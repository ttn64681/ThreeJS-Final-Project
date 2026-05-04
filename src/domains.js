import * as THREE from 'three';

import {spawnBonePiles, warpTerrain, spawnSwords, spawnCrosses, generateBuildings} from './procedural.js';

// Single sphere geometry for the "Sky" (use .clone())
const baseGeometry = new THREE.SphereGeometry(1, 64, 64);
// Shared ground geometry (use .clone())
const groundGeometry = createGridCircleGeometry(0.98, 64);

// Shader constants to animate
export const globalUniforms = {
    u_time: { value: 0.0 },
    u_color: { value: new THREE.Color(0xffaaaa) },
    u_power: { value: 2.0 },  // higher = tighter rim
    u_intensity: { value: 2.0 }
};

// Problem w/ just a Circle Geo: it draws triangles from a single center vertex
// To fix, we need to create a square grid geo w/ multiple vertices.
function createGridCircleGeometry(radius, segments) {
    // Create square
    const size = radius * 2;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    // To create square grid
    const pos = geometry.attributes.position; // we manually add position points to create grid

    // Loop through every vertex on the square
    for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);

        // Measure how far vertex is from center (0,0)
        let distance = Math.sqrt(x * x + y * y);
        // If vertex is outside desired radius, squish it inward
        if (distance > radius) {
            x = (x / distance) * radius;
            y = (y / distance) * radius;
            pos.setXY(i, x, y);
        }
    }

    // Recompute vertex normals on the geometry w/ new position points set
    geometry.computeVertexNormals();
    return geometry;
}

function addLightGroundSky(group, color) {
    const ambient = new THREE.AmbientLight(color, 0.4);
    group.add(ambient);

    // Set distance to 0 for infinite range.
    // Set decay to 0 to stop physics engine from killing light when room scales
    const sun = new THREE.PointLight(color, 5.0, 0, 0);
    sun.position.set(0, 0.5, 0);
    sun.castShadow = false;
    group.add(sun);

    const groundMat = new THREE.MeshStandardMaterial({
        color: color,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        metalness: 0.1,
        roughness: 0.8
    });
    const ground = new THREE.Mesh(groundGeometry, groundMat);
    ground.rotation.x = -Math.PI / 2; // lay flat
    ground.position.y = -0.2; // slightly below center
    group.add(ground);

    return ground;
}

// ==========================================
// DOMAIN 1: MALEVOLENT SHRINE
// ==========================================
export function createDomain1() {
    const group = new THREE.Group();

    // Domain Shell/Surface/Sky + Shader
    const skyMat = new THREE.ShaderMaterial({
        uniforms: {
            u_time: globalUniforms.u_time,
            u_local_opacity: { value: 1.0 } // allows main.js to fade the shader
        },
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPos;
            
            void main() { 
                vUv = uv; 
                vPos = position; // position is point on sphere surface in local space
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); 
            }
        `,
        fragmentShader: `
            uniform float u_time;
            uniform float u_local_opacity;
            varying vec2 vUv;
            varying vec3 vPos;
            
            // ===============================================================
            // Random noise plotted using uv...
            // FLAWS:
            // 1. Scalar Interpolation: Blending raw numbers at grid corners creates visible "stair-step" 
            //  artifacts and harsh square grid boundaries.
            // 2. UV Seams: Using vUv.x directly causes a hard vertical line where 0.0 meets 1.0 on the sphere.
            // 3. Limited Smoothness: The 2D math doesn't account for the 3D curvature of the sphere geometry.
            // ===============================================================
            // float random(vec2 st) { 
            //     return fract(sin(dot(st.xy, vec2(12.0,78.0))) * 43758.0); 
            // }
            // float noise(vec2 st) {
            //     vec2 i = floor(st); 
            //     vec2 f = fract(st);
            //    
            //     float a = random(i); 
            //     float b = random(i + vec2(1.0, 0.0));
            //     float c = random(i + vec2(0.0, 1.0)); 
            //     float d = random(i + vec2(1.0, 1.0));
            //    
            //     vec2 u = f * f * (3.0 - 2.0 * f);
            //     return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            // }
            
            // ===============================================================
            // Random noise using 3D point...
            // FLAWS:
            // (essentially same prob w/ uv but for each cell -> harsh per-cell edges)
            // (we need Gradient Noise (interpolate vectors instead of points))
            // ===============================================================
            // Takes 3D point, returns 0-1
            // Works exactly like 2D noise but w/ 8 cube corners instead of 4 square corners
            // float random3(vec3 p) {
            //     return fract(sin(dot(p, vec3(127.1, 311.7, 74.4))) * 43758.5);
            // }
            // float noise3D(vec3 p) {
            //     vec3 i = floor(p);
            //     vec3 f = fract(p);
            //     f = f * f * (3.0 - 2.0 * f); // smoothstep
            //
            //     // 8 corners of the surrounding cube
            //     float n000 = random3(i);
            //     float n100 = random3(i + vec3(1,0,0));
            //     float n010 = random3(i + vec3(0,1,0));
            //     float n110 = random3(i + vec3(1,1,0));
            //     float n001 = random3(i + vec3(0,0,1));
            //     float n101 = random3(i + vec3(1,0,1));
            //     float n011 = random3(i + vec3(0,1,1));
            //     float n111 = random3(i + vec3(1,1,1));
            //
            //     // Trilinear interpolation
            //     return mix(
            //         mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
            //         mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
            //         f.z
            //     );
            // }
            
            // =========================================================================
            // PERLIN NOISE 3D (NEW IMPLEMENTATION)
            // FIXES: 
            // - Uses Gradient Vectors instead of scalars to eliminate harsh grid boundaries.
            // - Uses 3D "Cylinder Sampling" (cos/sin) to remove the vertical sphere seam.
            // - Implements Quintic Smoothing for organic, "smokey" transitions.
            // =========================================================================
            // Takes 3D point, returns random 3D unit vector
            vec3 random3(vec3 p) {
                p = vec3(dot(p, vec3(127.1, 311.7, 74.4)),
                         dot(p, vec3(269.5, 183.3, 246.1)),
                         dot(p, vec3(113.5, 271.9, 124.6)));
                // Return a random vec on sphere or just a random normalized vector
                return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
            }
            float noise3D(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                
                // Smoothstep interpolation (quintic: 6t^5 - 15t^4 + 10t^3) 
                vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
            
                // Calculate dot products for the 8 corners of the cube
                float n000 = dot(random3(i + vec3(0,0,0)), f - vec3(0,0,0));
                float n100 = dot(random3(i + vec3(1,0,0)), f - vec3(1,0,0));
                float n010 = dot(random3(i + vec3(0,1,0)), f - vec3(0,1,0));
                float n110 = dot(random3(i + vec3(1,1,0)), f - vec3(1,1,0));
                float n001 = dot(random3(i + vec3(0,0,1)), f - vec3(0,0,1));
                float n101 = dot(random3(i + vec3(1,0,1)), f - vec3(1,0,1));
                float n011 = dot(random3(i + vec3(0,1,1)), f - vec3(0,1,1));
                float n111 = dot(random3(i + vec3(1,1,1)), f - vec3(1,1,1));
            
                // Trilinear interpolation using the smooth weights (u)
                return mix(
                    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
                    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
                    u.z
                );
            }

            void main() {
                // Multiplying by higher num tiles the noise = smaller blotches
                // vPos on unit sphere ranges from -1 to 1 on each axis
                vec3 p = vPos * 4.0;
                float time = u_time * 15.0; // scroll speed
                
                // ===============================================================
                // Random noise plotted using uv...
                // ===============================================================
                // // multiplying by higher num tiles the noise = smaller blotches
                // vec2 UV = vUV * 14.0;
                // float time = u time * 15.0: // scroll speed
                //
                // // poleMask = 0.0 at poles (vUv.y=0 and vUv.y=1), = 1.0 at equator
                // // sin(0) = 0, sin(PI) = 0, sin(PI/2) = 1
                // // Used to suppress horizontal distortion at poles
                // float poleMask = sin(vUv.y * 3.14159265358979);
                //
                // // Animate by moving through 2D noise space over time
                // // Oscillation on x and y
                // // inside sin -> freg
                // // outside sin -> amp
                // UV.x += sin(uv.V * 2.0 + time * 0.2) * 0.5 * poleMask; // osc right/left
                // UV.y -= time * 0.15; // osc Up/down
                //
                // float n = noise(uv): // sample noise at curr uv (val of 0.0-1.0)
                // n += 0.5 * noise (UV * 2.0 - time * 0.3): // extra smaller noise features
                // n /= 1.5; // normalize to 0.0-1.0 range of noise
                
                // ===============================================================
                // Random noise using 3D point...
                // ===============================================================
                // // Animate by moving through 3D noise space over time
                //
                // // Warp sample point for swirling effect
                // // noise3D returns 0-1, subtract 0.5 to center at 0, then scale
                // // This displaces sample point, creating swirl w/o UV distortion
                // // p.x += sin(noise3D(p * 0.8 + time * 0.05) - 0.5) * 1.0;
                // p.x += sin(p.y * 2.0 + time * 0.2) * 0.5;
                // p.y -= time * 0.15; // flows upward
                //
                // float n = noise3D(p); // sample noise at curr uv (val of 0.0-1.0)
                // n += 0.5 * noise3D(p * 2.0 - time * 0.3); // extra smaller noise features
                // n /= 1.5; // normalize to 0.0-1.0 range of noise
                
                // =========================================================================
                // PERLIN NOISE 3D (NEW IMPLEMENTATION)
                // =========================================================================
                // Animate by moving through 3D vector noise space over time
                
                float horizonMask = pow(1.0 - abs(p.y), 1.5);
                // float horizonMask = sin(vUv.y * 3.141592 * 0.85 + 0.1);
                // horizonMask = clamp(horizonMask, 0.0, 1.0);

                // Warp sample point for organic motion
                // This displaces sample point, creating swirl w/o UV distortion
                // p.x += (noise3D(p * 0.8 + time * 0.05) - 0.5) * 1.0;
                p.x += sin(p.y * 2.0 + time * 0.2) * 0.5;
                p.y -= time * 0.15; // flows upward

                float n = noise3D(p); // sample noise at curr uv (val of -1.0-1.0)
                n += 0.5 * noise3D(p * 2.0 - time * 0.3); // extra smaller noise features
                
                n /= 1.5; // normalize to [1.0,1.0] range of noise
                n = n * 0.5 + 0.5; // normalize from [-1.0,1.0] to [0.0,1.0] range of noise
                
                vec3 darkBlood = vec3(0.1, 0.0, 0.0);
                vec3 brightRed = vec3(0.5, 0.05, 0.0);
                vec3 abyssBlack = vec3(0.0, 0.0, 0.02);
                
                // smoothstep(edge0, edge1, x):
                //   returns 0.0 when x < edge0
                //   returns 1.0 when x > edge1
                // first lerp from darkBlood -> brightRed
                vec3 color = mix(darkBlood, brightRed, smoothstep(0.3, 0.45, n)); // range determines softness/sharpness
                // then lerp from brightRed -> abyssBlack
                
                float brightness = smoothstep(0.4, 0.65, n); // how bright color is at this pixel
                color = mix(color, abyssBlack, brightness * 2.0) * horizonMask; 
                
                gl_FragColor = vec4(color, u_local_opacity); 
            }
        `
    });
    const sky = new THREE.Mesh(baseGeometry, skyMat)
    sky.name = "Sky";

    group.add(sky);

    const ambient = new THREE.AmbientLight(0xffaaaa, 0.3);
    group.add(ambient);

    // Water for ground + Shader
    // const waterGeo = createGridCircleGeometry(0.98, 128);

    // Water reflective shader material
    const waterMat = new THREE.MeshStandardMaterial({
        color: 0xff2222, // bright red
        metalness: 0.9,  // super shiny
        roughness: 0.0,  // very smooth for sharp reflections
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    // for compilation optimization
    waterMat.customProgramCacheKey = function() { return 'water_shader'; }; //

    // Hijack shader to add ripples to the original three.js prebuilt shader on water material
    // this prevents me from needing to write my own custom reflection shader.
    // basically adding a shader in between the prebuilt three js shader that exists w/in every object material
    // im adding the vertex deformation shader ON TOP of the existing fragment shader
    waterMat.onBeforeCompile = (shader) => {
        shader.uniforms.u_time = globalUniforms.u_time;

        // safely inject after the #version and common chunks
        shader.vertexShader = shader.vertexShader.replace(
            `#include <common>`,
            `
            #include <common>
            uniform float u_time;
            `
        );

        shader.vertexShader = shader.vertexShader.replace(
            `#include <begin_vertex>`,
            `
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
            `
        );

        shader.vertexShader = shader.vertexShader.replace(
            `#include <beginnormal_vertex>`,
            `
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
            `
        );
    };

    const ground = new THREE.Mesh(groundGeometry, waterMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    group.add(ground);

    const sunLight1 = new THREE.PointLight(0xaa55ff, 3.0, 0, 0);
    sunLight1.position.set(0.5, 0.5, 0);
    sunLight1.castShadow = false
    // sunLight1.target.position.set(0.0, 0.0, 0);
    group.add(sunLight1, sunLight1.target);

    const sunLight2 = new THREE.PointLight(0xff27aa, 3.0, 0, 0);
    sunLight2.position.set(-0.5, 0.5, 0);
    sunLight2.castShadow = false;
    // sunLight2.target.position.set(0.0, 0.0, 0);
    group.add(sunLight2, sunLight2.target);

    // Moon body
    const moonGeo = new THREE.SphereGeometry(0.08, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.8,
        metalness: 0.1,
        emissive: 0x000000,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(0.0, 0.7, 0);
    group.add(moon);

    // Rim glow - slightly larger sphere rendered from inside
    // w/ fresnel shader that's bright at edges, dark in center
    const rimGeo = new THREE.SphereGeometry(0.085, 32, 32);
    const rimMat = new THREE.ShaderMaterial({
        uniforms: {
            u_color: globalUniforms.u_color,
            u_power: globalUniforms.u_power, // higher = tighter rim
            u_intensity: globalUniforms.u_intensity
        },
        side: THREE.BackSide, // render inside of sphere = rim appears around outside
        transparent: true,
        depthWrite: false,
        vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
            // Normal in view space
            vNormal = normalize(normalMatrix * normal);
            // Direction from vertex to camera in view space
            vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
            vViewDir = normalize(-viewPos.xyz);
            gl_Position = projectionMatrix * viewPos;
        }
    `,
        fragmentShader: `
        uniform vec3 u_color;
        uniform float u_power;
        uniform float u_intensity;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
            // Fresnel: dot of normal and view direction
            // When looking straight at surface: dot = 1 -> rim = 0 (dark center)
            // When looking at edge (grazing): dot = 0 -> rim = 1 (bright rim)
            float fresnel = 1.0 - abs(dot(vNormal, vViewDir));

            // Power controls tightness: pow(fresnel, 3) = tight bright ring
            // pow(fresnel, 1) = glow spreads far inward
            float rim = pow(fresnel, u_power) * u_intensity;

            gl_FragColor = vec4(u_color * rim, rim);
        }
    `
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.copy(moon.position);
    group.add(rimMesh);

    // Procedural
    spawnBonePiles(group, ground, 50);

    group.userData = { id: 'domain1', name: 'Malevolent Shrine' };
    return group;
}

// ==========================================
// DOMAIN 2: MUTUAL AUTHENTIC LOVE
// ==========================================
export function createDomain2() {
    const group = new THREE.Group();

    // Green Sky Shader
    const skyMat = new THREE.ShaderMaterial({
        uniforms: {
            u_time: globalUniforms.u_time,
            u_local_opacity: { value: 1.0 }
        },
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPos;
            void main() { 
                vUv = uv; 
                vPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); 
            }
        `,
        fragmentShader: `
            uniform float u_time;
            uniform float u_local_opacity;
            varying vec2 vUv; // (u,v) across the sphere surface
            varying vec3 vPos;
            
            // ===============================================================
            // Random noise plotted using uv...
            // FLAWS:
            // 1. Scalar Interpolation: Blending raw numbers at grid corners creates visible "stair-step" 
            //  artifacts and harsh square grid boundaries.
            // 2. UV Seams: Using vUv.x directly causes a hard vertical line where 0.0 meets 1.0 on the sphere.
            // 3. Limited Smoothness: The 2D math doesn't account for the 3D curvature of the sphere geometry.
            // ===============================================================
            // float random(vec2 st) { 
            //     return fract(sin(dot(st.xy, vec2(12.0,78.0))) * 43758.0); 
            // }
            // float noise(vec2 st) {
            //     vec2 i = floor(st); // which grid cell are we in?
            //     vec2 f = fract(st); // where w/in that cell are we? (0,0)-(1,1)
            //    
            //     float a = random(i);                  // bottom-left corner
            //     float b = random(i + vec2(1.0, 0.0)); // bottom-right corner
            //     float c = random(i + vec2(0.0, 1.0)); // top-left corner
            //     float d = random(i + vec2(1.0, 1.0)); // top-right corner
            //    
            //     vec2 u = f * f * (3.0 - 2.0 * f);     // smoothstep curve
            //     return mix(a, b, u.x)                 // interpolate bottom edge
            //          + (c - a) * u.y * (1.0 - u.x)    // blend in top-left
            //          + (d - b) * u.x * u.y;           // blend in top-right
            // }
            
            // =========================================================================
            // PERLIN NOISE 3D (NEW IMPLEMENTATION)
            // FIXES: 
            // - Uses Gradient Vectors instead of scalars to eliminate harsh grid boundaries.
            // - Uses 3D "Cylinder Sampling" (cos/sin) to remove the vertical sphere seam.
            // - Implements Quintic Smoothing for organic, "smokey" transitions.
            // =========================================================================
            // Takes 3D point, returns random 3D unit vector
            vec3 random3(vec3 p) {
                p = vec3(dot(p, vec3(127.1, 311.7, 74.4)),
                         dot(p, vec3(269.5, 183.3, 246.1)),
                         dot(p, vec3(113.5, 271.9, 124.6)));
                // Return a random vec on sphere or just a random normalized vector
                return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
            }
            float noise3D(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                
                // Smoothstep interpolation (quintic: 6t^5 - 15t^4 + 10t^3) 
                vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
            
                // Calc dot products for the 8 corners of the cube
                float n000 = dot(random3(i + vec3(0,0,0)), f - vec3(0,0,0));
                float n100 = dot(random3(i + vec3(1,0,0)), f - vec3(1,0,0));
                float n010 = dot(random3(i + vec3(0,1,0)), f - vec3(0,1,0));
                float n110 = dot(random3(i + vec3(1,1,0)), f - vec3(1,1,0));
                float n001 = dot(random3(i + vec3(0,0,1)), f - vec3(0,0,1));
                float n101 = dot(random3(i + vec3(1,0,1)), f - vec3(1,0,1));
                float n011 = dot(random3(i + vec3(0,1,1)), f - vec3(0,1,1));
                float n111 = dot(random3(i + vec3(1,1,1)), f - vec3(1,1,1));
            
                // Trilinear interpolation using the smooth weights (u)
                return mix(
                    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
                    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
                    u.z
                );
            }

            void main() {
                float time = u_time * 2.0;
            
                // Convert horizontal UV to a circle (0 to 2PI) to remove vertical seam
                float angle = vUv.x * 6.28318;
                
                // Fade aurora out at top/bottom poles based on 3D height, leaving only 'horizon'
                float horizonMask = pow(1.0 - abs(vPos.y), 2.0);
                // Used to untwist the top/bottom poles
                float poleMask = sin(vUv.y * 3.14159);
                
                // control horizontal drift and osc of the bands
                float distortX = angle - time * 0.1; 
                distortX += sin(vUv.y * 5.0 + time * 2.0) * 0.5 * poleMask;
                
                // stretches noise vertically to create long aurora strips (kinda)
                float distortY = vUv.y * 2.0 - time * 0.2;
                
                // The 3D coord sampled. cos/sin makes the X-axis wrap seamlessly.
                vec3 noiseCtx = vec3(cos(distortX), distortY, sin(distortX));
                
                // Scale: higher num -> skinny bands/strips.
                noiseCtx *= 1.5; 
                
                // Displaces noise w/ itself (makes it seem more contained tbh)
                float warpStrength = sin(time * 0.3) * 0.3;
                noiseCtx += noise3D(noiseCtx + time * 0.1) * warpStrength;
                
                // fBm (Fractal Brownian Motion): Adding layers of detail at increasing frequencies
                // n represents intensity of pixel
                float n = noise3D(noiseCtx);
                n += 0.5 * noise3D(noiseCtx * 2.0 + time * 0.4);
                n += 0.25 * noise3D(noiseCtx * 4.0 - time * 0.1);
                
                // Normalization: Map Perlin noise range [-1.75, 1.75] to [0.0, 1.0]
                n = (n / 1.75) * 0.5 + 0.5; 
                
                // Contrast Adjust: smoothstep(0, 0.9) forces more vibrant colors into the peaks
                n = smoothstep(0.1, 0.85, n); 
                
                vec3 nightSky = vec3(0.02, 0.05, 0.1);
                vec3 auroraGreen = vec3(0.1, 0.9, 0.4); 
                vec3 auroraBlue = vec3(0.1, 0.4, 0.9);
                vec3 auroraPink = vec3(0.8, 0.2, 0.6);
                
                // Color Layering: Green -> Blue at 0.5, Blue -> Pink at 0.7
                vec3 colorMix = mix(auroraGreen, auroraBlue, smoothstep(0.5, 0.8, n));
                colorMix = mix(colorMix, auroraPink, smoothstep(0.7, 0.9, n));
                
                // Final Brightness: Masked by poles to show only horizon
                float brightness = smoothstep(0.35, 0.7, n);
                
                vec3 finalColor = mix(nightSky, colorMix, brightness * 2.0) * horizonMask;
                
                gl_FragColor = vec4(finalColor, u_local_opacity);
            }
        `
    });
    const sky = new THREE.Mesh(baseGeometry, skyMat)
    sky.name = "Sky";

    group.add(sky);

    // Ground and Lights
    const rockyGeo = groundGeometry.clone();
    const rockMat = new THREE.MeshStandardMaterial({
        color: 0x334433, roughness: 0.9, transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(rockyGeo, rockMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    ground.receiveShadow = false;
    warpTerrain(ground); // We warp via CPU to use Raycaster to spawn points randomly
    group.add(ground);

    const sun = new THREE.DirectionalLight(0x00ff88, 5.0);
    sun.position.set(0, 0.5, 0);
    sun.castShadow = false;
    group.add(sun);

    const crossGroup = new THREE.Group();
    group.add(crossGroup);
    // Procedural
    spawnCrosses(crossGroup, ground, 25)
    spawnSwords(group, ground, crossGroup, 150);

    group.userData = { id: 'domain2', name: 'Mutual Authentic Love' };
    return group;
}

// TODO: Sidhant
// ==========================================
// DOMAIN 3:
// ==========================================
export function createDomain3() {
    const material = new THREE.MeshStandardMaterial({
        color: 0x00ff00, // green
        side: THREE.BackSide,
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
    });
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(baseGeometry, material);
    group.add(mesh);

    addLightGroundSky(group, 0x00ff00);

    generateBuildings(group, 500);

    group.userData = { id: 'domain3', name: 'Hurtbreak Wonderland' };
    return group;
}

// TODO: Sidhant
// ==========================================
// DOMAIN 4:
// ==========================================
export function createDomain4() {
    const material = new THREE.MeshStandardMaterial({
        color: 0xcccccc, // silver
        side: THREE.BackSide,
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
    });
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(baseGeometry, material);
    group.add(mesh);

    addLightGroundSky(group, 0xcccccc);

    group.userData = { id: 'domain4', name: 'Domain 4' };
    return group;
}
