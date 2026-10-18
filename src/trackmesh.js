// src/trackmesh.js — High-performance procedural track geometry generator
// Why: Generates continuous 44m deck slab, solid 1.2m walls, 5.0m energy fields,
// underhull girder ribs, jump lips, gantries, start line, boost pads, light gates, and tunnel

import * as THREE from 'three';
import { TRACK_W, FIELD_H, WALL_H, WALL_THICK, DECK_THICK } from './track.js';
import { getDeckMaterial, getKerbMaterial, getBarrierMaterial, getBoostPadMaterial } from './deck.js';
import { getHullMaterial, getGirderMaterial } from './hull.js';
import { createAsteroidField, createTrussTowers } from './rock.js';

// Reusable scratch vectors to avoid allocations
const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _t0 = new THREE.Vector3();
const _t1 = new THREE.Vector3();
const _u0 = new THREE.Vector3();
const _u1 = new THREE.Vector3();
const _r0 = new THREE.Vector3();
const _r1 = new THREE.Vector3();
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _norm = new THREE.Vector3();

export function buildTrackMeshes(track, scene) {
  const root = new THREE.Group();
  root.name = 'track_root';

  const n = track.n;
  const halfW = TRACK_W * 0.5;
  const kerbW = 2.0;

  // 1. Identify contiguous solid track segments (skipping jump gaps)
  const segments = [];
  let inSolid = false;
  let startIdx = 0;

  for (let i = 0; i < n; i++) {
    const s = i * track.actualStep;
    const isGap = track.inGap(s);
    if (!isGap && !inSolid) {
      inSolid = true;
      startIdx = i;
    } else if (isGap && inSolid) {
      inSolid = false;
      segments.push({ start: startIdx, end: i - 1 });
    }
  }
  if (inSolid) {
    // If wrapping around index 0 is solid, handle seamless closure
    if (segments.length > 0 && segments[0].start === 0 && !track.inGap(0)) {
      segments[0].start = startIdx; // Merged wrapped segment
    } else {
      segments.push({ start: startIdx, end: n - 1 });
    }
  }

  // Pre-allocate vertex buffers for main deck, underhull, walls, kerbs, and barriers
  // For ~5800 frames, combining into unified geometries per material reduces draw calls to < 10!
  const deckPos = [];
  const deckNorm = [];
  const deckUv = [];
  const deckIdx = [];

  const hullPos = [];
  const hullNorm = [];
  const hullUv = [];
  const hullIdx = [];

  const kerbPos = [];
  const kerbNorm = [];
  const kerbUv = [];
  const kerbIdx = [];

  const wallPos = [];
  const wallNorm = [];
  const wallUv = [];
  const wallIdx = [];

  const barrierPos = [];
  const barrierNorm = [];
  const barrierUv = [];
  const barrierIdx = [];

  const f0 = {};
  const f1 = {};

  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx];
    let count = seg.end >= seg.start ? (seg.end - seg.start) : (n - seg.start + seg.end);

    for (let step = 0; step < count; step++) {
      const i0 = (seg.start + step) % n;
      const i1 = (i0 + 1) % n;

      track.frame(i0 * track.actualStep, f0);
      track.frame(i1 * track.actualStep, f1);

      const s0 = i0 * track.actualStep;
      const s1 = (i0 + 1) * track.actualStep;
      const v0 = s0 / 40.0;
      const v1 = s1 / 40.0;

      // -----------------------------------------------------------------------
      // A. Main Road Deck (Top Surface)
      // -----------------------------------------------------------------------
      // 4 points forming a quad between i0 and i1
      // L0, R0 at step 0; L1, R1 at step 1
      const dBase = deckPos.length / 3;

      // Left inner edge (-halfW + kerbW)
      _vA.copy(f0.pos).addScaledVector(f0.R, -halfW + kerbW);
      deckPos.push(_vA.x, _vA.y, _vA.z);
      deckNorm.push(f0.U.x, f0.U.y, f0.U.z);
      deckUv.push(0.05, v0);

      // Right inner edge (+halfW - kerbW)
      _vA.copy(f0.pos).addScaledVector(f0.R, halfW - kerbW);
      deckPos.push(_vA.x, _vA.y, _vA.z);
      deckNorm.push(f0.U.x, f0.U.y, f0.U.z);
      deckUv.push(0.95, v0);

      // Left inner edge at step 1
      _vA.copy(f1.pos).addScaledVector(f1.R, -halfW + kerbW);
      deckPos.push(_vA.x, _vA.y, _vA.z);
      deckNorm.push(f1.U.x, f1.U.y, f1.U.z);
      deckUv.push(0.05, v1);

      // Right inner edge at step 1
      _vA.copy(f1.pos).addScaledVector(f1.R, halfW - kerbW);
      deckPos.push(_vA.x, _vA.y, _vA.z);
      deckNorm.push(f1.U.x, f1.U.y, f1.U.z);
      deckUv.push(0.95, v1);

      deckIdx.push(dBase, dBase + 2, dBase + 1, dBase + 1, dBase + 2, dBase + 3);

      // -----------------------------------------------------------------------
      // B. Red/White Hazard Kerbs (Left & Right)
      // -----------------------------------------------------------------------
      const kBase = kerbPos.length / 3;
      // Left kerb: from -halfW to -halfW + kerbW, raised by 0.15m
      _vA.copy(f0.pos).addScaledVector(f0.R, -halfW).addScaledVector(f0.U, 0.15);
      kerbPos.push(_vA.x, _vA.y, _vA.z);
      kerbNorm.push(f0.U.x, f0.U.y, f0.U.z);
      kerbUv.push(0, s0 * 0.5);

      _vA.copy(f0.pos).addScaledVector(f0.R, -halfW + kerbW);
      kerbPos.push(_vA.x, _vA.y, _vA.z);
      kerbNorm.push(f0.U.x, f0.U.y, f0.U.z);
      kerbUv.push(1, s0 * 0.5);

      _vA.copy(f1.pos).addScaledVector(f1.R, -halfW).addScaledVector(f1.U, 0.15);
      kerbPos.push(_vA.x, _vA.y, _vA.z);
      kerbNorm.push(f1.U.x, f1.U.y, f1.U.z);
      kerbUv.push(0, s1 * 0.5);

      _vA.copy(f1.pos).addScaledVector(f1.R, -halfW + kerbW);
      kerbPos.push(_vA.x, _vA.y, _vA.z);
      kerbNorm.push(f1.U.x, f1.U.y, f1.U.z);
      kerbUv.push(1, s1 * 0.5);

      kerbIdx.push(kBase, kBase + 2, kBase + 1, kBase + 1, kBase + 2, kBase + 3);

      // Right kerb: from halfW - kerbW to halfW, raised by 0.15m
      const krBase = kerbPos.length / 3;
      _vA.copy(f0.pos).addScaledVector(f0.R, halfW - kerbW);
      kerbPos.push(_vA.x, _vA.y, _vA.z);
      kerbNorm.push(f0.U.x, f0.U.y, f0.U.z);
      kerbUv.push(0, s0 * 0.5);

      _vA.copy(f0.pos).addScaledVector(f0.R, halfW).addScaledVector(f0.U, 0.15);
      kerbPos.push(_vA.x, _vA.y, _vA.z);
      kerbNorm.push(f0.U.x, f0.U.y, f0.U.z);
      kerbUv.push(1, s0 * 0.5);

      _vA.copy(f1.pos).addScaledVector(f1.R, halfW - kerbW);
      kerbPos.push(_vA.x, _vA.y, _vA.z);
      kerbNorm.push(f1.U.x, f1.U.y, f1.U.z);
      kerbUv.push(0, s1 * 0.5);

      _vA.copy(f1.pos).addScaledVector(f1.R, halfW).addScaledVector(f1.U, 0.15);
      kerbPos.push(_vA.x, _vA.y, _vA.z);
      kerbNorm.push(f1.U.x, f1.U.y, f1.U.z);
      kerbUv.push(1, s1 * 0.5);

      kerbIdx.push(krBase, krBase + 2, krBase + 1, krBase + 1, krBase + 2, krBase + 3);

      // -----------------------------------------------------------------------
      // C. Solid Barrier Walls (1.2m high, 0.7m thick)
      // -----------------------------------------------------------------------
      // Left Wall inner face (facing track center, normal = +R)
      const wBase = wallPos.length / 3;
      // Bottom inner
      _vA.copy(f0.pos).addScaledVector(f0.R, -halfW);
      wallPos.push(_vA.x, _vA.y, _vA.z);
      wallNorm.push(f0.R.x, f0.R.y, f0.R.z);
      wallUv.push(0, v0);

      // Top inner
      _vA.copy(f0.pos).addScaledVector(f0.R, -halfW).addScaledVector(f0.U, WALL_H);
      wallPos.push(_vA.x, _vA.y, _vA.z);
      wallNorm.push(f0.R.x, f0.R.y, f0.R.z);
      wallUv.push(1, v0);

      // Bottom inner step 1
      _vA.copy(f1.pos).addScaledVector(f1.R, -halfW);
      wallPos.push(_vA.x, _vA.y, _vA.z);
      wallNorm.push(f1.R.x, f1.R.y, f1.R.z);
      wallUv.push(0, v1);

      // Top inner step 1
      _vA.copy(f1.pos).addScaledVector(f1.R, -halfW).addScaledVector(f1.U, WALL_H);
      wallPos.push(_vA.x, _vA.y, _vA.z);
      wallNorm.push(f1.R.x, f1.R.y, f1.R.z);
      wallUv.push(1, v1);

      wallIdx.push(wBase, wBase + 1, wBase + 2, wBase + 1, wBase + 3, wBase + 2);

      // Left Wall top cap
      const wtBase = wallPos.length / 3;
      _vA.copy(f0.pos).addScaledVector(f0.R, -halfW).addScaledVector(f0.U, WALL_H);
      wallPos.push(_vA.x, _vA.y, _vA.z);
      wallNorm.push(f0.U.x, f0.U.y, f0.U.z);
      wallUv.push(0, v0);

      _vA.copy(f0.pos).addScaledVector(f0.R, -halfW - WALL_THICK).addScaledVector(f0.U, WALL_H);
      wallPos.push(_vA.x, _vA.y, _vA.z);
      wallNorm.push(f0.U.x, f0.U.y, f0.U.z);
      wallUv.push(1, v0);

      _vA.copy(f1.pos).addScaledVector(f1.R, -halfW).addScaledVector(f1.U, WALL_H);
      wallPos.push(_vA.x, _vA.y, _vA.z);
      wallNorm.push(f1.U.x, f1.U.y, f1.U.z);
      wallUv.push(0, v1);

      _vA.copy(f1.pos).addScaledVector(f1.R, -halfW - WALL_THICK).addScaledVector(f1.U, WALL_H);
      wallPos.push(_vA.x, _vA.y, _vA.z);
      wallNorm.push(f1.U.x, f1.U.y, f1.U.z);
      wallUv.push(1, v1);

      wallIdx.push(wtBase, wtBase + 2, wtBase + 1, wtBase + 1, wtBase + 2, wtBase + 3);

      // Right Wall inner face (facing track center, normal = -R)
      const wrBase = wallPos.length / 3;
      _vA.copy(f0.pos).addScaledVector(f0.R, halfW);
      wallPos.push(_vA.x, _vA.y, _vA.z);
      wallNorm.push(-f0.R.x, -f0.R.y, -f0.R.z);
      wallUv.push(0, v0);

      _vA.copy(f0.pos).addScaledVector(f0.R, halfW).addScaledVector(f0.U, WALL_H);
      wallPos.push(_vA.x, _vA.y, _vA.z);
      wallNorm.push(-f0.R.x, -f0.R.y, -f0.R.z);
      wallUv.push(1, v0);

      _vA.copy(f1.pos).addScaledVector(f1.R, halfW);
      wallPos.push(_vA.x, _vA.y, _vA.z);
      wallNorm.push(-f1.R.x, -f1.R.y, -f1.R.z);
      wallUv.push(0, v1);

      _vA.copy(f1.pos).addScaledVector(f1.R, halfW).addScaledVector(f1.U, WALL_H);
      wallPos.push(_vA.x, _vA.y, _vA.z);
      wallNorm.push(-f1.R.x, -f1.R.y, -f1.R.z);
      wallUv.push(1, v1);

      wallIdx.push(wrBase, wrBase + 2, wrBase + 1, wrBase + 1, wrBase + 2, wrBase + 3);

      // Right Wall top cap
      const wrtBase = wallPos.length / 3;
      _vA.copy(f0.pos).addScaledVector(f0.R, halfW).addScaledVector(f0.U, WALL_H);
      wallPos.push(_vA.x, _vA.y, _vA.z);
      wallNorm.push(f0.U.x, f0.U.y, f0.U.z);
      wallUv.push(0, v0);

      _vA.copy(f0.pos).addScaledVector(f0.R, halfW + WALL_THICK).addScaledVector(f0.U, WALL_H);
      wallPos.push(_vA.x, _vA.y, _vA.z);
      wallNorm.push(f0.U.x, f0.U.y, f0.U.z);
      wallUv.push(1, v0);

      _vA.copy(f1.pos).addScaledVector(f1.R, halfW).addScaledVector(f1.U, WALL_H);
      wallPos.push(_vA.x, _vA.y, _vA.z);
      wallNorm.push(f1.U.x, f1.U.y, f1.U.z);
      wallUv.push(0, v1);

      _vA.copy(f1.pos).addScaledVector(f1.R, halfW + WALL_THICK).addScaledVector(f1.U, WALL_H);
      wallPos.push(_vA.x, _vA.y, _vA.z);
      wallNorm.push(f1.U.x, f1.U.y, f1.U.z);
      wallUv.push(1, v1);

      wallIdx.push(wrtBase, wrtBase + 1, wrtBase + 2, wrtBase + 1, wrtBase + 3, wrtBase + 2);

      // -----------------------------------------------------------------------
      // D. Energy Barrier Forcefields (5.0m high above deck, atop walls)
      // -----------------------------------------------------------------------
      // Left Barrier: from WALL_H to FIELD_H at -halfW - WALL_THICK*0.5
      const bBase = barrierPos.length / 3;
      _vA.copy(f0.pos).addScaledVector(f0.R, -halfW - WALL_THICK * 0.5).addScaledVector(f0.U, WALL_H);
      barrierPos.push(_vA.x, _vA.y, _vA.z);
      barrierNorm.push(f0.R.x, f0.R.y, f0.R.z);
      barrierUv.push(0, v0 * 2.0);

      _vA.copy(f0.pos).addScaledVector(f0.R, -halfW - WALL_THICK * 0.5).addScaledVector(f0.U, FIELD_H);
      barrierPos.push(_vA.x, _vA.y, _vA.z);
      barrierNorm.push(f0.R.x, f0.R.y, f0.R.z);
      barrierUv.push(1, v0 * 2.0);

      _vA.copy(f1.pos).addScaledVector(f1.R, -halfW - WALL_THICK * 0.5).addScaledVector(f1.U, WALL_H);
      barrierPos.push(_vA.x, _vA.y, _vA.z);
      barrierNorm.push(f1.R.x, f1.R.y, f1.R.z);
      barrierUv.push(0, v1 * 2.0);

      _vA.copy(f1.pos).addScaledVector(f1.R, -halfW - WALL_THICK * 0.5).addScaledVector(f1.U, FIELD_H);
      barrierPos.push(_vA.x, _vA.y, _vA.z);
      barrierNorm.push(f1.R.x, f1.R.y, f1.R.z);
      barrierUv.push(1, v1 * 2.0);

      barrierIdx.push(bBase, bBase + 1, bBase + 2, bBase + 1, bBase + 3, bBase + 2);

      // Right Barrier: from WALL_H to FIELD_H at +halfW + WALL_THICK*0.5
      const brBase = barrierPos.length / 3;
      _vA.copy(f0.pos).addScaledVector(f0.R, halfW + WALL_THICK * 0.5).addScaledVector(f0.U, WALL_H);
      barrierPos.push(_vA.x, _vA.y, _vA.z);
      barrierNorm.push(-f0.R.x, -f0.R.y, -f0.R.z);
      barrierUv.push(0, v0 * 2.0);

      _vA.copy(f0.pos).addScaledVector(f0.R, halfW + WALL_THICK * 0.5).addScaledVector(f0.U, FIELD_H);
      barrierPos.push(_vA.x, _vA.y, _vA.z);
      barrierNorm.push(-f0.R.x, -f0.R.y, -f0.R.z);
      barrierUv.push(1, v0 * 2.0);

      _vA.copy(f1.pos).addScaledVector(f1.R, halfW + WALL_THICK * 0.5).addScaledVector(f1.U, WALL_H);
      barrierPos.push(_vA.x, _vA.y, _vA.z);
      barrierNorm.push(-f1.R.x, -f1.R.y, -f1.R.z);
      barrierUv.push(0, v1 * 2.0);

      _vA.copy(f1.pos).addScaledVector(f1.R, halfW + WALL_THICK * 0.5).addScaledVector(f1.U, FIELD_H);
      barrierPos.push(_vA.x, _vA.y, _vA.z);
      barrierNorm.push(-f1.R.x, -f1.R.y, -f1.R.z);
      barrierUv.push(1, v1 * 2.0);

      barrierIdx.push(brBase, brBase + 2, brBase + 1, brBase + 1, brBase + 2, brBase + 3);

      // -----------------------------------------------------------------------
      // E. Underhull Girder Belly (Structural Steel Plates)
      // -----------------------------------------------------------------------
      // V-shaped structural keel: Left outer (-halfW-WALL_THICK), Center keel (-DECK_THICK*1.6), Right outer
      const hBase = hullPos.length / 3;

      // 0: Left outer lower
      _vA.copy(f0.pos).addScaledVector(f0.R, -halfW - WALL_THICK).addScaledVector(f0.U, -DECK_THICK);
      hullPos.push(_vA.x, _vA.y, _vA.z);
      hullNorm.push(-f0.U.x, -f0.U.y, -f0.U.z);
      hullUv.push(0, v0 * 3.0);

      // 1: Center keel lower
      _vA.copy(f0.pos).addScaledVector(f0.U, -DECK_THICK * 1.8);
      hullPos.push(_vA.x, _vA.y, _vA.z);
      hullNorm.push(-f0.U.x, -f0.U.y, -f0.U.z);
      hullUv.push(0.5, v0 * 3.0);

      // 2: Right outer lower
      _vA.copy(f0.pos).addScaledVector(f0.R, halfW + WALL_THICK).addScaledVector(f0.U, -DECK_THICK);
      hullPos.push(_vA.x, _vA.y, _vA.z);
      hullNorm.push(-f0.U.x, -f0.U.y, -f0.U.z);
      hullUv.push(1.0, v0 * 3.0);

      // Step 1:
      // 3: Left outer lower
      _vA.copy(f1.pos).addScaledVector(f1.R, -halfW - WALL_THICK).addScaledVector(f1.U, -DECK_THICK);
      hullPos.push(_vA.x, _vA.y, _vA.z);
      hullNorm.push(-f1.U.x, -f1.U.y, -f1.U.z);
      hullUv.push(0, v1 * 3.0);

      // 4: Center keel lower
      _vA.copy(f1.pos).addScaledVector(f1.U, -DECK_THICK * 1.8);
      hullPos.push(_vA.x, _vA.y, _vA.z);
      hullNorm.push(-f1.U.x, -f1.U.y, -f1.U.z);
      hullUv.push(0.5, v1 * 3.0);

      // 5: Right outer lower
      _vA.copy(f1.pos).addScaledVector(f1.R, halfW + WALL_THICK).addScaledVector(f1.U, -DECK_THICK);
      hullPos.push(_vA.x, _vA.y, _vA.z);
      hullNorm.push(-f1.U.x, -f1.U.y, -f1.U.z);
      hullUv.push(1.0, v1 * 3.0);

      // Left underside quad (0, 3, 1, 1, 3, 4)
      hullIdx.push(hBase + 0, hBase + 3, hBase + 1, hBase + 1, hBase + 3, hBase + 4);
      // Right underside quad (1, 4, 2, 2, 4, 5)
      hullIdx.push(hBase + 1, hBase + 4, hBase + 2, hBase + 2, hBase + 4, hBase + 5);
    }
  }

  // Helper to compile buffer attributes
  function makeMesh(positions, normals, uvs, indices, material, name) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // Instantiate the unified geometry meshes
  root.add(makeMesh(deckPos, deckNorm, deckUv, deckIdx, getDeckMaterial(), 'track_deck'));
  root.add(makeMesh(kerbPos, kerbNorm, kerbUv, kerbIdx, getKerbMaterial(), 'track_kerbs'));
  root.add(makeMesh(wallPos, wallNorm, wallUv, wallIdx, getHullMaterial(), 'track_walls'));
  root.add(makeMesh(hullPos, hullNorm, hullUv, hullIdx, getHullMaterial(), 'track_underhull'));

  const barrierMesh = makeMesh(barrierPos, barrierNorm, barrierUv, barrierIdx, getBarrierMaterial(), 'track_barriers');
  barrierMesh.castShadow = false; // Energy field doesn't cast solid shadow
  root.add(barrierMesh);

  // -------------------------------------------------------------------------
  // 2. Jump Gap Lips & Caps (watertight ends and angled kicker plates)
  // -------------------------------------------------------------------------
  const gapLipGroup = new THREE.Group();
  gapLipGroup.name = 'gap_lips';
  const lipGeom = new THREE.BoxGeometry(TRACK_W + WALL_THICK * 2, 2.5, 8.0);
  const capGeom = new THREE.BoxGeometry(TRACK_W + WALL_THICK * 2, DECK_THICK * 2.2, 2.0);
  const hullMat = getHullMaterial();

  for (let g = 0; g < track.gaps.length; g++) {
    const [s0, s1] = track.gaps[g];

    // Departure Lip at s0
    track.frame(s0, f0);
    const lipOut = new THREE.Mesh(lipGeom, hullMat);
    lipOut.position.copy(f0.pos).addScaledVector(f0.U, 0.4).addScaledVector(f0.T, -3.0);
    const mOut = new THREE.Matrix4().makeBasis(f0.R, f0.U, f0.T);
    lipOut.quaternion.setFromRotationMatrix(mOut);
    lipOut.rotation.x -= 0.12; // Slight ramp up
    gapLipGroup.add(lipOut);

    // End cap closing the hollow cross section at s0
    const capOut = new THREE.Mesh(capGeom, hullMat);
    capOut.position.copy(f0.pos).addScaledVector(f0.U, -DECK_THICK * 0.5);
    capOut.quaternion.setFromRotationMatrix(mOut);
    gapLipGroup.add(capOut);

    // Arrival Receiver Lip at s1
    track.frame(s1, f1);
    const lipIn = new THREE.Mesh(lipGeom, hullMat);
    lipIn.position.copy(f1.pos).addScaledVector(f1.U, -0.4).addScaledVector(f1.T, 3.0);
    const mIn = new THREE.Matrix4().makeBasis(f1.R, f1.U, f1.T);
    lipIn.quaternion.setFromRotationMatrix(mIn);
    gapLipGroup.add(lipIn);

    // End cap closing the hollow cross section at s1
    const capIn = new THREE.Mesh(capGeom, hullMat);
    capIn.position.copy(f1.pos).addScaledVector(f1.U, -DECK_THICK * 0.5);
    capIn.quaternion.setFromRotationMatrix(mIn);
    gapLipGroup.add(capIn);
  }
  root.add(gapLipGroup);

  // -------------------------------------------------------------------------
  // 3. Gantries Every 300 m with Lamp Posts
  // -------------------------------------------------------------------------
  const gantryGroup = new THREE.Group();
  gantryGroup.name = 'gantries';
  const girderMat = getGirderMaterial();

  const gantryPylonGeom = new THREE.BoxGeometry(2.5, 14.0, 2.5);
  const gantryBeamGeom = new THREE.BoxGeometry(TRACK_W + 8.0, 2.2, 2.8);
  const lampFixtureGeom = new THREE.CylinderGeometry(0.8, 1.4, 1.8, 8);
  const lampLensMat = new THREE.MeshBasicMaterial({ color: 0xffeedd });

  const gantryInterval = 300.0;
  const numGantries = Math.floor(track.length / gantryInterval);

  for (let g = 0; g < numGantries; g++) {
    const s = g * gantryInterval;
    if (track.inGap(s)) continue; // Don't float gantries over jump cuts

    track.frame(s, f0);
    const arch = new THREE.Group();

    // Left pylon
    const pLeft = new THREE.Mesh(gantryPylonGeom, girderMat);
    pLeft.position.set(-halfW - 3.5, 7.0, 0);
    arch.add(pLeft);

    // Right pylon
    const pRight = new THREE.Mesh(gantryPylonGeom, girderMat);
    pRight.position.set(halfW + 3.5, 7.0, 0);
    arch.add(pRight);

    // Cross beam
    const beam = new THREE.Mesh(gantryBeamGeom, girderMat);
    beam.position.set(0, 13.5, 0);
    arch.add(beam);

    // 4 downward lamps across the span
    for (let l = -1.5; l <= 1.5; l += 1.0) {
      const lamp = new THREE.Mesh(lampFixtureGeom, lampLensMat);
      lamp.position.set(l * 10.0, 12.0, 0);
      lamp.rotation.x = Math.PI;
      arch.add(lamp);
    }

    const mat = new THREE.Matrix4().makeBasis(f0.R, f0.U, f0.T);
    arch.quaternion.setFromRotationMatrix(mat);
    arch.position.copy(f0.pos);
    gantryGroup.add(arch);
  }
  root.add(gantryGroup);

  // -------------------------------------------------------------------------
  // 4. Start Gantry + Start / Finish Line at s = 0
  // -------------------------------------------------------------------------
  const startGroup = new THREE.Group();
  startGroup.name = 'start_gantry';
  track.frame(0, f0);

  // Grand double-truss arch
  const startBeamGeom = new THREE.BoxGeometry(TRACK_W + 12.0, 4.0, 5.0);
  const startPylonGeom = new THREE.BoxGeometry(4.0, 18.0, 5.0);
  const startArch = new THREE.Group();

  const spLeft = new THREE.Mesh(startPylonGeom, girderMat);
  spLeft.position.set(-halfW - 5.0, 9.0, 0);
  startArch.add(spLeft);

  const spRight = new THREE.Mesh(startPylonGeom, girderMat);
  spRight.position.set(halfW + 5.0, 9.0, 0);
  startArch.add(spRight);

  const sBeam = new THREE.Mesh(startBeamGeom, girderMat);
  sBeam.position.set(0, 17.0, 0);
  startArch.add(sBeam);

  // 5 Countdown start light pods
  const redLightMat = new THREE.MeshBasicMaterial({ color: 0xff0022 });
  const lightHousingGeom = new THREE.CylinderGeometry(1.2, 1.2, 1.0, 16);
  for (let i = -2; i <= 2; i++) {
    const light = new THREE.Mesh(lightHousingGeom, redLightMat);
    light.position.set(i * 5.0, 14.0, 2.6);
    light.rotation.x = Math.PI * 0.5;
    startArch.add(light);
  }

  const mStart = new THREE.Matrix4().makeBasis(f0.R, f0.U, f0.T);
  startArch.quaternion.setFromRotationMatrix(mStart);
  startArch.position.copy(f0.pos);
  startGroup.add(startArch);

  // Start Line across deck: checkerboard texture
  const lineCanvas = document.createElement('canvas');
  lineCanvas.width = 512;
  lineCanvas.height = 64;
  const lctx = lineCanvas.getContext('2d');
  lctx.fillStyle = '#ffffff';
  lctx.fillRect(0, 0, 512, 64);
  lctx.fillStyle = '#111111';
  for (let c = 0; c < 16; c++) {
    for (let r = 0; r < 2; r++) {
      if ((c + r) % 2 === 1) lctx.fillRect(c * 32, r * 32, 32, 32);
    }
  }
  const lineTex = new THREE.CanvasTexture(lineCanvas);
  lineTex.colorSpace = THREE.SRGBColorSpace;
  const lineMat = new THREE.MeshBasicMaterial({
    map: lineTex,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -4.0,
    depthWrite: false
  });
  const lineGeom = new THREE.PlaneGeometry(TRACK_W - 4.0, 6.0);
  const startLine = new THREE.Mesh(lineGeom, lineMat);
  startLine.rotation.x = -Math.PI * 0.5;
  startLine.position.set(0, 0.08, 0); // Flush on deck with polygon offset to eliminate z-fighting
  startArch.add(startLine);

  root.add(startGroup);

  // -------------------------------------------------------------------------
  // 5. Boost Pad Meshes
  // -------------------------------------------------------------------------
  const padGroup = new THREE.Group();
  padGroup.name = 'boost_pads';
  const padGeom = new THREE.PlaneGeometry(8.0, 16.0);
  const padMat = getBoostPadMaterial();

  for (let p = 0; p < track.pads.length; p++) {
    const padDef = track.pads[p];
    track.frame(padDef.s, f0);

    const padMesh = new THREE.Mesh(padGeom, padMat);
    padMesh.position.copy(f0.pos)
      .addScaledVector(f0.R, padDef.x)
      .addScaledVector(f0.U, 0.08); // Floating just above deck surface

    const mPad = new THREE.Matrix4().makeBasis(f0.R, f0.U, f0.T);
    padMesh.quaternion.setFromRotationMatrix(mPad);
    padMesh.rotation.x += Math.PI * 0.5; // Lay flat along deck

    padGroup.add(padMesh);
  }
  root.add(padGroup);

  // -------------------------------------------------------------------------
  // 6. Light Gates on Detailed Emitter Pylons
  // -------------------------------------------------------------------------
  const gateGroup = new THREE.Group();
  gateGroup.name = 'light_gates';
  const ringGeom = new THREE.TorusGeometry(halfW + 3.0, 0.8, 8, 32, Math.PI);

  // Reusable geometries for detailed emitter pylons
  const pylonBaseGeom = new THREE.BoxGeometry(4.2, 2.5, 4.6);
  const pylonColGeom = new THREE.BoxGeometry(2.4, 15.0, 3.2);
  const pylonConduitGeom = new THREE.CylinderGeometry(0.22, 0.22, 14.5, 8);
  const pylonHeadGeom = new THREE.BoxGeometry(3.2, 3.2, 3.8);
  const pylonEmitterRingGeom = new THREE.TorusGeometry(1.2, 0.25, 8, 16);
  pylonEmitterRingGeom.rotateY(Math.PI * 0.5);
  const pylonBeaconGeom = new THREE.SphereGeometry(0.35, 8, 8);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3322, toneMapped: false });

  function createEmitterPylon(gateColor, isLeft) {
    const pylon = new THREE.Group();
    pylon.name = isLeft ? 'emitter_pylon_left' : 'emitter_pylon_right';

    // 1. Heavy Footing anchored to foundation
    const baseMesh = new THREE.Mesh(pylonBaseGeom, girderMat);
    baseMesh.position.set(0, 1.25, 0);
    pylon.add(baseMesh);

    // 2. Main Structural Column
    const colMesh = new THREE.Mesh(pylonColGeom, girderMat);
    colMesh.position.set(0, 8.5, 0);
    pylon.add(colMesh);

    // 3. Twin High-Voltage Conduit Runs
    const condL = new THREE.Mesh(pylonConduitGeom, hullMat);
    condL.name = 'pylon_conduit_run';
    condL.position.set(-0.65, 8.5, 1.3);
    pylon.add(condL);
    const condR = new THREE.Mesh(pylonConduitGeom, hullMat);
    condR.name = 'pylon_conduit_run';
    condR.position.set(0.65, 8.5, 1.3);
    pylon.add(condR);

    // 4. Cantilevered Projector Head
    const headMesh = new THREE.Mesh(pylonHeadGeom, hullMat);
    headMesh.name = 'pylon_projector_head';
    headMesh.position.set(isLeft ? 0.6 : -0.6, 16.5, 0);
    pylon.add(headMesh);

    // 5. Glowing Emitter Ring
    const emitMat = new THREE.MeshBasicMaterial({ color: gateColor, toneMapped: false });
    const emitRing = new THREE.Mesh(pylonEmitterRingGeom, emitMat);
    emitRing.name = 'pylon_emitter_ring';
    emitRing.position.set(isLeft ? 1.8 : -1.8, 16.5, 0);
    pylon.add(emitRing);

    // 6. Hazard Warning Strobe
    const beacon = new THREE.Mesh(pylonBeaconGeom, beaconMat);
    beacon.position.set(0, 18.3, 0);
    pylon.add(beacon);

    return pylon;
  }

  for (let g = 0; g < track.gates.length; g++) {
    const gateDef = track.gates[g];
    track.frame(gateDef.s, f0);

    const gate = new THREE.Group();
    const gateColor = gateDef.color || 0x00d2ff;
    const gateMat = new THREE.MeshBasicMaterial({
      color: gateColor,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });

    // Left and Right detailed emitter pylons
    const pyLeft = createEmitterPylon(gateColor, true);
    pyLeft.position.set(-halfW - 3.2, 0, 0);
    gate.add(pyLeft);

    const pyRight = createEmitterPylon(gateColor, false);
    pyRight.position.set(halfW + 3.2, 0, 0);
    gate.add(pyRight);

    // Glowing energy ring arch
    const ring = new THREE.Mesh(ringGeom, gateMat);
    ring.position.set(0, 0, 0);
    ring.rotation.z = 0;
    gate.add(ring);

    const mGate = new THREE.Matrix4().makeBasis(f0.R, f0.U, f0.T);
    gate.quaternion.setFromRotationMatrix(mGate);
    gate.position.copy(f0.pos);

    gateGroup.add(gate);
  }
  root.add(gateGroup);

  // -------------------------------------------------------------------------
  // 7. Glass Canopy Tunnel (The Cave Section: 7100m to 8300m)
  // -------------------------------------------------------------------------
  const tunnelGroup = new THREE.Group();
  tunnelGroup.name = 'glass_tunnel';
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x2288cc,
    transparent: true,
    opacity: 0.28,
    roughness: 0.1,
    metalness: 0.9,
    side: THREE.DoubleSide
  });

  for (let t = 0; t < track.tunnels.length; t++) {
    const [t0, t1] = track.tunnels[t];
    const tLen = t1 - t0;
    const tSteps = Math.floor(tLen / (track.actualStep * 4.0)); // Sample every 8m

    const tPos = [];
    const tNorm = [];
    const tUv = [];
    const tIdx = [];

    // Hexagonal canopy arch profile (5 vertices from left wall to right wall)
    const arcAngles = [Math.PI, Math.PI * 0.75, Math.PI * 0.5, Math.PI * 0.25, 0];
    const archR = halfW + 1.5;

    for (let step = 0; step < tSteps; step++) {
      const sA = t0 + step * (track.actualStep * 4.0);
      const sB = sA + track.actualStep * 4.0;
      track.frame(sA, f0);
      track.frame(sB, f1);

      const baseV = tPos.length / 3;

      // 5 arc points at sA
      for (let a = 0; a < 5; a++) {
        const theta = arcAngles[a];
        const rX = Math.cos(theta) * archR;
        const uY = Math.sin(theta) * (archR * 0.7) + WALL_H;
        _vA.copy(f0.pos).addScaledVector(f0.R, rX).addScaledVector(f0.U, uY);
        tPos.push(_vA.x, _vA.y, _vA.z);
        tNorm.push(f0.U.x, f0.U.y, f0.U.z);
        tUv.push(a / 4.0, step * 0.2);
      }

      // 5 arc points at sB
      for (let a = 0; a < 5; a++) {
        const theta = arcAngles[a];
        const rX = Math.cos(theta) * archR;
        const uY = Math.sin(theta) * (archR * 0.7) + WALL_H;
        _vA.copy(f1.pos).addScaledVector(f1.R, rX).addScaledVector(f1.U, uY);
        tPos.push(_vA.x, _vA.y, _vA.z);
        tNorm.push(f1.U.x, f1.U.y, f1.U.z);
        tUv.push(a / 4.0, (step + 1) * 0.2);
      }

      // 4 quad strips between the 5 arc segments
      for (let q = 0; q < 4; q++) {
        const p00 = baseV + q;
        const p01 = baseV + q + 1;
        const p10 = baseV + 5 + q;
        const p11 = baseV + 5 + q + 1;
        tIdx.push(p00, p10, p01, p01, p10, p11);
      }
    }

    const tGeom = new THREE.BufferGeometry();
    tGeom.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
    tGeom.setAttribute('normal', new THREE.Float32BufferAttribute(tNorm, 3));
    tGeom.setAttribute('uv', new THREE.Float32BufferAttribute(tUv, 2));
    tGeom.setIndex(tIdx);
    tGeom.computeVertexNormals();

    const tMesh = new THREE.Mesh(tGeom, glassMat);
    tunnelGroup.add(tMesh);
  }
  root.add(tunnelGroup);

  // -------------------------------------------------------------------------
  // 8. Gravity Flip Fields (flipFields() tubes of light, magenta-violet theme)
  // -------------------------------------------------------------------------
  const flipGroup = flipFields(track);
  root.add(flipGroup);

  // -------------------------------------------------------------------------
  // 9. Asteroid Field & Deep Space Truss Towers
  // -------------------------------------------------------------------------
  const asteroidField = createAsteroidField(280, track, 42);
  root.add(asteroidField);

  const trussTowers = createTrussTowers(track, 16);
  root.add(trussTowers);

  if (scene) {
    scene.add(root);
  }

  return root;
}

export class TrackMesh {
  constructor(track, scene = null) {
    this.track = track;
    this.group = buildTrackMeshes(track, scene);
  }
}

export function flipFields(track) {
  const flipGroup = new THREE.Group();
  flipGroup.name = 'flip_fields';
  if (!track || !track.flips || track.flips.length === 0) return flipGroup;

  const halfW = TRACK_W * 0.5;
  // Magenta-violet theme flip:[0.62, 0.24, 1.0]
  const flipColor = new THREE.Color(0.62, 0.24, 1.0);
  const flipMat = new THREE.MeshBasicMaterial({
    color: flipColor,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const f0 = {};

  for (let f = 0; f < track.flips.length; f++) {
    const [s0, s1] = track.flips[f];
    const len = s1 - s0;
    const numSamples = Math.max(12, Math.round(len / 15.0));

    // 1. Longitudinal guide tubes of light along left, right, and center
    const leftPts = [];
    const rightPts = [];
    const centerPts = [];

    for (let i = 0; i <= numSamples; i++) {
      const s = s0 + (i / numSamples) * len;
      track.frame(s, f0);

      const pL = new THREE.Vector3().copy(f0.pos)
        .addScaledVector(f0.R, -halfW - 0.5)
        .addScaledVector(f0.U, 1.5);
      leftPts.push(pL);

      const pR = new THREE.Vector3().copy(f0.pos)
        .addScaledVector(f0.R, halfW + 0.5)
        .addScaledVector(f0.U, 1.5);
      rightPts.push(pR);

      const pC = new THREE.Vector3().copy(f0.pos)
        .addScaledVector(f0.U, FIELD_H * 0.5);
      centerPts.push(pC);
    }

    const cLeft = new THREE.CatmullRomCurve3(leftPts);
    const cRight = new THREE.CatmullRomCurve3(rightPts);
    const cCenter = new THREE.CatmullRomCurve3(centerPts);

    const tubeGeomL = new THREE.TubeGeometry(cLeft, numSamples * 4, 0.7, 8, false);
    const tubeGeomR = new THREE.TubeGeometry(cRight, numSamples * 4, 0.7, 8, false);
    const tubeGeomC = new THREE.TubeGeometry(cCenter, numSamples * 4, 0.45, 8, false);

    flipGroup.add(new THREE.Mesh(tubeGeomL, flipMat));
    flipGroup.add(new THREE.Mesh(tubeGeomR, flipMat));
    flipGroup.add(new THREE.Mesh(tubeGeomC, flipMat));

    // 2. Transverse field rings / hoops spaced every ~25m along the flip
    const ringCount = Math.floor(len / 25.0);
    const ringGeom = new THREE.TorusGeometry(halfW + 2.0, 0.55, 8, 36);

    for (let r = 0; r <= ringCount; r++) {
      const s = s0 + (r / ringCount) * len;
      track.frame(s, f0);

      const ringMesh = new THREE.Mesh(ringGeom, flipMat);
      const mRing = new THREE.Matrix4().makeBasis(f0.R, f0.U, f0.T);
      ringMesh.quaternion.setFromRotationMatrix(mRing);
      ringMesh.position.copy(f0.pos).addScaledVector(f0.U, 2.0);
      flipGroup.add(ringMesh);
    }
  }

  return flipGroup;
}
