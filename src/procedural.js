import * as THREE from 'three';

// ===================== Domain 1 =====================

// TODO: THAI needs add bones and shrine from online import (sketchfab)

// ===================== Domain 2 =====================
// Single sources of truth to clone
const masterSword = createSword();
const masterCross = createCross();

export function warpTerrain(groundMesh) {
    // Grab ground's position attribute (contains every point on ground)
    const positionAttribute = groundMesh.geometry.attributes.position;
    const vertex = new THREE.Vector3(); // to store each position point as vertex

    // Loop through every point on ground
    for (let i = 0; i < positionAttribute.count; i++) {
        vertex.fromBufferAttribute(positionAttribute, i); // stores point as vertex

        // Create rolling hills
        const height = Math.sin(vertex.x * 5) * Math.cos(vertex.y * 5) * 0.1;
        // Break up smoothness by adding random displacement
        const displacement = (Math.random() - 0.5) * 0.05; // adss rougher/rockier texture

        // Update Z axis for point i
        // (which points "Up" b/c the ground is a circle rotated sideways to be flat on ground)
        positionAttribute.setZ(i, height + displacement);
    }

    // Force engine to recalc lighting shadows for new hills
    groundMesh.geometry.attributes.position.needsUpdate = true;
    groundMesh.geometry.computeVertexNormals();
}

export function spawnSwords(group, groundMesh, count) {
    groundMesh.updateMatrixWorld(true);

    // Raycaster obj is mathematical laser beam
    const raycaster = new THREE.Raycaster();
    const downVector = new THREE.Vector3(0, -1, 0); // we want to point down (-Y)

    for (let i = 0; i < count; i++) {
        // Pick random X/Z coordinate w/in circle's radius
        const randCoord = randomPointOnCircleGrid();

        // Fire laser from sky downward at that rand X/Z coord
        raycaster.set(new THREE.Vector3(randCoord.randX, 1.0, randCoord.randZ), downVector);
        const intersects = raycaster.intersectObject(groundMesh); // each intersected obj sorted
        // intersects[0] -> {distance, point, face, faceIndex, object, uv}

        // If intersects, place sword
        if (intersects.length > 0) {
            const hit = intersects[0];
            const distFromCenter = hit.point.length() // dist from (0,0,0)
            if (distFromCenter > .2) {
                const sword = masterSword.clone();
                sword.position.copy(hit.point);

                // Random sword stab angles
                sword.rotateX((Math.random() - 0.5) * 0.5);
                sword.rotateY(Math.random() * Math.PI * 2);
                sword.rotateZ((Math.random() - 0.5) * 0.2);

                group.add(sword);
            }
        }
    }
}

export function spawnCrosses(group, groundMesh, count) {
    groundMesh.updateMatrixWorld(true);

    // Setup raycaster
    const raycaster = new THREE.Raycaster();
    const downVector = new THREE.Vector3(0, -1, 0);

    for (let i = 0; i < count; i++) {
        // Pick random X/Z coordinate w/in circle's radius
        const randCoord = randomPointOnCircleGrid();

        const origin = new THREE.Vector3(randCoord.randX, 1.0, randCoord.randZ);
        raycaster.set(origin, downVector);

        // Shoot laser down
        const intersects = raycaster.intersectObject(groundMesh);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const distFromCenter = hit.point.length() // dist from (0,0,0)
            if (distFromCenter > .2) {
                const cross = masterCross.clone();
                cross.position.copy(hit.point);

                // Give cross random rotation
                cross.rotateY(Math.random() * Math.PI * 2);
                cross.rotateX((Math.random() - 0.5) * 0.2);
                cross.rotateZ((Math.random() - 0.5) * 0.2);

                group.add(cross);
            }
        }
    }
} // spawnCrosses

function randomPointOnCircleGrid() {
    const radius = Math.random() * 0.9;
    const angle = Math.random() * Math.PI * 2;
    const randX = Math.cos(angle) * radius;
    const randZ = Math.sin(angle) * radius;

    return { randX, randZ }
}

function createSword() {
    const swordGroup = new THREE.Group();

    // Blade
    const bladeGeo = new THREE.BoxGeometry(0.04, 0.4, 0.01);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1.0, roughness: 0.2 }); // silver
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 0.2; // move up so origin is at the tip

    // Guard/Hilt
    const guardGeo = new THREE.BoxGeometry(0.12, 0.02, 0.03);
    const guardMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.4 }); // gold
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.y = 0.4; // place b/w blade and handle

    // Handle
    const handleGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.1);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x221100, metalness: 0.0, roughness: 0.9 }); // dark blackish
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = 0.46;

    swordGroup.add(blade);
    swordGroup.add(guard);
    swordGroup.add(handle);

    swordGroup.scale.set(0.15, 0.15, 0.15);

    return swordGroup;
} // createSword

function createCross() {
    const crossGroup = new THREE.Group();
    // The vertical wooden post
    const postGeo = new THREE.BoxGeometry(0.04, 0.6, 0.04);
    // The horizontal wooden beam
    const beamGeo = new THREE.BoxGeometry(0.3, 0.04, 0.04);
    const woodMat = new THREE.MeshStandardMaterial({
        color: 0x3d2817, // Dark brown wood
        roughness: 0.9,
        metalness: 0.0
    });
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.y = 0.3; // move up so origin is at the bottom tip
    const beam = new THREE.Mesh(beamGeo, woodMat);
    beam.position.y = 0.45; // place beam near the top

    crossGroup.add(post);
    crossGroup.add(beam);
    crossGroup.scale.set(0.3, 0.3, 0.3);

    return crossGroup
} // createCross

// ===================== Domain 3 =====================

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
    // building.position.x = -0.5;
    building.position.y = height / 2;

    return building;
} // createBuilding

export function generateBuildings(group, count = 500) {
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
} // generateBuilding

// ===================== Domain 4 =====================