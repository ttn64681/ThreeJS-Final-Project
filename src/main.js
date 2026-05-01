import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

// Import domain generation functions from your separate file
import { createDomain1, createDomain2, createDomain3, createDomain4 } from './domains.js';

// ===================== Scene Variables =====================
let scene, camera, renderer, controls;
let domains = []; //
let gui;

// Animation State
let clock = new THREE.Clock();
let state = {
    mode: 'play',
    direction: 1,
    speed: 0.15,
    zoomProgress: 0.0,
    progressController: null,
    baseScaleFactor: 20,
    activeDevDomain: 'domain1',
    targetDevScale: 0.5,
    isPaused: false,
};

// ===================== Init =====================
function init() {
    const container = document.getElementById('canvas-container');

    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.01, 1000);
    camera.position.set(0, 0, 1);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    // controls.enabled = false; // Locked during animation loop (only allow camera rotation)
    controls.enablePan = false;  // Lock right-click dragging
    controls.enableZoom = false; // Lock scroll wheel

    // ===================== Create Objects =====================
    createObjects();

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

    // Start system
    applyDomainScales();
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
        camera.position.set(0, 0, 1);
        controls.target.set(0,0,0);
        // domains.forEach(d => d.visible = true);
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
                    child.material.depthWrite = true; // Force solid depth in Dev Mode
                }
                if (child.isLight) {
                    child.visible = true;
                    if (child.type === 'PointLight') {
                        // Multiply intensity by the square of the scale
                        // 5.0 * (20^2) = 2000 intensity.
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

        if ((i === 0)) { // hide largest off-screen domain
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

        // Traverse each child in the domain
        // Traverse each child in the domain
        domain.traverse((child) => {
            if (child.isMesh) {
                child.visible = domain.visible;
                child.material.opacity = finalOpacity;
                child.renderOrder = i; // ensure correct painter's algorithm

                // alphaTest 0.05 prevents invisible pixels from glitching the depth buffer
                child.material.alphaTest = 0.05;
                // only write depth when the sphere is mostly solid (>80%) to stop Z-fighting
                child.material.depthWrite = (finalOpacity > 0.8);
            }
        });
    }
}

// Array shifting for infinite treadmill
function shiftDomainsForward() {
    const passedDomain = domains.shift(); // removes first (biggest) outer-domain from array
    domains.push(passedDomain); // move outer-domain to end (smallest)
}

function shiftDomainsBackward() {
    const coreDomain = domains.pop(); // removes last (tiniest) domain
    domains.unshift(coreDomain); // move domain to beginning (biggest) outer-domain
}

// ===================== Render Loop =====================
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

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

    state.progressDisplay.updateDisplay();
    camera.updateProjectionMatrix()
    controls.update();
    renderer.render(scene, camera);
}

init();
