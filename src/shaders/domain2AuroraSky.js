// Domain 2 aurora sky
export const vertexShader = `
            varying vec2 vUv;
            varying vec3 vPos;
            void main() { 
                vUv = uv; 
                vPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); 
            }
        `;
export const fragmentShader = `
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
        `;
