import * as THREE from 'three';

// Shared sphere geometry for the "Sky"
const baseGeometry = new THREE.SphereGeometry(1, 64, 64);
// Shared ground geometry (radius 1 to match sphere)
const groundGeometry = new THREE.CircleGeometry(1, 64);


function addLightGroundSky(group, color) {
    const ambient = new THREE.AmbientLight(color, 0.4);
    group.add(ambient);

    // set distance to 0 for infinite range
    const sun = new THREE.PointLight(color, 5.0, 0);
    sun.position.set(0, 0.5, 0);
    group.add(sun);

    const groundMat = new THREE.MeshStandardMaterial({
        color: color,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        metalness: 0.1, // low metalness to react better to local lights
        roughness: 0.8  // higher roughness helps diffuse the light
    });
    const ground = new THREE.Mesh(groundGeometry, groundMat);
    ground.rotation.x = -Math.PI / 2; // lay flat
    ground.position.y = -0.2; // slightly below center
    group.add(ground);
}

// TODO: Thai
export function createDomain1() {
    const material = new THREE.MeshStandardMaterial({
        color: 0xff0000, // red
        side: THREE.BackSide,
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
    });
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(baseGeometry, material);
    group.add(mesh);

    addLightGroundSky(group, 0xff0000); // Add light and ground

    group.userData = { id: 'domain1', name: 'Malevolent Shrine' };
    return group;
}

// TODO: Thai
export function createDomain2() {
    const material = new THREE.MeshStandardMaterial({
        color: 0x8800ff, // purple
        side: THREE.BackSide,
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
    });
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(baseGeometry, material);
    group.add(mesh);

    addLightGroundSky(group, 0x8800ff);

    group.userData = { id: 'domain2', name: 'Infinite Void' };
    return group;
}

// TODO: Sidhant
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

    group.userData = { id: 'domain3', name: 'Domain 3' };
    return group;
}

// TODO: Sidhant
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
