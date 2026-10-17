// src/main.js — Main game loop, boot pipeline, composer, and test harness
// Why: map-agnostic runner connecting track, race, physics, input, audio, and render passes

import * as THREE from 'three';
import { CURRENT_VERSION } from './changelog.js';
import { clamp } from './noise.js';
import { SpaceWorld } from './space.js';
import { createSpaceTrack, TrackRacer } from './track.js';
import { Ship } from './ship.js';
import { FreeFlight } from './flight.js';
import { InputHandler } from './input.js';
import { Race } from './race.js';

// Global state container
export const app = {
  version: CURRENT_VERSION,
  renderer: null,
  scene: null,
  camera: null,
  world: null,
  track: null,
  trackMesh: null,
  ship: null,
  flight: null,
  input: null,
  race: null,
  playerRacer: null,
  clock: new THREE.Clock(),
  running: false,
  paused: false,
  mode: 'race', // 'race' | 'free'
  buildStatus: 'Initializing',
  buildProgress: 0,
};

// UI Elements
const elLoading = document.getElementById('loading');
const elLoadProg = document.getElementById('loadprog');
const elLoadText = document.getElementById('loadtext');
const elFps = document.getElementById('fps');

// Status update helper for procedural generation phases
export function status(text, progress = null) {
  app.buildStatus = text;
  if (elLoadText) elLoadText.textContent = text.toUpperCase();
  if (progress !== null) {
    app.buildProgress = Math.min(100, Math.max(0, progress));
    if (elLoadProg) elLoadProg.style.width = `${app.buildProgress}%`;
  }
}

// Ensure UI updates even if tab is in the background
// Why: rAF halts on hidden tabs, stalling multi-second procedural asset bakes
export function nextFrame() {
  return new Promise(resolve => {
    let resolved = false;
    const finish = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    requestAnimationFrame(finish);
    setTimeout(finish, 50); // Fallback timer for background tabs
  });
}

// Headless test hooks (window.__feather)
window.__feather = {
  state() {
    return {
      version: app.version,
      status: app.buildStatus,
      progress: app.buildProgress,
      running: app.running,
      paused: app.paused,
      mode: app.mode,
      ready: document.body.dataset.ui !== 'loading',
      fps: app.fps || 0,
      trackReady: !!(app.track && app.trackMesh),
      trackLength: app.track ? app.track.length : 0,
      shipReady: !!app.ship,
      shipPower: app.ship ? app.ship.power : 0,
      shipSpeed: app.flight ? app.flight.speed : 0,
      racerSpeed: app.playerRacer ? app.playerRacer.vs : 0,
      racerProgress: app.playerRacer ? app.playerRacer.progress : 0,
      racerLap: app.playerRacer ? app.playerRacer.lap : 0,
    };
  },
  async advance(seconds) {
    const dt = 1 / 120; // 120 Hz fixed physics step
    const steps = Math.max(1, Math.round(seconds / dt));
    for (let i = 0; i < steps; i++) {
      if (app.race) {
        app.race.step(dt);
      } else if (app.playerRacer && app.mode === 'race') {
        const steerCorr = clamp(-app.playerRacer.x * 0.08, -0.6, 0.6);
        app.playerRacer.step(dt, { throttle: 1.0, steer: steerCorr });
      } else if (app.flight) {
        app.flight.step(dt, { throttle: 1.0 });
      }
    }
    if (app.renderer && app.scene && app.camera) {
      app.renderer.render(app.scene, app.camera);
    }
    return window.__feather.state();
  },
  async shot(name = 'capture') {
    const canvas = document.getElementById('view');
    if (!canvas) return null;
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        if (!blob) return resolve(null);
        fetch(`/shot/${name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/png' },
          body: blob
        }).then(res => res.json())
          .then(data => resolve(data))
          .catch(() => resolve(null));
      }, 'image/png');
    });
  }
};

// Initialize Renderer & WebGL Context
async function boot() {
  status('Initializing WebGL...', 10);
  await nextFrame();

  const canvas = document.getElementById('view');
  app.renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true
  });
  app.renderer.setSize(window.innerWidth, window.innerHeight);
  app.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  app.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  app.renderer.toneMappingExposure = 1.0;
  app.renderer.outputColorSpace = THREE.SRGBColorSpace;
  app.renderer.autoClear = false;

  app.scene = new THREE.Scene();
  app.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.2, 30000);
  app.camera.position.set(0, 10, 30);
  app.camera.lookAt(0, 0, 0);

  window.addEventListener('resize', () => {
    if (!app.renderer || !app.camera) return;
    app.camera.aspect = window.innerWidth / window.innerHeight;
    app.camera.updateProjectionMatrix();
    app.renderer.setSize(window.innerWidth, window.innerHeight);
  });

  status('Creating Space Environment...', 30);
  await nextFrame();
  app.world = new SpaceWorld(app.scene, app.renderer, app.camera);

  status('Building Space Circuit Meshes...', 65);
  await nextFrame();
  app.track = createSpaceTrack();
  app.trackMesh = app.track.meshes(app.scene);

  status('Initializing Race & Fleet...', 85);
  await nextFrame();
  app.input = new InputHandler();

  // Create 9-Ship Race
  app.race = new Race(app.track, { difficulty: 'hard', numLaps: 3 });
  app.race.attachToScene(app.scene);
  app.playerRacer = app.race.playerRacer;
  app.ship = app.playerRacer.ship;

  // Initialize free flight model as fallback / mode switch
  app.flight = new FreeFlight(app.ship, app.track);

  status('Systems Flight Ready', 100);
  await nextFrame();

  // Hide loading screen and switch to menu/active state
  document.body.dataset.ui = 'active';
  app.running = true;

  let frames = 0;
  let lastTime = performance.now();
  const _fCam = {};
  const _fLook = {};
  const _vCamTarget = new THREE.Vector3();

  // HUD Elements
  const elRpos = document.getElementById('rpos');
  const elLapn = document.getElementById('lapn');
  const elSpd = document.getElementById('spd');
  const elState = document.getElementById('state');
  const elCount = document.getElementById('count');
  const elCountNum = document.getElementById('count-num');
  const elBstFill = document.querySelector('#bst .bar-fill');
  const elThrFill = document.querySelector('#thr .bar-fill');

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.1, app.clock.getDelta());
    frames++;
    if (now - lastTime >= 1000) {
      app.fps = Math.round((frames * 1000) / (now - lastTime));
      if (elFps) elFps.textContent = `${app.fps} FPS`;
      frames = 0;
      lastTime = now;
    }

    // Input actions
    const input = app.input ? app.input.poll() : {};
    if (app.input && app.input.consumeTrigger('toggleMode')) {
      app.mode = (app.mode === 'race') ? 'free' : 'race';
      const elMode = document.getElementById('hud-mode');
      if (elMode) elMode.textContent = app.mode === 'free' ? 'Free flight' : 'Race';
      if (app.mode === 'race' && app.playerRacer) {
        app.playerRacer.reset(app.playerRacer.s, 0, 60.0);
      }
    }
    if (app.input && app.input.consumeTrigger('respawn')) {
      if (app.mode === 'free' && app.flight && app.track) {
        app.flight.respawnOntoTrack(app.track, 0);
      } else if (app.mode === 'race' && app.playerRacer) {
        app.playerRacer.reset(app.playerRacer.s, 0, 60.0);
      }
    }
    if (app.input && app.input.consumeTrigger('toggleCanopy')) {
      if (app.ship) app.ship.toggleCanopy();
    }

    // Active Simulation
    if (app.mode === 'race' && app.race && app.playerRacer) {
      app.race.step(dt, input);

      // Deck-aware chase camera tracking player racer
      const camDist = 14.0 + (app.playerRacer.vs / app.playerRacer.handling.topSpeed) * 4.0;
      const camHeight = 3.6 + (app.playerRacer.isBoosting ? 0.8 : 0);
      const trackFrame = app.playerRacer.frame;
      const fwd = trackFrame.T || new THREE.Vector3(0, 0, -1);
      const up = trackFrame.U || new THREE.Vector3(0, 1, 0);

      const chasePos = _vCamTarget.copy(app.playerRacer.pos)
        .addScaledVector(fwd, -camDist)
        .addScaledVector(up, camHeight);

      app.camera.position.lerp(chasePos, 0.22);
      app.camera.up.slerp(up, 0.2);
      app.camera.lookAt(app.playerRacer.pos.x, app.playerRacer.pos.y + 1.2, app.playerRacer.pos.z);

      // Update HUD
      if (elRpos) elRpos.textContent = app.playerRacer.position || 4;
      if (elLapn) elLapn.textContent = app.playerRacer.lap || 1;
      if (elSpd) elSpd.textContent = Math.round(app.playerRacer.vs * 3.6);
      if (elBstFill) elBstFill.style.width = `${Math.round(app.playerRacer.boostEnergy * 100)}%`;
      if (elThrFill) elThrFill.style.width = `${Math.round((input.throttle || 0) * 100)}%`;

      if (elState) {
        if (app.race.state === 'countdown') {
          elState.textContent = 'SYSTEMS PRIMED';
        } else if (app.race.state === 'finished') {
          elState.textContent = 'RACE FINISHED';
        } else {
          elState.textContent = app.playerRacer.inAir ? 'BALLISTIC FLIGHT' : 'MAG-LOCK ACTIVE';
        }
      }

      // Countdown overlay display
      if (elCount) {
        if (app.race.state === 'countdown') {
          elCount.style.display = 'flex';
          const cd = Math.ceil(app.race.countdownTime);
          if (elCountNum) elCountNum.textContent = cd > 0 ? cd : 'GO!';
        } else {
          elCount.style.display = 'none';
        }
      }
    } else if (app.mode === 'free' && app.flight) {
      app.flight.step(dt, input);

      // Chase camera tracking free flight ship
      const forwardDir = app.flight.vel.length() > 2.0
        ? app.flight.vel.clone().normalize()
        : new THREE.Vector3(0, 0, -1).applyQuaternion(app.ship.root.quaternion);

      const chasePos = _vCamTarget.copy(app.ship.root.position)
        .addScaledVector(forwardDir, -16.0)
        .addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(app.ship.root.quaternion), 4.5);

      app.camera.position.lerp(chasePos, 0.18);
      app.camera.up.set(0, 1, 0).applyQuaternion(app.ship.root.quaternion);
      app.camera.lookAt(app.ship.root.position.x, app.ship.root.position.y + 1.2, app.ship.root.position.z);

      if (elSpd) elSpd.textContent = Math.round(app.flight.speed * 3.6);
      if (elState) elState.textContent = 'FREE FLIGHT';
    } else if (!app.playerRacer && app.track) {
      // Spectator flight along track
      const s = (now * 0.065) % app.track.length;
      app.track.frame(s, _fCam);
      app.track.frame((s + 45.0) % app.track.length, _fLook);
      app.camera.position.copy(_fCam.pos).addScaledVector(_fCam.U, 7.5).addScaledVector(_fCam.R, Math.sin(now * 0.0008) * 8.0);
      app.camera.up.copy(_fCam.U);
      app.camera.lookAt(_fLook.pos.x, _fLook.pos.y + 2.0, _fLook.pos.z);
    }

    if (app.running && app.renderer) {
      if (app.world) {
        app.world.update(dt, app.camera, null, 0, app.renderer);
        app.world.preRender(app.renderer);
      }
      if (app.scene && app.camera) {
        app.renderer.render(app.scene, app.camera);
      }
    }
  }

  requestAnimationFrame(animate);
}

window.addEventListener('DOMContentLoaded', boot);
