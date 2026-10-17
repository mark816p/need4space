// tools/test_p0_acceptance.mjs — Verify P0.10 Subsystems & Full Game Loop
import * as THREE from 'three';
import { CameraController, CAMERA_MODES } from '../src/camera.js';
import { HUDController } from '../src/hud.js';
import { FXSystem } from '../src/fx.js';
import { SettingsManager, DEFAULT_SETTINGS } from '../src/settings.js';
import { MenuManager } from '../src/menu.js';
import { createSpaceTrack } from '../src/track.js';
import { Race } from '../src/race.js';

console.log('Testing P0.10 Subsystems: Camera, HUD, FX, Menu, and Settings...');

// -----------------------------------------------------------------------------
// Test 1: CameraController 5-Modes & Trauma Shake
// -----------------------------------------------------------------------------
console.log('Test 1: Testing CameraController 5 Perspectives & Trauma...');
const camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.2, 30000);
const camCtrl = new CameraController(camera, { fov: 65 });

if (CAMERA_MODES.length !== 5) throw new Error('Expected 5 camera modes');
for (let i = 0; i < 5; i++) {
  const mode = camCtrl.cycleView();
  console.log(`  Camera Mode ${i + 1}/5: ${mode}`);
}
if (camCtrl.mode !== 'chase') throw new Error('Camera cycling did not wrap to chase');

// Test Trauma
camCtrl.addTrauma(0.7);
if (camCtrl.trauma < 0.6) throw new Error('Trauma did not accumulate');
console.log('  Trauma initial:', camCtrl.trauma.toFixed(2));

const track = createSpaceTrack();
const race = new Race(track, { difficulty: 'hard' });
const racer = race.playerRacer;

// Step camera
camCtrl.update(0.016, racer, track);
if (camCtrl.trauma >= 0.7) throw new Error('Trauma did not decay');
console.log('  Trauma after update:', camCtrl.trauma.toFixed(2));
console.log('  PASS: CameraController verified.');

// -----------------------------------------------------------------------------
// Test 2: SettingsManager & Persistence
// -----------------------------------------------------------------------------
console.log('\nTest 2: Testing SettingsManager & localStorage persistence...');

// Mock localStorage
const store = {};
globalThis.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; }
};

const settings = new SettingsManager();
settings.set('quality', 'ultra');
settings.set('difficulty', 'brutal');
settings.set('volumeMaster', 0.75);

const settings2 = new SettingsManager();
if (settings2.get('quality') !== 'ultra') throw new Error('Settings failed to persist quality');
if (settings2.get('difficulty') !== 'brutal') throw new Error('Settings failed to persist difficulty');
if (settings2.get('volumeMaster') !== 0.75) throw new Error('Settings failed to persist volume');
console.log('  PASS: SettingsManager persistence verified.');

// -----------------------------------------------------------------------------
// Test 3: HUDController & Minimap
// -----------------------------------------------------------------------------
console.log('\nTest 3: Testing HUDController...');

// Mock Canvas 2D Context for Headless Node test
class MockCanvasContext {
  clearRect() {}
  beginPath() {}
  arc() {}
  fill() {}
  stroke() {}
  moveTo() {}
  lineTo() {}
  closePath() {}
}

globalThis.document = {
  getElementById: (id) => {
    if (id === 'map') {
      return { getContext: () => new MockCanvasContext() };
    }
    return {
      textContent: '',
      innerHTML: '',
      style: {},
      classList: { add() {}, remove() {}, contains: () => false },
      appendChild() {},
      querySelectorAll: () => [],
      addEventListener() {}
    };
  },
  querySelector: () => ({ style: {} }),
  createElement: () => ({ className: '', style: {}, appendChild() {} })
};
globalThis.Path2D = function() {
  return { moveTo() {}, lineTo() {}, closePath() {} };
};

const hud = new HUDController(track, race);
if (hud.segments.length !== 32) throw new Error('Expected 32 speedometer segments');

hud.update(0.016, racer, { throttle: 1.0 });
console.log('  Speedometer segments count:', hud.segments.length);
console.log('  PASS: HUDController initialized and updated without error.');

// -----------------------------------------------------------------------------
// Test 4: FXSystem (Flashes & Particles)
// -----------------------------------------------------------------------------
console.log('\nTest 4: Testing FXSystem...');
const scene = new THREE.Scene();
const fx = new FXSystem(scene, camera);

fx.flash('boost', 1.0);
if (fx.edgeOpacity !== 1.0) throw new Error('Edge flash opacity failed to set');
fx.emitSparks(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), 20);

fx.update(0.016, racer);
if (fx.edgeOpacity >= 1.0) throw new Error('Edge flash did not decay');
console.log('  PASS: FXSystem flashes and sparks verified.');

// -----------------------------------------------------------------------------
// Test 5: MenuManager & Race Results
// -----------------------------------------------------------------------------
console.log('\nTest 5: Testing MenuManager modal navigation & results...');
const appMock = {
  paused: false,
  race,
  playerRacer: racer,
  hud,
  settings,
  cameraController: camCtrl
};

const menu = new MenuManager(appMock);
menu.pause();
if (!appMock.paused || !menu.isOpen) throw new Error('Menu failed to pause game');

menu.showOptions();
if (menu.currentView !== 'settings') throw new Error('Failed to open settings view');

menu.showResults(race.getResults());
if (menu.currentView !== 'results') throw new Error('Failed to open results view');

menu.resume();
if (appMock.paused || menu.isOpen) throw new Error('Menu failed to resume game');
console.log('  PASS: MenuManager navigation and results verified.');

console.log('\nPASS: All P0.10 Subsystems acceptance checks passed successfully!');
