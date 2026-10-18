// src/shipmodels.js — Procedural anti-gravity ship models (Feather S1, Comet R1, Anvil H1)
// Why: Procedural meshes replacing external Blender GLB files while exposing exact same
// hierarchy (root, visual, rotors, canopy, plumes, engine rings) and metadata (halfSpan, length, bottom)

import * as THREE from 'three';

// Shared materials for ship components
export function createShipMaterials(liveryColor = 0xe62233, bodyColor = 0xf0f2f5) {
  // Base white composite hull material
  const body = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.35,
    metalness: 0.15
  });
  body.name = 'ship_body';

  // Livery accent panels (default racing red)
  const livery = new THREE.MeshStandardMaterial({
    color: liveryColor,
    roughness: 0.3,
    metalness: 0.25
  });
  livery.name = 'ship_livery';

  // Dark titanium / carbon trim
  const dark = new THREE.MeshStandardMaterial({
    color: 0x161a22,
    roughness: 0.45,
    metalness: 0.85
  });
  dark.name = 'ship_dark';

  // Smoked semi-transparent canopy glass
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x111c24,
    transparent: true,
    opacity: 0.65,
    roughness: 0.08,
    metalness: 0.1,
    transmission: 0.7,
    ior: 1.5
  });
  glass.name = 'ship_glass';

  // Glowing engine intake / exhaust nozzle ring
  const engineGlow = new THREE.MeshBasicMaterial({
    color: 0x00d2ff
  });
  engineGlow.name = 'ship_engineGlow';

  return { body, livery, dark, glass, engineGlow };
}

// =============================================================================
// FEATHER S1 (Precision Needle / Twin Turbofan Craft)
// 13.34 m long, ~10.3 m span (halfSpan = 5.15 m), twin turbofan pods on swept wings
// =============================================================================
export function buildFeatherS1(mats = null) {
  if (!mats) mats = createShipMaterials(0xe62233, 0xf0f2f5);
  const visual = new THREE.Group();
  visual.name = 'feather_s1_visual';

  const halfSpan = 5.15;
  const length = 13.34;
  const bottom = -0.65; // Lowest point of hull

  // 1. Central Sleek Fuselage (tapered wedge)
  // Nose at z = -6.67, Tail at z = +6.67
  const fuselageGeom = new THREE.BufferGeometry();
  // 12-point faceted low-drag aerodynamic needle
  const vFuselage = [
    // 0: Nose tip
    0, 0.15, -6.67,
    // 1-4: Mid-cabin ridge
    -1.1, 0.55, -1.0,
    1.1, 0.55, -1.0,
    1.3, -0.45, -1.0,
    -1.3, -0.45, -1.0,
    // 5-8: Rear spine
    -0.85, 0.45, 4.8,
    0.85, 0.45, 4.8,
    0.95, -0.5, 4.8,
    -0.95, -0.5, 4.8,
    // 9: Dorsal spine ridge
    0, 0.85, 0.5,
    // 10: Tail tip
    0, 0.35, 6.67,
    // 11: Keel belly
    0, -0.65, 0.5
  ];

  const iFuselage = [
    // Nose facets
    0, 9, 1,   0, 2, 9,
    0, 1, 4,   0, 3, 2,
    0, 4, 11,  0, 11, 3,
    // Mid cabin top & sides
    1, 9, 5,   9, 6, 5,   9, 2, 6,
    1, 5, 8,   1, 8, 4,
    2, 7, 6,   2, 3, 7,
    // Belly
    4, 8, 11,  11, 8, 7,  11, 7, 3,
    // Tail
    9, 10, 6,  9, 5, 10,
    5, 6, 10,  7, 8, 10
  ];

  fuselageGeom.setAttribute('position', new THREE.Float32BufferAttribute(vFuselage, 3));
  fuselageGeom.setIndex(iFuselage);
  fuselageGeom.computeVertexNormals();

  const fuselageMesh = new THREE.Mesh(fuselageGeom, mats.body);
  fuselageMesh.castShadow = true;
  fuselageMesh.receiveShadow = true;
  visual.add(fuselageMesh);

  // 2. Cockpit Canopy with Hinge at Rear (canopy opens/closes)
  const canopyPivot = new THREE.Group();
  canopyPivot.name = 'canopy_pivot';
  canopyPivot.position.set(0, 0.58, 0.6); // Hinge pivot point at rear of cockpit

  const canopyGeom = new THREE.BufferGeometry();
  const vCanopy = [
    0, 0.28, -2.6,    // Nose of canopy (relative to pivot)
    -0.55, 0.22, -1.2,
    0.55, 0.22, -1.2,
    0, 0.42, -1.0,     // Top apex
    -0.5, 0.05, 0.0,   // Rear left at hinge
    0.5, 0.05, 0.0,    // Rear right at hinge
    0, 0.25, 0.0       // Rear top at hinge
  ];
  const iCanopy = [
    0, 3, 1,  0, 2, 3,
    1, 3, 4,  3, 6, 4,
    2, 5, 3,  3, 5, 6
  ];
  canopyGeom.setAttribute('position', new THREE.Float32BufferAttribute(vCanopy, 3));
  canopyGeom.setIndex(iCanopy);
  canopyGeom.computeVertexNormals();

  const canopyMesh = new THREE.Mesh(canopyGeom, mats.glass);
  canopyPivot.add(canopyMesh);
  visual.add(canopyPivot);

  // 3. Swept Forward-Slash Wings (Livery colored)
  const wingGeom = new THREE.BufferGeometry();
  const vWings = [
    // Left Wing (root -> tip)
    -1.2, 0.1, -0.5,   // Root leading
    -halfSpan, 0.35, 1.8, // Tip leading
    -halfSpan + 0.3, 0.1, 3.4, // Tip trailing
    -0.8, -0.05, 3.8,  // Root trailing
    // Right Wing (root -> tip)
    1.2, 0.1, -0.5,    // Root leading
    halfSpan, 0.35, 1.8,  // Tip leading
    halfSpan - 0.3, 0.1, 3.4,  // Tip trailing
    0.8, -0.05, 3.8    // Root trailing
  ];
  const iWings = [
    // Left upper & lower
    0, 1, 2,  0, 2, 3,
    0, 2, 1,  0, 3, 2,
    // Right upper & lower
    4, 6, 5,  4, 7, 6,
    4, 5, 6,  4, 6, 7
  ];
  wingGeom.setAttribute('position', new THREE.Float32BufferAttribute(vWings, 3));
  wingGeom.setIndex(iWings);
  wingGeom.computeVertexNormals();

  const wingMesh = new THREE.Mesh(wingGeom, mats.livery);
  wingMesh.castShadow = true;
  wingMesh.receiveShadow = true;
  visual.add(wingMesh);

  // 4. Twin Turbofan Engine Pods (Left & Right)
  const podGeom = new THREE.CylinderGeometry(0.72, 0.65, 4.6, 16);
  podGeom.rotateX(Math.PI * 0.5); // Align along Z

  const leftPod = new THREE.Mesh(podGeom, mats.dark);
  leftPod.position.set(-2.8, 0.25, 2.8);
  leftPod.castShadow = true;
  visual.add(leftPod);

  const rightPod = new THREE.Mesh(podGeom, mats.dark);
  rightPod.position.set(2.8, 0.25, 2.8);
  rightPod.castShadow = true;
  visual.add(rightPod);

  // Glowing Intake / Exhaust Rings
  const ringGeom = new THREE.TorusGeometry(0.68, 0.08, 8, 16);
  const leftRing = new THREE.Mesh(ringGeom, mats.engineGlow);
  leftRing.position.set(-2.8, 0.25, 5.1);
  visual.add(leftRing);

  const rightRing = new THREE.Mesh(ringGeom, mats.engineGlow);
  rightRing.position.set(2.8, 0.25, 5.1);
  visual.add(rightRing);

  // 5. Spinning Turbofan Rotors (rotors array for animation)
  const rotorGeom = new THREE.BufferGeometry();
  const vRotor = [];
  const iRotor = [];
  // 6 fan blades
  for (let b = 0; b < 6; b++) {
    const angle = (b / 6) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const idx = b * 3;
    vRotor.push(0, 0, 0);
    vRotor.push(cos * 0.6, sin * 0.6, -0.05);
    vRotor.push(cos * 0.6, sin * 0.6, 0.05);
    iRotor.push(idx, idx + 1, idx + 2);
  }
  rotorGeom.setAttribute('position', new THREE.Float32BufferAttribute(vRotor, 3));
  rotorGeom.setIndex(iRotor);
  rotorGeom.computeVertexNormals();

  const leftRotor = new THREE.Mesh(rotorGeom, mats.dark);
  leftRotor.position.set(-2.8, 0.25, 0.6); // Inside front intake
  visual.add(leftRotor);

  const rightRotor = new THREE.Mesh(rotorGeom, mats.dark);
  rightRotor.position.set(2.8, 0.25, 0.6);
  visual.add(rightRotor);

  const rotors = [leftRotor, rightRotor];

  // 6. Engine Exhaust Plumes (Additive cone meshes)
  const plumeGeom = new THREE.ConeGeometry(0.6, 4.5, 12, 1, true);
  plumeGeom.rotateX(-Math.PI * 0.5);
  plumeGeom.translate(0, 0, 2.25);

  const plumeMat = new THREE.MeshBasicMaterial({
    color: 0x00d2ff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const leftPlume = new THREE.Mesh(plumeGeom, plumeMat);
  leftPlume.position.set(-2.8, 0.25, 5.1);
  visual.add(leftPlume);

  const rightPlume = new THREE.Mesh(plumeGeom, plumeMat);
  rightPlume.position.set(2.8, 0.25, 5.1);
  visual.add(rightPlume);

  const plumes = [leftPlume, rightPlume];

  // Nozzle positions (for engine trails)
  const nozzles = [
    new THREE.Vector3(-2.8, 0.25, 5.1),
    new THREE.Vector3(2.8, 0.25, 5.1)
  ];

  return {
    kind: 'feather',
    visual,
    halfSpan,
    length,
    bottom,
    canopy: canopyPivot,
    rotors,
    plumes,
    nozzles,
    engineGlowMat: mats.engineGlow,
    engineColorHex: 0x00d2ff,
    tris: 320
  };
}

// =============================================================================
// COMET R1 (Titanium Manta with Single Huge Rocket Tail)
// =============================================================================
export function buildCometR1(mats = null) {
  if (!mats) mats = createShipMaterials(0xffaa00, 0x1f242d);
  const visual = new THREE.Group();
  visual.name = 'comet_r1_visual';

  const halfSpan = 5.6;
  const length = 14.8;
  const bottom = -0.65;

  // 1. Pointed Needle Nose & Titanium Manta Hull
  // Nose tip at z = -7.4, swept out to span ±5.6 at z = 1.0, trailing edge to z = 4.8
  const mantaGeom = new THREE.BufferGeometry();
  const vManta = [
    // 0: Pointed nose tip
    0, 0.05, -7.4,
    // 1, 2: Mid-chine forward
    -1.8, 0.12, -2.5,
    1.8, 0.12, -2.5,
    // 3, 4: Wing tips (broad titanium manta)
    -5.6, 0.18, 1.2,
    5.6, 0.18, 1.2,
    // 5, 6: Trailing edge outer
    -4.2, 0.14, 4.2,
    4.2, 0.14, 4.2,
    // 7, 8: Engine root flanks
    -1.7, 0.22, 5.2,
    1.7, 0.22, 5.2,
    // 9: Dorsal spine ridge
    0, 0.85, -0.2,
    // 10: Tail spine ridge
    0, 0.65, 5.4,
    // 11: Belly keel
    0, -0.65, 0.5
  ];

  const iManta = [
    // Nose facets
    0, 9, 1,   0, 2, 9,
    0, 1, 11,  0, 11, 2,
    // Mid manta lifting surface
    1, 9, 3,   9, 4, 2,   2, 4, 9,   1, 3, 9,
    1, 11, 3,  2, 4, 11,
    // Outer wing trailing
    3, 9, 5,   4, 6, 9,
    3, 5, 11,  4, 11, 6,
    // Tail blend to engine root
    5, 9, 7,   9, 10, 7,  9, 8, 10,  6, 8, 9,
    5, 7, 11,  6, 11, 8,
    7, 10, 8,  7, 8, 11
  ];

  mantaGeom.setAttribute('position', new THREE.Float32BufferAttribute(vManta, 3));
  mantaGeom.setIndex(iManta);
  mantaGeom.computeVertexNormals();

  const mantaMesh = new THREE.Mesh(mantaGeom, mats.body);
  mantaMesh.castShadow = true;
  visual.add(mantaMesh);

  // 2. Twin Hover Sponsons underneath the flanks
  const sponsonGeom = new THREE.BoxGeometry(1.2, 0.45, 6.5);
  const spL = new THREE.Mesh(sponsonGeom, mats.dark);
  spL.position.set(-2.8, -0.42, 0.8);
  visual.add(spL);
  const spR = new THREE.Mesh(sponsonGeom, mats.dark);
  spR.position.set(2.8, -0.42, 0.8);
  visual.add(spR);

  // 3. Low Faired Aerodynamic Canopy
  const canopyPivot = new THREE.Group();
  canopyPivot.position.set(0, 0.45, -1.2);
  const canopyGeom = new THREE.BufferGeometry();
  const vCanopy = [
    0, 0.35, -2.6,
    -0.65, 0.28, 0.4,
    0.65, 0.28, 0.4,
    0, 0.48, -0.4,
    0, 0.15, 1.6
  ];
  const iCanopy = [
    0, 3, 1,  0, 2, 3,
    1, 3, 4,  3, 2, 4
  ];
  canopyGeom.setAttribute('position', new THREE.Float32BufferAttribute(vCanopy, 3));
  canopyGeom.setIndex(iCanopy);
  canopyGeom.computeVertexNormals();
  const canopyMesh = new THREE.Mesh(canopyGeom, mats.glass);
  canopyPivot.add(canopyMesh);
  visual.add(canopyPivot);

  // 4. Side Heat Dispersion Exits (louvers with glowing thermal orange emitters)
  const heatExitMat = new THREE.MeshBasicMaterial({ color: 0xff6600, toneMapped: false });
  const heatLouverGeom = new THREE.BoxGeometry(0.35, 0.25, 1.8);
  const heatL = new THREE.Mesh(heatLouverGeom, heatExitMat);
  heatL.position.set(-2.2, 0.2, 2.8);
  heatL.rotation.y = 0.2;
  visual.add(heatL);
  const heatR = new THREE.Mesh(heatLouverGeom, heatExitMat);
  heatR.position.set(2.2, 0.2, 2.8);
  heatR.rotation.y = -0.2;
  visual.add(heatR);
  const heatExits = [heatL, heatR];

  // 5. Single Huge Rocket Tail Cone
  const tailConeGeom = new THREE.CylinderGeometry(1.35, 1.75, 2.8, 24);
  tailConeGeom.rotateX(Math.PI * 0.5);
  const tailNozzle = new THREE.Mesh(tailConeGeom, mats.dark);
  tailNozzle.position.set(0, 0.18, 5.8);
  visual.add(tailNozzle);

  // Internal Nozzle Face (for dark engineFaces vs glow mode)
  const nozzleFaceGeom = new THREE.CircleGeometry(1.28, 24);
  const nozzleFaceMat = new THREE.MeshBasicMaterial({ color: 0x111620 });
  const nozzleFace = new THREE.Mesh(nozzleFaceGeom, nozzleFaceMat);
  nozzleFace.position.set(0, 0.18, 7.15);
  visual.add(nozzleFace);

  // 6. 18-Tooth Folding Petal Nozzle
  // Teeth fold: fanned out wide when engine-off/braking (fold ~0.42 rad), closed on throttle (fold ~0.06 rad)
  const petals = [];
  const petalCount = 18;
  const petalR = 1.35;
  const petalZ = 7.18;
  const petalGeom = new THREE.BoxGeometry(0.24, 0.08, 0.75);
  // Shift pivot to base of petal
  petalGeom.translate(0, 0, 0.375);

  const petalGroup = new THREE.Group();
  petalGroup.name = 'comet_petals';
  petalGroup.position.set(0, 0.18, petalZ);

  for (let i = 0; i < petalCount; i++) {
    const angle = (i * Math.PI * 2) / petalCount;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(angle) * petalR, Math.sin(angle) * petalR, 0);
    // Orient outward around the circle
    pivot.rotation.z = angle - Math.PI * 0.5;

    const petalMesh = new THREE.Mesh(petalGeom, mats.dark);
    pivot.add(petalMesh);
    petalGroup.add(pivot);

    petals.push(pivot);
  }
  visual.add(petalGroup);

  // 7. Internal Rotor Spinner (spins faster with speed/boost)
  const rotorGroup = new THREE.Group();
  rotorGroup.position.set(0, 0.18, 7.1);
  const rotorHub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 8), mats.dark);
  rotorHub.rotation.x = Math.PI * 0.5;
  rotorGroup.add(rotorHub);
  const bladeGeom = new THREE.BoxGeometry(0.18, 1.05, 0.05);
  for (let b = 0; b < 6; b++) {
    const blade = new THREE.Mesh(bladeGeom, mats.dark);
    blade.rotation.z = (b * Math.PI) / 3;
    rotorGroup.add(blade);
  }
  visual.add(rotorGroup);

  // Glowing Engine Ring
  const engineGlowRing = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.08, 6, 24), mats.engineGlow);
  engineGlowRing.position.set(0, 0.18, 7.16);
  visual.add(engineGlowRing);

  // 8. Plume
  const plumeGeom = new THREE.ConeGeometry(1.4, 8.5, 18, 1, true);
  plumeGeom.rotateX(-Math.PI * 0.5);
  plumeGeom.translate(0, 0, 4.25);
  const plumeMat = new THREE.MeshBasicMaterial({
    color: 0xff8811,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const plume = new THREE.Mesh(plumeGeom, plumeMat);
  plume.position.set(0, 0.18, 7.2);
  visual.add(plume);

  return {
    kind: 'rocket',
    visual,
    halfSpan,
    length,
    bottom,
    canopy: canopyPivot,
    rotors: [rotorGroup],
    petals,
    heatExits,
    nozzleFaces: [nozzleFace],
    engineGlowMat: mats.engineGlow,
    engineColorHex: 0xffaa00,
    plumes: [plume],
    nozzles: [new THREE.Vector3(0, 0.18, 7.2)],
    tris: 420
  };
}

// =============================================================================
// ANVIL H1 (Heavy Armoured Lifting Body with Dual Pulse Rings)
// =============================================================================
export function buildAnvilH1(mats = null) {
  if (!mats) mats = createShipMaterials(0x8844ff, 0x22262e);
  const visual = new THREE.Group();
  visual.name = 'anvil_h1_visual';

  const halfSpan = 6.4;
  const length = 12.8;
  const bottom = -0.65;

  const hullGeom = new THREE.BoxGeometry(8.5, 1.8, 11.0);
  const hullMesh = new THREE.Mesh(hullGeom, mats.body);
  hullMesh.castShadow = true;
  visual.add(hullMesh);

  // Pulse rings
  const ringGeom = new THREE.TorusGeometry(1.2, 0.2, 8, 16);
  const rLeft = new THREE.Mesh(ringGeom, mats.engineGlow);
  rLeft.position.set(-3.2, 0, 5.5);
  visual.add(rLeft);

  const rRight = new THREE.Mesh(ringGeom, mats.engineGlow);
  rRight.position.set(3.2, 0, 5.5);
  visual.add(rRight);

  const canopyPivot = new THREE.Group();
  canopyPivot.position.set(0, 0.9, 0);

  const plumeGeom = new THREE.ConeGeometry(1.0, 5.0, 12, 1, true);
  plumeGeom.rotateX(-Math.PI * 0.5);
  plumeGeom.translate(0, 0, 2.5);
  const plumeMat = new THREE.MeshBasicMaterial({
    color: 0x9933ff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const pl1 = new THREE.Mesh(plumeGeom, plumeMat);
  pl1.position.set(-3.2, 0, 5.5);
  const pl2 = new THREE.Mesh(plumeGeom, plumeMat);
  pl2.position.set(3.2, 0, 5.5);
  visual.add(pl1);
  visual.add(pl2);

  return {
    kind: 'heavy',
    visual,
    halfSpan,
    length,
    bottom,
    canopy: canopyPivot,
    rotors: [rLeft, rRight],
    plumes: [pl1, pl2],
    nozzles: [new THREE.Vector3(-3.2, 0, 5.5), new THREE.Vector3(3.2, 0, 5.5)],
    tris: 310
  };
}

// Universal ship loader: supports procedural builder or GLB loader path
export function loadShip(urlOrBuilder = 'feather') {
  if (typeof urlOrBuilder === 'function') {
    return urlOrBuilder();
  }
  if (urlOrBuilder === 'comet' || urlOrBuilder === 'rocket') {
    return buildCometR1();
  }
  if (urlOrBuilder === 'anvil' || urlOrBuilder === 'heavy') {
    return buildAnvilH1();
  }
  return buildFeatherS1();
}
