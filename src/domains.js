import * as THREE from 'three';

import { warpTerrain, spawnSwords, spawnCrosses, generateBuildings } from './procedural.js';

// Single sphere geometry for the "Sky" (use .clone())
const baseGeometry = new THREE.SphereGeometry(1, 64, 64);
// Shared ground geometry (use .clone())
const groundGeometry = createGridCircleGeometry(0.98, 64);

// Shader constants to animate
export const globalUniforms = {
    u_time: { value: 0.0 }
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
    group.add(sun);

    const groundMat = new THREE.MeshStandardMaterial({
        color: color,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        metalness: 0.1,
        roughness: 0.8
    });
    const ground = new THREE.Mesh(groundGeometry.clone(), groundMat);
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
            void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: `
            uniform float u_time;
            uniform float u_local_opacity;
            varying vec2 vUv;

            float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
            
            float noise(vec2 st) {
                vec2 i = floor(st); vec2 f = fract(st);
                float a = random(i); float b = random(i + vec2(1.0, 0.0));
                float c = random(i + vec2(0.0, 1.0)); float d = random(i + vec2(1.0, 1.0));
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }

            void main() {
                vec2 uv = vUv * 4.0; 
                float time = u_time * 15.0; 
                
                // Pole mask to prevent twisting at top and bottom of domain sphere!
                float poleMask = sin(vUv.y * 3.14159);
                
                // Multiply the X distortion by the mask
                uv.x += sin(uv.y * 2.0 + time * 0.2) * 0.5 * poleMask;
                uv.y -= time * 0.15; 
                
                float n = noise(uv);
                n += 0.5 * noise(uv * 2.0 - time * 0.3);
                n = n / 1.5; 
                
                vec3 darkBlood = vec3(0.1, 0.0, 0.0);
                vec3 brightRed = vec3(0.9, 0.05, 0.0);
                vec3 abyssBlack = vec3(0.0);
                
                vec3 color = mix(darkBlood, brightRed, smoothstep(0.2, 0.8, n));
                color = mix(color, abyssBlack, smoothstep(0.65, 0.85, n)); 
                
                gl_FragColor = vec4(color, u_local_opacity); 
            }
        `
    });
    const sky = new THREE.Mesh(baseGeometry.clone(), skyMat)
    sky.name = "Sky";

    group.add(sky);

    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    group.add(ambient);

    // Water for ground + Shader
    const waterGeo = createGridCircleGeometry(0.98, 128);

    // Water reflective shader material
    const waterMat = new THREE.MeshStandardMaterial({
        color: 0xff2200, // bright red
        metalness: 0.9,  // super shiny
        roughness: 0.1,  // very smooth for sharp reflections
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    // for compilation optimization
    waterMat.customProgramCacheKey = function() { return 'water_shader'; }; //

    // Hijack shader to add ripples to the original three.js prebuilt shader on water material
    // this prevents me from needing to write my own custom reflection shader.
    // basically adding a shader in between the prebuilt three js shader that exists w/in every object material
    // im adding the vertex deformation shader. ON TOP of the existing fragment shader
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
            #include <begin_vertex>
            float dist = length(position.xy); 
            float time = u_time * 80.0; 
            transformed.z += sin(dist * 25.0 - time) * 0.01;
            `
            // transformed.z is the waves
        );

        shader.vertexShader = shader.vertexShader.replace(
            `#include <beginnormal_vertex>`,
            `
            #include <beginnormal_vertex>
            float distN = length(position.xy);
            float timeN = u_time * 80.0;
            
            float slope = cos(distN * 25.0 - timeN) * 0.6;
            
            vec2 dir = position.xy;
            float len = length(dir);
            if (len > 0.0) {
                dir /= len; 
                objectNormal.x -= dir.x * slope;
                objectNormal.y -= dir.y * slope;
            }
            objectNormal = normalize(objectNormal);
            `
        );
    };

    // const waterMat = new THREE.MeshBasicMaterial({
    //         color: 0xffffff, // Pure white, ignores all lighting
    //         transparent: true,
    //         depthWrite: false,
    //         side: THREE.DoubleSide
    //     });

    const ground = new THREE.Mesh(groundGeometry.clone(), waterMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    group.add(ground);

    const sunLight = new THREE.PointLight(0xff5500, 3.0, 0, 0);
    sunLight.position.set(0, 0.5, 0);
    group.add(sunLight);

    const bulbGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.copy(sunLight.position);
    group.add(bulb);

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
            void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: `
            uniform float u_time;
            uniform float u_local_opacity;
            varying vec2 vUv;

            float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
            float noise(vec2 st) {
                vec2 i = floor(st); vec2 f = fract(st);
                float a = random(i); float b = random(i + vec2(1.0, 0.0));
                float c = random(i + vec2(0.0, 1.0)); float d = random(i + vec2(1.0, 1.0));
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }

            void main() {
                vec2 uv = vUv;
                float time = u_time * 2.0;
                
                // Pole Mask to fix twisting at the top and bottom of domain sphere
                float poleMask = sin(vUv.y * 3.14159);

                vec2 noiseScale = vec2(8.0, 2.0);
                
                // stop the X-axis twisting at  poles
                float distortX = uv.x * noiseScale.x - time * 0.5;
                distortX += sin(uv.y * 5.0 + time) * 0.5 * poleMask; 
                
                vec2 drift = vec2(distortX, uv.y * noiseScale.y - time * 0.2);
                
                float n = noise(drift);
                n += 0.5 * noise(drift * 2.0 + time * 0.4);
                n += 0.25 * noise(drift * 4.0 - time * 0.1);
                n = n / 1.75; 
                
                float intensity = smoothstep(0.4, 0.7, n) * pow(poleMask, 2.0);
                
                vec3 nightSky = vec3(0.02, 0.05, 0.1);
                vec3 auroraGreen = vec3(0.1, 0.9, 0.4); 
                vec3 auroraBlue = vec3(0.1, 0.4, 0.9);
                vec3 auroraPink = vec3(0.8, 0.2, 0.6);
                
                vec3 colorMix = mix(auroraGreen, auroraBlue, smoothstep(0.5, 0.8, n));
                colorMix = mix(colorMix, auroraPink, smoothstep(0.7, 0.9, n));
                
                vec3 finalColor = mix(nightSky, colorMix, intensity * 2.0);
                
                gl_FragColor = vec4(finalColor, u_local_opacity);
            }
        `
    });
    const sky = new THREE.Mesh(baseGeometry.clone(), skyMat)
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
    warpTerrain(ground);
    group.add(ground);

    const sun = new THREE.PointLight(0x00ff88, 5.0, 0, 0);
    sun.position.set(0, 0.5, 0);
    group.add(sun);

    // Procedural
    spawnSwords(group, ground, 150);
    spawnCrosses(group, ground, 25)

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
