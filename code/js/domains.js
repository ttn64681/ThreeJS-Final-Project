import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';              // load 3D models
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'; // decode meshopt encoded models

import {
    spawnBonePiles,
    warpTerrain,
    spawnSwords,
    spawnCrosses,
    generateBuildings,
    generateDoors
} from './procedural.js'; // procedural mesh generation funcs 

// Shader strings
import { vertexShader as domain1SkyVertex, fragmentShader as domain1SkyFragment } from '../shaders/domain1Sky.js';
import { vertexShader as moonRimVertex, fragmentShader as moonRimFragment } from '../shaders/moonRim.js';
// import { vertexShader as domain3CloudVertex, fragmentShader as domain3CloudFragment } from '../shaders/domain3Cloud.js';
import { vertexShader as domain2SkyVertex, fragmentShader as domain2SkyFragment } from '../shaders/domain2AuroraSky.js';
import { injectCommon as waterInjectCommon, injectBeginVertex as waterInjectBeginVertex, injectBeginNormal as waterInjectBeginNormal } from '../shaders/domain1WaterPatches.js';

import { getPerf } from './perfSettings.js'; // performance settings parameters 

const perf = getPerf();

// Shared geometries
const baseGeometry = new THREE.SphereGeometry(1, perf.skySegments, perf.skySegments);
const groundGeometry = createGridCircleGeometry(0.98, perf.groundSegments);

// Domain 3 global vars (shared road material)
const texLoader = new THREE.TextureLoader();
const roadTex = texLoader.load('assets/road-texture.png');
roadTex.wrapS = THREE.RepeatWrapping;
roadTex.wrapT = THREE.RepeatWrapping;
roadTex.repeat.set(20, 20);
const roadShellMaterial = new THREE.MeshBasicMaterial({
    //color: 0x828282, // beige
    side: THREE.BackSide,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    map: roadTex,
});

// Shader constants to animate
export const globalUniforms = {
    u_time: { value: 0.0 },
    u_color: { value: new THREE.Color(0xffaaaa) },
    u_power: { value: 2.0 },  // moon fresnel shader params; higher = tighter rim
    u_intensity: { value: 2.0 }
};

// Problem w/ just Circle Geo: it draws triangles from a single center vertex
// To fix, need to create a square grid geo w/ multiple vertices.
function createGridCircleGeometry(radius, segments) {
    // Create square
    const size = radius * 2;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    // To create square grid
    const pos = geometry.attributes.position; // manually add position points to create grid

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

// function addLightGroundSky(group, color) {
//     const ambient = new THREE.AmbientLight(color, 0.4);
//     group.add(ambient);

//     // Set distance to 0 for infinite range.
//     // Set decay to 0 to stop physics engine from killing light when room scales
//     // distance/decay overridden each frame in applyDomainScales from shell scale; defaults avoid infinite reach.
//     const sun = new THREE.PointLight(color, 5.0, 1, 2);
//     sun.position.set(0, 0.5, 0);
//     sun.castShadow = false;
//     group.add(sun);

//     const groundMat = new THREE.MeshStandardMaterial({
//         color: color,
//         transparent: true,
//         depthWrite: false,
//         side: THREE.DoubleSide,
//         metalness: 0.1,
//         roughness: 0.8
//     });
//     const ground = new THREE.Mesh(groundGeometry, groundMat);
//     ground.rotation.x = -Math.PI / 2; // lay flat
//     ground.position.y = -0.2; // slightly below center
//     group.add(ground);

//     return ground;
// }

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
        vertexShader: domain1SkyVertex,
        fragmentShader: domain1SkyFragment
    });
    const sky = new THREE.Mesh(baseGeometry, skyMat)
    sky.name = "Sky";

    group.add(sky);

    const ambient = new THREE.AmbientLight(0xffaaaa, 0.3);
    group.add(ambient);

    // Water reflective shader material
    const waterMat = new THREE.MeshStandardMaterial({
        color: 0xff2222, // bright red
        metalness: 0.9,  // super shiny
        roughness: 0.0,  // very smooth for sharp reflections
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    // for compilation optimization (idk I'm grasping at straws here)
    waterMat.customProgramCacheKey = function() { return 'water_shader'; };

    // Hijack shader to add ripples to the original three.js prebuilt shader on water material
    // this prevents me from needing to write my own custom reflection shader.
    // basically adding a shader in between the prebuilt three js shader that exists w/in every object material
    // I'm adding the vertex deformation shader ON TOP of the existing fragment shader.
    waterMat.onBeforeCompile = (shader) => {
        shader.uniforms.u_time = globalUniforms.u_time;

        // safely inject after the #version and common chunks
        shader.vertexShader = shader.vertexShader.replace(
            `#include <common>`,
            waterInjectCommon
        );

        shader.vertexShader = shader.vertexShader.replace(
            `#include <begin_vertex>`,
            waterInjectBeginVertex
        );

        shader.vertexShader = shader.vertexShader.replace(
            `#include <beginnormal_vertex>`,
            waterInjectBeginNormal
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

    const sunLight2 = new THREE.PointLight(0xff27aa, 3.0, 1, 2);
    sunLight2.position.set(-0.5, 0.5, 0);
    sunLight2.castShadow = false;
    // sunLight2.target.position.set(0.0, 0.0, 0);
    group.add(sunLight2, sunLight2.target);

    // const helper1 = new THREE.PointLightHelper(sunLight1, 0.2);
    // const helper2 = new THREE.PointLightHelper(sunLight2, 0.2);
    // helper1.userData.isLightHelperGizmo = true;
    // helper2.userData.isLightHelperGizmo = true;
    // group.add(helper1, helper2);

    // Load shrine model
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const shrine = new THREE.Group();
    shrine.position.set(0, -0.18, -0.6);
    group.add(shrine);
    /**
     * This work is based on "Malevolent Shrine | Jujutsu Kaisen"
     * (https://sketchfab.com/3d-models/malevolent-shrine-jujutsu-kaisen-efcf94d9cf03434db7b0978144b500b6)
     * by NexusB (https://sketchfab.com/NexusB) licensed under
     * CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
     */
    loader.load('./assets/shrine.glb', (gltf) => {
        const shrineModel = gltf.scene;
        shrineModel.scale.set(1.3, 1.3, 1.3);
        shrine.add(shrineModel);
    });

    // Moon body
    const moonGeo = new THREE.SphereGeometry(0.08, perf.moonSegments, perf.moonSegments);
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
    const rimGeo = new THREE.SphereGeometry(0.085, perf.moonSegments, perf.moonSegments);
    const rimMat = new THREE.ShaderMaterial({
        uniforms: {
            u_color: globalUniforms.u_color,
            u_power: globalUniforms.u_power, // higher = tighter rim
            u_intensity: globalUniforms.u_intensity
        },
        side: THREE.BackSide, // render inside of sphere = rim appears around outside
        transparent: true,
        depthWrite: false,
        vertexShader: moonRimVertex,
        fragmentShader: moonRimFragment
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.copy(moon.position);
    group.add(rimMesh);

    // Procedural
    spawnBonePiles(group, ground, perf.bonePiles);

    // Export Moon and RimMesh to control fresnel + intensity via main.js lil-gui
    // group.userData = { id: 'domain1', name: 'Malevolent Shrine', helper1: helper1, helper2: helper2 };
    group.userData = { id: 'domain1', name: 'Malevolent Shrine', creator: 'Thai' };
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
        vertexShader: domain2SkyVertex,
        fragmentShader: domain2SkyFragment
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

    const sunLight = new THREE.DirectionalLight(0x00ff88, 1.85);
    sunLight.position.set(0, 0.5, 0);
    sunLight.castShadow = false;
    group.add(sunLight);

    // const helper = new THREE.DirectionalLightHelper(sunLight, 0.2);
    // helper.userData.isLightHelperGizmo = true;
    // group.add(helper);

    const crossGroup = new THREE.Group();
    group.add(crossGroup);
    // Procedural
    spawnCrosses(crossGroup, ground, perf.crosses);
    spawnSwords(group, ground, crossGroup, perf.swords);

    // group.userData = { id: 'domain2', name: 'Mutual Authentic Love', helper: helper };
    group.userData = { id: 'domain2', name: 'Mutual Authentic Love', creator: 'Thai'};
    return group;
}

// TODO: Sidhant
// ==========================================
// DOMAIN 3: HURTBREAK WONDERLAND
// ==========================================
export function createDomain3() {
    // material.onBeforeCompile = (shader) => {
    //     shader.uniforms.uFogColor = { value: new THREE.Color(0xffdd88) };
    //     shader.uniforms.uFogNear = { value: 0.2 };
    //     shader.uniforms.uFogFar = { value: 1.2 };
    //
    //     shader.fragmentShader = shader.fragmentShader.replace(
    //         `#include <dithering_fragment>`,
    //         `
    //         // distance from camera
    //         float depth = gl_FragCoord.z / gl_FragCoord.w;
    //
    //         float fogFactor = smoothstep(uFogNear, uFogFar, depth);
    //
    //         gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, fogFactor);
    //
    //         #include <dithering_fragment>
    //         `
    //     );
    // };

    const group = new THREE.Group();
    const mesh = new THREE.Mesh(baseGeometry, roadShellMaterial);
    group.add(mesh);

    // const fogGeo2 = new THREE.SphereGeometry(1, 48, 48);
    // const fogMat2 = new THREE.ShaderMaterial({
    //     uniforms: {
    //         u_time: globalUniforms.u_time,
    //         u_local_opacity: { value: 1.0 } // allows main.js to fade the shader
    //     },
    //     side: THREE.BackSide,
    //     transparent: true,
    //     depthWrite: false,
    //     vertexShader: domain3CloudVertex,
    //     fragmentShader: domain3CloudFragment,
    // });
    // const fog4 = new THREE.Mesh(fogGeo2, fogMat2);
    // group.add(fog4);


    const coreLight = new THREE.PointLight(0xffdd55, 50.0, 1, 2);
    group.add(coreLight);
    coreLight.position.set(0.0, 0.2, -0.9);


    for (let i = 0; i < 8; i++) {
        const otherLight = new THREE.PointLight(0xffdd55, 3.0, 1, 2);

        const radius = 5;
        const angle = (i / 8) * Math.PI * 2;

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        group.add(otherLight);
        otherLight.position.set(x * 0.1, z * 0.1, -0.2);
    }

    const backLight = new THREE.PointLight(0xffdd55, 1.0, 1, 2);
    group.add(backLight);
    backLight.position.set(0.0, -0.2, 0.8);

    // const fogGeo = new THREE.SphereGeometry(0.75, 64, 64); // smaller than sky
    // // const fogMat = new THREE.MeshStandardMaterial({
    // //     side: THREE.BackSide,
    // //     transparent: true,
    // //     opacity: 0.3,
    // //     softnoise: true,
    // // });

    // const fogMat = new THREE.ShaderMaterial({
    //     uniforms: {
    //         u_time: globalUniforms.u_time,
    //         u_local_opacity: { value: 1.0 }
    //     },
    //     side: THREE.BackSide,
    //     transparent: true,
    //     depthWrite: false,
    //     depthTest: true,
    //     //opacity: 0.7,
    //     vertexShader: `
    //         varying vec3 vPos;
    //         void main() {
    //             vPos = position;
    //             gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    //         }
    //     `,
    //     fragmentShader: `
    //         uniform float u_time;
    //         varying vec3 vPos;
            
    //         float noise3D(vec3 p);
            
    //         vec3 random3(vec3 p) {
    //             p = vec3(dot(p, vec3(127.1, 311.7, 74.4)),
    //                      dot(p, vec3(269.5, 183.3, 246.1)),
    //                      dot(p, vec3(113.5, 271.9, 124.6)));
    //             // Return a random vec on sphere or just a random normalized vector
    //             return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    //         }
    //         float noise3D(vec3 p) {
    //             vec3 i = floor(p);
    //             vec3 f = fract(p);
                
    //             // Smoothstep interpolation (quintic: 6t^5 - 15t^4 + 10t^3) 
    //             vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
            
    //             // Calc dot products for the 8 corners of the cube
    //             float n000 = dot(random3(i + vec3(0,0,0)), f - vec3(0,0,0));
    //             float n100 = dot(random3(i + vec3(1,0,0)), f - vec3(1,0,0));
    //             float n010 = dot(random3(i + vec3(0,1,0)), f - vec3(0,1,0));
    //             float n110 = dot(random3(i + vec3(1,1,0)), f - vec3(1,1,0));
    //             float n001 = dot(random3(i + vec3(0,0,1)), f - vec3(0,0,1));
    //             float n101 = dot(random3(i + vec3(1,0,1)), f - vec3(1,0,1));
    //             float n011 = dot(random3(i + vec3(0,1,1)), f - vec3(0,1,1));
    //             float n111 = dot(random3(i + vec3(1,1,1)), f - vec3(1,1,1));
            
    //             // Trilinear interpolation using the smooth weights (u)
    //             return mix(
    //                 mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    //                 mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    //                 u.z
    //             );
    //         }
            
    //         void main() {
    //             vec3 p = vPos * 2.0;
            
    //             float time = u_time * 0.2;
            
    //             // slow drifting
    //             p.y -= time;
            
    //             float n = noise3D(p);
    //             n += 0.5 * noise3D(p * 2.0);
    //             n /= 1.5;
            
    //             // normalize
    //             n = n * 0.5 + 0.5;
            
    //             // soften it heavily
    //             float fog = smoothstep(0.4, 0.7, n);
            
    //             // fade top/bottom so it "hovers"
    //             float heightMask = smoothstep(-0.2, 0.3, vPos.y);
            
    //             float alpha = fog * heightMask * 0.7;
            
    //             vec3 color = vec3(0.4, 0.4, 0.5);
            
    //             gl_FragColor = vec4(color, alpha);
    //         }
    //     `
    // });

    // const fog1 = new THREE.Mesh(fogGeo, fogMat);
    // fog1.position.set(0.0, -0.2, 0.0);
    // group.add(fog1);
    //
    // const fog2 = new THREE.Mesh(fogGeo, fogMat);
    // fog2.position.set(0.0, -0.2, 0.0);
    // fog2.scale.set(0.9, 0.9, 0.9);
    // fog2.material.uniforms.u_time = globalUniforms.u_time;
    // group.add(fog2);

    // const mat = new THREE.MeshStandardMaterial({
    //     color: 0xffffff,
    //     transparent: true,
    //     opacity: 0.1,
    //     fog: true
    // });
    // group.add(mat);



    // const glowGeo = new THREE.SphereGeometry(0.2, 16, 16);
    // const glowMat = new THREE.MeshStandardMaterial({
    //     color: 0xffe88c,
    //     emissive: 0xffff00,
    //     emissiveIntensity: 2,
    // });
    // const glow = new THREE.Mesh(glowGeo, glowMat);
    //
    // glow.position.copy(coreLight.position);
    // group.add(glow);
    //
    // const haloGeo = new THREE.SphereGeometry(0.35, 32, 32);
    // const haloMat = new THREE.MeshBasicMaterial({
    //     color: 0xffdd55,
    //     transparent: true,
    //     opacity: 0.15,
    //     depthWrite: false
    // });
    //
    // const halo = new THREE.Mesh(haloGeo, haloMat);
    // halo.position.copy(coreLight.position);
    // group.add(halo);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    group.add(ambient);


    //addLightGroundSky(group, 0x00ff00);

    generateBuildings(group, perf.buildings);
    //const building = createBuildingTest();
    //group.add(building);


    group.userData = { id: 'domain3', name: 'Hurtbreak Wonderland', creator: 'Sidhant' };
    return group;
}

// function createRoofForBuildingTest(width, height, texLoader) {
//     const roofMats = [
//         new THREE.MeshStandardMaterial({ map: texLoader.load('assets/roof-texture.png') }),
//         new THREE.MeshStandardMaterial({ map: texLoader.load('assets/building-no-window-texture.png') }),
//         new THREE.MeshStandardMaterial({ map: texLoader.load('assets/building-no-window-texture.png') }),
//     ];
//     const roofHeight = width / 2;
//     const geo2 = new THREE.CylinderGeometry( roofHeight, roofHeight, width, 3 );
//     const roof = new THREE.Mesh( geo2, roofMats );
//     roof.rotation.x = -Math.PI / 2;

//     const random = Math.random();
//     if (random < 0.5) roof.rotation.y = Math.PI / 2;

//     roof.position.y = height + (roofHeight / 2);

//     return roof;
// }

// TODO: Sidhant
// ==========================================
// DOMAIN 4:
// ==========================================
export function createDomain4() {
    const material = new THREE.MeshStandardMaterial({
        color: 0x8cd1ff, // silver
        side: THREE.BackSide,
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
    });
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(baseGeometry, material);
    group.add(mesh);

    const doorGroup = new THREE.Group();
    generateDoors(doorGroup, perf.doorRows, perf.doorCols);
    doorGroup.position.y = 0.5;
    //doorGroup.rotation.x = Math.PI;
    group.add(doorGroup);

    const light = new THREE.PointLight(0xffffff, 3.0, 1, 2);
    light.position.y = 0.1;
    group.add(light);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    group.add(ambient);

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

    // const geo = new THREE.CircleGeometry( 0.8, 32 );
    // const mat = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
    // const circle = new THREE.Mesh( geo, mat );
    // circle.position.y = 0.6;
    // circle.rotation.x = -Math.PI / 2;
    // group.add(circle)


    group.userData = { id: 'domain4', name: '\"Hell\"', creator: 'Sidhant' };
    return group;
}

