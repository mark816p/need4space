// src/race.js — Race manager, 8 AI rivals, racing line planner, grid, and standings
// Why: Fixed-step 120 Hz driver AI, 9 teams, projected-gradient line plan,
// collision resolution, lap progression, and standings projections

import * as THREE from 'three';
import { damp, clamp } from './noise.js';
import { TrackRacer } from './track.js';
import { Ship } from './ship.js';
import { buildFeatherS1, createShipMaterials } from './shipmodels.js';

// 9 Racing Teams (colors, liveries, engine colors)
export const TEAMS = [
  {
    name: 'Solaris Dynamics',
    css: '#ffaa00',
    liveryColor: 0xffaa00,
    bodyColor: 0x1f242d,
    engineColor: 0xff7700
  },
  {
    name: 'Vortex Hypercraft',
    css: '#00ff88',
    liveryColor: 0x00ff88,
    bodyColor: 0x0f1b18,
    engineColor: 0x00ffaa
  },
  {
    name: 'Nexus Heavy Industries',
    css: '#9933ff',
    liveryColor: 0x8833ee,
    bodyColor: 0x1e1828,
    engineColor: 0xcc44ff
  },
  {
    name: 'Apex Orbital',
    css: '#00d2ff',
    liveryColor: 0x00d2ff,
    bodyColor: 0x0d202d,
    engineColor: 0xffffff
  },
  {
    name: 'Feather Racing', // Player team (Slot 4)
    css: '#ff2233',
    liveryColor: 0xe62233,
    bodyColor: 0xf0f2f5,
    engineColor: 0x00d2ff
  },
  {
    name: 'Vostok Aerospace',
    css: '#ff3366',
    liveryColor: 0xff3366,
    bodyColor: 0x241118,
    engineColor: 0xff2288
  },
  {
    name: 'Mirai Cybernetics',
    css: '#00e5ff',
    liveryColor: 0x00e5ff,
    bodyColor: 0xe0f7fa,
    engineColor: 0x00b0ff
  },
  {
    name: 'Titan Heavyworks',
    css: '#ffcc00',
    liveryColor: 0xffcc00,
    bodyColor: 0x2b2510,
    engineColor: 0xff9900
  },
  {
    name: 'Zenith Interstellar',
    css: '#ffffff',
    liveryColor: 0xffffff,
    bodyColor: 0x1a1a24,
    engineColor: 0x66eeff
  }
];

// AI Skill / Difficulty parameters
export const AI_LEVELS = {
  normal: {
    speedMul: 0.93,
    padHitRate: 0.82,
    steerGrip: 8.5,
    boostProb: 0.70,
    wander: 1.8,
    lookAhead: 28.0
  },
  hard: {
    speedMul: 0.985,
    padHitRate: 0.95,
    steerGrip: 11.5,
    boostProb: 0.90,
    wander: 0.8,
    lookAhead: 38.0
  },
  brutal: {
    speedMul: 1.025,
    padHitRate: 1.0,
    steerGrip: 14.0,
    boostProb: 0.98,
    wander: 0.2,
    lookAhead: 48.0
  }
};

// Points per position (1st through 9th)
export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2];

export class DriverAI {
  constructor(racer, track, skill = 'hard') {
    this.racer = racer;
    this.track = track;
    this.skill = skill;
    this.params = AI_LEVELS[skill] || AI_LEVELS.hard;

    // AI Driving state
    this.laneOffset = (Math.random() - 0.5) * 1.5;
    this.lastBoostS = -1000;
  }

  plan(allRacers = []) {
    const r = this.racer;
    const track = this.track;
    const s = r.s;

    // 1. Target lateral line from track racing line (corners, apexes, pads)
    let targetX = track.racingLine(s) + this.laneOffset;

    // Force strict centering over cuts, gaps, and loops
    if (track.inGap(s) || track.inLoop(s)) {
      targetX = 0;
    } else {
      // Seek boost pads if nearby and skill roll permits
      if (track.pads && Math.random() < this.params.padHitRate) {
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

    // 2. Traffic avoidance: look ahead for rivals within 25m
    for (let i = 0; i < allRacers.length; i++) {
      const other = allRacers[i];
      if (other === r) continue;
      const aheadDist = (other.progress - r.progress);
      if (aheadDist > 0 && aheadDist < 26.0) {
        const lateralDist = Math.abs(other.x - r.x);
        if (lateralDist < 8.0) {
          // Pass on the side with more track margin
          const passDir = r.x > other.x ? 1 : -1;
          targetX += passDir * 9.0;
        }
      }
    }

    // 3. Compute Steering Input
    const steerErr = targetX - r.x;
    const steer = clamp(steerErr * 0.12, -1.0, 1.0);

    // 4. Target Speed & Throttle
    const frameIdx = Math.floor(s / track.actualStep);
    const curveTarget = (track.targetSpeeds && track.targetSpeeds[frameIdx]) ? track.targetSpeeds[frameIdx] : 240.0;
    const maxSpeed = curveTarget * this.params.speedMul;

    let throttle = 1.0;
    let brake = 0;
    if (r.vs > maxSpeed + 15.0) {
      throttle = 0;
      brake = clamp((r.vs - maxSpeed) * 0.05, 0, 1.0);
    }

    // 5. Boost Planning
    let boost = false;
    if (r.boostEnergy > 0.45 && !r.isBoosting && Math.random() < this.params.boostProb) {
      // Prefer boosting on straights
      const isStraight = curveTarget > 230.0;
      const distSinceBoost = (s - this.lastBoostS + track.length) % track.length;
      if (isStraight && distSinceBoost > 600.0) {
        boost = true;
        this.lastBoostS = s;
      }
    }

    return { throttle, brake, steer, boost };
  }
}

export class Race {
  constructor(track, options = {}) {
    this.track = track;
    this.options = options;
    this.difficulty = options.difficulty || 'hard';
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

      const shipModel = buildFeatherS1(mats);
      const ship = new Ship(shipModel);

      const racer = new TrackRacer(this.track, ship, {
        isPlayer,
        difficulty: this.difficulty,
        kind: 'feather',
        airPitch: this.options.airPitch !== undefined ? this.options.airPitch : true
      });

      racer.team = team;
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
        const driver = new DriverAI(racer, this.track, this.difficulty);
        this.drivers.push(driver);
      }
    }

    this._updateStandings();
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
          input = playerInput;
        } else {
          const ai = this.drivers[k];
          input = ai ? ai.plan(this.racers) : { throttle: 1.0 };
        }
      }

      racer.step(dt, input);

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
      if (rA.inAir) continue;

      for (let j = i + 1; j < count; j++) {
        const rB = this.racers[j];
        if (rB.inAir) continue;

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

            // Elastic bounce impulse
            const relVx = rA.vx - rB.vx;
            const bounce = 14.0;
            rA.vx += pushDir * bounce;
            rB.vx -= pushDir * bounce;

            // Visual hit shakes
            rA.ship.hit(new THREE.Vector3(pushDir, 0, 0), 1.2);
            rB.ship.hit(new THREE.Vector3(-pushDir, 0, 0), 1.2);

            rA.emit('knock', { other: rB.team.name });
            rB.emit('knock', { other: rA.team.name });
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
        isPlayer: r.isPlayer,
        time,
        points: POINTS[rank] || 0
      };
    });
  }
}
