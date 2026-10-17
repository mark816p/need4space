// src/trackracer.js — Fixed-step 120 Hz track-space anti-gravity physics simulation
// Why: Frame-rate independent physics, magnetic hold on loops, hover cushion,
// ballistic air time, wall scraping without sticking, and event emission

import * as THREE from 'three';
import { damp, clamp } from './noise.js';
import { TRACK_W, FIELD_H } from './track.js';
import { HANDLING, PERKS } from './ships.js';
import { getChamberDarkness } from './wreckzones.js';

// Module-level scratch objects to prevent allocations in 120 Hz loop
const _pCurr = new THREE.Vector3();
const _pNext = new THREE.Vector3();
const _vWorldVel = new THREE.Vector3();
const _vAirGrav = new THREE.Vector3(0, -25.0, 0);
const _mBasis = new THREE.Matrix4();
const _qTrack = new THREE.Quaternion();
const _qAir = new THREE.Quaternion();

export class TrackRacer {
  // Static drift flag — drift code exists behind this flag, default false
  static drifting = false;

  constructor(track, ship, options = {}) {
    this.track = track;
    this.ship = ship;
    this.isPlayer = !!options.isPlayer;
    this.difficulty = options.difficulty || 'hard';

    // Ship handling characteristics
    this.kind = (ship && ship.kind) || options.kind || 'feather';
    this.handling = { ...HANDLING[this.kind] };
    this.perks = this.isPlayer ? { ...PERKS[this.difficulty] } : null;

    // Apply perks if player
    if (this.perks) {
      this.handling.grip *= this.perks.gripMul;
      this.handling.topSpeed *= this.perks.topSpeedMul;
      this.handling.boostRefillRate *= this.perks.boostRefillMul;
    }

    // Track-Space Physical Coordinates
    this.s = 0;                  // Longitudinal distance along track (m)
    this.x = 0;                  // Lateral distance across track (m, 0 = center)
    this.h = this.handling.hoverHeight; // Height above deck (m)

    // Velocities
    this.vs = 0;                 // Forward speed (m/s)
    this.vx = 0;                 // Lateral speed (m/s)
    this.vh = 0;                 // Hover vertical speed (m/s)

    // World Space Transforms (rendered by interpolation)
    this.pos = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.camQ = new THREE.Quaternion(); // Smoothed orientation for camera follower

    // World velocity when in ballistic air flight
    this.airVel = new THREE.Vector3();
    this.inAir = false;
    this.airTime = 0;

    // Race Progress & Lap Counting
    this.progress = 0;           // Accumulated meters traveled
    this.lap = 0;
    this.finished = false;
    this.wrecked = false;

    // Boost & Energy
    this.boostEnergy = 1.0;      // 0.0 to 1.0
    this.isBoosting = false;
    this.boostTimer = 0;

    // Event bus (consumed by FX, audio, and HUD)
    this.events = [];
    this.lastWallHitTime = -10.0;
    this.lastPadTime = -10.0;

    // Scratch frame holder
    this.frame = {};
  }

  emit(type, detail = {}) {
    this.events.push({ type, time: performance.now() * 0.001, ...detail });
  }

  consumeEvents() {
    if (this.events.length === 0) return [];
    const ev = this.events;
    this.events = [];
    return ev;
  }

  reset(s = 0, x = 0, speed = 0) {
    this.s = this.track ? this.track.wrap(s) : s;
    this.x = x;
    this.h = this.handling.hoverHeight;
    this.vs = speed;
    this.vx = 0;
    this.vh = 0;
    this.inAir = false;
    this.airTime = 0;
    this.isBoosting = false;
    this.boostTimer = 0;
    this.boostEnergy = 1.0;
    this.wrecked = false;
    this.updatePose(0);
  }

  step(dt, input = {}) {
    if (!this.track) return;

    const throttle = input.throttle ?? 1.0;
    const brake = input.brake ?? 0;
    const steer = input.steer ?? 0;
    const airbrakeL = input.airbrakeL ?? false;
    const airbrakeR = input.airbrakeR ?? false;
    const boostPressed = input.boost ?? false;

    // 1. Boost Management
    if (boostPressed && this.boostEnergy > 0.15 && !this.isBoosting) {
      this.isBoosting = true;
      this.boostTimer = this.handling.boostDuration;
      this.emit('boost_start');
    }

    if (this.isBoosting) {
      this.boostTimer -= dt;
      this.boostEnergy = Math.max(0, this.boostEnergy - (dt / this.handling.boostDuration));
      if (this.boostTimer <= 0 || this.boostEnergy <= 0) {
        this.isBoosting = false;
        this.emit('boost_end');
      }
    } else {
      // Slow boost refill over time
      this.boostEnergy = Math.min(1.0, this.boostEnergy + this.handling.boostRefillRate * dt);
    }

    // 2. Forward Longitudinal Acceleration & Drag
    const targetTop = this.isBoosting ? this.handling.boostSpeed : this.handling.topSpeed;
    const accelRate = this.isBoosting ? this.handling.boostAccel : this.handling.accel;

    if (throttle > 0 && this.vs < targetTop) {
      this.vs += throttle * accelRate * dt;
    } else if (throttle === 0 && this.vs > 0) {
      // Engine coasting drag
      this.vs = Math.max(0, this.vs - 18.0 * dt);
    }

    // Airbrakes / Braking drag
    if (brake > 0) {
      this.vs = Math.max(0, this.vs - brake * 65.0 * dt);
    }
    if (airbrakeL || airbrakeR) {
      this.vs = Math.max(0, this.vs - this.handling.airbrakeDrag * dt);
    }

    // High-speed aerodynamic drag capping overshoot
    if (this.vs > targetTop) {
      this.vs = damp(this.vs, targetTop, 2.5, dt);
    }

    // 3. Track Context & Jump Cuts / Gaps
    const isInGap = this.track.inGap(this.s);

    if (isInGap && !this.inAir) {
      // Launched into ballistic air flight over jump cut
      this.inAir = true;
      this.airTime = 0;
      this.track.frame(this.s, this.frame);
      // Convert current track-space velocity to world space
      this.airVel.copy(this.frame.T).multiplyScalar(this.vs)
        .addScaledVector(this.frame.R, this.vx)
        .addScaledVector(this.frame.U, this.vh);
      this.emit('jump_launch', { speed: this.vs });
    }

    // 4. Air Flight vs Deck Hold
    if (this.inAir) {
      // Ballistic air motion in world space
      this.airTime += dt;
      this.airVel.addScaledVector(_vAirGrav, dt);
      this.pos.addScaledVector(this.airVel, dt);

      // Advance longitudinal s proportional to forward velocity
      this.s = this.track.wrap(this.s + this.vs * dt);
      this.progress += this.vs * dt;

      // Check if we reached solid deck to catch landing
      if (!this.track.inGap(this.s)) {
        this.track.frame(this.s, this.frame);
        const toShip = _pCurr.copy(this.pos).sub(this.frame.pos);
        const distU = toShip.dot(this.frame.U);
        const distR = toShip.dot(this.frame.R);

        // Catch landing if close to deck plane and within track width
        if (distU <= this.handling.hoverHeight * 2.2 && Math.abs(distR) < (TRACK_W * 0.5 + 4.0)) {
          this.inAir = false;
          this.h = Math.max(0.2, distU);
          this.x = clamp(distR, -TRACK_W * 0.48, TRACK_W * 0.48);
          // Convert world velocity back to track-space vs
          this.vs = Math.max(this.airVel.dot(this.frame.T), 50.0);
          this.vx = this.airVel.dot(this.frame.R);
          this.vh = 0; // Smooth landing without bounce storm
          this.emit('landing', { impact: Math.abs(distU) });
        }
      }
    } else {
      // -----------------------------------------------------------------------
      // On-Track Physics (Hover cushion, Magnetic hold, Lateral steering)
      // -----------------------------------------------------------------------
      // Advance along track
      const ds = this.vs * dt;
      this.s = this.track.wrap(this.s + ds);
      this.progress += ds;

      this.track.frame(this.s, this.frame);

      // Hover Cushion Spring-Damper
      const hoverErr = this.handling.hoverHeight - this.h;
      const hoverForce = hoverErr * this.handling.hoverStiffness - this.vh * this.handling.hoverDamping;
      this.vh += hoverForce * dt;
      this.h += this.vh * dt;
      this.h = clamp(this.h, 0.2, this.handling.hoverHeight * 3.0);

      // Steering & Airbrake Cornering
      let effectiveSteer = steer;
      if (airbrakeL) effectiveSteer -= this.handling.airbrakeTurn * 0.6;
      if (airbrakeR) effectiveSteer += this.handling.airbrakeTurn * 0.6;

      // Lateral acceleration
      this.vx += effectiveSteer * (this.handling.turnRate * 25.0) * dt;

      // Centripetal drift against track curvature
      // Hug apex / counteract centrifugal push
      const gripFactor = this.handling.grip;
      this.vx = damp(this.vx, 0, gripFactor, dt);

      // Integrate lateral position
      this.x += this.vx * dt;

      // 5. Wall Collisions (Solid Barriers at ±TRACK_W/2)
      const halfWall = (TRACK_W * 0.5) - (this.ship ? this.ship.halfSpan : 4.5);
      if (Math.abs(this.x) > halfWall) {
        const side = Math.sign(this.x);
        this.x = side * halfWall;

        // Bounce back laterally
        this.vx = -this.vx * this.handling.wallBounce;

        // Friction along wall: retains forward velocity ("never stuck on wall")
        const speedLoss = Math.abs(this.vs) * (this.handling.wallFriction * 0.2);
        this.vs = Math.max(30.0, this.vs - speedLoss);

        // Emit scrape event with cooldown
        const nowSec = performance.now() * 0.001;
        if (nowSec - this.lastWallHitTime > 0.25) {
          this.lastWallHitTime = nowSec;
          this.emit('wall_hit', { side, speed: this.vs });
          if (this.ship) {
            this.ship.hit(new THREE.Vector3(side, 0, 0), 1.5);
          }
        }
      }

      // 6. Boost Pad Intersections
      if (this.track.pads && this.track.pads.length > 0) {
        for (let p = 0; p < this.track.pads.length; p++) {
          const pad = this.track.pads[p];
          if (Math.abs(this.s - pad.s) < (this.vs * dt + 4.0) && Math.abs(this.x - pad.x) < 5.0) {
            const nowSec = performance.now() * 0.001;
            if (nowSec - this.lastPadTime > 1.2) {
              this.lastPadTime = nowSec;
              this.boostEnergy = 1.0;
              this.isBoosting = true;
              this.boostTimer = this.handling.boostDuration;
              this.vs = Math.min(this.handling.boostSpeed * 1.05, this.vs + 45.0);
              this.emit('pad_hit', { s: pad.s });
            }
          }
        }
      }
    }

    // 7. Update 3D World Transform & Interpolation Pose
    this.updatePose(steer);
  }

  updatePose(steer = 0) {
    if (!this.track) return;

    if (!this.inAir) {
      this.track.frame(this.s, this.frame);
      // Position on track plane
      this.pos.copy(this.frame.pos)
        .addScaledVector(this.frame.R, this.x)
        .addScaledVector(this.frame.U, this.h);

      // Orientation matching track basis (R, U, T)
      _mBasis.makeBasis(this.frame.R, this.frame.U, this.frame.T);
      _qTrack.setFromRotationMatrix(_mBasis);

      // Coordinate roll tilt into steering
      const rollAngle = -steer * 0.32;
      const qRoll = new THREE.Quaternion().setFromAxisAngle(this.frame.T, rollAngle);
      this.quat.copy(_qTrack).multiply(qRoll);
    } else {
      // In air: orient forward along air velocity vector
      if (this.airVel.length() > 2.0) {
        const fwd = _vWorldVel.copy(this.airVel).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
        up.crossVectors(fwd, right).normalize();
        _mBasis.makeBasis(right, up, fwd.negate());
        _qAir.setFromRotationMatrix(_mBasis);
        this.quat.slerp(_qAir, 0.15);
      }
    }

    // Update smoothed camera orientation
    this.camQ.slerp(this.quat, 0.22);

    // Apply to 3D ship root if attached
    if (this.ship) {
      this.ship.root.position.copy(this.pos);
      this.ship.root.quaternion.copy(this.quat);
      this.ship.update(1 / 120, {
        throttle: 1.0,
        boost: this.isBoosting,
        turn: steer,
        speed: this.vs,
        accS: this.vs,
        chamberDarkness: getChamberDarkness(this.s)
      });
    }
  }
}
