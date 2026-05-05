// Moon rim fresnel
export const vertexShader = `
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
    `;
export const fragmentShader = `
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
    `;
