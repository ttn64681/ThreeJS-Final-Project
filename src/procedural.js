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
        // Break up smoothness by adding a random displacement
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
        const radius = Math.random() * 0.9;
        const angle = Math.random() * Math.PI * 2;
        const randX = Math.cos(angle) * radius;
        const randZ = Math.sin(angle) * radius;

        // Fire laser from sky downward at that rand X/Z coord
        raycaster.set(new THREE.Vector3(randX, 1.0, randZ), downVector);
        const intersects = raycaster.intersectObject(groundMesh); // each intersected obj sorted
        // intersects[0] -> {distance, point, face, faceIndex, object, uv}

        // If intersects, place sword
        if (intersects.length > 0) {
            const hit = intersects[0];
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

export function spawnCrosses(group, groundMesh, count) {
    groundMesh.updateMatrixWorld(true);

    // Setup raycaster
    const raycaster = new THREE.Raycaster();
    const downVector = new THREE.Vector3(0, -1, 0);

    for (let i = 0; i < count; i++) {
        // Pick random X/Z coordinate w/in circle's radius
        const radius = Math.random() * 0.9;
        const angle = Math.random() * Math.PI * 2;
        const randomX = Math.cos(angle) * radius;
        const randomZ = Math.sin(angle) * radius;

        const origin = new THREE.Vector3(randomX, 1.0, randomZ);
        raycaster.set(origin, downVector);

        // Shoot laser down
        const intersects = raycaster.intersectObject(groundMesh);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const cross = masterCross.clone();
            cross.position.copy(hit.point);

            // Give cross random rotation
            cross.rotateY(Math.random() * Math.PI * 2);
            cross.rotateX((Math.random() - 0.5) * 0.2);
            cross.rotateZ((Math.random() - 0.5) * 0.2);

            group.add(cross);
        }
    }
} // spawnCrosses

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

function createGrass(width, length) {
    const park = new THREE.Group();


    const geo = new THREE.BoxGeometry(length, 0.05, width)
    const mat = new THREE.MeshStandardMaterial( {
        color: 0x2ecc71,
        side: THREE.DoubleSide
    } );
    const grass = new THREE.Mesh( geo, mat );

    grass.lookAt(0, 0, 0);

    park.add(grass);

    const sidewalk = createSidewalk(width, length);
    park.add(sidewalk);


    // const geo2 = new THREE.BoxGeometry(width + 0.05, height, length + 0.05);
    // const mat2 = new THREE.MeshStandardMaterial( { color: 0xaaaaaa } );
    // const border = new THREE.Mesh( geo2, mat2 );
    // border.position.y = 0.04;
    // park.add(border);

    return park;

}

function createSidewalk(width, length) {

    const texLoader = new THREE.TextureLoader();
    const sidewalkTex = texLoader.load('assets/sidewalk-texture.png');

    const geo = new THREE.BoxGeometry(length + 0.02, 0.005, width + 0.02);
    const mat = new THREE.MeshStandardMaterial({ map: sidewalkTex });
    const sidewalk = new THREE.Mesh(geo, mat);
    sidewalk.position.y = 0.01; // slightly above ground
    return sidewalk;
}

function createBuilding(width, length) {
    const building = new THREE.Group();

    // -- Base Setup --
    const height = 0.05 + Math.random() * 0.2;



    const texLoader = new THREE.TextureLoader();
    const baseTex = texLoader.load('assets/building-texture.png');
    const geo = new THREE.BoxGeometry(length, height, width);
    const mat = new THREE.MeshStandardMaterial({ map: baseTex });
    const base = new THREE.Mesh(geo, mat);
    base.position.y = height / 2;
    building.add(base);

    // -- Side walk --
    const sidewalk = createSidewalk(width, length);
    building.add(sidewalk);


    // -- Fixed Gable Roof --
    const rH = 0.04; // Roof Height
    const hL = length / 2; // Half Length
    const hW = width / 2; // Half Width

    let geo2;

    let roofChance = Math.random();
    if (roofChance < 0.25) {
        // Vertices defined face-by-face with counter-clockwise winding order pointing OUTWARD
        const vertices = new Float32Array([
            // Front Slope (Looking from negative Z)
            -hL, 0, -hW, hL, rH, 0, hL, 0, -hW,
            -hL, 0, -hW, -hL, rH, 0, hL, rH, 0,

            // Back Slope (Looking from positive Z)
            hL, 0, hW, -hL, rH, 0, -hL, 0, hW,
            hL, 0, hW, hL, rH, 0, -hL, rH, 0,

            // Right Side (Triangle looking from positive X)
            hL, 0, -hW, hL, rH, 0, hL, 0, hW,

            // Left Side (Triangle looking from negative X)
            -hL, 0, hW, -hL, rH, 0, -hL, 0, -hW
        ]);

        // UVs mapped to stretch perfectly across each triangle set
        const uvs = new Float32Array([
            // Front Slope
            0, 0, 1, 1, 1, 0,
            0, 0, 0, 1, 1, 1,

            // Back Slope
            0, 0, 1, 1, 1, 0,
            0, 0, 0, 1, 1, 1,

            // Right Side
            0, 0, 0.5, 1, 1, 0,

            // Left Side
            0, 0, 0.5, 1, 1, 0
        ]);

        geo2 = new THREE.BufferGeometry();
        geo2.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geo2.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geo2.computeVertexNormals(); // Recalculates normals to point outward
    } else if (roofChance >= 0.25 && roofChance < 0.50) {
        const vertices = new Float32Array([
            // Slope 1 (Looking from negative X) - Points OUTWARD
            -hL, 0, -hW,   -hL, 0,  hW,    0, rH,  hW,
            -hL, 0, -hW,    0, rH,  hW,    0, rH, -hW,

            // Slope 2 (Looking from positive X) - Points OUTWARD
            hL, 0,  hW,    hL, 0, -hW,    0, rH, -hW,
            hL, 0,  hW,    0, rH, -hW,    0, rH,  hW,

            // Front Triangle (Looking from negative Z)
            -hL, 0, -hW,    0, rH, -hW,    hL, 0, -hW,

            // Back Triangle (Looking from positive Z)
            hL, 0,  hW,    0, rH,  hW,   -hL, 0,  hW
        ]);

        const uvs = new Float32Array([
            // Slope 1
            0, 0,  1, 0,  1, 1,
            0, 0,  1, 1,  0, 1,
            // Slope 2
            0, 0,  1, 0,  1, 1,
            0, 0,  1, 1,  0, 1,
            // Front Triangle
            0, 0,  0.5, 1,  1, 0,
            // Back Triangle
            0, 0,  0.5, 1,  1, 0
        ]);

        geo2 = new THREE.BufferGeometry();
        geo2.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geo2.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geo2.computeVertexNormals(); // Recalculates normals to point outward
    } else if (roofChance >= 0.50 && roofChance < 0.75) {
        // -- Pyramid Shape --
        const pyramidVertices = new Float32Array([
            // Front Triangle (Looking from negative Z)
            -hL, 0, -hW,   0, rH, 0,   hL, 0, -hW,
            // Back Triangle (Looking from positive Z)
            hL, 0,  hW,   0, rH, 0,  -hL, 0,  hW,
            // Right Triangle (Looking from positive X)
            hL, 0, -hW,   0, rH, 0,   hL, 0,  hW,
            // Left Triangle (Looking from negative X)
            -hL, 0,  hW,   0, rH, 0,  -hL, 0, -hW
        ]);

        const pyramidUvs = new Float32Array([
            // Front
            0, 0,  0.5, 1,  1, 0,
            // Back
            0, 0,  0.5, 1,  1, 0,
            // Right
            0, 0,  0.5, 1,  1, 0,
            // Left
            0, 0,  0.5, 1,  1, 0
        ]);

        geo2 = new THREE.BufferGeometry();
        geo2.setAttribute('position', new THREE.BufferAttribute(pyramidVertices, 3));
        geo2.setAttribute('uv', new THREE.BufferAttribute(pyramidUvs, 2));
        geo2.computeVertexNormals();
    } else {
        geo2 = new THREE.BoxGeometry(length, 0.001, width);
        geo2.computeVertexNormals();
    }

    const roofMat = new THREE.MeshStandardMaterial({
        map: texLoader.load('assets/roof-texture.png'),
        //flatShading: false,
        roughness: 0.9,
        metalness: 0.0,
    });

    const roof = new THREE.Mesh(geo2, roofMat);
    roof.position.y = height;
    building.add(roof);

    return building;
}



export function generateBuildings(group, count = 500) {

    const up = new THREE.Vector3(0, 1, 0);
    const placedPoints = [];

    let attempts = 0;


    while (placedPoints.length < count && attempts < count * 10) {
        attempts++;

        const width = 0.05 + Math.random() * (0.15 - 0.05);
        const length = 0.05 + Math.random() * (0.15 -  0.05);

        const normal = randomPointOnSphere();

        // spacing radius
        const minDist = 0.12;

        if (isTooClose(normal, placedPoints, minDist)) continue;

        placedPoints.push(normal);

        const isBuilding = Math.random() < 0.75;

        const obj = isBuilding ? createBuilding(width, length) : createGrass(width, length);

        obj.position.copy(normal);

        const quat = new THREE.Quaternion()
            .setFromUnitVectors(up, normal.clone().negate());

        obj.quaternion.copy(quat);

        group.add(obj);
    }
} // generateBuilding

function isTooClose(point, placedPoints, minDist) {
    for (let p of placedPoints) {
        if (p.distanceTo(point) < minDist) {
            return true;
        }
    }
    return false;
}

// ===================== Domain 4 =====================