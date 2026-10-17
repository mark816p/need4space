// src/flight.js — Arcade hover model for free flight
// Why: Anti-grav lift while powered, ground-effect cushion, thrust vs quadratic drag,
// coordinated banked turns, and collision probes; G toggles race/free in space, T respawns onto track

import * as THREE from 'three';
import { damp, clamp } from './noise.js';

// Scratch vectors to prevent allocations in physics step
const _vFwd = new THREE.Vector3();
const _vRight = new THREE.Vector3();
const _vUp = new THREE.Vector3();
const _vVelNorm = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

export class FreeFlight {
  constructor(ship, track = null) {
    this.ship = ship;
    this.track = track;

    // Physical state
    this.pos = new THREE.Vector3(0, 5, 0);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.speed = 0;

    // Orientation (pitch, yaw, roll)
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.quat = new THREE.Quaternion();

    // Flight parameters
    this.maxSpeed = 240.0;        // m/s (~860 km/h)
    this.thrust = 110.0;          // m/s2 acceleration
    this.boostThrust = 190.0;     // m/s2 under boost
    this.dragCoeff = 0.0018;      // Quadratic drag
    this.grip = 8.5;              // Lateral grip (velocity aligns with nose)
    this.hoverHeight = 2.4;       // Ground cushion equilibrium height
    this.hoverStiffness = 35.0;   // Spring constant for ground cushion

    // Pitch & Turn rates
    this.turnRate = 1.8;          // rad/s
    this.pitchRate = 1.4;         // rad/s
    this.rollRate = 2.4;          // rad/s

    // Raycaster for surface probes
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 15.0;

    // Track frame helper
    this.frameHelper = {};
  }

  setTrack(track) {
    this.track = track;
  }

  respawnOntoTrack(track = this.track, targetS = 0) {
    if (!track) return;
    track.frame(targetS, this.frameHelper);

    // Place ship hovering directly over track centerline
    this.pos.copy(this.frameHelper.pos).addScaledVector(this.frameHelper.U, this.hoverHeight);

    // Face directly along track tangent +T
    const m = new THREE.Matrix4().makeBasis(this.frameHelper.R, this.frameHelper.U, this.frameHelper.T);
    this.quat.setFromRotationMatrix(m);

    // Initial forward speed (60 m/s)
    this.vel.copy(this.frameHelper.T).multiplyScalar(60.0);
    this.speed = 60.0;

    const euler = new THREE.Euler().setFromQuaternion(this.quat, 'YXZ');
    this.yaw = euler.y;
    this.pitch = euler.x;
    this.roll = euler.z;

    this.ship.root.position.copy(this.pos);
    this.ship.root.quaternion.copy(this.quat);
  }

  step(dt, input = {}) {
    const throttle = input.throttle ?? 0;
    const brake = input.brake ?? 0;
    const steer = input.steer ?? 0;       // -1 left, +1 right
    const pitchIn = input.pitch ?? 0;     // -1 down, +1 up
    const rollIn = input.roll ?? 0;
    const boost = input.boost ?? false;

    // 1. Angular rate integration
    this.yaw -= steer * this.turnRate * dt;
    this.pitch += pitchIn * this.pitchRate * dt;
    this.pitch = clamp(this.pitch, -Math.PI * 0.45, Math.PI * 0.45);

    // Coordinated roll into turn, with auto-leveling
    const targetRoll = -steer * 0.55 + rollIn * 0.8;
    this.roll = damp(this.roll, targetRoll, 4.5, dt);

    // Build orientation quaternion
    const euler = new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ');
    this.quat.setFromEuler(euler);

    // Forward and lateral basis vectors
    _vFwd.set(0, 0, -1).applyQuaternion(this.quat);
    _vRight.set(1, 0, 0).applyQuaternion(this.quat);
    _vUp.set(0, 1, 0).applyQuaternion(this.quat);

    // 2. Thrust & Drag
    let accel = 0;
    if (this.ship.engineOn && this.ship.power > 0.1) {
      const currentThrust = boost ? this.boostThrust : this.thrust;
      accel = throttle * currentThrust * this.ship.power;
      if (brake > 0) {
        accel -= brake * 65.0; // Airbrakes
      }
    }

    this.vel.addScaledVector(_vFwd, accel * dt);

    // Quadratic air drag
    const vMag = this.vel.length();
    if (vMag > 0.01) {
      const dragMag = this.dragCoeff * vMag * vMag;
      this.vel.addScaledVector(this.vel, -dragMag * dt / vMag);
    }

    // 3. Directional Grip (velocity follows nose)
    if (vMag > 0.1) {
      const fwdSpeed = this.vel.dot(_vFwd);
      const latSpeed = this.vel.dot(_vRight);
      const vertSpeed = this.vel.dot(_vUp);

      // Kill lateral drift according to grip coefficient
      const newLat = damp(latSpeed, 0, this.grip, dt);
      const newVert = damp(vertSpeed, 0, this.grip * 0.5, dt);

      this.vel.copy(_vFwd).multiplyScalar(fwdSpeed)
        .addScaledVector(_vRight, newLat)
        .addScaledVector(_vUp, newVert);
    }

    // 4. Ground-effect Cushion / Anti-grav Lift Probe
    if (this.track) {
      const nearestIdx = this.track.nearestIndex(this.pos);
      const s = nearestIdx * this.track.actualStep;
      this.track.frame(s, this.frameHelper);

      // Distance from track plane
      const toPos = _rayOrigin.copy(this.pos).sub(this.frameHelper.pos);
      const heightAboveDeck = toPos.dot(this.frameHelper.U);
      const lateralDist = Math.abs(toPos.dot(this.frameHelper.R));

      // Cushion active when within track width + margin
      if (lateralDist < (this.track.length ? 30.0 : 25.0) && heightAboveDeck < 12.0) {
        const error = this.hoverHeight - heightAboveDeck;
        if (error > 0) {
          // Strong upward spring when too close to deck
          this.vel.addScaledVector(this.frameHelper.U, error * this.hoverStiffness * dt);
        } else if (heightAboveDeck < this.hoverHeight * 2.0 && this.ship.engineOn) {
          // Gentle anti-gravity lift holding hover altitude
          this.vel.addScaledVector(this.frameHelper.U, error * 10.0 * dt);
        }
      }
    }

    // 5. Integrate Position
    this.pos.addScaledVector(this.vel, dt);
    this.speed = this.vel.length();

    // 6. Update Ship Visuals and Hierarchies
    this.ship.root.position.copy(this.pos);
    this.ship.root.quaternion.copy(this.quat);

    this.ship.update(dt, {
      throttle,
      boost,
      turn: steer,
      speed: this.speed,
      accS: accel,
      latS: this.vel.dot(_vRight)
    });
  }
}
