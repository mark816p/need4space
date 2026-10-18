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
const _mScratch = new THREE.Matrix4();
const _vCamRight = new THREE.Vector3();
const _vCamUp = new THREE.Vector3();

function createRadialDataTexture(innerR, innerG, innerB, outerR, outerG, outerB) {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const center = (size - 1) * 0.5;
  const maxR = size * 0.5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const t = Math.min(1.0, dist / maxR);
      const alpha = Math.max(0, Math.pow(1.0 - t, 2.0));
      const idx = (y * size + x) * 4;
      data[idx] = Math.round(THREE.MathUtils.lerp(innerR, outerR, t) * 255);
      data[idx + 1] = Math.round(THREE.MathUtils.lerp(innerG, outerG, t) * 255);
      data[idx + 2] = Math.round(THREE.MathUtils.lerp(innerB, outerB, t) * 255);
      data[idx + 3] = Math.round(alpha * 255);
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

let _puffTex = null;
function getPuffTexture() {
  if (_puffTex) return _puffTex;
  if (typeof document === 'undefined') {
    _puffTex = createRadialDataTexture(1, 1, 1, 0.8, 0.9, 1);
    return _puffTex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.75)');
  grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
  grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  _puffTex = new THREE.CanvasTexture(canvas);
  return _puffTex;
}

let _tailGlowTex = null;
function getTaillightGlowTexture() {
  if (_tailGlowTex) return _tailGlowTex;
  if (typeof document === 'undefined') {
    _tailGlowTex = createRadialDataTexture(1, 0.9, 0.8, 1, 0.1, 0);
    return _tailGlowTex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0.0, 'rgba(255, 240, 220, 1.0)');
  grad.addColorStop(0.25, 'rgba(255, 75, 25, 0.85)');
  grad.addColorStop(0.6, 'rgba(255, 20, 10, 0.3)');
  grad.addColorStop(1.0, 'rgba(255, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  _tailGlowTex = new THREE.CanvasTexture(canvas);
  return _tailGlowTex;
}

// Engine Trail class (supports puff mode with expanding billboard discs & soft alpha falloff)
export class EngineTrail {
  constructor(maxPoints = 40, width = 0.5, color = 0x00d2ff, mode = 'puff') {
    this.maxPoints = maxPoints;
    this.width = width;
    this.color = color;
    this.mode = mode; // 'puff' (expanding billboard discs) or 'strip'
    this.history = []; // Array of { pos: Vector3, up: Vector3, time: number }

    const maxVertices = maxPoints * 4;
    const maxIndices = maxPoints * 6;

    this.geom = new THREE.BufferGeometry();
    this.positions = new Float32Array(maxVertices * 3);
    this.alphas = new Float32Array(maxVertices);
    this.uvs = new Float32Array(maxVertices * 2);
    this.indices = new Uint16Array(maxIndices);

    // Build static quad index buffer & UVs
    for (let i = 0; i < maxPoints; i++) {
      const v = i * 4;
      const idx = i * 6;
      this.indices[idx] = v;
      this.indices[idx + 1] = v + 1;
      this.indices[idx + 2] = v + 2;
      this.indices[idx + 3] = v;
      this.indices[idx + 4] = v + 2;
      this.indices[idx + 5] = v + 3;

      const u = i * 8;
      this.uvs[u] = 0;     this.uvs[u + 1] = 0;
      this.uvs[u + 2] = 1; this.uvs[u + 3] = 0;
      this.uvs[u + 4] = 1; this.uvs[u + 5] = 1;
      this.uvs[u + 6] = 0; this.uvs[u + 7] = 1;
    }

    this.geom.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geom.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));
    this.geom.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    this.geom.setIndex(new THREE.BufferAttribute(this.indices, 1));

    const puffTex = getPuffTexture();
    this.mat = new THREE.MeshBasicMaterial({
      color: this.color,
      map: puffTex || undefined,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(this.geom, this.mat);
    this.mesh.frustumCulled = false;
  }

  update(worldPos, worldUp, emit = true, camera = null) {
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

    // Billboard orientation from camera or fallback vectors
    let rX = 1, rY = 0, rZ = 0;
    let uX = 0, uY = 1, uZ = 0;
    if (camera) {
      _mScratch.extractRotation(camera.matrixWorld);
      _vCamRight.set(1, 0, 0).applyMatrix4(_mScratch);
      _vCamUp.set(0, 1, 0).applyMatrix4(_mScratch);
      rX = _vCamRight.x; rY = _vCamRight.y; rZ = _vCamRight.z;
      uX = _vCamUp.x;    uY = _vCamUp.y;    uZ = _vCamUp.z;
    } else if (worldUp) {
      uX = worldUp.x; uY = worldUp.y; uZ = worldUp.z;
      rX = -uZ; rY = 0; rZ = uX;
    }

    if (this.mode === 'puff') {
      // Puff mode: expanding billboard discs with soft alpha falloff
      for (let i = 0; i < count; i++) {
        const pt = this.history[i];
        const frac = i / (this.maxPoints - 1);
        // Expanding disc: size grows with age from width up to 3.2x width
        const radius = this.width * (0.8 + frac * 2.4);
        // Soft non-linear alpha falloff
        const alpha = Math.pow(Math.max(0, 1.0 - frac), 1.8) * 0.85;

        const cx = pt.pos.x, cy = pt.pos.y, cz = pt.pos.z;
        const rx = rX * radius, ry = rY * radius, rz = rZ * radius;
        const ux = uX * radius, uy = uY * radius, uz = uZ * radius;

        const vIdx = i * 12;
        // v0 = center - right - up
        this.positions[vIdx]     = cx - rx - ux;
        this.positions[vIdx + 1] = cy - ry - uy;
        this.positions[vIdx + 2] = cz - rz - uz;
        // v1 = center + right - up
        this.positions[vIdx + 3] = cx + rx - ux;
        this.positions[vIdx + 4] = cy + ry - uy;
        this.positions[vIdx + 5] = cz + rz - uz;
        // v2 = center + right + up
        this.positions[vIdx + 6] = cx + rx + ux;
        this.positions[vIdx + 7] = cy + ry + uy;
        this.positions[vIdx + 8] = cz + rz + uz;
        // v3 = center - right + up
        this.positions[vIdx + 9]  = cx - rx + ux;
        this.positions[vIdx + 10] = cy - ry + uy;
        this.positions[vIdx + 11] = cz - rz + uz;

        const aIdx = i * 4;
        this.alphas[aIdx] = alpha;
        this.alphas[aIdx + 1] = alpha;
        this.alphas[aIdx + 2] = alpha;
        this.alphas[aIdx + 3] = alpha;
      }

      this.geom.attributes.position.needsUpdate = true;
      this.geom.attributes.alpha.needsUpdate = true;
      this.geom.setDrawRange(0, count * 6);
    } else {
      // Fallback thin strip mode
      for (let i = 0; i < count; i++) {
        const pt = this.history[i];
        const frac = i / (this.maxPoints - 1);
        const w = this.width * (1.0 - frac * 0.5);

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

    // Taillights for dark tracks & chambers: softened rival taillights (tinted glow sprite, lower point-light punch)
    this.isRival = !!options.isRival;
    this.taillights = [];
    this._initTaillights(options);
  }

  _initTaillights(options) {
    this.taillights = [];
    const isRival = this.isRival;
    const glowTex = getTaillightGlowTexture();

    for (let i = 0; i < this.nozzles.length; i++) {
      const nozzlePos = this.nozzles[i];

      const tlGroup = new THREE.Group();
      tlGroup.position.set(nozzlePos.x, nozzlePos.y, nozzlePos.z + 0.15);

      // Softened point-light punch in the dark (lower intensity for rivals to avoid blowing out track)
      const basePunch = isRival ? 0.35 : 0.75;
      const pLight = new THREE.PointLight(0xff3311, basePunch, 22, 1.8);
      tlGroup.add(pLight);

      // Tinted glow sprite
      let glowSprite = null;
      if (glowTex) {
        const spriteMat = new THREE.SpriteMaterial({
          map: glowTex,
          color: 0xff3b18,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
          opacity: isRival ? 0.65 : 0.85
        });
        glowSprite = new THREE.Sprite(spriteMat);
        glowSprite.scale.set(1.6, 1.6, 1.0);
        tlGroup.add(glowSprite);
      }

      this.visual.add(tlGroup);
      this.taillights.push({
        group: tlGroup,
        light: pLight,
        sprite: glowSprite
      });
    }
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

    // 6. Update Exhaust Ribbon Trails (puff mode with camera billboarding)
    if (this.trails.length > 0) {
      for (let i = 0; i < this.nozzles.length; i++) {
        const localNozzle = this.nozzles[i];
        _vPos.copy(localNozzle);
        this.visual.localToWorld(_vPos);

        _vTarget.set(0, 1, 0);
        _qRot.copy(this.root.quaternion);
        _vTarget.applyQuaternion(_qRot);

        const shouldEmit = this.power > 0.1 && speed > 5.0;
        this.trails[i].update(_vPos, _vTarget, shouldEmit, camera);
      }
    }

    // 7. Dynamic Taillights in the dark (softened rival punch, warm tinted glow)
    for (let i = 0; i < this.taillights.length; i++) {
      const tl = this.taillights[i];
      const basePunch = this.isRival ? 0.35 : 0.75;
      tl.light.intensity = basePunch * (0.5 + chamberDarkness * 0.7);
      if (tl.sprite && tl.sprite.material) {
        tl.sprite.material.opacity = (this.isRival ? 0.65 : 0.85) * (0.6 + chamberDarkness * 0.5);
      }
    }
  }
}
