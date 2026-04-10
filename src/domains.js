import * as THREE from 'three';

// Shared sphere geometry
const baseGeometry = new THREE.SphereGeometry(1, 64, 64);

// TODO: Thai
export function createDomain1() {
    const material = new THREE.MeshBasicMaterial({
        color: 0xff0000, // red
        wireframe: true,
        side: THREE.BackSide,
        transparent: true,
        opacity: 1.0
    });
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(baseGeometry, material);
    group.add(mesh);
    group.userData = { id: 'domain1', name: 'Malevolent Shrine' };
    return group;
}

// TODO: Thai
export function createDomain2() {
    const material = new THREE.MeshBasicMaterial({
        color: 0x8800ff, // purple
        wireframe: false,
        side: THREE.BackSide,
        transparent: true,
        opacity: 1.0
    });
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(baseGeometry, material);
    group.add(mesh);
    group.userData = { id: 'domain2', name: 'Infinite Void' };
    return group;
}

// TODO: Sidhant
export function createDomain3() {
    const material = new THREE.MeshBasicMaterial({
        color: 0x00ff00, // green
        wireframe: true,
        side: THREE.BackSide,
        transparent: true,
        opacity: 1.0
    });
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(baseGeometry, material);
    group.add(mesh);
    group.userData = { id: 'domain3', name: 'Domain 3' };
    return group;
}

// TODO: Sidhant
export function createDomain4() {
    const material = new THREE.MeshBasicMaterial({
        color: 0xcccccc, // silver
        wireframe: false,
        side: THREE.BackSide,
        transparent: true,
        opacity: 1.0
    });
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(baseGeometry, material);
    group.add(mesh);
    group.userData = { id: 'domain4', name: 'Domain 4' };
    return group;
}