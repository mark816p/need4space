// src/music.js — Procedural WebAudio electronic soundtrack generator
// Why: Zero-asset electronic music with 909 drums, acid 303 filter sweeps,
// space pads, dynamic sidechain ducking, and 3 distinct tracks

export const TRACK_LIST = [
  { id: 'orbital', name: 'Orbital Velocity', bpm: 140, genre: 'Driving Breakbeat Techno' },
  { id: 'solar', name: 'Solar Flare', bpm: 150, genre: 'Acid Trance' },
  { id: 'void', name: 'Deep Void', bpm: 132, genre: 'Ambient Drum & Bass' }
];

// Note to Frequency helper (A4 = 440)
function mtof(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class ProceduralMusic {
  constructor(audioManager) {
    this.audio = audioManager;
    this.trackIndex = 0;
    this.isPlaying = false;
    this.bpm = 140;

    // Sidechain ducking gain node
    this.duckGain = null;
    this.musicOut = null;

    // Step sequencer state
    this.step = 0;
    this.nextNoteTime = 0;
    this.timerID = null;

    // Pattern definitions
    this.currentTrack = TRACK_LIST[0];
  }

  _ensureNodes() {
    if (!this.audio.ctx) return false;
    if (!this.duckGain) {
      const ctx = this.audio.ctx;
      this.duckGain = ctx.createGain();
      this.duckGain.gain.value = 1.0;

      this.musicOut = ctx.createGain();
      this.musicOut.gain.value = 0.55;

      this.duckGain.connect(this.musicOut);
      this.musicOut.connect(this.audio.musicGain || ctx.destination);
    }
    return true;
  }

  start(trackIndex = 0) {
    if (!this._ensureNodes()) return;
    this.trackIndex = trackIndex % TRACK_LIST.length;
    this.currentTrack = TRACK_LIST[this.trackIndex];
    this.bpm = this.currentTrack.bpm;
    this.step = 0;
    this.isPlaying = true;
    this.nextNoteTime = this.audio.ctx.currentTime + 0.1;

    this._scheduler();
    console.log(`[Music] Playing: ${this.currentTrack.name} (${this.bpm} BPM)`);
  }

  stop() {
    this.isPlaying = false;
    if (this.timerID) {
      clearTimeout(this.timerID);
      this.timerID = null;
    }
  }

  nextTrack() {
    this.start((this.trackIndex + 1) % TRACK_LIST.length);
  }

  // Sidechain ducking called by boost hits or heavy engine kicks
  triggerDuck(amount = 0.55, releaseTime = 0.35) {
    if (!this.duckGain || !this.audio.ctx) return;
    const t = this.audio.ctx.currentTime;
    this.duckGain.gain.cancelScheduledValues(t);
    this.duckGain.gain.setValueAtTime(1.0 - amount, t);
    this.duckGain.gain.exponentialRampToValueAtTime(1.0, t + releaseTime);
  }

  // Lookahead sequencer scheduler (16th note timing)
  _scheduler() {
    if (!this.isPlaying || !this.audio.ctx) return;

    const scheduleAheadTime = 0.12; // Schedule ahead in 120ms window
    while (this.nextNoteTime < this.audio.ctx.currentTime + scheduleAheadTime) {
      this._scheduleStep(this.step, this.nextNoteTime);
      const secondsPerBeat = 60.0 / this.bpm;
      const secondsPer16th = secondsPerBeat / 4.0;
      this.nextNoteTime += secondsPer16th;
      this.step = (this.step + 1) % 64; // 4-bar 64-step loop
    }

    this.timerID = setTimeout(() => this._scheduler(), 40);
  }

  // Trigger drum voices and synth patterns for current 16th note step
  _scheduleStep(step, time) {
    const ctx = this.audio.ctx;
    const track = this.currentTrack.id;

    // 1. Kick Drum (909 Pitch Sweep)
    let kick = false;
    if (track === 'orbital' || track === 'solar') {
      // 4-on-the-floor
      kick = (step % 4 === 0);
    } else if (track === 'void') {
      // DnB breakbeat kick: steps 0, 10, 22, 28...
      kick = (step % 16 === 0) || (step % 16 === 10);
    }
    if (kick) this._playKick(time);

    // 2. Snare / Clap (909 Snappy)
    let snare = false;
    if (track === 'orbital') {
      snare = (step % 8 === 4); // Backbeat on beats 2 & 4
    } else if (track === 'solar') {
      snare = (step % 16 === 4) || (step % 16 === 12);
    } else if (track === 'void') {
      snare = (step % 16 === 8); // Half-time DnB snare
    }
    if (snare) this._playSnare(time);

    // 3. Hi-Hats (Closed & Open)
    if (track === 'solar') {
      // Offbeat open hi-hat
      if (step % 4 === 2) this._playHiHat(time, true);
      else if (step % 2 === 0) this._playHiHat(time, false);
    } else {
      // Driving 16th note pattern
      const accent = (step % 4 === 2);
      this._playHiHat(time, accent);
    }

    // 4. Acid 303 Bassline
    this._playBassStep(step, time, track);

    // 5. Synth Space Pad (Every 16 steps / 1 bar)
    if (step % 16 === 0) {
      const bar = Math.floor(step / 16);
      this._playPadBar(bar, time, track);
    }
  }

  // ---------------------------------------------------------------------------
  // Voice Synthesizers
  // ---------------------------------------------------------------------------

  _playKick(time) {
    const ctx = this.audio.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.08);

    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(gain);
    gain.connect(this.duckGain);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  _playSnare(time) {
    const ctx = this.audio.ctx;
    // Tone body
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(185, time);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.35, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
    osc.connect(oscGain);
    oscGain.connect(this.duckGain);
    osc.start(time);
    osc.stop(time + 0.1);

    // Noise snap
    const bufferSize = ctx.sampleRate * 0.15;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1900;
    filter.Q.value = 1.8;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.duckGain);
    noise.start(time);
    noise.stop(time + 0.16);
  }

  _playHiHat(time, isOpen = false) {
    const ctx = this.audio.ctx;
    const dur = isOpen ? 0.20 : 0.04;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7500;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(isOpen ? 0.22 : 0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.duckGain);
    source.start(time);
    source.stop(time + dur + 0.01);
  }

  _playBassStep(step, time, track) {
    const ctx = this.audio.ctx;
    // D minor bassline notes
    const dNotes = [38, 38, 50, 38, 41, 38, 43, 45]; // D2, D2, D3, D2, F2, D2, G2, A2
    const note = dNotes[step % dNotes.length];

    const osc = ctx.createOscillator();
    osc.type = (track === 'solar') ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(mtof(note), time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 8.5; // Resonant 303 squelch

    // Acid filter envelope sweep
    const sweepCutoff = 380 + Math.sin(step * 0.4) * 320 + ((step % 4 === 0) ? 900 : 0);
    filter.frequency.setValueAtTime(sweepCutoff * 2.2, time);
    filter.frequency.exponentialRampToValueAtTime(sweepCutoff, time + 0.11);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.duckGain);
    osc.start(time);
    osc.stop(time + 0.13);
  }

  _playPadBar(bar, time, track) {
    const ctx = this.audio.ctx;
    // 4-chord progression: Dm -> Bb -> F -> C
    const chords = [
      [50, 53, 57], // Dm (D3, F3, A3)
      [46, 50, 53], // Bb (Bb2, D3, F3)
      [41, 48, 53], // F  (F2, C3, F3)
      [48, 52, 55], // C  (C3, E3, G3)
    ];
    const chord = chords[bar % 4];
    const dur = (60.0 / this.bpm) * 4.0; // 1 full bar duration

    chord.forEach((note, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      // Slight detune for lush space chorus
      osc.detune.setValueAtTime((idx - 1) * 7, time);
      osc.frequency.setValueAtTime(mtof(note), time);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, time);
      filter.frequency.linearRampToValueAtTime(1400, time + dur * 0.5);
      filter.frequency.linearRampToValueAtTime(700, time + dur);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.08, time + 0.6);
      gain.gain.linearRampToValueAtTime(0.001, time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.duckGain);
      osc.start(time);
      osc.stop(time + dur);
    });
  }
}
