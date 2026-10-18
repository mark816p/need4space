// src/track.js — Track spline, Frenet/RMF frames, spatial index, and space circuit layout
// Why: Fixed 2m discretization with double-reflection RMF guarantees C2 continuity and zero loop frame flips

import * as THREE from 'three';
import { clamp, lerp } from './noise.js';
import { buildTrackMeshes } from './trackmesh.js';
export { TrackRacer, PITCH_AIR } from './trackracer.js';

export const STEP = 2.0;           // 2 m frame spacing along track
export const TRACK_W_V1 = 44.0;    // 44 m road width in v1.0 (expanded to 56 m in P4)
export let TRACK_W = 56.0;         // 56 m road width ("the roads are a bit bigger in redout")
export const FIELD_H = 5.0;        // 5.0 m energy barrier height above deck
export const WALL_H = 1.2;         // 1.2 m solid barrier height
export const WALL_THICK = 0.7;     // 0.7 m wall thickness
export const DECK_THICK = 1.8;     // 1.8 m deck slab thickness

// Helper to define control points
export function pt(x, y, z, bank = 0, name = '') {
  return { pos: new THREE.Vector3(x, y, z), bank: THREE.MathUtils.degToRad(bank), name };
}

// Scratch vectors to avoid per-query allocations
const _pA = new THREE.Vector3();
const _pB = new THREE.Vector3();
const _tA = new THREE.Vector3();
const _tB = new THREE.Vector3();
const _uA = new THREE.Vector3();
const _uB = new THREE.Vector3();
const _rA = new THREE.Vector3();
const _rB = new THREE.Vector3();

export class Track {
  constructor(controlPoints, features = {}) {
    this.controlPoints = controlPoints;
    this.features = features;

    // Feature zones
    this.gaps = [...(features.gaps || [])];   // [[s0, s1], ...]
    this.loops = features.loops || [];       // [[s0, s1], ...]
    this.tunnels = features.tunnels || [];   // [[s0, s1], ...]
    this.caves = features.caves || [];       // [[s0, s1], ...]
    this.pads = features.pads || [];         // [{ s, x, kind: 'boost' }, ...]
    this.gates = features.gates || [];       // [{ s, color }, ...]
    this.flips = features.flips || [];       // [[s0, s1], ...]
    this.name = features.name || 'space';

    // Flips also go into gaps for meshes/lips/AI planning
    for (let i = 0; i < this.flips.length; i++) {
      const [f0, f1] = this.flips[i];
      if (!this.gaps.some(([g0, g1]) => Math.abs(g0 - f0) < 5 && Math.abs(g1 - f1) < 5)) {
        this.gaps.push([f0, f1]);
      }
    }

    this._buildCurve();
    this._buildFrames();
    this._buildSpeedProfile();
    this._buildSpatialIndex();
  }

  _buildCurve() {
    const pts = this.controlPoints.map(c => c.pos);
    // Centripetal Catmull-Rom prevents overshoots and loops on sharp transitions
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    this.curve.arcLengthDivisions = 20000;
    this.length = this.curve.getLength();
    this.n = Math.round(this.length / STEP);
    this.actualStep = this.length / this.n;
  }

  _buildFrames() {
    const n = this.n;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);

    this.tx = new Float32Array(n);
    this.ty = new Float32Array(n);
    this.tz = new Float32Array(n);

    this.ux = new Float32Array(n);
    this.uy = new Float32Array(n);
    this.uz = new Float32Array(n);

    this.rx = new Float32Array(n);
    this.ry = new Float32Array(n);
    this.rz = new Float32Array(n);

    this.bank = new Float32Array(n);
    this.solid = new Uint8Array(n);
    this.solid.fill(1);

    // 1. Resample raw curve positions and tangents
    const rawPos = [];
    const rawTangents = [];
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const p = this.curve.getPointAt(u);
      const t = this.curve.getTangentAt(u).normalize();
      rawPos.push(p);
      rawTangents.push(t);
    }

    // 2. Three passes of smoothing: (a + 2b + c) / 4 to eliminate micro-inflections
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < n; i++) {
        const prev = rawPos[(i - 1 + n) % n];
        const curr = rawPos[i];
        const next = rawPos[(i + 1) % n];
        curr.x = (prev.x + 2 * curr.x + next.x) * 0.25;
        curr.y = (prev.y + 2 * curr.y + next.y) * 0.25;
        curr.z = (prev.z + 2 * curr.z + next.z) * 0.25;
      }
    }

    // Recompute smoothed tangents
    for (let i = 0; i < n; i++) {
      const prev = rawPos[(i - 1 + n) % n];
      const next = rawPos[(i + 1) % n];
      rawTangents[i].subVectors(next, prev).normalize();
    }

    // 3. Double-reflection Rotation Minimizing Frames (RMF)
    // Why: Carries frames through loops and barrel rolls without torsion flipping
    const rmfR = [new THREE.Vector3()];
    const rmfU = [new THREE.Vector3()];

    // Initial seed frame: world up or cross product
    let seedUp = new THREE.Vector3(0, 1, 0);
    if (Math.abs(rawTangents[0].dot(seedUp)) > 0.95) seedUp.set(0, 0, 1);
    rmfR[0].crossVectors(rawTangents[0], seedUp).normalize();
    rmfU[0].crossVectors(rmfR[0], rawTangents[0]).normalize();

    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const rL = new THREE.Vector3();
    const tL = new THREE.Vector3();

    for (let i = 0; i < n - 1; i++) {
      const p0 = rawPos[i];
      const p1 = rawPos[i + 1];
      const t0 = rawTangents[i];
      const t1 = rawTangents[i + 1];
      const r0 = rmfR[i];

      // Reflection plane 1: bisector of p0 and p1
      v1.subVectors(p1, p0);
      const c1 = v1.dot(v1);
      rL.copy(r0).addScaledVector(v1, -2.0 * v1.dot(r0) / c1);
      tL.copy(t0).addScaledVector(v1, -2.0 * v1.dot(t0) / c1);

      // Reflection plane 2: bisector of tL and t1
      v2.subVectors(t1, tL);
      const c2 = v2.dot(v2);
      const r1 = new THREE.Vector3();
      if (c2 > 1e-7) {
        r1.copy(rL).addScaledVector(v2, -2.0 * v2.dot(rL) / c2);
      } else {
        r1.copy(rL);
      }
      r1.normalize();
      const u1 = new THREE.Vector3().crossVectors(r1, t1).normalize();

      rmfR.push(r1);
      rmfU.push(u1);
    }

    // 4. Distribute loop holonomy / residual angle evenly along closed track
    // Reflection from last point back to first
    v1.subVectors(rawPos[0], rawPos[n - 1]);
    const c1Last = v1.dot(v1);
    rL.copy(rmfR[n - 1]).addScaledVector(v1, -2.0 * v1.dot(rmfR[n - 1]) / c1Last);
    tL.copy(rawTangents[n - 1]).addScaledVector(v1, -2.0 * v1.dot(rawTangents[n - 1]) / c1Last);
    v2.subVectors(rawTangents[0], tL);
    const c2Last = v2.dot(v2);
    const rClosing = new THREE.Vector3();
    if (c2Last > 1e-7) {
      rClosing.copy(rL).addScaledVector(v2, -2.0 * v2.dot(rL) / c2Last);
    } else {
      rClosing.copy(rL);
    }
    rClosing.normalize();

    // Compute residual angle between rClosing and rmfR[0]
    let residual = Math.atan2(rClosing.dot(rmfU[0]), rClosing.dot(rmfR[0]));
    // Unwind residual to [-PI, PI]
    while (residual > Math.PI) residual -= Math.PI * 2.0;
    while (residual < -Math.PI) residual += Math.PI * 2.0;

    // Distribute residual angle linearly across all frames
    for (let i = 0; i < n; i++) {
      const theta = -residual * (i / n);
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const r = rmfR[i];
      const u = rmfU[i];
      const newR = new THREE.Vector3().copy(r).multiplyScalar(cosT).addScaledVector(u, sinT).normalize();
      const newU = new THREE.Vector3().crossVectors(newR, rawTangents[i]).normalize();
      rmfR[i] = newR;
      rmfU[i] = newU;
    }

    // 5. Interpolate control point banking the short way round
    const numCtrl = this.controlPoints.length;
    for (let i = 0; i < n; i++) {
      const s = i * this.actualStep;
      const uNorm = i / n;
      const ctrlU = uNorm * numCtrl;
      const idx0 = Math.floor(ctrlU) % numCtrl;
      const idx1 = (idx0 + 1) % numCtrl;
      const frac = ctrlU - Math.floor(ctrlU);

      // Cosine ease for ultra-smooth banking transitions
      const ease = (1.0 - Math.cos(frac * Math.PI)) * 0.5;
      const b0 = this.controlPoints[idx0].bank;
      let b1 = this.controlPoints[idx1].bank;
      // Shortest arc interpolation
      while (b1 - b0 > Math.PI) b1 -= Math.PI * 2.0;
      while (b1 - b0 < -Math.PI) b1 += Math.PI * 2.0;
      const totalBank = lerp(b0, b1, ease);

      this.bank[i] = totalBank;

      // Apply banking rotation around tangent vector
      const cosB = Math.cos(totalBank);
      const sinB = Math.sin(totalBank);
      const r = rmfR[i];
      const u = rmfU[i];
      const bankedR = new THREE.Vector3().copy(r).multiplyScalar(cosB).addScaledVector(u, sinB).normalize();
      const bankedU = new THREE.Vector3().crossVectors(bankedR, rawTangents[i]).normalize();

      this.px[i] = rawPos[i].x;
      this.py[i] = rawPos[i].y;
      this.pz[i] = rawPos[i].z;

      this.tx[i] = rawTangents[i].x;
      this.ty[i] = rawTangents[i].y;
      this.tz[i] = rawTangents[i].z;

      this.rx[i] = bankedR.x;
      this.ry[i] = bankedR.y;
      this.rz[i] = bankedR.z;

      this.ux[i] = bankedU.x;
      this.uy[i] = bankedU.y;
      this.uz[i] = bankedU.z;
    }

    // 6. Mark jump gap cutouts in solid array
    for (const [s0, s1] of this.gaps) {
      const i0 = Math.round(s0 / this.actualStep);
      const i1 = Math.round(s1 / this.actualStep);
      for (let i = i0; i <= i1; i++) {
        const idx = ((i % n) + n) % n;
        this.solid[idx] = 0;
      }
    }
  }

  _buildSpeedProfile() {
    // Target speeds (m/s) along track based on curvature and straights
    // 900 km/h = 250 m/s; tight corners drop to 180 m/s
    const n = this.n;
    this.targetSpeeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const prev = (i - 1 + n) % n;
      const next = (i + 1) % n;
      _tA.set(this.tx[prev], this.ty[prev], this.tz[prev]);
      _tB.set(this.tx[next], this.ty[next], this.tz[next]);
      const angle = _tA.angleTo(_tB);
      const curvature = angle / (2.0 * this.actualStep); // 1/radius
      // High speed straights: 250 m/s; sharp hairpin: 160 m/s
      const speed = clamp(255.0 - curvature * 3200.0, 165.0, 265.0);
      this.targetSpeeds[i] = speed;
    }
  }

  _buildSpatialIndex() {
    // 64m grid cell spatial hash for O(1) nearest-point lookups
    this.cellSize = 64.0;
    this.grid = new Map();
    for (let i = 0; i < this.n; i++) {
      const cx = Math.floor(this.px[i] / this.cellSize);
      const cy = Math.floor(this.py[i] / this.cellSize);
      const cz = Math.floor(this.pz[i] / this.cellSize);
      const key = `${cx},${cy},${cz}`;
      let bucket = this.grid.get(key);
      if (!bucket) {
        bucket = [];
        this.grid.set(key, bucket);
      }
      bucket.push(i);
    }
  }

  wrap(s) {
    s = s % this.length;
    return s < 0 ? s + this.length : s;
  }

  nearestIndex(pos) {
    const cx = Math.floor(pos.x / this.cellSize);
    const cy = Math.floor(pos.y / this.cellSize);
    const cz = Math.floor(pos.z / this.cellSize);

    let bestDistSq = Infinity;
    let bestIdx = 0;

    // Search 3x3x3 neighboring cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = this.grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (bucket) {
            for (let b = 0; b < bucket.length; b++) {
              const idx = bucket[b];
              const d2 = (this.px[idx] - pos.x) ** 2 +
                         (this.py[idx] - pos.y) ** 2 +
                         (this.pz[idx] - pos.z) ** 2;
              if (d2 < bestDistSq) {
                bestDistSq = d2;
                bestIdx = idx;
              }
            }
          }
        }
      }
    }
    return bestIdx;
  }

  frame(s, out = {}) {
    s = this.wrap(s);
    const u = s / this.actualStep;
    const i0 = Math.floor(u);
    const i1 = (i0 + 1) % this.n;
    const f = u - i0;

    if (!out.pos) out.pos = new THREE.Vector3();
    if (!out.T) out.T = new THREE.Vector3();
    if (!out.U) out.U = new THREE.Vector3();
    if (!out.R) out.R = new THREE.Vector3();

    out.pos.set(
      lerp(this.px[i0], this.px[i1], f),
      lerp(this.py[i0], this.py[i1], f),
      lerp(this.pz[i0], this.pz[i1], f)
    );

    out.T.set(
      lerp(this.tx[i0], this.tx[i1], f),
      lerp(this.ty[i0], this.ty[i1], f),
      lerp(this.tz[i0], this.tz[i1], f)
    ).normalize();

    out.R.set(
      lerp(this.rx[i0], this.rx[i1], f),
      lerp(this.ry[i0], this.ry[i1], f),
      lerp(this.rz[i0], this.rz[i1], f)
    ).normalize();

    out.U.crossVectors(out.R, out.T).normalize();
    out.bank = lerp(this.bank[i0], this.bank[i1], f);
    out.solid = this.solid[i0] && this.solid[i1];

    return out;
  }

  inGap(s) {
    s = this.wrap(s);
    for (let i = 0; i < this.gaps.length; i++) {
      const [s0, s1] = this.gaps[i];
      if (s >= s0 && s <= s1) return true;
    }
    return false;
  }

  inLoop(s) {
    s = this.wrap(s);
    for (let i = 0; i < this.loops.length; i++) {
      const [s0, s1] = this.loops[i];
      if (s >= s0 && s <= s1) return true;
    }
    return false;
  }

  inTunnel(s) {
    s = this.wrap(s);
    for (let i = 0; i < this.tunnels.length; i++) {
      const [s0, s1] = this.tunnels[i];
      if (s >= s0 && s <= s1) return true;
    }
    return false;
  }

  inFlip(s) {
    s = this.wrap(s);
    for (let i = 0; i < this.flips.length; i++) {
      const [s0, s1] = this.flips[i];
      if (s >= s0 && s <= s1) return true;
    }
    return false;
  }

  getFlip(s) {
    s = this.wrap(s);
    for (let i = 0; i < this.flips.length; i++) {
      const [s0, s1] = this.flips[i];
      if (s >= s0 && s <= s1) return this.flips[i];
    }
    return null;
  }

  speedProfile(s) {
    s = this.wrap(s);
    const idx = Math.floor(s / this.actualStep) % this.n;
    return this.targetSpeeds[idx];
  }

  racingLine(s) {
    // Projected optimal racing line offset across the deck [-width/2, width/2]
    s = this.wrap(s);
    const idx = Math.floor(s / this.actualStep) % this.n;
    const nextIdx = (idx + 25) % this.n; // Look ahead 50m
    _tA.set(this.tx[idx], this.ty[idx], this.tz[idx]);
    _tB.set(this.tx[nextIdx], this.ty[nextIdx], this.tz[nextIdx]);
    _rA.set(this.rx[idx], this.ry[idx], this.rz[idx]);
    const steerDir = _tB.dot(_rA); // Positive = turning right, negative = turning left
    // Apex clipping: hug inside edge on corners, center on straights
    return clamp(-steerDir * (TRACK_W * 0.38), -TRACK_W * 0.35, TRACK_W * 0.35);
  }

  meshes(scene) {
    return buildTrackMeshes(this, scene);
  }
}

// Factory function for the Space Circuit (~26.6 km expanded in P7 to thread the 12 km derelict Colossus)
export function createSpaceTrack() {
  const numPoints = 64;
  const controlPoints = [];
  const R_BASE = 3915.0; // Perimeter yields ~26.66 km
  const R_LOOP = 80.0;
  const excursionScale = 980.0;

  for (let i = 0; i < numPoints; i++) {
    const theta = (i / numPoints) * Math.PI * 2.0;
    // Harmonic radius modulation for natural cosmic sweeping curves
    let r = R_BASE + 630.0 * Math.cos(theta * 2.0) - 350.0 * Math.sin(theta * 3.0);
    let x = Math.sin(theta) * r;
    let z = Math.cos(theta) * r;
    let y = Math.sin(theta * 2.0) * 85.0 + Math.cos(theta * 4.0) * 50.0;
    let bank = 0;
    let name = `Sector ${i + 1}`;

    // Sinusoidal envelope excursion threading through the 12 km Titan-class derelict Colossus
    if (i >= 28 && i <= 56) {
      const frac = (i - 28) / 28.0;
      const colossusEnvelope = Math.sin(frac * Math.PI) ** 1.6;
      x -= excursionScale * colossusEnvelope;
      y += 28.0 * Math.sin(frac * Math.PI);
    }

    // Specific track features mapped to continuous sectors
    if (i === 0) {
      name = 'Start Gantry';
      bank = 0;
    } else if (i >= 2 && i <= 4) {
      name = 'Orbital Sweeper';
      bank = -28;
    } else if (i === 8) {
      name = 'Jump Gap 1';
      bank = 0;
    } else if (i === 11) {
      name = 'Loop Approach';
      y += R_LOOP * 0.8;
      bank = 0;
    } else if (i === 12) {
      name = 'Vertical Loop Top (Inverted)';
      y += R_LOOP * 2.0;
      bank = 0;
    } else if (i === 13) {
      name = 'Loop Exit';
      y += R_LOOP * 0.8;
      bank = 0;
    } else if (i === 16) {
      name = 'Pre-Derelict Flip 1 Approach';
      bank = 0;
    } else if (i === 17) {
      name = 'Pre-Derelict Flip 1 (Climb 24m & Invert)';
      y += 24.0;
      bank = 180.0;
    } else if (i >= 18 && i <= 21) {
      name = 'Pre-Derelict Overhead Inverted Straight';
      y += 24.0;
      bank = 180.0;
    } else if (i === 22) {
      name = 'Pre-Derelict Flip 2 (Descent 24m & Upright)';
      bank = 0;
    } else if (i >= 24 && i <= 26) {
      name = 'Meteorite Glass Tunnel (The Cave)';
      bank = 0;
    } else if (i === 27) {
      name = 'Jump Gap 2';
      bank = 0;
    } else if (i >= 28 && i <= 30) {
      name = 'Colossus Approach';
      bank = 0;
    } else if (i >= 31 && i <= 32) {
      name = 'Colossus Engine Bell & Throat';
      bank = 8;
    } else if (i >= 33 && i <= 35) {
      name = 'Colossus Reactor Hall & Cores';
      bank = 0;
    } else if (i === 36) {
      name = 'The Break (150m Vacuum Leap)';
      bank = -10;
    } else if (i === 38) {
      name = 'Colossus Upside-Down Hold Flip 1 Approach';
      bank = 0;
    } else if (i === 39) {
      name = 'Colossus Upside-Down Hold Flip 1 (Invert)';
      y += 24.0;
      bank = 180.0;
    } else if (i >= 40 && i <= 43) {
      name = 'Colossus Upside-Down Hold (Inverted Flight)';
      y += 24.0;
      bank = 180.0;
    } else if (i === 44) {
      name = 'Colossus Upside-Down Hold Flip 2 (Upright)';
      bank = 0;
    } else if (i >= 45 && i <= 49) {
      name = 'Cargo Hangar Bay & Staging Rack Towers';
      bank = -6;
    } else if (i >= 50 && i <= 54) {
      name = 'Trench Run & Barbette Defense Turrets';
      bank = 4;
    } else if (i >= 55 && i <= 57) {
      name = 'Hull Breach Exit & 650m Sensor Boom';
      bank = 16;
    } else if (i >= 58 && i <= 60) {
      name = 'Wreck Graveyard Sweeper';
      bank = 24;
    } else if (i >= 61) {
      name = 'Grand Home Sweeper';
      bank = 28;
    }

    controlPoints.push(pt(x, y, z, bank, name));
  }

  // Feature markers aligned to the 26.6 km space circuit
  const features = {
    name: 'space',
    flips: [
      [6750, 7000],   // Pre-derelict Flip 1 (180 deg turnover, climb 24 m to overhead deck)
      [8750, 9050],   // Pre-derelict Flip 2 (180 deg turnover, descent 24 m to standard deck)
      [15900, 16140], // Colossus Upside-Down Hold Flip 1 (180 deg turnover into inverted hold flight)
      [18000, 18240], // Colossus Upside-Down Hold Flip 2 (180 deg turnover back upright into hangar)
    ],
    gaps: [
      [3300, 3450],   // Jump Gap 1 (150 m leap)
      [10900, 11050], // Jump Gap 2 (150 m leap)
      [14700, 14850], // The Break (150 m vacuum leap across Colossus fracture)
    ],
    loops: [
      [4700, 5300],   // Vertical Loop (~600 m circumference)
    ],
    tunnels: [
      [9800, 10800],  // Meteorite Cave Glass Tunnel (1000 m)
      [12000, 14700], // Colossus Engine Bell & Reactor Hall (2700 m)
      [15600, 18600], // Colossus Upside-Down Hold (3000 m)
      [18600, 22400], // Colossus Cargo Hangar & Trench Run (3800 m)
    ],
    pads: [
      { s: 400, x: 0, kind: 'boost' },
      { s: 3150, x: 0, kind: 'boost' },   // Pre-jump pad 1
      { s: 4550, x: 0, kind: 'boost' },   // Pre-loop boost
      { s: 6600, x: 0, kind: 'boost' },   // Pre-flip 1 boost pad
      { s: 8650, x: 0, kind: 'boost' },   // Pre-flip 2 boost pad
      { s: 9700, x: 0, kind: 'boost' },   // Meteorite tunnel entry
      { s: 10750, x: 0, kind: 'boost' },  // Pre-jump pad 2
      { s: 11850, x: 0, kind: 'boost' },  // Pre-derelict boost pad
      { s: 14650, x: 0, kind: 'boost' },  // Boost pad before The Break vacuum leap
      { s: 15750, x: 0, kind: 'boost' },  // Pre-hold flip 1
      { s: 17900, x: 0, kind: 'boost' },  // Pre-hold flip 2
      { s: 20450, x: 0, kind: 'boost' },  // Trench run entry boost
      { s: 22250, x: 0, kind: 'boost' },  // Trench run exit / breach pad
      { s: 24800, x: 0, kind: 'boost' },  // Final straight pad
    ],
    gates: [
      { s: 300, color: 0x00d2ff },
      { s: 3200, color: 0xffaa00 },
      { s: 5400, color: 0x00ff88 },
      { s: 6650, color: 0xa855f7 }, // Magenta gate before Gravity Flip 1
      { s: 9150, color: 0x00d2ff }, // Cyan gate after Gravity Flip 2
      { s: 9750, color: 0x00d2ff }, // Cyan gate at Meteorite Cave
      { s: 10800, color: 0xff3366 },
      { s: 11900, color: 0xff8800 }, // Orange gate before the Colossus Engine Bell
      { s: 15800, color: 0xec4899 }, // Magenta-violet gate before Upside-Down Hold Flip 1
      { s: 18100, color: 0xec4899 }, // Magenta-violet gate before Upside-Down Hold Flip 2
      { s: 20500, color: 0x00d2ff }, // Trench run gate
      { s: 22400, color: 0x00ff88 }, // Exit breach gate
      { s: 24900, color: 0x00d2ff },
    ]
  };

  return new Track(controlPoints, features);
}

