// src/ship.js — Ship entity class, visual hierarchy, plumes, ribbons, canopy, and engine spool
// Why: Decouples physical transform (root) from visual bob/shake (visual); manages engine power,
// canopy lock, ribbons, and lighting without per-frame allocations

import * as THREE from 'three';
import { damp, clamp } from './noise.js';
import { loadShip, createShipMaterials } from './shipmodels.js';

// Module-level scratch math to avoid per-frame allocations
const _vPos = new THREE.Vector3();
const _vTarget = new THREE.Vector3();
const _qRot = new THREE.Quaternion();

// Ribbon Trail class for engine exhausts
export class EngineTrail {
  constructor(maxPoints = 40, width = 0.5, color = 0x00d2ff) {
    this.maxPoints = maxPoints;
    this.width = width;
    this.history = []; // Array of { pos: Vector3, up: Vector3, time: number }
    this.color = color;

    const maxVertices = maxPoints * 2;
    const maxIndices = (maxPoints - 1) * 6;

    this.geom = new THREE.BufferGeometry();
    this.positions = new Float32Array(maxVertices * 3);
    this.alphas = new Float32Array(maxVertices);
    this.indices = new Uint16Array(maxIndices);

    // Build static quad index buffer
    for (let i = 0; i < maxPoints - 1; i++) {
      const v = i * 2;
      const idx = i * 6;
      this.indices[idx] = v;
      this.indices[idx + 1] = v + 1;
      this.indices[idx + 2] = v + 2;
      this.indices[idx + 3] = v + 1;
      this.indices[idx + 4] = v + 3;
      this.indices[idx + 5] = v + 2;
    }

    this.geom.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geom.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));
    this.geom.setIndex(new THREE.BufferAttribute(this.indices, 1));

    this.mat = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(this.geom, this.mat);
    this.mesh.frustumCulled = false;
  }

  update(worldPos, worldUp, emit = true) {
    if (emit) {
      this.history.unshift({
        pos: worldPos.clone(),
        up: worldUp.clone()
      });
      if (this.history.length > this.maxPoints) {
        this.history.pop();
      }
    } else if (this.history.length > 0) {
      this.history.pop();
    }

    const count = this.history.length;
    if (count < 2) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    for (let i = 0; i < count; i++) {
      const pt = this.history[i];
      const frac = i / (this.maxPoints - 1);
      const w = this.width * (1.0 - frac * 0.5);

      // Left and right strip edges
      _vPos.copy(pt.pos).addScaledVector(pt.up, w * 0.5);
      this.positions[i * 6] = _vPos.x;
      this.positions[i * 6 + 1] = _vPos.y;
      this.positions[i * 6 + 2] = _vPos.z;

      _vPos.copy(pt.pos).addScaledVector(pt.up, -w * 0.5);
      this.positions[i * 6 + 3] = _vPos.x;
      this.positions[i * 6 + 4] = _vPos.y;
      this.positions[i * 6 + 5] = _vPos.z;

      this.alphas[i * 2] = 1.0 - frac;
      this.alphas[i * 2 + 1] = 1.0 - frac;
    }

    this.geom.attributes.position.needsUpdate = true;
    this.geom.attributes.alpha.needsUpdate = true;
    this.geom.setDrawRange(0, (count - 1) * 6);
  }

  clear() {
    this.history.length = 0;
    this.mesh.visible = false;
  }
}

export class Ship {
  constructor(modelOrKind = 'feather', options = {}) {
    this.options = options;

    // Load model hierarchy
    const model = typeof modelOrKind === 'string' ? loadShip(modelOrKind) : modelOrKind;
    this.model = model;
    this.kind = model.kind || 'feather';
    this.halfSpan = model.halfSpan || 5.15;
    this.length = model.length || 13.34;
    this.bottom = model.bottom || -0.65;
    this.rotors = model.rotors || [];
    this.plumes = model.plumes || [];
    this.canopy = model.canopy || null;
    this.nozzles = model.nozzles || [];

    // Root Group: position & orientation controlled exclusively by physics
    this.root = new THREE.Group();
    this.root.name = `ship_${this.kind}_root`;

    // Visual Group: child of root, receives hit shake, turn roll, hover bob
    // Rule: Visual transform is NEVER fed back into physics state!
    this.visual = model.visual;
    this.root.add(this.visual);

    // Engine & Power state
    this.engineOn = true;
    this.power = 1.0;            // 0.0 (cold) to 1.0 (spooled)
    this.spoolRate = 0.85;       // ~1.2 s to full spool
    this.ready = true;
    this.rotorAngle = 0;

    // Canopy state (1 = closed, 0 = open)
    this.canopyT = 1.0;
    this.canopyTarget = 1.0;

    // Visual Hit Shake impulse state
    this.shakeRot = new THREE.Euler(0, 0, 0);
    this.shakeVel = new THREE.Vector3();
    this.shakeOffset = new THREE.Vector3();

    // Headlight SpotLight: (0, 0.9, -6.5) aiming (0, -4, -70)
    this.headlight = new THREE.SpotLight(0xe4ecff, 1.8, 300, 0.45, 0.6, 1.5);
    this.headlight.position.set(0, 0.9, -6.5);
    this.headlightTarget = new THREE.Object3D();
    this.headlightTarget.position.set(0, -4.0, -70.0);
    this.root.add(this.headlightTarget);
    this.headlight.target = this.headlightTarget;
    this.root.add(this.headlight);

    // Engine Ribbon Trails (one per nozzle)
    this.trails = this.nozzles.map(() => new EngineTrail(35, 0.7, 0x00d2ff));
  }

  attachTrails(scene) {
    if (!scene) return;
    for (const trail of this.trails) {
      scene.add(trail.mesh);
    }
  }

  setEngine(on) {
    this.engineOn = !!on;
    if (this.engineOn) {
      // Canopy must close before engines run
      this.canopyTarget = 1.0;
    }
  }

  toggleCanopy() {
    // Canopy locked while engines are running
    if (this.engineOn && this.power > 0.05) {
      return false;
    }
    this.canopyTarget = this.canopyTarget > 0.5 ? 0.0 : 1.0;
    return true;
  }

  hit(dir, strength = 1.0, localPoint = null) {
    // Angular visual impulse shake
    const s = Math.min(3.5, strength);
    this.shakeRot.z += dir.x * s * 0.12;
    this.shakeRot.x -= dir.z * s * 0.10;
    this.shakeOffset.x += dir.x * s * 0.25;
    this.shakeOffset.y += Math.abs(dir.y) * s * 0.20;
  }

  setLod(distance, focalPx) {
    // Procedural LOD scaling: toggle plume/interior details
    const close = distance < 60;
    for (let i = 0; i < this.plumes.length; i++) {
      this.plumes[i].visible = close || this.power > 0.1;
    }
  }

  upgradeMaterials(anisotropy, renderer) {
    this.visual.traverse(obj => {
      if (obj.isMesh && obj.material) {
        if (obj.material.map) obj.material.map.anisotropy = anisotropy;
        obj.material.needsUpdate = true;
      }
    });
  }

  fxObjects() {
    return {
      plumes: this.plumes,
      headlight: this.headlight
    };
  }

  update(dt, state = {}, scene = null, camera = null) {
    const throttle = state.throttle ?? 1.0;
    const boost = state.boost ?? false;
    const turn = state.turn ?? 0;
    const speed = state.speed ?? 0;

    // 1. Engine Spool dynamics
    const targetPower = this.engineOn ? 1.0 : 0.0;
    this.power = damp(this.power, targetPower, this.spoolRate * 4.0, dt);
    this.ready = this.power > 0.92;

    // 2. Canopy Animation
    this.canopyT = damp(this.canopyT, this.canopyTarget, 4.0, dt);
    if (this.canopy) {
      // Hinge rotates up ~50 degrees when open
      this.canopy.rotation.x = (1.0 - this.canopyT) * -0.85;
    }

    // 3. Rotor / Turbofan Spin
    const spinRate = (this.power * 25.0 + (throttle > 0 ? 30.0 : 5.0) + (boost ? 40.0 : 0)) * dt;
    this.rotorAngle += spinRate;
    for (let i = 0; i < this.rotors.length; i++) {
      this.rotors[i].rotation.z = this.rotorAngle * (i % 2 === 0 ? 1 : -1);
    }

    // 4. Exhaust Plumes Dynamics
    const plumeScale = this.power * (0.6 + throttle * 0.6 + (boost ? 1.2 : 0));
    for (let i = 0; i < this.plumes.length; i++) {
      const pl = this.plumes[i];
      pl.scale.set(1.0 + (boost ? 0.3 : 0), 1.0 + (boost ? 0.3 : 0), Math.max(0.01, plumeScale));
      pl.visible = this.power > 0.05;
      if (pl.material) {
        pl.material.opacity = Math.min(1.0, 0.4 + plumeScale * 0.35);
      }
    }

    // 5. Visual Turn Roll & Hit Shake Decay
    this.shakeRot.x = damp(this.shakeRot.x, 0, 8.0, dt);
    this.shakeRot.y = damp(this.shakeRot.y, 0, 8.0, dt);
    this.shakeRot.z = damp(this.shakeRot.z, 0, 8.0, dt);

    this.shakeOffset.x = damp(this.shakeOffset.x, 0, 9.0, dt);
    this.shakeOffset.y = damp(this.shakeOffset.y, 0, 9.0, dt);
    this.shakeOffset.z = damp(this.shakeOffset.z, 0, 9.0, dt);

    // 6. Dynamic Headlight adaptation in dark chambers / tunnels
    const chamberDarkness = state.chamberDarkness ?? 0;
    const targetHeadlight = 1.8 + chamberDarkness * 4.8;
    this.headlight.intensity = damp(this.headlight.intensity, targetHeadlight, 4.0, dt);
    this.headlight.distance = 300 + chamberDarkness * 120;

    // Coordinated visual turn bank into the corner
    const turnBank = -turn * 0.22;
    this.visual.rotation.set(
      this.shakeRot.x,
      this.shakeRot.y,
      this.shakeRot.z + turnBank
    );
    this.visual.position.copy(this.shakeOffset);

    // 6. Update Exhaust Ribbon Trails
    if (this.trails.length > 0) {
      for (let i = 0; i < this.nozzles.length; i++) {
        const localNozzle = this.nozzles[i];
        _vPos.copy(localNozzle);
        this.visual.localToWorld(_vPos);

        _vTarget.set(0, 1, 0);
        _qRot.copy(this.root.quaternion);
        _vTarget.applyQuaternion(_qRot);

        const shouldEmit = this.power > 0.1 && speed > 5.0;
        this.trails[i].update(_vPos, _vTarget, shouldEmit);
      }
    }
  }
}
