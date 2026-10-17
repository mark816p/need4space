// src/rock.js — Procedural asteroid rocks, debris field, and deep-space truss towers
// Why: Asteroid field framing the circuit, jump gaps, and meteorite cave section;
// high-detail instanced rocks with cratered basalt noise without external assets

import * as THREE from 'three';
import { noise2, fbm, mulberry32 } from './noise.js';
import { getGirderMaterial } from './hull.js';

let _rockMaterial = null;

export function createRockTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const nCanvas = document.createElement('canvas');
  nCanvas.width = size;
  nCanvas.height = size;
  const nCtx = nCanvas.getContext('2d');
  const nImgData = nCtx.createImageData(size, size);
  const nData = nImgData.data;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;

      // Multi-octave basalt noise + crater pits
      const rockNoise = fbm(u * 8.0, v * 8.0, 4, 2.0, 0.5);
      const craterNoise = noise2(u * 16.0, v * 16.0);
      const isCrater = craterNoise < -0.45;

      let lum = 60 + rockNoise * 45;
      if (isCrater) lum *= 0.45;

      const idx = (y * size + x) * 4;
      // Chondrite brownish grey
      data[idx] = Math.max(20, Math.min(220, lum * 1.05));
      data[idx + 1] = Math.max(18, Math.min(210, lum * 0.98));
      data[idx + 2] = Math.max(16, Math.min(200, lum * 0.92));
      data[idx + 3] = 255;

      // Normal map perturbation
      const nx = (noise2((u + 0.01) * 16.0, v * 16.0) - noise2((u - 0.01) * 16.0, v * 16.0)) * 60;
      const ny = (noise2(u * 16.0, (v + 0.01) * 16.0) - noise2(u * 16.0, (v - 0.01) * 16.0)) * 60;
      nData[idx] = Math.max(0, Math.min(255, 128 + nx));
      nData[idx + 1] = Math.max(0, Math.min(255, 128 + ny));
      nData[idx + 2] = 230;
      nData[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  nCtx.putImageData(nImgData, 0, 0);

  const diffTex = new THREE.CanvasTexture(canvas);
  diffTex.wrapS = THREE.RepeatWrapping;
  diffTex.wrapT = THREE.RepeatWrapping;
  diffTex.colorSpace = THREE.SRGBColorSpace;

  const normTex = new THREE.CanvasTexture(nCanvas);
  normTex.wrapS = THREE.RepeatWrapping;
  normTex.wrapT = THREE.RepeatWrapping;

  return { diffuse: diffTex, normal: normTex };
}

export function getRockMaterial() {
  if (_rockMaterial) return _rockMaterial;
  const tex = createRockTexture(512);
  _rockMaterial = new THREE.MeshStandardMaterial({
    map: tex.diffuse,
    normalMap: tex.normal,
    roughness: 0.92,
    metalness: 0.08
  });
  return _rockMaterial;
}

// Procedural perturbed asteroid geometry
export function createAsteroidGeometry(radius = 15.0, detail = 2, seed = 42) {
  const geom = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();
  const rand = mulberry32(seed);

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length();
    // Perturb vertices along normal direction using 3D spherical noise
    const n = fbm(v.x * 0.05 + rand() * 10, v.y * 0.05 + rand() * 10, 3, 2.0, 0.5);
    const crater = noise2(v.z * 0.08, v.x * 0.08);
    const displacement = 1.0 + (n - 0.5) * 0.45 + (crater < -0.4 ? -0.2 : 0);
    v.setLength(len * displacement);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geom.computeVertexNormals();
  return geom;
}

// Instanced asteroid field surrounding the track
export function createAsteroidField(count = 250, track, seed = 999) {
  const rand = mulberry32(seed);
  const geom = createAsteroidGeometry(1.0, 2, seed);
  const mat = getRockMaterial();
  const instanced = new THREE.InstancedMesh(geom, mat, count);

  const dummy = new THREE.Object3D();
  const frame = {};

  for (let i = 0; i < count; i++) {
    // Pick distance along track
    const s = rand() * track.length;
    track.frame(s, frame);

    // Lateral and vertical offset: distribute 80m to 450m away from the track center
    const lateralDist = (rand() < 0.5 ? -1 : 1) * (70.0 + rand() * 350.0);
    const verticalDist = (rand() - 0.5) * 250.0;
    const forwardDist = (rand() - 0.5) * 60.0;

    dummy.position.copy(frame.pos)
      .addScaledVector(frame.R, lateralDist)
      .addScaledVector(frame.U, verticalDist)
      .addScaledVector(frame.T, forwardDist);

    // Random rotation
    dummy.rotation.set(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2);

    // Random scale (5 m to 65 m diameter asteroids)
    const scale = 5.0 + Math.pow(rand(), 2.2) * 60.0;
    dummy.scale.set(scale, scale * (0.8 + rand() * 0.4), scale * (0.7 + rand() * 0.5));

    dummy.updateMatrix();
    instanced.setMatrixAt(i, dummy.matrix);
  }

  instanced.instanceMatrix.needsUpdate = true;
  instanced.castShadow = true;
  instanced.receiveShadow = true;
  return instanced;
}

// Deep-space communication/sensor towers mounted on truss arms extending from track
export function createTrussTowers(track, count = 16) {
  const group = new THREE.Group();
  group.name = 'truss_towers';
  const girderMat = getGirderMaterial();
  const redBeaconMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

  // Reusable geometry
  const trussArmGeom = new THREE.BoxGeometry(4.0, 4.0, 90.0);
  const towerGeom = new THREE.CylinderGeometry(2.5, 6.0, 80.0, 6);
  const dishGeom = new THREE.SphereGeometry(14.0, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.4);
  const beaconGeom = new THREE.SphereGeometry(1.5, 8, 8);

  const frame = {};
  for (let i = 0; i < count; i++) {
    const s = (i / count) * track.length + 150.0;
    track.frame(s, frame);

    const side = (i % 2 === 0 ? 1 : -1);
    const towerGroup = new THREE.Group();

    // Extend arm sideways from track underside
    const arm = new THREE.Mesh(trussArmGeom, girderMat);
    arm.position.set(0, -6.0, side * 45.0);
    towerGroup.add(arm);

    // Vertical sensor mast
    const mast = new THREE.Mesh(towerGeom, girderMat);
    mast.position.set(0, 35.0, side * 85.0);
    towerGroup.add(mast);

    // Radar dish
    const dish = new THREE.Mesh(dishGeom, girderMat);
    dish.position.set(0, 75.0, side * 85.0);
    dish.rotation.x = Math.PI * 0.35 * side;
    towerGroup.add(dish);

    // Red flashing hazard beacon at top
    const beacon = new THREE.Mesh(beaconGeom, redBeaconMat);
    beacon.position.set(0, 82.0, side * 85.0);
    towerGroup.add(beacon);

    // Position and orient towerGroup according to track frame
    const mat = new THREE.Matrix4().makeBasis(frame.T, frame.U, frame.R);
    towerGroup.quaternion.setFromRotationMatrix(mat);
    towerGroup.position.copy(frame.pos);

    group.add(towerGroup);
  }

  return group;
}
