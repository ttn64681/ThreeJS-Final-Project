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

function randomPointOnSphere() {
    const u = Math.random();
    const v = Math.random();

    const theta = 2 * Math.PI * u; // Longitude
    const phi = Math.acos(2 * v - 1); // Latitude

    return new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
    );
}

function createBuilding() {

    const height = 0.05 + Math.random() * (0.2 - 0.05);

    const geo = new THREE.BoxGeometry( 0.05, height, 0.05 );
    const mat = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
    const building = new THREE.Mesh( geo, mat );
    building.position.x = -0.5;
    building.position.y = height / 2;

    return building;
}

function generateBuildings(group, count = 500) {

    for (let i = 0; i < count; i++) {
        const normal = randomPointOnSphere();
        const building = createBuilding();

        building.position.copy(normal);

        // Make building stand outward
        building.lookAt(new THREE.Vector3(0, 0, 0));
        building.rotateX(Math.PI / 2);

        // Attach to a pivot so rotation works cleanly
        const pivot = new THREE.Group();
        pivot.position.copy(normal);
        pivot.lookAt(0, 0, 0);

        building.position.set(0, 0, 0);
        pivot.add(building);

        group.add(pivot);
    }

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

    generateBuildings(group, 500);

    group.userData = { id: 'domain3', name: 'Hurtbreak Wonderland' };
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
