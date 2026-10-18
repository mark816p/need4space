// src/audio.js — Procedural WebAudio sound system: multi-layer engine synth and physical SFX
// Why: Zero-external-file audio synthesis with formant-filtered jet growl,
// speed-tracking air hiss, resonant wall scrapes, and punchy jump landings

// High-precision procedural noise buffer cache
let _noiseBuffer = null;
function getNoiseBuffer(ctx) {
  if (_noiseBuffer) return _noiseBuffer;
  const bufferSize = ctx.sampleRate * 2; // 2 seconds of loopable stereo noise
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      // Pinkish noise approximation (1/f) for realistic aerodynamic turbulence
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // Gain compensation
    }
  }
  _noiseBuffer = buffer;
  return _noiseBuffer;
}

export class EngineAudio {
  constructor(ctx, destination) {
    this.ctx = ctx;

    // Master engine bus
    this.gain = ctx.createGain();
    this.gain.gain.value = 0.0;
    this.gain.connect(destination);

    // Layer 1: Sub-bass rumble (40 - 120 Hz)
    this.subOsc = ctx.createOscillator();
    this.subOsc.type = 'sawtooth';
    this.subGain = ctx.createGain();
    this.subGain.gain.value = 0.0;
    this.subFilter = ctx.createBiquadFilter();
    this.subFilter.type = 'lowpass';
    this.subFilter.frequency.value = 140;

    this.subOsc.connect(this.subFilter);
    this.subFilter.connect(this.subGain);
    this.subGain.connect(this.gain);

    // Layer 2: Turbine whine (400 - 2400 Hz)
    this.turbineOsc = ctx.createOscillator();
    this.turbineOsc.type = 'triangle';
    this.turbineGain = ctx.createGain();
    this.turbineGain.gain.value = 0.0;
    this.turbineOsc.connect(this.turbineGain);
    this.turbineGain.connect(this.gain);

    // Layer 3: Formant jet growl (bandpass resonance)
    this.growlOsc = ctx.createOscillator();
    this.growlOsc.type = 'sawtooth';
    this.growlFilter = ctx.createBiquadFilter();
    this.growlFilter.type = 'bandpass';
    this.growlFilter.Q.value = 4.5;
    this.growlFilter.frequency.value = 650;
    this.growlGain = ctx.createGain();
    this.growlGain.gain.value = 0.0;

    this.growlOsc.connect(this.growlFilter);
    this.growlFilter.connect(this.growlGain);
    this.growlGain.connect(this.gain);

    // Layer 4: Speed-dependent aerodynamic air hiss
    this.hissSource = ctx.createBufferSource();
    this.hissSource.buffer = getNoiseBuffer(ctx);
    this.hissSource.loop = true;
    this.hissFilter = ctx.createBiquadFilter();
    this.hissFilter.type = 'bandpass';
    this.hissFilter.frequency.value = 1200;
    this.hissFilter.Q.value = 1.2;
    this.hissGain = ctx.createGain();
    this.hissGain.gain.value = 0.0;

    this.hissSource.connect(this.hissFilter);
    this.hissFilter.connect(this.hissGain);
    this.hissGain.connect(this.gain);

    // Start oscillators
    this.subOsc.start();
    this.turbineOsc.start();
    this.growlOsc.start();
    this.hissSource.start();
  }

  update(dt, telemetry = {}) {
    const t = this.ctx.currentTime;
    const throttle = Math.max(0, Math.min(1, telemetry.throttle || 0));
    const speedRatio = Math.max(0, Math.min(1.5, (telemetry.speed || 0) / 280.0));
    const isBoosting = !!telemetry.isBoosting;
    const inAir = !!telemetry.inAir;

    // Smooth ramp targets (avoids clicks and stepping)
    const rampTime = 0.05;

    // 1. Sub rumble: loudest on full throttle on deck, attenuated during air jumps
    const subFreq = 42 + throttle * 48 + speedRatio * 35;
    const subVol = inAir ? 0.06 : (0.15 + throttle * 0.35 + (isBoosting ? 0.2 : 0));
    this.subOsc.frequency.setTargetAtTime(subFreq, t, rampTime);
    this.subGain.gain.setTargetAtTime(subVol, t, rampTime);

    // 2. Turbine whine: tracks speed and rotor frequency
    const turbineFreq = 380 + speedRatio * 1600 + (isBoosting ? 400 : 0);
    const turbineVol = 0.08 + speedRatio * 0.18 + (isBoosting ? 0.12 : 0);
    this.turbineOsc.frequency.setTargetAtTime(turbineFreq, t, rampTime);
    this.turbineGain.gain.setTargetAtTime(turbineVol, t, rampTime);

    // 3. Formant growl: shifts frequency with throttle kick
    const growlFreq = 480 + throttle * 550 + (inAir ? 300 : 0);
    const growlVol = (throttle * 0.25) + (isBoosting ? 0.2 : 0);
    this.growlFilter.frequency.setTargetAtTime(growlFreq, t, rampTime);
    this.growlGain.gain.setTargetAtTime(growlVol, t, rampTime);

    // 4. Air hiss: scales with air velocity squared
    const hissFreq = 800 + speedRatio * 1800;
    const hissVol = Math.pow(speedRatio, 1.6) * 0.22;
    this.hissFilter.frequency.setTargetAtTime(hissFreq, t, rampTime);
    this.hissGain.gain.setTargetAtTime(hissVol, t, rampTime);

    // Master engine volume
    this.gain.gain.setTargetAtTime(0.75, t, rampTime);
  }

  stop() {
    try {
      this.subOsc.stop();
      this.turbineOsc.stop();
      this.growlOsc.stop();
      this.hissSource.stop();
    } catch (_) {}
  }
}

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.engineGain = null;
    this.musicGain = null;
    this.limiter = null;

    this.engine = null;
    this.isMuted = false;
    this.isInitialized = false;

    // Track user gesture auto-unlock
    this._unlockHandler = () => this.init();
    if (typeof window !== 'undefined') {
      window.addEventListener('click', this._unlockHandler, { once: true });
      window.addEventListener('keydown', this._unlockHandler, { once: true });
      window.addEventListener('touchstart', this._unlockHandler, { once: true });

      // Silence when tab is in background
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) {
          this.ctx.suspend().catch(() => {});
        } else {
          this.ctx.resume().catch(() => {});
        }
      });
    }
  }

  init() {
    if (this.isInitialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = (typeof window !== 'undefined')
      ? (window.AudioContext || window.webkitAudioContext)
      : null;

    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    // 1. Master limiter (prevents distortion and clipping across overlapping sounds)
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -12.0; // dB
    this.limiter.knee.value = 10.0;
    this.limiter.ratio.value = 8.0;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.20;
    this.limiter.connect(this.ctx.destination);

    // 2. Bus Gains
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.9;

    this.underwaterFilter = this.ctx.createBiquadFilter();
    this.underwaterFilter.type = 'lowpass';
    this.underwaterFilter.frequency.value = 22050;
    this.masterGain.connect(this.underwaterFilter);
    this.underwaterFilter.connect(this.limiter);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.85;
    this.sfxGain.connect(this.masterGain);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.8;
    this.engineGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.65;
    this.musicGain.connect(this.masterGain);

    // 3. Engine Synth
    this.engine = new EngineAudio(this.ctx, this.engineGain);

    this.isInitialized = true;
    console.log('[Audio] Procedural WebAudio system online.');
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0.0 : 0.9;
    }
    return this.isMuted;
  }

  // ---------------------------------------------------------------------------
  // Procedural SFX Generators
  // ---------------------------------------------------------------------------

  // Countdown: 3, 2, 1 (440 Hz pips), GO! (880 Hz + harmonic chime)
  playCountdown(count) {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (count <= 0) {
      // GO! Chime (880 Hz + octave harmonic)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1760, t + 0.22);

      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.35);
    } else {
      // 3 - 2 - 1 Short Sine Pip
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, t);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.09);
    }
  }

  // Boost Pad Hit: Rising FM chirp (300 -> 1200 Hz in 180ms)
  playBoost() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(1250, t + 0.18);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(3500, t + 0.18);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(filter);
    filter.connect(gain);

    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 0.4;
      gain.connect(panner);
      panner.connect(this.sfxGain);
    } else {
      gain.connect(this.sfxGain);
    }

    osc.start(t);
    osc.stop(t + 0.25);
  }

  // Wall Scrape: Modulated bandpass noise burst panned left or right
  playWallScrape(side = 1, speed = 200) {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = getNoiseBuffer(this.ctx);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const speedRatio = Math.max(0.2, Math.min(1.5, speed / 250.0));
    filter.frequency.setValueAtTime(1200 * speedRatio, t);
    filter.Q.value = 6.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    source.connect(filter);
    filter.connect(gain);

    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, side));
      gain.connect(panner);
      panner.connect(this.sfxGain);
    } else {
      gain.connect(this.sfxGain);
    }

    source.start(t);
    source.stop(t + 0.14);
  }

  // Jump Launch: Hollow aerodynamic whoosh
  playJumpLaunch() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.25);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  // Jump Landing: Punchy sub-thud (60 Hz sine decay 120ms) + chassis clatter
  playJumpLand() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Sub thud
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(75, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.14);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);

    // Chassis mechanical slap
    const snap = this.ctx.createBufferSource();
    snap.buffer = getNoiseBuffer(this.ctx);
    const snapFilter = this.ctx.createBiquadFilter();
    snapFilter.type = 'highpass';
    snapFilter.frequency.value = 1800;
    const snapGain = this.ctx.createGain();
    snapGain.gain.setValueAtTime(0.2, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    snap.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(this.sfxGain);
    snap.start(t);
    snap.stop(t + 0.05);
  }

  // Lap Pass: Clean 2-tone melodic chime (E5 659Hz -> B5 988Hz)
  playLapChime() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Note 1: E5
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, t);
    const gain1 = this.ctx.createGain();
    gain1.gain.setValueAtTime(0.35, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(t);
    osc1.stop(t + 0.2);

    // Note 2: B5
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, t + 0.1);
    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0.35, t + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(t + 0.1);
    osc2.stop(t + 0.38);
  }

  // Critical Health Warning Alarm: 2-tone urgent warning pulse (v1.8.0)
  playAlarm() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(660, t + 0.08);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.value = 3.0;

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.17);
  }

  // Ship Disintegration Explosion: Low-end sub blast + noise roar + debris crackle (v1.8.0)
  playExplosion() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Sub detonation
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.55);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.65);

    // Filtered noise roar
    const noise = this.ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(this.ctx);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 0.7);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.75, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.75);
  }

  // Heavy Lateral Slam Impact: Sub-impact thump + crunch (v1.11.0)
  playSlam() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Impact thump
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.22);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.25);

    // Metal crunch noise
    const crunch = this.ctx.createBufferSource();
    crunch.buffer = getNoiseBuffer(this.ctx);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.value = 4.0;

    const crunchGain = this.ctx.createGain();
    crunchGain.gain.setValueAtTime(0.55, t);
    crunchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    crunch.connect(filter);
    filter.connect(crunchGain);
    crunchGain.connect(this.sfxGain);
    crunch.start(t);
    crunch.stop(t + 0.18);
  }

  // Energy Shield Damage Hit: High sizzle/crackle deflection (v1.8.0)
  playShieldHit() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.14);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, t);
    filter.Q.value = 5.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  setUnderwater(underK = 0.0) {
    if (!this.ctx || !this.underwaterFilter) return;
    const clamped = Math.max(0.0, Math.min(1.0, underK));
    const targetFreq = 22000.0 * Math.pow(450.0 / 22000.0, clamped);
    this.underwaterFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.06);
  }

  update(dt, telemetry) {
    if (!this.isInitialized || !this.engine) return;
    this.engine.update(dt, telemetry);
  }
}

export { AudioManager as SoundSystem };
