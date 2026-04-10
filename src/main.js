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
let pauseButton;
let state = {
    mode: 'play',
    direction: 1,
    speed: 0.3,
    zoomProgress: 0.0,
    baseScaleFactor: 10,
    activeDevDomain: 'domain1',
    targetDevScale: 20,
    isPaused: false,
    togglePause: function() {
        this.isPaused = !this.isPaused;
        pauseButton.name(this.isPaused ? 'Play' : 'Pause');
    },
};

// ===================== Init =====================
function init() {
    const container = document.getElementById('canvas-container');

    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
    camera.position.set(0, 0, 0.1);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enabled = false; // Locked during animation loop (only allow camera rotation)

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
    engineFolder.add(state, 'speed', 0.01, 1.5).name('Zoom Speed');
    engineFolder.add(state, 'baseScaleFactor', 2, 50).name('Scale Factor').onChange(() => {
        if(state.mode === 'play') applyDomainScales();
    });
    pauseButton = gui.add(state, 'togglePause').name("Pause");

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
    devFolder.add(state, 'targetDevScale', 5, 100).name('Room Size').onChange(() => {
        if(state.mode === 'dev') applyDevMode();
    });
}

// ===================== Button Wiring =====================
function setupButtons() {
    document.getElementById('btn-play').addEventListener('click', (e) => setMode('play', 1, e.target));
    document.getElementById('btn-reverse').addEventListener('click', (e) => setMode('play', -1, e.target));
    document.getElementById('btn-dev').addEventListener('click', (e) => setMode('dev', 0, e.target));
}

function setMode(mode, dir, btnElement) {
    state.mode = mode;
    if (dir !== 0) state.direction = dir;

    // Update button styling (remove active-btn class from all butts)
    document.querySelectorAll('#ui-layer button').forEach(btn => btn.classList.remove('active-btn'));
    btnElement.classList.add('active-btn');

    // Handle Logic
    if (mode === 'dev') {
        controls.enabled = true;
        applyDevMode();
    } else {
        controls.enabled = false;
        camera.position.set(0, 0, 0.1);
        controls.target.set(0,0,0);
        domains.forEach(d => d.visible = true);
    }
}

// ===================== Math Logic =====================
function applyDevMode() {
    domains.forEach(group => {
        if (group.userData.id === state.activeDevDomain) {
            group.visible = true;
            group.scale.set(state.targetDevScale, state.targetDevScale, state.targetDevScale);
            group.children[0].material.opacity = 1.0;
        } else {
            group.visible = false;
        }
    });
}

function applyDomainScales() {
    for (let i = 0; i < domains.length; i++) {
        const exponent = 1 - i + state.zoomProgress;
        const scaleValue = Math.pow(state.baseScaleFactor, exponent);
        domains[i].scale.set(scaleValue, scaleValue, scaleValue);

        // Opacity mapping
        let fadeOpacity = exponent + 2.0;
        domains[i].children[0].material.opacity = Math.max(0, Math.min(1, fadeOpacity));
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

    if (state.mode === 'play' && !state.isPaused) {
        state.zoomProgress += state.speed * delta * state.direction;

        if (state.zoomProgress >= 1.0) {
            state.zoomProgress -= 1.0;
            shiftDomainsForward();
        } else if (state.zoomProgress <= 0.0) {
            state.zoomProgress += 1.0;
            shiftDomainsBackward();
        }
        applyDomainScales();
    }

    controls.update();
    renderer.render(scene, camera);
}

// Boot the engine
init();