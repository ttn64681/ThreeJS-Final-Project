// Fullscreen intro quad (explosion + warp). Imported by code/js/main.js.
export const introOverlayVertex = `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
    `;
export const introOverlayFragment = `
        uniform float u_progress; 
        uniform float u_time;
        varying vec2 vUv;

        void main() {
            vec2 center = vUv - 0.5; 
            float dist = length(center);

            // Spiky explosion
            float angle = atan(center.y, center.x);
            float spikes = sin(angle * 20.0 + u_time * 20.0);
            
            // Expands outward rapidly
            float core = smoothstep(0.8 * u_progress * spikes, 0.0, dist + (spikes * 0.9));

            // Color phase (white -> red/orange -> dark red)
            vec3 white = vec3(1.0, 1.0, 1.0);
            vec3 red = vec3(1.0, 0.3, 0.0);
            vec3 darkRed = vec3(0.4, 0.0, 0.0);

            // Transition from white to red at 30% progress, then red to dark red at 40%
            vec3 colorMix = mix(white, red, smoothstep(0.0, 0.4, u_progress));
            colorMix = mix(colorMix, darkRed, smoothstep(0.35, 0.6, u_progress));

            // Combine and Fade Out
            vec3 finalColor = colorMix * core;
            
            // Fade entire effect to completely transparent as progress hits 1.0
            float fadeOut = 1.0 - smoothstep(0.7, 1.0, u_progress);
            float finalAlpha = core * fadeOut;

            gl_FragColor = vec4(finalColor, finalAlpha);
        }
    `;
