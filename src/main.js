import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

// Import domain generation functions from your separate file
import {createDomain1, createDomain2, createDomain3, createDomain4, globalUniforms} from './domains.js';
import {animateFloatingDebris} from './procedural.js';

// ===================== Scene Variables =====================
let scene, camera, renderer, controls;
let domains = []; // i=0->1=3 : largest to smallest
let domainMeshesCache = []; // Hold all our meshes. When traversing each mesh, we check if
let gui;

// Animation State
let clock = new THREE.Clock();
let state = {
    mode: 'play',
    direction: 1,
    speed: 0.05,
    zoomProgress: 0.0,
    progressController: null,
    baseScaleFactor: 25,
    activeDevDomain: 'domain1',
    targetDevScale: 0.5,
    isPaused: true,
    shaderTime: 0.0,
};

// Intro Animation State
let introComplete = false;
let introShaderProgress = 0.0; // 0.0 -> 1.0
// Speed controls for intro
const introDuration = 5.0; // total intro seconds
const introStartZ = 1000.0; // starting camera distance
let introProgress = 0.0; // raw elapsed time in intro

// Intro overlay - fullscreen quad w/ shader mat
// rendered in separate orthographic scene on top
const introScene = new THREE.Scene();
const introCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const introGeo = new THREE.PlaneGeometry(2, 2);
const introMat = new THREE.ShaderMaterial({
    uniforms: {
        u_progress: { value: 0.0 }, // drives the warp/explosion
        u_time: { value: 0.0 }
    },
    transparent: true,
    depthWrite: false,
    vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
    `,
    fragmentShader: `
        uniform float u_progress; // 0=start, 1=fully zoomed in/done
        uniform float u_time;
        varying vec2 vUv;

        void main() {
            vec2 center = vUv - 0.5; // -0.5 to 0.5, centered
            float dist = length(center);

            // Warp: UV spirals/contracts toward center as progress increases
            float angle = atan(center.y, center.x);
            float warp = dist * (1.0 - u_progress * 2.0); // shrinks to zero

            // Ripple outward from center
            float ring = sin(dist * 30.0 - u_time * 10.0) * 0.5 + 0.5;

            // Fade out as progress -> 1.0
            float alpha = 1.0 - smoothstep(0.6, 1.0, u_progress);

            // Dark vortex color
            vec3 color = mix(vec3(0.0), vec3(0.5, 0.0, 0.0), ring * (1.0 - u_progress));
            gl_FragColor = vec4(color, alpha);
        }
    `
});
const introQuad = new THREE.Mesh(introGeo, introMat);
introScene.add(introQuad);

// ===================== Init =====================
function init() {
    const container = document.getElementById('canvas-container');

    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.01, 1000);
    camera.position.set(0, 0, 8);

    // Renderer

    // renderer = new THREE.WebGLRenderer({ antialias: true });
    // renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance', // tells GPU driver to use fast GPU on laptops
        stencil: false,   // not using stencil buffer
        depth: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // was 2

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    // Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    // controls.enabled = false; // Locked during animation loop (only allow camera rotation)
    controls.enablePan = false;  // Lock right-click dragging
    controls.enableZoom = false; // Lock scroll wheel

    // ===================== Create Objects =====================
    createObjects();

    // ===================== Cache Objects =====================
    domains.forEach(domain => {
        scene.add(domain);
        // Build cache for each domain
        const meshes = [];
        domain.traverse(child => {
            if (child.isMesh) meshes.push(child);
        });
        domainMeshesCache.push(meshes);
    });

    // ===================== GUI =====================
    setupGUI();

    // ===================== Button Wiring =====================
    setupButtons();

    // ===================== Handle Resize =====================
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    renderer.compile(scene, camera); // compile shaders

    // Start system BUT we want to run intro sequence first
    applyDomainScales(); // ts makes i=1,2,3 visible
    animate();
}

// ===================== Create Objects =====================
function createObjects() {
    // Call imported functions and push to domain array in order
    domains.push(createDomain1());
    domains.push(createDomain2());
    domains.push(createDomain3());
    domains.push(createDomain4());

    // Add them to scene
    domains.forEach(domain => scene.add(domain));
}

// ===================== GUI Setup =====================
function setupGUI() {
    // Attach GUI to HTML gui-container
    const guiContainer = document.getElementById('gui-container');
    gui = new GUI({ container: guiContainer, title: 'Engine Settings' });

    // Animation Controls
    const engineFolder = gui.addFolder('Animation Engine');
    state.progressDisplay = engineFolder.add(state, 'zoomProgress').name('Zoom Progress: ').decimals(4).disable();
    engineFolder.add(state, 'speed', 0.01, 1.5).name('Zoom Speed');
    engineFolder.add(state, 'baseScaleFactor', 2, 50).name('Scale Factor').onChange(() => {
        if(state.mode === 'play') applyDomainScales();
    });
    // Extract names and ids for the dropdown mapping
    const domainMapping = {};
    domains.forEach(d => {
        domainMapping[d.userData.name] = d.userData.id;
    });

    // Dev Mode Controls
    const devFolder = gui.addFolder('Dev Mode Options');
    devFolder.add(state, 'activeDevDomain', domainMapping).name('Edit Domain').onChange(() => {
        if(state.mode === 'dev') applyDevMode();
    });
    devFolder.add(state, 'targetDevScale', 0.15, 5).name('Room Size').onChange(() => {
        if(state.mode === 'dev') {
            domains.forEach(group => {
                group.scale.set(state.targetDevScale, state.targetDevScale, state.targetDevScale);
            })
        };
    });
}

// ===================== Button Wiring =====================
function setupButtons() {
    document.getElementById('btn-play').addEventListener('click', (e) => setMode('play', 1, e.target));
    document.getElementById('btn-reverse').addEventListener('click', (e) => setMode('reverse', -1, e.target));
    document.getElementById('btn-dev').addEventListener('click', (e) => setMode('dev', 0, e.target));
}

function setMode(mode, dir, btnElement) {
    state.mode = mode;
    if (dir !== 0) state.direction = dir;

    // Play / Pause handler
    if ((mode === 'play' || mode === 'reverse')) {
        state.isPaused = !state.isPaused;
    }

    // Update button styling (remove active-btn class from all butts)
    document.querySelectorAll('#ui-layer button').forEach(btn => btn.classList.remove('active-btn'));
    btnElement.classList.add('active-btn');

    // Dev Mode Handler
    if (mode === 'dev') {
        controls.enablePan = true;
        controls.enableZoom = true;
        applyDevMode();
    } else {
        controls.enablePan = false;
        controls.enableZoom = false;
        if (introComplete) {
            camera.position.z = 1;
            controls.target.set(0, 0, 0);
        }
    }
}

// ===================== Math Logic =====================
function applyDevMode() {
    domains.forEach(group => {
        if (group.userData.id === state.activeDevDomain) {
            group.visible = true;
            group.scale.set(state.targetDevScale, state.targetDevScale, state.targetDevScale);

            // reset every child (Sky, Ground, and Lights)
            group.traverse((child) => {
                if (child.isMesh) {
                    child.visible = true;
                    child.material.opacity = 1.0;
                    child.material.transparent = true;
                    child.material.depthWrite = true; // force solid depth
                }
                if (child.isLight) {
                    child.visible = true;
                    if (child.type === 'PointLight') {
                        // Multiply intensity by square of the scale
                        // 5.0 * (20^2) = 2000 intensity
                        child.intensity = 5.0 * Math.pow(state.targetDevScale, 2);
                    } else {
                        child.intensity = 0.4; // reset ambient to normal
                    }
                }
            });
        } else {
            group.visible = false;
        }
    });
}

function applyDomainScales() {
    // i=0 -> i=3 : largest domain -> smallest domain
    // We only ever see at most 3 domains at a time given our camera is so close
    // and because they scale up so large
    for (let i = 0; i < domains.length; i++) {
        let domain = domains[i]

        if ((i === 0 && introComplete)) { // hide largest off-screen domain
            domain.visible = false;
            continue;
        }

        domain.visible = true; // reset visibility for all domains

        const exponent = 1 - i + state.zoomProgress;
        const scaleValue = Math.pow(state.baseScaleFactor, exponent);
        domain.scale.set(scaleValue, scaleValue, scaleValue);

        // Opacity mapping
        let fadeOpacity = exponent + 2.0;
        const finalOpacity = Math.max(0, Math.min(1, fadeOpacity));

        // Recurse each child/group in the domain to update render order and opacity (BOTTLENECK)
        // domain.traverse((child) => {
        //     if (child.isMesh) {
        //         ...
        //     }
        // });

        // Linearly traverse array of children neatly
        domainMeshesCache[i].forEach((child) => {
            child.visible = domain.visible;
            child.renderOrder = i; // ensure correct painter's algorithm
            // alphaTest 0.05 prevents invisible pixels from glitching the depth buffer
            child.material.alphaTest = 0.05;
            // only write depth when the sphere is mostly solid (>80%) to stop Z-fighting
            child.material.depthWrite = (finalOpacity > 0.8);

            // Render sky first, then others on top
            if (child.name === "Sky") {
                child.renderOrder = i*10;
            } else {
                child.renderOrder = (i*10) + 1;
            }

            // If custom shader found, fade it via uniform. Else, fade normally
            if (child.material.uniforms && child.material.uniforms.u_local_opacity) {
                child.material.uniforms.u_local_opacity.value = finalOpacity;
            } else {
                child.material.opacity = finalOpacity;
            }
        });
    }
}

// Array shifting for infinite treadmill
function shiftDomainsForward() {
    const passedDomain = domains.shift(); // removes first (biggest) outer-domain from array
    domains.push(passedDomain); // move outer-domain to end (smallest)
    domainMeshesCache.push(domainMeshesCache.shift());
}

function shiftDomainsBackward() {
    const coreDomain = domains.pop(); // removes last (tiniest) domain
    domains.unshift(coreDomain); // move domain to beginning (biggest) outer-domain
    domainMeshesCache.unshift(domainMeshesCache.pop());
}

// ===================== Render Loop =====================

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    state.shaderTime += state.speed * delta * state.direction;


    // Intro "Cutscene" on Play pressed
    if (!introComplete && state.mode !== 'dev' && !state.isPaused) {
        introProgress += delta;

        // Intro shader duration (15% of introDuration)
        introShaderProgress = Math.min(introProgress / (introDuration * 0.15), 1.0);
        introMat.uniforms.u_progress.value = introShaderProgress;
        introMat.uniforms.u_time.value += delta;

        // Camera Zoom: Quintic Ease Out
        const t = Math.min(introProgress / introDuration, 1.0);
        // Quintic Ease Out: 1 - (1 - t)^5
        // Starts fast, then slows into Z=1
        const eased = 1 - Math.pow(1 - t, 6);

        camera.position.z = introStartZ - (introStartZ - 1.0) * eased; // zoom to 1.0

        // Last 25% of intro, gradually start the zoom (domain scaling)
        if (t > 0.75) {
            const blendT = (t - 0.75) / 0.25; // 0.0 -> 1.0 over the last 25%
            state.zoomProgress += state.speed * delta * blendT;
            applyDomainScales(); // Update the domain scales behind the scenes!
        }

        // Render main scene underneath intro overlay
        renderer.render(scene, camera);
        // Render intro overlay on top (autoClear=false prevents wiping the scene)
        renderer.autoClear = false;
        renderer.render(introScene, introCamera);
        renderer.autoClear = true;

        // End of Intro
        if (t >= 1.0) {
            introComplete = true;
            camera.position.z = 1;
            controls.target.set(0, 0, 0);
            state.isPaused = false; // starts zoom loop
        }

        controls.update();
        state.progressDisplay.updateDisplay();

        // Let shaders run during intro
        globalUniforms.u_time.value = state.shaderTime;

        return; // skips normal loop logic during intro
    }


    // Zoom Loop
    if ((state.mode === 'play' || state.mode === 'reverse') && !state.isPaused) {
        state.zoomProgress += state.speed * delta * state.direction;

        // Loop from 0.0-1.0
        if (state.zoomProgress >= 1.0) {
            state.zoomProgress -= 1.0;
            shiftDomainsForward();
        } else if (state.zoomProgress <= 0.0) {
            state.zoomProgress += 1.0;
            shiftDomainsBackward();
        }
        applyDomainScales();
    }

    globalUniforms.u_time.value = state.shaderTime;
    // animateFloatingDebris(state.shaderTime);

    controls.update();
    state.progressDisplay.updateDisplay();
    renderer.render(scene, camera);
}

state.isPaused = true;
init();
