// Domain 1 sky dome (Malevolent Shrine). Imported by code/js/domains.js createDomain1.
export const vertexShader = `
            varying vec2 vUv;
            varying vec3 vPos;
            
            void main() { 
                vUv = uv; 
                vPos = position; // position is point on sphere surface in local space
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); 
            }
        `;
export const fragmentShader = `
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
        `;
