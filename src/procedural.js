import * as THREE from 'three';

// ===================== Domain 1 =====================

// =====================================
// ============= Constants =============
// =====================================

export const floatingDebris = []; // tracks everything that needs to bob on water

// Helper math func to replicate GLSL smoothstep in javascript
function smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

// =====================================
// =============== SKULL ===============
// =====================================
// Shared Skull Material
const skullMat = new THREE.MeshStandardMaterial({
    color: 0xd4c9a8, // aged bone yellow-white
    roughness: 0.85,
    metalness: 0.0,
});
// Cranium - slightly flattened sphere
const skullCraniumGeo = new THREE.SphereGeometry(0.06, 12, 10);
skullCraniumGeo.scale(1.0, 0.9, 0.85); // flatten slightly
const skullCranium = new THREE.Mesh(skullCraniumGeo, skullMat);
skullCranium.position.y = 0.065;
// Jaw - smaller flattened half-sphere
const skullJawGeo = new THREE.SphereGeometry(0.045, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
skullJawGeo.scale(1.0, 0.6, 0.8);
const skullJaw = new THREE.Mesh(skullJawGeo, skullMat);
skullJaw.position.y = 0.02;
skullJaw.rotation.x = Math.PI; // flip so opening faces down
// Eye sockets - two dark recessed spheres
const skullSocketMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1.0 });
const skullSocketGeo = new THREE.SphereGeometry(0.018, 8, 8);
const skullSocket = new THREE.Mesh(skullSocketGeo, skullSocketMat);
// Nasal cavity
const skullNoseGeo = new THREE.SphereGeometry(0.012, 6, 6);
skullNoseGeo.scale(0.7, 1.0, 1.0);
const skullNose = new THREE.Mesh(skullNoseGeo, skullSocketMat);
skullNose.position.set(0, 0.045, 0.055);
// Tooth Boxes
const skullToothGeo = new THREE.BoxGeometry(0.008, 0.012, 0.008);
const skullTooth = new THREE.Mesh(skullToothGeo, skullMat);


// =====================================
// =========== BULL SKULL ==============
// =====================================
const bullSkullMat = new THREE.MeshStandardMaterial({
    color: 0xc8b99a,
    roughness: 0.9,
    metalness: 0.0,
});
const darkMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 1.0 });

// =====================================
// =============== BONE ================
// =====================================
const boneMat = new THREE.MeshStandardMaterial({
    color: 0xcec7a8,
    roughness: 0.8,
    metalness: 0.0,
});

export function spawnBonePiles(group, groundMesh, count) {
    groundMesh.updateMatrixWorld(true);

    // Raycaster obj is mathematical laser beam
    const raycaster = new THREE.Raycaster();
    const downVector = new THREE.Vector3(0, -1, 0); // we want to point down (-Y)

    for (let i = 0; i < count; i++) {
        // Pick random X/Z coordinate w/in circle's radius
        const randCoord = randomPointOnCircleGrid(0.1, 0.8);

        // Fire laser from sky downward at that rand X/Z coord
        raycaster.set(new THREE.Vector3(randCoord.randX, 1.0, randCoord.randZ), downVector);
        const intersects = raycaster.intersectObject(groundMesh);
        // intersects[0] -> {distance, point, face, faceIndex, object, uv}

        if (intersects.length > 0) {
            const hit = intersects[0];
            let item;

            // ==========================================
            //         🎰🤑🌟DA LOOT POOL 🌟🤑🎰
            // ==========================================
            const rng = Math.random(); // 0.0 - 1.0

            if (rng < 0.30) {
                // 30% chance (0.00 to 0.30)
                item = createBone();
            } else if (rng < 0.60) {
                // 30% chance (0.30 to 0.60)
                item = createBonePile();
            } else if (rng < 0.80) {
                // 20% chance (0.60 to 0.80)
                item = createSkull();
            } else if (rng < 0.95) {
                // 15% chance (0.80 to 0.95)
                item = createBullSkull();
            } else {
                // 5% chance (0.95 to 1.00)
                item = new THREE.Group();
                const s1 = createSkull();
                s1.position.set(0.15, 0, 0);
                const s2 = createBullSkull();
                s2.position.set(-0.15, 0, .04);
                s2.rotation.y = Math.PI / 2;
                item.add(s1);
                item.add(s2);
            }

            item.position.copy(hit.point);
            item.rotation.y = Math.random() * Math.PI * 2;
            item.scale.set(0.3, 0.3, 0.3);

            // Buoyancy (bobbing) setup
            const dist = Math.sqrt(hit.point.x * hit.point.x + hit.point.z * hit.point.z);

            item.userData = {
                startY: hit.point.y,
                startXRot: item.rotation.x,
                startZRot: item.rotation.z,
                dist: dist,
                bobSpeed: 1.5 + Math.random() * 2.0,
                bobPhase: Math.random() * Math.PI * 2
            };

            floatingDebris.push(item);
            group.add(item);
        }
    }
}

export function createSkull() {
    const group = new THREE.Group();
    group.add(skullCranium.clone());
    group.add(skullJaw.clone());
    [-0.025, 0.025].forEach(xOffset => {
        const skull = skullNose.clone()
        skull.position.set(xOffset, 0.07, 0.0);
        group.add(skull);
    });
    group.add(skullNose.clone());
    for (let i = -2; i <= 2; i++) {
        const tooth = skullTooth.clone()
        tooth.position.set(i * 0.011, 0.01, 0.03 + Math.abs(i) * -0.003);
        group.add(tooth);
    }

    group.rotation.x = (Math.random() - 0.5) * 0.4
    group.rotation.y = Math.random() * Math.PI * 2
    group.rotation.z = (Math.random() - 0.5) * 0.4
    return group;
}

export function createBullSkull() {
    const group = new THREE.Group();

    // Wide flat cranium
    const craniumGeo = new THREE.SphereGeometry(0.09, 10, 8);
    craniumGeo.scale(1.3, 0.7, 1.0);
    const bullSkull = new THREE.Mesh(craniumGeo, bullSkullMat)
    group.add(bullSkull);

    // Snout - elongated box
    const bullSnoutGeo = new THREE.BoxGeometry(0.08, 0.055, 0.12);
    const bullSnout = new THREE.Mesh(bullSnoutGeo, bullSkullMat);
    bullSnout.position.set(0, -0.025, 0.1);
    group.add(bullSnout);

    // Horns - curved using TubeGeometry along a CatmullRomCurve3
    [-1, 1].forEach(side => {
        const hornCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(side * 0.09, 0.02, 0),
            new THREE.Vector3(side * 0.14, 0.06, -0.02),
            new THREE.Vector3(side * 0.17, 0.10, -0.01),
            new THREE.Vector3(side * 0.16, 0.14, 0.02),
        ]);
        const hornGeo = new THREE.TubeGeometry(hornCurve, 12, 0.012, 7, false);
        group.add(new THREE.Mesh(hornGeo, bullSkullMat));
    });

    // Eye sockets
    [-0.038, 0.038].forEach(x => {
        const bullSocket = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), darkMat);
        bullSocket.position.set(x, 0.015, 0.055);
        group.add(bullSocket);
    });

    // Nostril holes
    [-0.02, 0.02].forEach(x => {
        const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), darkMat);
        nostril.position.set(x, -0.025, 0.155);
        group.add(nostril);
    });

    group.position.y = -0.05
    group.rotation.x = (Math.random() - 0.5) * 0.4
    group.rotation.y = Math.random() * Math.PI * 2
    group.rotation.z = (Math.random() - 0.5) * 0.4

    return group;
}

export function createBone() {
    const group = new THREE.Group();
    const length = 0.08 + Math.random() * 0.1;

    // Shaft - slightly tapered cylinder
    const shaftGeo = new THREE.CylinderGeometry(0.008, 0.006, length, 8);
    group.add(new THREE.Mesh(shaftGeo, boneMat));

    // End knobs - spheres at each end (epiphyses)
    [-length/2, length/2].forEach(y => {
        const knobGeo = new THREE.SphereGeometry(0.014, 8, 6);
        knobGeo.scale(1.0, 0.7, 1.0); // slightly flattened
        const knob = new THREE.Mesh(knobGeo, boneMat);
        knob.position.y = y;
        group.add(knob);
    });
    group.rotation.z = Math.PI / 2;
    return group;
}

export function createBonePile() {
    const group = new THREE.Group();
    const numBones = 6 + Math.floor(Math.random() * 8);

    for (let i = 0; i < numBones; i++) {
        const bone = createBone();
        bone.position.set(
            (Math.random() - 0.5) * 0.5,
            0.01,
            (Math.random() - 0.5) * 0.5
        );
        bone.rotation.set(
            (Math.random() - 0.5) * 0.4,
            Math.random() * Math.PI * 2,
            Math.PI / 2
        );
        group.add(bone);
    }

    // Skull on top of some piles
    if (Math.random() > 0.5) {
        const skull = createSkull();
        skull.position.set(
            (Math.random() - 0.5) * 0.06,
            0.02,
            (Math.random() - 0.5) * 0.06
        );
        skull.rotation.y = Math.random() * Math.PI * 2;
        skull.rotation.x = (Math.random() - 0.5) * 0.3;
        group.add(skull);
    }

    return group;
}

// ===================== Domain 2 =====================

// Constants
const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xddeeff,    // slightly blue-white steel
    metalness: 1.0,
    roughness: 0.0,
});
const handleMat = new THREE.MeshStandardMaterial({
    color: 0x1a0a00,    // very dark brown/black wrap
    metalness: 0.0,
    roughness: 0.95,
});


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

export function spawnSwords(group, groundMesh, crossGroup, count) {
    groundMesh.updateMatrixWorld(true);
    crossGroup.updateMatrixWorld(true); // ensure cross positions are up to date

    // Raycaster obj is mathematical laser beam
    const raycaster = new THREE.Raycaster();
    const downVector = new THREE.Vector3(0, -1, 0); // we want to point down (-Y)

    for (let i = 0; i < count; i++) {
        // Pick random X/Z coordinate w/in circle's radius
        const randCoord = randomPointOnCircleGrid(0.2, 0.7);

        // Fire laser from sky downward at that rand X/Z coord
        raycaster.set(new THREE.Vector3(randCoord.randX, 1.0, randCoord.randZ), downVector);
        const targets = [groundMesh, crossGroup];
        const intersects = raycaster.intersectObjects(targets, true); // each intersected obj sorted
        // intersects[0] -> {distance, point, face, faceIndex, object, uv}

        // If intersects, place sword
        if (intersects.length > 0) {
            const hit = intersects[0];
            const sword = createSword();
            sword.position.copy(hit.point);

            // Random sword stab angles
            sword.rotateX((Math.random() - 0.5) * 0.6);
            sword.rotateY(Math.random() * 2.0 * Math.PI);
            sword.rotateZ((Math.random() - 0.5) * 0.6);

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
        const randCoord = randomPointOnCircleGrid(0.2, 0.7);

        const origin = new THREE.Vector3(randCoord.randX, 1.0, randCoord.randZ);
        raycaster.set(origin, downVector);

        // Shoot laser down
        const intersects = raycaster.intersectObject(groundMesh);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const cross = createCross();
            cross.position.copy(hit.point);

            // Give cross random rotation
            cross.rotateX((Math.random() - 0.5) * 0.5);
            cross.rotateY(Math.random() * Math.PI * 2);
            cross.rotateZ((Math.random() - 0.5) * 0.5);

            group.add(cross);
        }
    }
} // spawnCrosses

function randomPointOnCircleGrid(centerOffset, edgeOffset) {
    const radius = centerOffset + Math.random() * edgeOffset;
    const angle = Math.random() * Math.PI * 2;
    const randX = Math.cos(angle) * radius;
    const randZ = Math.sin(angle) * radius;

    return { randX, randZ }
}

export function createSword() {
    const swordGroup = new THREE.Group();

    // Random Blade/Handle Length
    const lengthMult = 0.7 + Math.random() * 0.6; // 0.7x-1.3x length

    // Japanese sword hilt colors (tsuba)
    const tsubaColors = [
        0x8B0000, // deep red
        0xD4AF37, // gold
        0xC0C0C0, // silver
        0x1a1a1a, // black
        0x4B3621, // dark brown
        0x2E4A1E, // dark green
        0x3B1F5E, // deep purple
        0x8B4513, // saddle brown
    ];
    const tsubaColor = tsubaColors[Math.floor(Math.random() * tsubaColors.length)];

    // Blade - custom tapered shape for tapered blade instead of BoxGeometry
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.018, 0);       // base left
    bladeShape.lineTo(0.018, 0);        // base right
    bladeShape.lineTo(0.001, 0.45 * lengthMult);  // near tip right (tapers)
    bladeShape.lineTo(-0.001, 0.45 * lengthMult); // near tip left
    bladeShape.closePath();

    // Slight blade depth via extrude geo
    const bladeExtrudeGeo = new THREE.ExtrudeGeometry(bladeShape, {
        depth: 0.006,
        bevelEnabled: true,
        bevelSize: 0.003,
        bevelThickness: 0.003,
        bevelSegments: 1
    });
    const blade = new THREE.Mesh(bladeExtrudeGeo, bladeMat);
    blade.position.y *= lengthMult; // center blade vertically
    swordGroup.add(blade);

    // Tsuba (oval guard) - oval/disc shape via lathe geo
    const tsubaPoints = [
        new THREE.Vector2(0, -0.008),
        new THREE.Vector2(0.07, -0.004),
        new THREE.Vector2(0.09, 0),
        new THREE.Vector2(0.07, 0.004),
        new THREE.Vector2(0, 0.008),
    ];
    const tsubaGeo = new THREE.LatheGeometry(tsubaPoints, 32);
    const tsubaMat = new THREE.MeshStandardMaterial({
        color: tsubaColor,
        metalness: 0.7,
        roughness: 0.4,
    });
    const tsuba = new THREE.Mesh(tsubaGeo, tsubaMat);
    tsuba.position.y = 0.45 * lengthMult; // sits at blade base
    tsuba.scale.set(0.6, 0.6, 0.6)
    swordGroup.add(tsuba);

    const scaleFactor = 0.6;

    // Handle - tapered cylinder geo
    const handleHeight = 0.14 * lengthMult;
    const handleGeo = new THREE.CylinderGeometry(
        0.012,              // top radius (narrower near tsuba)
        0.016,              // bot radius (wider at pommel)
        handleHeight,  // length scales w/ sword
        8                   // facets — slightly faceted for wrapped grip look
    );
    const handle = new THREE.Mesh(handleGeo, handleMat);
    // Blade base + half handle's height (to move center up)
    handle.position.y = (0.45 * lengthMult) + (handleHeight / 2 * scaleFactor);
    handle.scale.set(scaleFactor, scaleFactor, scaleFactor);
    swordGroup.add(handle);

    // Pommel - rounded end cap via sphere geo
    const pommelRadius = 0.022;
    const pommelGeo = new THREE.SphereGeometry(pommelRadius, 8, 8);
    const pommelMat = new THREE.MeshStandardMaterial({
        color: tsubaColor,  // matches tsuba
        metalness: 0.8,
        roughness: 0.3,
    });
    const pommel = new THREE.Mesh(pommelGeo, pommelMat);
    // Blade base + full handle height + half pommel radius
    pommel.position.y = (0.45 * lengthMult) + (handleHeight * scaleFactor) + (pommelRadius / 2);
    pommel.scale.set(scaleFactor, scaleFactor, scaleFactor);
    swordGroup.add(pommel);

    swordGroup.scale.set(0.15, 0.15, 0.15);

    // swordGroup.traverse((child) => {
    //     if (child.isMesh) {
    //         child.castShadow = true;
    //     }
    // });

    return swordGroup;
}

function createCross() {
    const crossGroup = new THREE.Group();

    const scaleMult = 0.90 + Math.random() * 0.35; // 0.9x to 1.25x size

    // Brown tint variations
    const woodColors = [
        0x3d2817, 0x4a3020, 0x2e1e10, 0x5c3d20, 0x3a2510, 0x6b4423,
    ];
    const woodColor = woodColors[Math.floor(Math.random() * woodColors.length)];

    const postHeight = 0.5 * scaleMult;
    const beamWidth = 0.25 * scaleMult;
    const thickness = 0.04 * scaleMult;

    // Vertical wooden post
    const postGeo = new THREE.BoxGeometry(thickness, postHeight, thickness);
    // Horizontal wooden beam
    const beamGeo = new THREE.BoxGeometry(beamWidth, thickness, thickness);
    const woodMat = new THREE.MeshStandardMaterial({
        color: woodColor,
        roughness: 0.85 + Math.random() * 0.15,
        metalness: 0.0
    });

    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.y = postHeight / 2; // move up so origin is at bottom tip
    const beam = new THREE.Mesh(beamGeo, woodMat);
    beam.position.y = postHeight * 0.72; // place beam near top

    crossGroup.add(post);
    crossGroup.add(beam);
    crossGroup.scale.set(0.4, 0.4, 0.4);

    // crossGroup.traverse((child) => {
    //     if (child.isMesh) {
    //         child.castShadow = true;
    //     }
    // });

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
    const mat = new THREE.MeshBasicMaterial( { color: 0xff0000, transparent: true } );
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

// ===================== Animation =====================

export function animateFloatingDebris(time) {
    for (let i = 0; i < floatingDebris.length; i++) {
        const obj = floatingDebris[i];
        const dist = obj.userData.dist;

        // EXACT DOMAIN1 WATER SHADER MATH
        const timeScaled = time * 80.0;
        const wave1 = Math.sin(dist * 60.0 - timeScaled) * 0.004;
        const wave2 = Math.sin(dist * 40.0 - timeScaled * 0.7 + 1.5) * 0.002;
        const centerFade = smoothstep(0.0, 0.1, dist);

        const waterHeight = (wave1 + wave2) * centerFade;

        // Inidividual bobbing
        const bob = Math.sin(time * obj.userData.bobSpeed + obj.userData.bobPhase) * 0.005;

        // Set height
        obj.position.y = obj.userData.startY + waterHeight + bob;

        // Rotation
        obj.rotation.x = obj.userData.startXRot + Math.sin(time * obj.userData.bobSpeed) * 0.08;
        obj.rotation.z = obj.userData.startZRot + Math.cos(time * obj.userData.bobSpeed) * 0.08;
        obj.rotation.y = obj.userData.startZRot + Math.cos(time * obj.userData.bobSpeed) * 0.05;
    }
}