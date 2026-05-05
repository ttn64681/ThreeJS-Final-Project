import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

// Import domain generation functions from your separate file
import {createDomain1, createDomain2, createDomain3, createDomain4, globalUniforms} from './domains.js';
import {animateFloatingDebris} from './procedural.js';

// ===================== Scene Variables =====================
let scene, camera, renderer, controls;
let domains = []; // i=0->1=3 : largest to smallest
let domainMeshesCache = []; // Hold all currently viewable domain's meshes
let gui;
// Light Helpers
let d1_helper1;
let d1_helper2;
let d2_helper;

// Animation State
let clock = new THREE.Clock();
let state = {
    mode: 'play',
    direction: 1,
    speed: 0.05,
    zoomProgress: 0.0,
    domainOrderStr: 'domain1 -> domain2 -> domain3 -> domain4',
    progressController: null,
    baseScaleFactor: 18,
    activeDevDomain: 'domain1',
    targetDevScale: 0.5,
    isPaused: true,
    shaderTime: 0.0,
    showLightHelpers: false,
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
        u_progress: { value: 0.0 }, // drives warp
        u_time: { value: 0.0 }
    },
    transparent: true,
    depthWrite: false,
    vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
    `,
    fragmentShader: `
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
    `
});
const introQuad = new THREE.Mesh(introGeo, introMat);
introQuad.renderOrder = 2; // shader draws last
introScene.add(introQuad);
// gojo.png overlay
const texLoader = new THREE.TextureLoader();
const gojoTex = texLoader.load('./assets/gojo.png');
const gojoMat = new THREE.MeshBasicMaterial({
    map: gojoTex,
    transparent: true,
    opacity: 0.0, // start invisible
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});
const gojoGeo = new THREE.PlaneGeometry(1, 1); // flat plane for image
const gojoMesh = new THREE.Mesh(gojoGeo, gojoMat);
gojoMesh.renderOrder = 1; // draws before shader (underlayed)
introScene.add(gojoMesh);

// ===================== Init =====================
function init() {
    const container = document.getElementById('canvas-container');

    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.01, 1000);
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

    renderer.physicallyCorrectLights = true;

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
        // Split the cache into meshes and lights for clean looping
        const cache = { meshes: [], lights: [] };
        domain.traverse(child => {
            if (child.isMesh) cache.meshes.push(child);
            if (child.isLight) {
                cache.lights.push({
                    light: child,
                    baseIntensity: child.intensity // save original brightness
                });
            }
        });
        domainMeshesCache.push(cache);
        if (domain.userData.id === 'domain1') {
            d1_helper1 = domain.userData.helper1;
            d1_helper2 = domain.userData.helper2;
        } else if (domain.userData.id === 'domain2') {
            d2_helper = domain.userData.helper;
        }
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
}

// ===================== GUI Setup =====================
function setupGUI() {
    // Attach GUI to HTML gui-container
    const guiContainer = document.getElementById('gui-container');
    gui = new GUI({ container: guiContainer, title: 'Engine Settings' });

    // Animation Controls
    const engineFolder = gui.addFolder('Animation Engine');
    engineFolder.add(state, 'domainOrderStr').name('Current Order').listen().disable();
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
        if(state.mode === 'dev') {
            applyDevMode()
        };
    });
    devFolder.add(state, 'targetDevScale', 0.15, 5).name('Room Size').onChange(() => {
        if(state.mode === 'dev') {
            domains.forEach(group => {
                group.scale.set(state.targetDevScale, state.targetDevScale, state.targetDevScale);
            })
        };
    });
    devFolder.add(state, 'showLightHelpers').name('Show light helpers');

    // Domain 1: Moon Controls
    const moonFolder = gui.addFolder('Moon & Sky');
    moonFolder; // hidden until dev mode activates Domain 1
    const colorProxy = { rimColor: globalUniforms.u_color.value.getHex() };
    // Wire directly into globalUniforms
    moonFolder.addColor(colorProxy, 'rimColor').name('Rim Color').onChange(v => {
        globalUniforms.u_color.value.setHex(v);
    });
    moonFolder.add(globalUniforms.u_power, 'value', 0.5, 8).name('Rim Tightness');
    moonFolder.add(globalUniforms.u_intensity, 'value', 0.1, 5).name('Rim Intensity');

    // Intro Reset Btn
    const introControls = {
        resetIntro: () => {
            introComplete = false;
            introProgress = 0.0;
            introShaderProgress = 0.0;
            state.zoomProgress = 0.0;
            state.shaderTime = 0.0;
            state.isPaused = true;

            camera.position.set(0, 0, 8);
            controls.target.set(0, 0, 0);
            controls.update();

            applyDomainScales();
        }
    };
    engineFolder.add(introControls, 'resetIntro').name('Replay Intro');
}

// ===================== Button Wiring =====================
function setupButtons() {
    document.getElementById('btn-play').addEventListener('click', (e) => setMode('play', 1, e.target));
    document.getElementById('btn-reverse').addEventListener('click', (e) => setMode('reverse', -1, e.target));
    document.getElementById('btn-dev').addEventListener('click', (e) => setMode('dev', 0, e.target));
}

function setMode(mode, dir, btnElement) {
    const prevMode = state.mode;
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
        camera.position.set(0, 0, 1.5);
        controls.target.set(0, 0, 0);
        controls.update();
        applyDevMode();
    } else {
        controls.enablePan = false;
        controls.enableZoom = false;
        // Only snap the orbit camera when leaving dev mode — not on play/reverse / pause toggles,
        // otherwise orbit position is lost every time you pause.
        if (prevMode === 'dev') {
            controls.enableDamping = false;
            if (introComplete) {
                camera.position.set(0, 0, 1);
            } else {
                camera.position.set(0, 0, introStartZ);
            }
            controls.target.set(0, 0, 0);
            controls.update();
            controls.enableDamping = true;
        }
        applyDomainScales();
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
                    if (child.name !== "Sky") { // never overwrite depthWrite for Sky
                        child.material.depthWrite = true;
                    } // force solid depth
                }
                if (child.isLight) {
                    child.visible = true;
                    if (child.type === 'PointLight' || child.type === 'DirectionalLight') {
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
        const cache = domainMeshesCache[i];
        
        if ((i === 0 && introComplete)) { // hide largest off-screen domain
            domain.visible = false;
            cache.lights.forEach((item) => {
                item.light.visible = false;
                item.light.intensity = 0;
            });
            continue;
        }

        domain.visible = true; // reset visibility for all domains

        const exponent = 1 - i + state.zoomProgress;
        const scaleValue = Math.pow(state.baseScaleFactor, exponent);
        domain.scale.set(scaleValue, scaleValue, scaleValue);
        const lightRadius = scaleValue;

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
        let opacityOver80 = (finalOpacity > 0.8);
        // Fade the Meshes
        cache.meshes.forEach((child) => {
            child.visible = domain.visible;  // ensure correct painter's algorithm
            child.material.alphaTest = 0.05; // prevents invisible pixels from glitching the depth buffer
            child.material.depthWrite = opacityOver80; // only write depth when sphere >80% solid (stop Z-fighting)

            if (child.name === "Sky") { // Render sky first, then others on top
                child.renderOrder = i * 10;
                child.material.depthWrite = false;
            } else {
                child.renderOrder = (i * 10) + 1;
                child.material.depthWrite = opacityOver80;
            }

            if (child.material.uniforms && child.material.uniforms.u_local_opacity) { // Fade custom shader via uniform
                child.material.uniforms.u_local_opacity.value = finalOpacity;
            } else { // Fade material opacity normally
                child.material.opacity = finalOpacity;
            }
        });
        // Fade the Lights
        cache.lights.forEach((item) => {
            item.light.visible = domain.visible;
            // Multiply original intensity by opacity to fade them out
            item.light.intensity = domain.visible ? (item.baseIntensity * finalOpacity) : 0; // zero out intensity if domain hidden
            // Finite range so stacked domain lights do not wash out distant shells (was distance=0 / infinite).
            if (domain.visible && item.light.isPointLight) {
                item.light.decay = 1;
                item.light.distance = lightRadius;
            }
        });
    }
}

// Array shifting for infinite treadmill
function shiftDomainsForward() {
    const passedDomain = domains.shift(); // removes first (biggest) outer-domain from array
    domains.push(passedDomain); // move outer-domain to end (smallest)
    domainMeshesCache.push(domainMeshesCache.shift());
    state.domainOrderStr = domains.map(d => d.userData.id).join(' -> ');
}

function shiftDomainsBackward() {
    const coreDomain = domains.pop(); // removes last (tiniest) domain
    domains.unshift(coreDomain); // move domain to beginning (biggest) outer-domain
    domainMeshesCache.unshift(domainMeshesCache.pop());
    state.domainOrderStr = domains.map(d => d.userData.id).join(' -> ');
}

// ===================== Render Loop =====================

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    state.shaderTime += state.speed * delta * state.direction;

    const showHelpers = state.mode === 'dev' && state.showLightHelpers;
    if (d1_helper1) { d1_helper1.visible = showHelpers; d1_helper1.update(); }
    if (d1_helper2) { d1_helper2.visible = showHelpers; d1_helper2.update(); }
    if (d2_helper) { d2_helper.visible = showHelpers; d2_helper.update(); }

    // Intro "Cutscene" on Play pressed
    if (!introComplete && state.mode !== 'dev' && !state.isPaused) {
        introProgress += delta;

        // Intro shader duration (15% of introDuration)
        introShaderProgress = Math.min(introProgress / (introDuration * 0.5), 1.0);
        introMat.uniforms.u_progress.value = introShaderProgress;
        introMat.uniforms.u_time.value += delta;

        // Camera Zoom: Quintic Ease Out
        const t = Math.min(introProgress / introDuration, 1.0);
        // Ease Out: 1 - (1 - t)^6 (starts fast, slows to Z=1)
        const eased = 1 - Math.pow(1 - t, 6);
        camera.position.z = introStartZ - (introStartZ - 1.0) * eased; // zoom to 1.0
        // Reset X and Y so camera shake (later) is always centered
        camera.position.x = 0
        camera.position.y = 0

        controls.update();

        // Gojo PNG Zoom:
        // Keep image square (otherwise it stretches to your wide screen)
        const aspect = window.innerWidth / window.innerHeight;
        // Ease Out Scaling (start fast -> slows)
        const gojoScale = Math.pow(introShaderProgress * 2.0, 1.5);
        // Apply scale (multiply Y by aspect ratio to un-stretch image)
        gojoMesh.scale.set(gojoScale * aspect, gojoScale * aspect, 1);
        // Opacity Animation: Fade in fast, fade out at the end
        const fadeIn = THREE.MathUtils.smoothstep(introShaderProgress * 3.0, 0.0, 0.1);
        const fadeOut = 1.0 - THREE.MathUtils.smoothstep(introShaderProgress * 2.0, 0.6, 1.0);
        gojoMat.opacity = fadeIn * fadeOut;

        // Camera Shake
        const shakeIntensity = Math.pow(1.0 - introShaderProgress, 2);
        const magnitude = 50.0;
        if (shakeIntensity > 0) {
            const xDistCam = (Math.random() - 0.5) * magnitude * shakeIntensity; // x offset
            const yDistCam = (Math.random() - 0.5) * magnitude * shakeIntensity; // y offset
            const xDistGojo = (Math.random() - 0.5) * 2 * shakeIntensity;
            const yDistGojo = (Math.random() - 0.5) * 2 * shakeIntensity;
            camera.position.x += xDistCam;
            camera.position.y += yDistCam;
            gojoMesh.position.set(xDistGojo / 50, yDistGojo / 50, 0);
        }

        // Last 25% of intro, gradually start the zoom (domain scaling)
        if (t > 0.75) {
            const blendT = (t - 0.75) / 0.25; // 0.0 -> 1.0 over the last 25%
            state.zoomProgress += state.speed * delta * blendT;
            applyDomainScales(); // update domain scales
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

init();
