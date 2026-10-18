// src/camera.js — 5-mode dynamic racing camera with spring-damper physics, trauma shake, and speed FOV
// Why: Decoupled camera hierarchy following track RMF frame to prevent roll sickness,
// with 5 camera perspectives, high-G FOV warping, and non-linear trauma shake

import * as THREE from 'three';
import { damp, clamp } from './noise.js';

export const CAMERA_MODES = [
  { id: 'chase', name: 'CHASE' },
  { id: 'close', name: 'CLOSE' },
  { id: 'bumper', name: 'BUMPER' },
  { id: 'cockpit', name: 'COCKPIT' },
  { id: 'flyby', name: 'FLYBY' }
];

export class CameraController {
  constructor(camera, options = {}) {
    this.camera = camera;
    this.modeIndex = 0;
    this.mode = CAMERA_MODES[0].id;

    // Base optical parameters
    this.baseFov = options.fov || 65.0;
    this.currentFov = this.baseFov;
    this.rollFollow = options.rollFollow !== undefined ? options.rollFollow : 1.0; // 1 = camera rolls with the deck

    // Trauma & Shake
    this.trauma = 0.0; // 0..1 trauma accumulator
    this.shakeTime = 0.0;

    // Chase spring targets
    this._vTarget = new THREE.Vector3();
    this._vChasePos = new THREE.Vector3();
    this._vLookAt = new THREE.Vector3();
    this._qUp = new THREE.Quaternion();
    this._vUp = new THREE.Vector3(0, 1, 0);

    // Scratch math
    this._vFwd = new THREE.Vector3();
    this._vRight = new THREE.Vector3();
    this._vUpTmp = new THREE.Vector3();
    this._vOffset = new THREE.Vector3();
    this._fCam = {};
    this._vDeckCam = new THREE.Vector3();

    // Flyby spectator state
    this.flybyGantryS = 0;
    this.flybyPos = new THREE.Vector3();
    this.flybyActive = false;
  }

  cycleView() {
    this.modeIndex = (this.modeIndex + 1) % CAMERA_MODES.length;
    this.mode = CAMERA_MODES[this.modeIndex].id;
    if (typeof document !== 'undefined') {
      const elCamName = document.getElementById('cam-name');
      if (elCamName) elCamName.textContent = CAMERA_MODES[this.modeIndex].name;
    }
    this.flybyActive = false;
    console.log(`[Camera] Switched to ${this.mode.toUpperCase()}`);
    return this.mode;
  }

  setView(modeId) {
    const idx = CAMERA_MODES.findIndex(m => m.id === modeId);
    if (idx !== -1) {
      this.modeIndex = idx;
      this.mode = modeId;
      if (typeof document !== 'undefined') {
        const elCamName = document.getElementById('cam-name');
        if (elCamName) elCamName.textContent = CAMERA_MODES[idx].name;
      }
      this.flybyActive = false;
    }
  }

  addTrauma(amount) {
    this.trauma = clamp(this.trauma + amount, 0.0, 1.0);
  }

  update(dt, racer, track) {
    if (!racer || !track) return;

    this.shakeTime += dt * 30.0;

    // 1. Decay trauma (trauma^2 produces crisp non-linear falloff)
    this.trauma = damp(this.trauma, 0.0, 3.5, dt);
    const shake = this.trauma * this.trauma;

    const shakeX = (Math.sin(this.shakeTime * 1.3) * 0.4 + Math.sin(this.shakeTime * 2.7) * 0.2) * shake;
    const shakeY = (Math.cos(this.shakeTime * 1.7) * 0.35 + Math.sin(this.shakeTime * 3.1) * 0.15) * shake;
    const shakeZ = (Math.sin(this.shakeTime * 1.1) * 0.25) * shake;

    // 2. Dynamic Speed FOV Warp (65 -> 86 deg)
    const speedRatio = clamp(racer.vs / (racer.handling ? racer.handling.topSpeed : 250.0), 0.0, 1.5);
    const boostFov = racer.isBoosting ? 14.0 : 0.0;
    const targetFov = this.baseFov + (speedRatio * 10.0) + boostFov;
    this.currentFov = damp(this.currentFov, targetFov, 6.0, dt);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();

    // 3. Coordinate Frames
    const f = racer.frame || {};
    const fwd = f.T || this._vFwd.set(0, 0, -1);
    const up = f.U || this._vUp.set(0, 1, 0);
    const right = f.R || this._vRight.set(1, 0, 0);
    const racerPos = racer.pos || racer.ship.root.position;

    // 4. Perspective Modes
    if (this.mode === 'chase') {
      // Standard Chase: distance 14m..19m, height 3.6m..4.5m
      const dist = 14.0 + speedRatio * 4.5;
      const height = 3.6 + (racer.isBoosting ? 0.6 : 0.0);

      this._vChasePos.copy(racerPos)
        .addScaledVector(fwd, -dist)
        .addScaledVector(up, height)
        .addScaledVector(right, shakeX)
        .addScaledVector(up, shakeY);

      this.camera.position.lerp(this._vChasePos, 0.24);

      // Deck-aware camera clamping (§J.2): prevent camera from dipping below the road on rolling straights or crests
      if (track && track.frame) {
        const sCam = track.wrap ? track.wrap(racer.s - dist) : ((racer.s - dist + track.length) % track.length);
        track.frame(sCam, this._fCam);
        this._vDeckCam.subVectors(this.camera.position, this._fCam.pos);
        const clearance = this._vDeckCam.dot(this._fCam.U);
        const minClearance = 1.8;
        if (clearance < minClearance) {
          this.camera.position.addScaledVector(this._fCam.U, minClearance - clearance);
        }
      }

      if (this.rollFollow >= 1.0) {
        this.camera.up.lerp(up, 0.35).normalize();
      } else {
        this.camera.up.lerp(up, 0.2).normalize();
      }

      this._vLookAt.copy(racerPos)
        .addScaledVector(up, 1.2)
        .addScaledVector(fwd, 6.0);
      this.camera.lookAt(this._vLookAt.x, this._vLookAt.y, this._vLookAt.z);

    } else if (this.mode === 'close') {
      // Close Chase: distance 8.5m, height 2.2m
      const dist = 8.5 + speedRatio * 2.0;
      const height = 2.2;

      this._vChasePos.copy(racerPos)
        .addScaledVector(fwd, -dist)
        .addScaledVector(up, height)
        .addScaledVector(right, shakeX * 0.7)
        .addScaledVector(up, shakeY * 0.7);

      this.camera.position.lerp(this._vChasePos, 0.32);
      if (this.rollFollow >= 1.0) {
        this.camera.up.lerp(up, 0.45).normalize();
      } else {
        this.camera.up.lerp(up, 0.25).normalize();
      }

      this._vLookAt.copy(racerPos).addScaledVector(up, 1.0).addScaledVector(fwd, 4.0);
      this.camera.lookAt(this._vLookAt.x, this._vLookAt.y, this._vLookAt.z);

    } else if (this.mode === 'bumper') {
      // Bumper / Nose camera
      this._vChasePos.copy(racerPos)
        .addScaledVector(fwd, 4.8)
        .addScaledVector(up, 0.6)
        .addScaledVector(right, shakeX * 0.3)
        .addScaledVector(up, shakeY * 0.3);

      this.camera.position.copy(this._vChasePos);
      this.camera.up.copy(up);

      this._vLookAt.copy(racerPos).addScaledVector(fwd, 25.0).addScaledVector(up, 0.5);
      this.camera.lookAt(this._vLookAt.x, this._vLookAt.y, this._vLookAt.z);

    } else if (this.mode === 'cockpit') {
      // Cockpit interior
      this._vChasePos.copy(racerPos)
        .addScaledVector(fwd, 0.8)
        .addScaledVector(up, 1.15)
        .addScaledVector(right, shakeX * 0.2)
        .addScaledVector(up, shakeY * 0.2);

      this.camera.position.copy(this._vChasePos);
      this.camera.up.copy(up);

      this._vLookAt.copy(racerPos).addScaledVector(fwd, 30.0).addScaledVector(up, 1.1);
      this.camera.lookAt(this._vLookAt.x, this._vLookAt.y, this._vLookAt.z);

    } else if (this.mode === 'flyby') {
      // Spectator Flyby from trackside gantries
      const distToGantry = Math.abs(racer.s - this.flybyGantryS);
      if (!this.flybyActive || distToGantry > 350.0) {
        this.flybyGantryS = (racer.s + 120.0) % track.length;
        const gFrame = {};
        track.frame(this.flybyGantryS, gFrame);
        this.flybyPos.copy(gFrame.pos)
          .addScaledVector(gFrame.U, 12.0)
          .addScaledVector(gFrame.R, 18.0);
        this.flybyActive = true;
      }

      this.camera.position.lerp(this.flybyPos, 0.08);
      this._vLookAt.copy(racerPos).addScaledVector(up, 1.0);
      this.camera.lookAt(this._vLookAt.x, this._vLookAt.y, this._vLookAt.z);
    }
  }
}
