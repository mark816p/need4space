// src/trackracer.js — Fixed-step 120 Hz track-space anti-gravity physics simulation
// Why: Frame-rate independent physics, magnetic hold on loops, hover cushion,
// ballistic air time, wall scraping without sticking, and event emission

import * as THREE from 'three';
import { damp, clamp } from './noise.js';
import { TRACK_W, FIELD_H } from './track.js';
import { HANDLING, PERKS } from './ships.js';
import { getChamberDarkness } from './wreckzones.js';

export const PITCH_AIR = 14.0; // 14 m/s² nose control in the air

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
    if (this.ship) {
      this.ship.isRival = !this.isPlayer;
    }
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

    // Boost & Energy (with overflow support up to 1.5)
    this.boostEnergy = 1.0;      // 0.0 to 1.5
    this.isBoosting = false;
    this.boostTimer = 0;

    // Drift state (active when TrackRacer.drifting is true and isPlayer; Rivals never drift)
    this.isDrifting = false;
    this.driftDir = 0;           // -1 = left, +1 = right
    this.driftTime = 0.0;
    this.driftBuild = 0.0;       // 0..1 builds over 0.5s
    this.driftTier = 0;          // 0 = none, 1 = blue, 2 = orange, 3 = violet
    this.driftChain = 0;         // Multiplier counter
    this.driftChainTimer = 0.0;  // 2.5s timer
    this.driftYaw = 0.0;         // Nose held ~20° in corner

    // Air Pitch Control (nose down pulls hull to deck sooner, nose up stretches flight)
    this.airPitch = options.airPitch !== undefined ? options.airPitch : true;
    this.pitchAccel = 0.0;       // Eased acceleration
    this.pitchAngle = 0.0;       // Visual tilt angle in air
    this.isInFlip = false;

    // Airbrake Charge System (1.6.0: 1 shot held up to 1.0s, 3.0s recharge; Anvil has 2 charges)
    this.maxAirbrakes = this.handling.airbrakes || 1;
    this.airbrakeCharges = this.maxAirbrakes;
    this.airbrakeHoldTimer = 0.0;
    this.airbrakeRechargeTimer = 0.0;
    this.activeAirbrake = null;
    this.airbrakeBlockedL = false;
    this.airbrakeBlockedR = false;

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
    this.isDrifting = false;
    this.driftDir = 0;
    this.driftTime = 0.0;
    this.driftBuild = 0.0;
    this.driftTier = 0;
    this.driftChain = 0;
    this.driftChainTimer = 0.0;
    this.driftYaw = 0.0;
    this.pitchAccel = 0.0;
    this.pitchAngle = 0.0;
    this.isInFlip = false;
    this.maxAirbrakes = this.handling.airbrakes || 1;
    this.airbrakeCharges = this.maxAirbrakes;
    this.airbrakeHoldTimer = 0.0;
    this.airbrakeRechargeTimer = 0.0;
    this.activeAirbrake = null;
    this.wrecked = false;
    this.updatePose(0);
  }

  step(dt, input = {}) {
    if (!this.track) return;

    const throttle = input.throttle ?? 1.0;
    const brake = input.brake ?? 0;
    const steer = input.steer ?? 0;
    const rawAirbrakeL = input.airbrakeL ?? false;
    const rawAirbrakeR = input.airbrakeR ?? false;
    const boostPressed = input.boost ?? false;
    const rawPitch = input.pitch ?? 0;

    // 0. Airbrake Charge Management (1 shot = up to AIRBRAKE_HOLD 1.0s, AIRBRAKE_WAIT 3.0s recharge)
    if (!rawAirbrakeL) this.airbrakeBlockedL = false;
    if (!rawAirbrakeR) this.airbrakeBlockedR = false;

    if (this.activeAirbrake) {
      const stillHeld = (this.activeAirbrake === 'L' && rawAirbrakeL) || (this.activeAirbrake === 'R' && rawAirbrakeR);
      if (stillHeld && this.airbrakeHoldTimer < 1.0) {
        this.airbrakeHoldTimer += dt;
      } else {
        if (this.activeAirbrake === 'L' && rawAirbrakeL) this.airbrakeBlockedL = true;
        if (this.activeAirbrake === 'R' && rawAirbrakeR) this.airbrakeBlockedR = true;
        this.activeAirbrake = null;
        this.airbrakeHoldTimer = 0.0;
      }
    } else {
      if (rawAirbrakeL && !this.airbrakeBlockedL && this.airbrakeCharges > 0) {
        this.airbrakeCharges--;
        this.activeAirbrake = 'L';
        this.airbrakeHoldTimer = 0.0;
        this.emit('airbrake_fire', { side: 'L', charges: this.airbrakeCharges });
      } else if (rawAirbrakeR && !this.airbrakeBlockedR && this.airbrakeCharges > 0) {
        this.airbrakeCharges--;
        this.activeAirbrake = 'R';
        this.airbrakeHoldTimer = 0.0;
        this.emit('airbrake_fire', { side: 'R', charges: this.airbrakeCharges });
      }
    }

    // Recharge timer (AIRBRAKE_WAIT = 3.0s)
    if (this.airbrakeCharges < this.maxAirbrakes) {
      this.airbrakeRechargeTimer += dt;
      if (this.airbrakeRechargeTimer >= 3.0) {
        this.airbrakeCharges++;
        this.airbrakeRechargeTimer = 0.0;
        this.emit('airbrake_ready', { charges: this.airbrakeCharges });
      }
    } else {
      this.airbrakeRechargeTimer = 0.0;
    }

    const airbrakeL = (this.activeAirbrake === 'L');
    const airbrakeR = (this.activeAirbrake === 'R');

    // 1. Boost Management & Energy Overflow (> 1.0 up to 1.5)
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
      if (this.boostEnergy > 1.0) {
        // Boost overflow (> 1.0) bleeds back slowly unless boosted away
        this.boostEnergy = Math.max(1.0, this.boostEnergy - 0.08 * dt);
      } else {
        // Slow boost refill over time
        this.boostEnergy = Math.min(1.0, this.boostEnergy + this.handling.boostRefillRate * dt);
      }
    }

    // Drift Chain Timer decay (2.5s timer)
    if (this.driftChainTimer > 0) {
      this.driftChainTimer -= dt;
      if (this.driftChainTimer <= 0) {
        this.driftChain = 0;
      }
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

    // 3. Track Context, Jump Cuts / Gaps & Gravity Flips (§A.7)
    const isInFlip = this.track.inFlip ? this.track.inFlip(this.s) : false;
    this.isInFlip = isInFlip;
    const isInGap = this.track.inGap(this.s) && !isInFlip;

    if (isInFlip && this.inAir) {
      // Gravity flip field catches and aligns craft with climbing/inverting track frame
      this.inAir = false;
      this.h = this.handling.hoverHeight;
      this.vh = 0;
    }

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

      // Nose control in the air (airPitch setting, disabled during flips)
      if (this.airPitch && !this.isInFlip) {
        let targetPitchAcc = 0.0;
        let targetPitchAngle = 0.0;

        // ↑ / KeyW / ArrowUp: nose down pulls hull back to deck sooner (-14 m/s²)
        // ↓ / KeyS / ArrowDown: nose up stretches flight (+14 m/s²)
        if (rawPitch !== 0) {
          targetPitchAcc = -rawPitch * PITCH_AIR;
          targetPitchAngle = rawPitch * 0.35;
        } else if (throttle > 0 && brake === 0) {
          targetPitchAcc = -throttle * PITCH_AIR;
          targetPitchAngle = -0.32;
        } else if (brake > 0 && throttle === 0) {
          targetPitchAcc = brake * PITCH_AIR;
          targetPitchAngle = 0.32;
        }

        // Eased with damp(6)
        this.pitchAccel = damp(this.pitchAccel, targetPitchAcc, 6.0, dt);
        this.pitchAngle = damp(this.pitchAngle, targetPitchAngle, 6.0, dt);
      } else {
        // Disabled during gravity flips
        this.pitchAccel = damp(this.pitchAccel, 0, 10.0, dt);
        this.pitchAngle = damp(this.pitchAngle, 0, 10.0, dt);
      }

      this.airVel.addScaledVector(_vAirGrav, dt);
      this.airVel.y += this.pitchAccel * dt;
      this.pos.addScaledVector(this.airVel, dt);

      // Advance longitudinal s proportional to forward velocity
      this.s = this.track.wrap(this.s + this.vs * dt);
      this.progress += this.vs * dt;

      // Check if we reached solid deck to catch landing
      if (!this.track.inGap(this.s) || isInFlip) {
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
      // On-Track Physics (Hover cushion, Magnetic hold, Lateral steering & Drift)
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

      // Drift handling (behind static TrackRacer.drifting flag; Rivals never drift)
      const canDrift = TrackRacer.drifting && this.isPlayer && !isInFlip;
      const wantsDrift = (brake > 0.1 && throttle > 0.1) || (brake > 0.1 && Math.abs(steer) > 0.6);

      if (canDrift) {
        if (!this.isDrifting && wantsDrift) {
          // Initiate drift
          this.isDrifting = true;
          this.driftDir = Math.sign(steer) || (airbrakeR ? 1 : (airbrakeL ? -1 : 1));
          this.driftTime = 0.0;
          this.driftBuild = 0.0;
          this.driftTier = 0;
          // Lateral hop feel
          this.vh += 2.2;
          this.emit('drift_start', { dir: this.driftDir });
        } else if (this.isDrifting) {
          // Check if drift continues
          const keepDrift = (brake > 0.05 || (Math.abs(steer) > 0.3 && Math.sign(steer) === this.driftDir));
          if (keepDrift) {
            this.driftTime += dt;
            this.driftBuild = Math.min(1.0, this.driftBuild + dt / 0.5);

            // Tier progression: Tier 1 (blue), Tier 2 (orange), Tier 3 (violet)
            if (this.driftTime >= 2.5) {
              this.driftTier = 3; // Violet #b042ff
            } else if (this.driftTime >= 1.6) {
              this.driftTier = 2; // Orange #ff8800
            } else if (this.driftTime >= 0.8) {
              this.driftTier = 1; // Blue #00d2ff
            } else {
              this.driftTier = 0;
            }

            // Nose held ~20° in
            const targetYaw = this.driftDir * (20.0 * Math.PI / 180.0) * this.driftBuild;
            this.driftYaw = damp(this.driftYaw, targetYaw, 8.0, dt);

            this.emit('drift_step', { tier: this.driftTier, dir: this.driftDir, time: this.driftTime });
          } else {
            // Straight recovery kick on drift exit
            if (this.driftTier >= 1) {
              // Energy overflow kick past 1.0 up to 1.5
              const tierBonus = [0, 0.18, 0.35, 0.50][this.driftTier];
              this.boostEnergy = clamp(Math.max(this.boostEnergy, 1.0) + tierBonus, 0.0, 1.5);

              // Straight recovery kick forward speed impulse
              this.vs += 12.0 * this.driftTier;

              // Drift chain increment with 2.5s timer
              this.driftChain = (this.driftChainTimer > 0) ? this.driftChain + 1 : 1;
              this.driftChainTimer = 2.5;

              this.emit('drift_kick', {
                tier: this.driftTier,
                chain: this.driftChain,
                energy: this.boostEnergy
              });
            }

            this.isDrifting = false;
            this.driftTime = 0.0;
            this.driftTier = 0;
            this.driftYaw = 0.0;
            this.emit('drift_end');
          }
        }
      } else if (this.isDrifting) {
        this.isDrifting = false;
        this.driftTime = 0.0;
        this.driftTier = 0;
        this.driftYaw = 0.0;
      }

      // Steering & Airbrake Cornering
      let effectiveSteer = steer;
      if (airbrakeL) effectiveSteer -= this.handling.airbrakeTurn * 0.6;
      if (airbrakeR) effectiveSteer += this.handling.airbrakeTurn * 0.6;

      // Player cornering steer assistance by difficulty
      if (this.isPlayer && this.perks && this.perks.autoSteerAssist > 0) {
        const targetLine = this.track.racingLine(this.s);
        const assist = clamp((targetLine - this.x) * 0.05, -1.0, 1.0);
        effectiveSteer += assist * this.perks.autoSteerAssist;
      }

      if (this.isDrifting) {
        // Turns at 1.3x turn rate
        effectiveSteer *= 1.3;
      }

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
        // Player wallScrapeDamp makes knocks a fifth as costly on Easy
        const wallDamp = (this.isPlayer && this.perks && this.perks.wallScrapeDamp !== undefined) ? this.perks.wallScrapeDamp : 1.0;
        const speedLoss = Math.abs(this.vs) * (this.handling.wallFriction * 0.2) * wallDamp;
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

      // Coordinate roll tilt into steering with anti-dip corner safety clamping
      // Prevent long hulls' tail and wing corners from dipping into track deck on steep twists
      const halfSpan = (this.model && this.model.halfSpan) || 5.2;
      const maxRollFromHeight = Math.asin(clamp((this.h - 0.25) / halfSpan, 0.1, 0.85));
      const rollAngle = clamp(-steer * 0.32, -maxRollFromHeight, maxRollFromHeight);
      const qRoll = new THREE.Quaternion().setFromAxisAngle(this.frame.T, rollAngle);
      this.quat.copy(_qTrack).multiply(qRoll);

      // Apply drift nose angle (~20° in corner) if drifting
      if (this.isDrifting && Math.abs(this.driftYaw) > 0.001) {
        const qYaw = new THREE.Quaternion().setFromAxisAngle(this.frame.U, this.driftYaw);
        this.quat.multiply(qYaw);
      }
    } else {
      // In air: orient forward along air velocity vector, incorporating pitch tilt
      if (this.airVel.length() > 2.0) {
        const fwd = _vWorldVel.copy(this.airVel).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
        up.crossVectors(fwd, right).normalize();
        _mBasis.makeBasis(right, up, fwd.negate());
        _qAir.setFromRotationMatrix(_mBasis);

        if (Math.abs(this.pitchAngle) > 0.001) {
          const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitchAngle);
          _qAir.multiply(qPitch);
        }

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
