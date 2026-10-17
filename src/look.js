// src/look.js — Look parameters, color grading presets, and dynamic optics state
// Why: Film-grade tone mapping, speed-dependent chromatic aberration,
// cinematic grain, vignette, and ambient occlusion tuning for Need4Space

import * as THREE from 'three';
import { clamp, damp } from './noise.js';

// Default aesthetic and physical camera parameters
export const LOOK_DEFAULTS = {
  // Tone mapping & Grading
  exposure: 1.08,
  contrast: 1.06,
  saturation: 1.12,

  // Film Optics
  grainStrength: 0.04,
  vignetteFalloff: 0.35,
  vignetteDarkness: 0.65,

  // Speed Optics (Chromatic Aberration & Edge Warp)
  chromaBase: 0.0008,
  chromaSpeedScale: 0.0045, // Up to ~4px radial split at maximum speeds
  chromaGForceScale: 0.0035,

  // Bloom (Engines, Boost Pads, Forcefields)
  bloomRadius: 0.45,
  bloomStrength: 0.65,
  bloomThreshold: 0.85,
  bloomBoostFactor: 1.85,

  // Ground-Truth Ambient Occlusion (GTAO)
  gtaoRadius: 2.2,
  gtaoExponent: 1.3,
  gtaoThickness: 1.2,
  gtaoIntensity: 1.0,

  // Screen-Space Reflections (Deck SSR)
  ssrMaxDistance: 50.0,
  ssrStepSize: 0.75,
  ssrMaxSteps: 16,
  ssrBinarySteps: 4,
  ssrRoughnessCutoff: 0.60,
  ssrEdgeFade: 0.18
};

export class LookController {
  constructor(options = {}) {
    this.params = { ...LOOK_DEFAULTS, ...options };

    // Dynamic per-frame modulated parameters
    this.currentChroma = this.params.chromaBase;
    this.currentBloomStrength = this.params.bloomStrength;
    this.currentExposure = this.params.exposure;
    this.hitShake = 0;
    this.boostCharge = 0;

    // Scratch math
    this._vTmp = new THREE.Vector3();
  }

  // Update dynamic optics state from racer flight telemetry
  update(dt, telemetry = {}) {
    const speedRatio = clamp((telemetry.speed || 0) / 300.0, 0, 1.5);
    const latG = clamp(Math.abs(telemetry.lateralG || 0) / 25.0, 0, 1.2);
    const boosting = !!telemetry.isBoosting;
    const hitImpulse = telemetry.hitImpulse || 0;

    // 1. Chromatic aberration expands with speed, lateral G-force, and collisions
    const targetChroma = this.params.chromaBase +
      speedRatio * this.params.chromaSpeedScale +
      latG * this.params.chromaGForceScale +
      this.hitShake * 0.008;

    this.currentChroma = damp(this.currentChroma, targetChroma, 8.0, dt);

    // 2. Bloom swells up during engine boost and pad kicks
    const targetBloom = boosting
      ? this.params.bloomStrength * this.params.bloomBoostFactor
      : this.params.bloomStrength;
    this.currentBloomStrength = damp(this.currentBloomStrength, targetBloom, 10.0, dt);

    // 3. Exposure kick on shield/hull impacts
    if (hitImpulse > 0.1) {
      this.hitShake = Math.min(1.0, this.hitShake + hitImpulse);
    }
    this.hitShake = damp(this.hitShake, 0, 6.0, dt);
    this.currentExposure = this.params.exposure + this.hitShake * 0.35;
  }
}
