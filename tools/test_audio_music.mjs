// tools/test_audio_music.mjs — Verify Procedural WebAudio System & Music Synthesizer
import { AudioManager, EngineAudio } from '../src/audio.js';
import { ProceduralMusic, TRACK_LIST } from '../src/music.js';

console.log('Testing Audio & Music System (P0.9 Acceptance Checks)...');

// -----------------------------------------------------------------------------
// Mock WebAudio Context for Headless Node.js Verification
// -----------------------------------------------------------------------------
class MockAudioParam {
  constructor(val = 0) {
    this.value = val;
  }
  setValueAtTime(v) { this.value = v; }
  setTargetAtTime(v) { this.value = v; }
  linearRampToValueAtTime(v) {}
  exponentialRampToValueAtTime(v) {}
  cancelScheduledValues() {}
}

class MockAudioNode {
  constructor(ctx) {
    this.ctx = ctx;
    this.connected = [];
  }
  connect(dest) {
    this.connected.push(dest);
    return dest;
  }
  disconnect() {
    this.connected = [];
  }
}

class MockGainNode extends MockAudioNode {
  constructor(ctx) {
    super(ctx);
    this.gain = new MockAudioParam(1.0);
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor(ctx) {
    super(ctx);
    this.type = 'sine';
    this.frequency = new MockAudioParam(440);
    this.detune = new MockAudioParam(0);
    this.started = false;
    this.stopped = false;
  }
  start() { this.started = true; }
  stop() { this.stopped = true; }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor(ctx) {
    super(ctx);
    this.type = 'lowpass';
    this.frequency = new MockAudioParam(350);
    this.Q = new MockAudioParam(1.0);
  }
}

class MockBufferSourceNode extends MockAudioNode {
  constructor(ctx) {
    super(ctx);
    this.buffer = null;
    this.loop = false;
    this.started = false;
    this.stopped = false;
  }
  start() { this.started = true; }
  stop() { this.stopped = true; }
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = new MockAudioNode(this);
    this.state = 'running';
  }
  createGain() { return new MockGainNode(this); }
  createOscillator() { return new MockOscillatorNode(this); }
  createBiquadFilter() { return new MockBiquadFilterNode(this); }
  createBufferSource() { return new MockBufferSourceNode(this); }
  createDynamicsCompressor() {
    const node = new MockAudioNode(this);
    node.threshold = new MockAudioParam(-12);
    node.knee = new MockAudioParam(10);
    node.ratio = new MockAudioParam(8);
    node.attack = new MockAudioParam(0.003);
    node.release = new MockAudioParam(0.25);
    return node;
  }
  createBuffer(channels, length, rate) {
    const data = new Float32Array(length);
    return {
      numberOfChannels: channels,
      length,
      sampleRate: rate,
      getChannelData: () => data
    };
  }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
}

// -----------------------------------------------------------------------------
// Test 1: AudioManager & Engine Synthesizer
// -----------------------------------------------------------------------------
console.log('Test 1: Testing AudioManager & Multi-Layer Engine Audio...');
const mockCtx = new MockAudioContext();

// Emulate environment AudioContext
globalThis.window = {
  AudioContext: function() { return mockCtx; },
  addEventListener() {}
};
globalThis.document = {
  addEventListener() {}
};

const audio = new AudioManager();
audio.init();

if (!audio.isInitialized) throw new Error('FAIL: AudioManager failed to initialize');
if (!audio.engine) throw new Error('FAIL: Engine audio synth failed to construct');
if (!audio.limiter) throw new Error('FAIL: Limiter compressor node missing');

// Verify Engine update under telemetry
audio.engine.update(0.016, {
  throttle: 1.0,
  speed: 260.0,
  isBoosting: true,
  inAir: false
});

console.log('  Sub Osc Freq:', audio.engine.subOsc.frequency.value.toFixed(1), 'Hz');
console.log('  Turbine Freq:', audio.engine.turbineOsc.frequency.value.toFixed(1), 'Hz');
console.log('  Formant Freq:', audio.engine.growlFilter.frequency.value.toFixed(1), 'Hz');
console.log('  Air Hiss Freq:', audio.engine.hissFilter.frequency.value.toFixed(1), 'Hz');

if (audio.engine.subOsc.frequency.value < 60) throw new Error('FAIL: Sub oscillator should pitch up with speed');
if (audio.engine.turbineOsc.frequency.value < 1000) throw new Error('FAIL: Turbine whine should pitch up with speed');
console.log('  PASS: Multi-layer engine synthesizer modulation verified.');

// -----------------------------------------------------------------------------
// Test 2: Procedural SFX Triggers
// -----------------------------------------------------------------------------
console.log('\nTest 2: Verifying Procedural SFX Generators...');
audio.playCountdown(3);
audio.playCountdown(0);
audio.playBoost();
audio.playWallScrape(1.0, 240);
audio.playJumpLaunch();
audio.playJumpLand();
audio.playLapChime();

audio.toggleMute();
if (!audio.isMuted) throw new Error('FAIL: Expected audio to be muted');
audio.playBoost(); // Should do nothing while muted
audio.toggleMute();
if (audio.isMuted) throw new Error('FAIL: Expected audio to be unmuted');
console.log('  PASS: All SFX generators and mute toggle verified.');

// -----------------------------------------------------------------------------
// Test 3: Procedural Generative Music Engine
// -----------------------------------------------------------------------------
console.log('\nTest 3: Testing Procedural Music Sequencer & 3 Tracks...');
const music = new ProceduralMusic(audio);

if (TRACK_LIST.length !== 3) throw new Error('FAIL: Expected exactly 3 tracks');
for (let i = 0; i < 3; i++) {
  music.start(i);
  console.log(`  Track ${i + 1}: ${music.currentTrack.name} (${music.bpm} BPM)`);
  if (!music.isPlaying) throw new Error('FAIL: Music failed to start');

  // Verify step scheduling
  music._scheduleStep(0, mockCtx.currentTime);  // Beat 1 (Kick + Pad)
  music._scheduleStep(4, mockCtx.currentTime);  // Beat 2 (Snare + Bass)
  music._scheduleStep(8, mockCtx.currentTime);  // Beat 3 (Kick + Bass)
  music._scheduleStep(12, mockCtx.currentTime); // Beat 4 (Snare + Bass)

  // Sidechain ducking
  music.triggerDuck(0.6, 0.3);
  if (music.duckGain.gain.value > 0.5) throw new Error('FAIL: Music duck gain should reduce on duck trigger');

  music.stop();
  if (music.isPlaying) throw new Error('FAIL: Music failed to stop');
}

console.log('  PASS: 3 procedural electronic music tracks and sidechain ducking verified.');
console.log('\nPASS: All P0.9 Audio and Music acceptance checks passed!');
