// src/race.js — Race manager, 8 AI rivals, racing line planner, grid, and standings
// Why: Fixed-step 120 Hz driver AI, 9 teams, projected-gradient line plan,
// collision resolution, lap progression, and standings projections

import * as THREE from 'three';
import { damp, clamp } from './noise.js';
import { TrackRacer } from './track.js';
import { Ship } from './ship.js';
import { buildFeatherS1, buildCometR1, buildAnvilH1, createShipMaterials } from './shipmodels.js';
import { PERKS } from './ships.js';
import { applyShipLivery } from './liveries.js';

// 9 Racing Teams (colors, liveries, engine colors)
export const TEAMS = [
  {
    name: 'Solaris Dynamics',
    css: '#ffaa00',
    liveryColor: 0xffaa00,
    bodyColor: 0x1f242d,
    engineColor: 0xff7700,
    shipKind: 'feather',
    pilot: 'Aria Vance',
    nickname: 'Sunburst',
    style: 'apex'
  },
  {
    name: 'Vortex Hypercraft',
    css: '#00ff88',
    liveryColor: 0x00ff88,
    bodyColor: 0x0f1b18,
    engineColor: 0x00ffaa,
    shipKind: 'heavy',
    pilot: 'Kaelen Voss',
    nickname: 'Vortex Slammer',
    style: 'slammer'
  },
  {
    name: 'Nexus Heavy Industries',
    css: '#9933ff',
    liveryColor: 0x8833ee,
    bodyColor: 0x1e1828,
    engineColor: 0xcc44ff,
    shipKind: 'heavy',
    pilot: 'Torin Drak',
    nickname: 'Iron Fist',
    style: 'slammer'
  },
  {
    name: 'Apex Orbital',
    css: '#00d2ff',
    liveryColor: 0x00d2ff,
    bodyColor: 0x0d202d,
    engineColor: 0xffffff,
    shipKind: 'rocket',
    pilot: 'Maya Lin',
    nickname: 'Apex Rocket',
    style: 'speeder'
  },
  {
    name: 'Feather Racing', // Player team (Slot 4)
    css: '#ff2233',
    liveryColor: 0xe62233,
    bodyColor: 0xf0f2f5,
    engineColor: 0x00d2ff,
    shipKind: 'feather',
    pilot: 'Ace Pilot',
    nickname: 'Feather One',
    style: 'player'
  },
  {
    name: 'Vostok Aerospace',
    css: '#ff3366',
    liveryColor: 0xff3366,
    bodyColor: 0x241118,
    engineColor: 0xff2288,
    shipKind: 'rocket',
    pilot: 'Yuri Chen',
    nickname: 'Cosmo Speed',
    style: 'speeder'
  },
  {
    name: 'Mirai Cybernetics',
    css: '#00e5ff',
    liveryColor: 0x00e5ff,
    bodyColor: 0xe0f7fa,
    engineColor: 0x00b0ff,
    shipKind: 'feather',
    pilot: 'Rei Tanaka',
    nickname: 'Cyber Apex',
    style: 'apex'
  },
  {
    name: 'Titan Heavyworks',
    css: '#ffcc00',
    liveryColor: 0xffcc00,
    bodyColor: 0x2b2510,
    engineColor: 0xff9900,
    shipKind: 'heavy',
    pilot: 'Brutus Volkov',
    nickname: 'The Anvil',
    style: 'slammer'
  },
  {
    name: 'Zenith Interstellar',
    css: '#ffffff',
    liveryColor: 0xffffff,
    bodyColor: 0x1a1a24,
    engineColor: 0x66eeff,
    shipKind: 'rocket',
    pilot: 'Lyra Thorne',
    nickname: 'Void Phantom',
    style: 'speeder'
  }
];

// AI Skill / Difficulty parameters
export const AI_LEVELS = {
  easy: {
    speedMul: 0.89,
    padHitRate: 0.65,
    steerGrip: 8.0,
    boostProb: 0.45,
    wander: 2.2,
    lookAhead: 26.0,
    boostInterval: 850
  },
  normal: {
    speedMul: 0.94,
    padHitRate: 0.80,
    steerGrip: 9.5,
    boostProb: 0.70,
    wander: 1.5,
    lookAhead: 30.0,
    boostInterval: 650
  },
  hard: {
    speedMul: 0.99,
    padHitRate: 0.92,
    steerGrip: 12.0,
    boostProb: 0.88,
    wander: 0.7,
    lookAhead: 38.0,
    boostInterval: 500
  },
  brutal: {
    speedMul: 1.02,
    padHitRate: 0.98,
    steerGrip: 14.0,
    boostProb: 0.96,
    wander: 0.2,
    lookAhead: 46.0,
    boostInterval: 390
  }
};

// Points per position (1st through 9th)
export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2];

export class DriverAI {
  constructor(racer, track, skill = 'easy', style = 'apex') {
    this.racer = racer;
    this.track = track;
    this.skill = skill;
    this.style = style || (racer.team && racer.team.style) || 'apex';
    this.params = AI_LEVELS[skill] || AI_LEVELS.easy;

    // AI Driving state
    this.laneOffset = (Math.random() - 0.5) * 1.5;
    this.lastBoostS = -1000;
  }

  plan(allRacers = []) {
    const r = this.racer;
    const track = this.track;
    const s = r.s;

    // 1. Target lateral line from track racing line (corners, apexes, pads)
    let targetX = track.racingLine(s) + (this.style === 'apex' ? this.laneOffset * 0.5 : this.laneOffset);

    // Force strict centering over cuts, gaps, and loops; leave centre sooner after a flip
    if (track.inGap(s) || track.inLoop(s)) {
      targetX = 0;
    } else if (track.inFlip && track.inFlip(s)) {
      targetX = 0;
    } else {
      // Seek boost pads if nearby and skill roll permits
      const padRate = this.style === 'apex' ? Math.min(1.0, this.params.padHitRate * 1.1) : this.params.padHitRate;
      if (track.pads && Math.random() < padRate) {
        for (let i = 0; i < track.pads.length; i++) {
          const pad = track.pads[i];
          const distToPad = (pad.s - s + track.length) % track.length;
          if (distToPad > 0 && distToPad < 140.0) {
            targetX = THREE.MathUtils.lerp(targetX, pad.x, 0.75);
            break;
          }
        }
      }
    }

    // Rivals keep lane off walls
    const maxMargin = (28.0) - 7.5; // Wall at ±28m (TRACK_W 56m)
    targetX = clamp(targetX, -maxMargin, maxMargin);

    // 2. Traffic interaction: look ahead for rivals within 25m
    let wantsSlam = false;
    for (let i = 0; i < allRacers.length; i++) {
      const other = allRacers[i];
      if (other === r || other.isDead) continue;
      const aheadDist = (other.progress - r.progress);
      const lateralDist = Math.abs(other.x - r.x);

      // Aggressive Slammer Persona: check if alongside at racing speed to strike
      if (this.style === 'slammer' && r.vs > 60.0 && Math.abs(aheadDist) < 18.0 && lateralDist < 8.5) {
        if (r.slamTimer <= 0) {
          wantsSlam = true;
          // Steer towards target to initiate slam
          targetX = other.x;
        }
      } else if (aheadDist > 0 && aheadDist < 26.0 && lateralDist < 8.0) {
        // Pass on the side with more track margin
        const passDir = r.x > other.x ? 1 : -1;
        targetX += passDir * 9.0;
      }
    }

    // 3. Compute Steering Input
    const steerErr = targetX - r.x;
    const steerMul = this.style === 'apex' ? 0.16 : 0.12;
    const steer = clamp(steerErr * steerMul, -1.0, 1.0);

    // 4. Target Speed & Throttle
    const frameIdx = Math.floor(s / track.actualStep);
    const curveTarget = (track.targetSpeeds && track.targetSpeeds[frameIdx]) ? track.targetSpeeds[frameIdx] : 240.0;
    const speedMul = this.style === 'speeder' ? this.params.speedMul * 1.03 : this.params.speedMul;
    const maxSpeed = curveTarget * speedMul;

    let throttle = 1.0;
    let brake = 0;
    if (r.vs > maxSpeed + 15.0) {
      throttle = 0;
      brake = clamp((r.vs - maxSpeed) * 0.05, 0, 1.0);
    }

    // 5. Boost Planning
    let boost = false;
    const baseInterval = this.params.boostInterval || 600.0;
    const interval = this.style === 'speeder' ? baseInterval * 0.72 : baseInterval;
    const boostProb = this.style === 'speeder' ? Math.min(0.98, this.params.boostProb * 1.15) : this.params.boostProb;

    if (r.boostEnergy > 0.45 && !r.isBoosting && Math.random() < boostProb) {
      // Prefer boosting on straights
      const isStraight = curveTarget > 225.0;
      const distSinceBoost = (s - this.lastBoostS + track.length) % track.length;
      if (isStraight && distSinceBoost > interval) {
        boost = true;
        this.lastBoostS = s;
      }
    }

    return { throttle, brake, steer, boost, slam: wantsSlam };
  }
}

export class Race {
  constructor(track, options = {}) {
    this.track = track;
    this.options = options;
    this.difficulty = options.difficulty || 'easy';
    this.numLaps = options.numLaps || 3;
    this.state = 'countdown'; // 'grid' | 'countdown' | 'racing' | 'finished'
    this.countdownTime = 4.0;  // 3-2-1-GO! (4 seconds total)
    this.elapsedTime = 0;
    this.standings = [];

    // Grid slots: 3 columns (x = [0, -16, 16]), back = 26 + row*30 + (col ? 7 : 0)
    // 9 Racers: Player in slot 4
    this.racers = [];
    this.drivers = [];
    this.playerRacer = null;

    this._buildGrid();
  }

  _buildGrid() {
    for (let k = 0; k < 9; k++) {
      const isPlayer = (k === 4);
      const team = TEAMS[k];

      const row = Math.floor(k / 3);
      const col = k % 3;
      const x = [0, -16, 16][col];
      const back = 26 + row * 30 + (col !== 0 ? 7 : 0);

      const mats = createShipMaterials(team.liveryColor, team.bodyColor);
      mats.engineGlow.color.setHex(team.engineColor);

      // Support selected ship kind for player (feather, rocket, heavy)
      const playerShipKind = this.options.shipKind || (this.options.settings ? this.options.settings.get('selectedShip') : 'feather');
      let shipModel;
      let shipKind = 'feather';
      if (isPlayer) {
        shipKind = playerShipKind;
        if (playerShipKind === 'rocket' || playerShipKind === 'comet') {
          shipModel = buildCometR1(mats);
          shipKind = 'rocket';
        } else if (playerShipKind === 'heavy' || playerShipKind === 'anvil') {
          shipModel = buildAnvilH1(mats);
          shipKind = 'heavy';
        } else {
          shipModel = buildFeatherS1(mats);
          shipKind = 'feather';
        }
      } else {
        shipKind = team.shipKind || 'feather';
        if (shipKind === 'rocket' || shipKind === 'comet') {
          shipModel = buildCometR1(mats);
          shipKind = 'rocket';
        } else if (shipKind === 'heavy' || shipKind === 'anvil') {
          shipModel = buildAnvilH1(mats);
          shipKind = 'heavy';
        } else {
          shipModel = buildFeatherS1(mats);
          shipKind = 'feather';
        }
      }

      const ship = new Ship(shipModel, { isRival: !isPlayer });
      if (isPlayer) {
        const liveryIdx = this.options.settings ? (this.options.settings.get('selectedLivery') ?? 0) : 0;
        applyShipLivery(ship, liveryIdx);
      }

      const racer = new TrackRacer(this.track, ship, {
        isPlayer,
        difficulty: this.difficulty,
        kind: shipKind,
        airPitch: this.options.airPitch !== undefined ? this.options.airPitch : true
      });

      racer.team = team;
      racer.pilot = isPlayer ? (this.options.playerName || 'Ace Pilot') : team.pilot;
      racer.nickname = team.nickname;
      racer.aiStyle = team.style;
      racer.gridSlot = k;
      racer.initialBack = back;

      // Start position behind the start line
      const startS = this.track.wrap(this.track.length - back);
      racer.reset(startS, x, 0);
      racer.progress = -back; // Lap counting accumulated progress starts at -back

      this.racers.push(racer);

      if (isPlayer) {
        this.playerRacer = racer;
        this.drivers.push(null); // Player controlled by input
      } else {
        const driver = new DriverAI(racer, this.track, this.difficulty, team.style);
        this.drivers.push(driver);
      }
    }

    this._updateStandings();
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty;
    for (let k = 0; k < this.racers.length; k++) {
      const racer = this.racers[k];
      if (racer.isPlayer) {
        racer.difficulty = difficulty;
        racer.perks = PERKS[difficulty] || PERKS.easy;
      } else if (this.drivers[k]) {
        this.drivers[k].skill = difficulty;
        this.drivers[k].params = AI_LEVELS[difficulty] || AI_LEVELS.easy;
      }
    }
  }

  attachToScene(scene) {
    if (!scene) return;
    for (const r of this.racers) {
      scene.add(r.ship.root);
      r.ship.attachTrails(scene);
    }
  }

  step(dt, playerInput = {}) {
    this.elapsedTime += dt;

    // 1. Countdown handling (3, 2, 1, GO!)
    if (this.state === 'countdown') {
      this.countdownTime -= dt;
      if (this.countdownTime <= 0) {
        this.state = 'racing';
        for (const r of this.racers) {
          r.emit('race_go');
        }
      }
    }

    // 2. Step Racers Physics
    for (let k = 0; k < 9; k++) {
      const racer = this.racers[k];
      let input = { throttle: 0, brake: 0, steer: 0, boost: false };

      if (this.state === 'racing' || this.state === 'finished') {
        if (racer.isPlayer) {
          input = { throttle: 1.0, ...playerInput };
        } else {
          const ai = this.drivers[k];
          input = ai ? ai.plan(this.racers) : { throttle: 1.0 };
        }
      }

      racer.step(dt, input);

      // Ships lit by the road deck (§P11.2)
      if (racer.ship && racer.ship.setDeckLight && racer.frame) {
        racer.ship.setDeckLight(racer.frame, this.track.deckColor || 0x222938, this.options.settings);
      }

      // Lap tracking based on progress
      if (racer.progress >= 0) {
        racer.lap = Math.min(this.numLaps, Math.floor(racer.progress / this.track.length) + 1);
        if (racer.progress >= this.track.length * this.numLaps && !racer.finished) {
          racer.finished = true;
          racer.finishTime = this.elapsedTime;
          racer.emit('race_finish', { time: racer.finishTime });
        }
      }
    }

    // 3. Ship-to-Ship Collisions
    this._resolveCollisions();

    // 4. Update Standings
    this._updateStandings();

    // Check if player has finished
    if (this.playerRacer && this.playerRacer.finished && this.state === 'racing') {
      this.state = 'finished';
    }
  }

  _resolveCollisions() {
    const count = this.racers.length;
    for (let i = 0; i < count; i++) {
      const rA = this.racers[i];
      if (rA.inAir || rA.isDead) continue;

      for (let j = i + 1; j < count; j++) {
        const rB = this.racers[j];
        if (rB.inAir || rB.isDead) continue;

        // Check longitudinal distance
        const sDist = Math.abs(rA.s - rB.s);
        const wrappedDist = Math.min(sDist, this.track.length - sDist);

        if (wrappedDist < 12.0) {
          // Check lateral distance
          const xDist = rA.x - rB.x;
          const minSep = (rA.ship.halfSpan + rB.ship.halfSpan) * 0.9;

          if (Math.abs(xDist) < minSep) {
            // Lateral collision overlap
            const overlap = minSep - Math.abs(xDist);
            const pushDir = xDist >= 0 ? 1 : -1;

            rA.x += pushDir * overlap * 0.5;
            rB.x -= pushDir * overlap * 0.5;

            // Check if active slam impact occurs
            if (rA.isSlamming && !rB.isSlamming) {
              const slamDmg = (rA.handling.slamDamage || 30.0) * (rB.handling.damageResist || 1.0);
              rB.takeDamage(slamDmg, 'slam');
              rA.takeDamage(slamDmg * 0.2, 'slam_recoil');
              const slamImpulse = (rA.handling.slamForce || 40.0) * 0.85;
              rB.vx += (rA.slamDir || pushDir) * slamImpulse;
              rA.isSlamming = false;
              rA.slamActiveTimer = 0.0;
              rA.emit('slam_hit', { attacker: rA.team.name, defender: rB.team.name, damage: slamDmg });
              rB.emit('knock', { other: rA.team.name, damage: slamDmg, wasSlam: true });
            } else if (rB.isSlamming && !rA.isSlamming) {
              const slamDmg = (rB.handling.slamDamage || 30.0) * (rA.handling.damageResist || 1.0);
              rA.takeDamage(slamDmg, 'slam');
              rB.takeDamage(slamDmg * 0.2, 'slam_recoil');
              const slamImpulse = (rB.handling.slamForce || 40.0) * 0.85;
              rA.vx += (rB.slamDir || -pushDir) * slamImpulse;
              rB.isSlamming = false;
              rB.slamActiveTimer = 0.0;
              rB.emit('slam_hit', { attacker: rB.team.name, defender: rA.team.name, damage: slamDmg });
              rA.emit('knock', { other: rB.team.name, damage: slamDmg, wasSlam: true });
            } else {
              // Elastic bounce impulse
              const relVx = rA.vx - rB.vx;
              const bounce = 14.0;
              rA.vx += pushDir * bounce;
              rB.vx -= pushDir * bounce;

              // Kinetic collision damage tracking speed & mass with debounce cooldown
              const relSpd = Math.hypot(rA.vs - rB.vs, relVx);
              const baseDmg = Math.min(22.0, 4.0 + relSpd * 0.08);
              const dmgA = baseDmg * (rB.handling.mass / rA.handling.mass) * (rA.handling.damageResist || 1.0);
              const dmgB = baseDmg * (rA.handling.mass / rB.handling.mass) * (rB.handling.damageResist || 1.0);

              const nowSec = this.elapsedTime;
              if (nowSec - (rA.lastShipHitTime || -10.0) > 0.35) {
                rA.lastShipHitTime = nowSec;
                rA.takeDamage(dmgA, 'ship_collision');
                rA.emit('knock', { other: rB.team.name, damage: dmgA });
              }
              if (nowSec - (rB.lastShipHitTime || -10.0) > 0.35) {
                rB.lastShipHitTime = nowSec;
                rB.takeDamage(dmgB, 'ship_collision');
                rB.emit('knock', { other: rA.team.name, damage: dmgB });
              }
            }

            // Visual hit shakes
            rA.ship.hit(new THREE.Vector3(pushDir, 0, 0), 1.2);
            rB.ship.hit(new THREE.Vector3(-pushDir, 0, 0), 1.2);
          }
        }
      }
    }
  }

  _updateStandings() {
    // Sort racers by accumulated progress descending
    this.standings = [...this.racers].sort((a, b) => b.progress - a.progress);

    for (let rank = 0; rank < this.standings.length; rank++) {
      this.standings[rank].position = rank + 1;
    }
  }

  getResults() {
    const totalDist = this.track.length * this.numLaps;
    return this.standings.map((r, rank) => {
      let time = r.finishTime;
      // Projections for unfinished ships based on current pace
      if (!time) {
        const pace = r.vs > 10 ? (totalDist - r.progress) / r.vs : 60;
        time = this.elapsedTime + pace;
      }
      return {
        rank: rank + 1,
        name: r.team.name,
        pilot: r.pilot || (r.team && r.team.pilot) || 'Ace Pilot',
        nickname: r.nickname || (r.team && r.team.nickname) || '',
        shipKind: r.kind,
        isPlayer: r.isPlayer,
        time,
        points: POINTS[rank] || 0,
        gap: rank === 0 ? '--' : `+${Math.max(0, time - (this.standings[0].finishTime || this.elapsedTime)).toFixed(2)}s`
      };
    });
  }
}
