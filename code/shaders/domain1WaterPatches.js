// Injected into MeshStandardMaterial for domain1 water via onBeforeCompile (see domains.js waterMat).
// Three replace() targets: #include <common>, <begin_vertex>, <beginnormal_vertex>.
export const injectCommon = `
            #include <common>
            uniform float u_time;
            `;

export const injectBeginVertex = `
            #include <begin_vertex> // displacement (height of water surface)
            float dist = length(position.xy); // distance from center (0=center, 0.98=edge)
            float time = u_time * 80.0; // how fast the wave propagates outward
            
            // float freq = mix(40.0, 10.0, dist);
            // float pulse = mix(0.0, sin(time * 0.5) * 2.0, sin(dist*time*0.1));
            // transformed.z += sin(dist * 50.0 - time) * 0.01; // transformed.z is the waves
            
            float wave1 = sin(dist * 60.0 - time) * 0.004;
            float wave2 = sin(dist * 40.0 - time * 0.7 + 1.5) * 0.002; // offset phase
            float centerFade = smoothstep(0.0, 0.1, dist); 
            transformed.z += (wave1 + wave2) * centerFade;
            `;

export const injectBeginNormal = `
            #include <beginnormal_vertex>
            float distN = length(position.xy);
            float timeN = u_time * 80.0;
            
            // float slope = cos(distN * 50.0 - timeN) * 0.6;
            
            float slope = cos(distN * 60.0 - timeN) * 60.0 * 0.004
                        + cos(distN * 40.0 - timeN * 0.7 + 1.5) * 40.0 * 0.002;
            
            vec2 dir = position.xy;
            float len = length(dir);
            if (len > 0.0) {
                dir /= len; 
                // Displace normal away from the wave slope
                objectNormal.x -= dir.x * slope;
                objectNormal.y -= dir.y * slope;
            }
            objectNormal = normalize(objectNormal);
            `;
