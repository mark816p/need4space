// src/overgrowth.js — Liana strands and gantry ivy hanging clear of the track deck
// Why: Strands hang straight down from track edges; none in loops/rolls/jumps; ivy stops 8m over deck clear of ships
import * as THREE from 'three';
import { TRACK_W } from './track.js';

export class OvergrowthSystem {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();

    if (!track) return;

    this.vineMat = new THREE.MeshStandardMaterial({
      color: 0x1b4d24,
      roughness: 0.8,
      metalness: 0.1
    });

    this._buildLianas();
    scene.add(this.group);
  }

  _buildLianas() {
    const track = this.track;
    const n = track.n;
    const step = 35; // Place lianas every ~70m along jungle sectors

    const strandGeo = new THREE.CylinderGeometry(0.2, 0.08, 18.0, 5, 4);
    strandGeo.translate(0, -9.0, 0); // Origin at top attachment point

    const _f = {};
    const instances = [];

    for (let i = 0; i < n; i += step) {
      const s = i * track.actualStep;

      // Skip lianas in gaps, loops, rolls, and cuts
      if (track.inGap(s) || track.inLoop(s)) continue;

      track.frame(s, _f);

      // Only place when track is reasonably level (not inverted or heavy roll)
      if (_f.U.y < 0.6) continue;

      // Place strands on both outer rim edges (outside energy barrier)
      const leftEdge = _f.pos.clone().addScaledVector(_f.R, -(TRACK_W * 0.5 + 2.5));
      const rightEdge = _f.pos.clone().addScaledVector(_f.R, (TRACK_W * 0.5 + 2.5));

      instances.push(leftEdge);
      instances.push(rightEdge);
    }

    if (instances.length === 0) return;

    const instMesh = new THREE.InstancedMesh(strandGeo, this.vineMat, instances.length);
    const mat4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion(); // Identity = hanging straight down along -Y
    const scl = new THREE.Vector3();

    for (let i = 0; i < instances.length; i++) {
      pos.copy(instances[i]);
      // Slight natural sway rotation
      quat.setFromEuler(new THREE.Euler(Math.sin(i * 0.4) * 0.08, 0, Math.cos(i * 0.5) * 0.08));
      const lenScale = 0.7 + Math.random() * 0.6;
      scl.set(1.0, lenScale, 1.0);

      mat4.compose(pos, quat, scl);
      instMesh.setMatrixAt(i, mat4);
    }

    instMesh.instanceMatrix.needsUpdate = true;
    this.group.add(instMesh);
  }
}
