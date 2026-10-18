// src/hud.js — Race HUD controller: 32-segment speedometer, lap timers, splits, and 380x380 minimap
// Why: WipEout-style telemetry presentation with zero garbage-collection allocations per frame

function formatTime(sec) {
  if (sec <= 0 || !isFinite(sec)) return '--:--.---';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec * 1000) % 1000);
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  const mss = ms < 10 ? `00${ms}` : (ms < 100 ? `0${ms}` : `${ms}`);
  return `${mm}:${ss}.${mss}`;
}

export class HUDController {
  constructor(track, race) {
    this.track = track;
    this.race = race;

    const hasDoc = typeof document !== 'undefined';

    // DOM Caches
    this.elRpos = hasDoc ? document.getElementById('rpos') : null;
    this.elRtot = hasDoc ? document.getElementById('rtot') : null;
    this.elLapn = hasDoc ? document.getElementById('lapn') : null;
    this.elLapt = hasDoc ? document.getElementById('lapt') : null;
    this.elSpd = hasDoc ? document.getElementById('spd') : null;
    this.elSpdbar = hasDoc ? document.getElementById('spdbar') : null;
    this.elBstFill = hasDoc ? document.querySelector('#bst .bar-fill') : null;
    this.elThrFill = hasDoc ? document.querySelector('#thr .bar-fill') : null;
    this.elAirbrakeFill = hasDoc ? document.getElementById('airbrake-fill') : null;
    this.elShieldFill = hasDoc ? document.getElementById('shield-fill') : null;
    this.elBstOverflow = hasDoc ? document.getElementById('bst-overflow') : null;
    this.elDriftChain = hasDoc ? document.getElementById('drift-chain') : null;
    this.elState = hasDoc ? document.getElementById('state') : null;

    // Timing DOM
    this.elLap = hasDoc ? document.getElementById('lap') : null;
    this.elSplitLast = hasDoc ? document.getElementById('split-last') : null;
    this.elSplitBest = hasDoc ? document.getElementById('split-best') : null;
    this.elSplitTotal = hasDoc ? document.getElementById('split-total') : null;
    this.elSplitScore = hasDoc ? document.getElementById('split-score') : null;

    // Minimap DOM & Context
    this.canvasMap = hasDoc ? document.getElementById('map') : null;
    this.ctxMap = this.canvasMap ? this.canvasMap.getContext('2d') : null;

    // Lap tracking state
    this.currentLapTime = 0.0;
    this.lastLapTime = 0.0;
    this.bestLapTime = 0.0;
    this.totalRaceTime = 0.0;
    this.currentLap = 1;
    this.score = 0;

    // 32-segment speedometer elements
    this.segments = [];
    this._initSpeedometer();
    this._initMinimapBounds();
  }

  _initSpeedometer() {
    if (!this.elSpdbar) return;
    this.elSpdbar.innerHTML = '';
    for (let i = 0; i < 32; i++) {
      const seg = document.createElement('div');
      seg.className = 'spd-seg';
      this.elSpdbar.appendChild(seg);
      this.segments.push(seg);
    }
  }

  _initMinimapBounds() {
    if (!this.track || !this.ctxMap) return;

    // Find 2D track bounding box (X and Z)
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    const frames = this.track.frames || [];
    for (let i = 0; i < frames.length; i += 8) {
      const p = frames[i].pos;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }

    const pad = 24.0;
    const mapSize = 380.0;
    const rangeX = (maxX - minX) || 1.0;
    const rangeZ = (maxZ - minZ) || 1.0;

    // Coordinate mapping functions
    this.mapScale = (mapSize - pad * 2) / Math.max(rangeX, rangeZ);
    this.mapOffsetX = pad + ((mapSize - pad * 2) - rangeX * this.mapScale) * 0.5 - minX * this.mapScale;
    this.mapOffsetZ = pad + ((mapSize - pad * 2) - rangeZ * this.mapScale) * 0.5 - minZ * this.mapScale;

    // Pre-bake static track circuit path for 60 FPS performance
    this.trackPath = new Path2D();
    if (frames.length > 0) {
      const startX = frames[0].pos.x * this.mapScale + this.mapOffsetX;
      const startZ = frames[0].pos.z * this.mapScale + this.mapOffsetZ;
      this.trackPath.moveTo(startX, startZ);

      for (let i = 8; i < frames.length; i += 8) {
        const x = frames[i].pos.x * this.mapScale + this.mapOffsetX;
        const z = frames[i].pos.z * this.mapScale + this.mapOffsetZ;
        this.trackPath.lineTo(x, z);
      }
      this.trackPath.closePath();
    }
  }

  update(dt, playerRacer, input = {}) {
    if (!playerRacer) return;

    // 1. Lap Timing & Splits
    if (this.race && this.race.state === 'racing') {
      this.currentLapTime += dt;
      this.totalRaceTime += dt;

      // Lap crossover detection
      if (playerRacer.lap !== this.currentLap) {
        if (playerRacer.lap > this.currentLap) {
          this.lastLapTime = this.currentLapTime;
          if (this.bestLapTime === 0 || this.lastLapTime < this.bestLapTime) {
            this.bestLapTime = this.lastLapTime;
          }
          this.score += 2500;
          this.currentLapTime = 0.0;
        }
        this.currentLap = playerRacer.lap;
      }
    }

    // 2. DOM Updates
    if (this.elRpos) this.elRpos.textContent = playerRacer.position || 1;
    if (this.elRtot) this.elRtot.textContent = this.race ? this.race.racers.length : 9;
    if (this.elLapn) this.elLapn.textContent = playerRacer.lap || 1;
    if (this.elLapt) this.elLapt.textContent = this.race ? this.race.numLaps : 3;

    // Speedometer
    const kmh = Math.round(playerRacer.vs * 3.6);
    if (this.elSpd) this.elSpd.textContent = kmh;

    // 32 Segments lighting
    const topSpeed = playerRacer.handling ? playerRacer.handling.topSpeed : 260.0;
    const speedRatio = Math.max(0, Math.min(1.2, playerRacer.vs / topSpeed));
    const activeCount = Math.floor(speedRatio * 32);

    for (let i = 0; i < 32; i++) {
      const seg = this.segments[i];
      if (!seg) continue;
      if (i < activeCount) {
        if (i >= 28) {
          seg.className = 'spd-seg boost';
        } else if (i >= 22) {
          seg.className = 'spd-seg warn';
        } else {
          seg.className = 'spd-seg on';
        }
      } else {
        seg.className = 'spd-seg';
      }
    }

    // Energy & Thrust bars
    if (this.elBstFill) {
      const pct = Math.min(100, Math.round(playerRacer.boostEnergy * 100));
      this.elBstFill.style.width = `${pct}%`;
      if (playerRacer.boostEnergy > 1.0) {
        if (this.elBstFill.classList) this.elBstFill.classList.add('overflow');
        if (this.elBstOverflow) {
          const overPct = Math.round((playerRacer.boostEnergy - 1.0) * 200);
          this.elBstOverflow.style.width = `${overPct}%`;
          this.elBstOverflow.style.display = 'block';
        }
      } else {
        if (this.elBstFill.classList) this.elBstFill.classList.remove('overflow');
        if (this.elBstOverflow) this.elBstOverflow.style.display = 'none';
      }
    }
    if (this.elThrFill) {
      this.elThrFill.style.width = `${Math.round((input.throttle || 0) * 100)}%`;
    }
    if (this.elAirbrakeFill) {
      const maxChg = playerRacer.maxAirbrakes || 1;
      const curChg = playerRacer.airbrakeCharges !== undefined ? playerRacer.airbrakeCharges : maxChg;
      const rechgFrac = curChg < maxChg ? (playerRacer.airbrakeRechargeTimer || 0) / 3.0 : 0;
      const totalRatio = Math.min(1.0, (curChg + rechgFrac) / maxChg);
      this.elAirbrakeFill.style.width = `${Math.round(totalRatio * 100)}%`;
    }
    if (this.elShieldFill) {
      const maxSh = playerRacer.maxShield || 100.0;
      const curSh = playerRacer.shield !== undefined ? playerRacer.shield : maxSh;
      const shPct = Math.max(0, Math.min(100, Math.round((curSh / maxSh) * 100)));
      this.elShieldFill.style.width = `${shPct}%`;
      if (this.elShieldFill.classList) {
        if (shPct <= 25) {
          this.elShieldFill.classList.add('crit');
          this.elShieldFill.classList.remove('warn');
        } else if (shPct <= 50) {
          this.elShieldFill.classList.add('warn');
          this.elShieldFill.classList.remove('crit');
        } else {
          this.elShieldFill.classList.remove('warn');
          this.elShieldFill.classList.remove('crit');
        }
      }
    }

    // Drift Chain indicator (dormant when drift inactive)
    if (this.elDriftChain) {
      if (playerRacer.driftChain && playerRacer.driftChain > 1) {
        this.elDriftChain.textContent = `CHAIN x${playerRacer.driftChain}`;
        this.elDriftChain.style.display = 'block';
      } else {
        this.elDriftChain.style.display = 'none';
      }
    }

    // Times & Score
    if (this.elLap) this.elLap.textContent = formatTime(this.currentLapTime);
    if (this.elSplitLast) this.elSplitLast.textContent = formatTime(this.lastLapTime);
    if (this.elSplitBest) this.elSplitBest.textContent = formatTime(this.bestLapTime);
    if (this.elSplitTotal) this.elSplitTotal.textContent = formatTime(this.totalRaceTime);
    if (this.elSplitScore) this.elSplitScore.textContent = this.score;

    // 3. Minimap Rendering
    this._renderMinimap(playerRacer);
  }

  _renderMinimap(playerRacer) {
    const ctx = this.ctxMap;
    if (!ctx || !this.trackPath) return;

    // Clear 380x380 canvas
    ctx.clearRect(0, 0, 380, 380);

    // Track circuit line
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.22)';
    ctx.lineWidth = 4.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(this.trackPath);

    // Inner bright track line
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke(this.trackPath);

    // Start / Finish Line
    if (this.track.frames && this.track.frames.length > 0) {
      const p0 = this.track.frames[0].pos;
      const sx = p0.x * this.mapScale + this.mapOffsetX;
      const sz = p0.z * this.mapScale + this.mapOffsetZ;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sz, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 8 AI Rivals Blips
    if (this.race && this.race.racers) {
      for (const r of this.race.racers) {
        if (r === playerRacer) continue;
        const rx = r.pos.x * this.mapScale + this.mapOffsetX;
        const rz = r.pos.z * this.mapScale + this.mapOffsetZ;

        ctx.fillStyle = r.team ? r.team.css : '#ffaa00';
        ctx.beginPath();
        ctx.arc(rx, rz, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Player Blip (Highlighted Cyan with glowing ring)
    const px = playerRacer.pos.x * this.mapScale + this.mapOffsetX;
    const pz = playerRacer.pos.z * this.mapScale + this.mapOffsetZ;

    // Outer pulse ring
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, pz, 6.0, 0, Math.PI * 2);
    ctx.stroke();

    // Solid core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, pz, 3.8, 0, Math.PI * 2);
    ctx.fill();
  }
}
