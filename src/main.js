// src/main.js — Main game loop, boot pipeline, composer, and test harness
// Why: map-agnostic runner connecting track, race, physics, input, audio, and render passes

import * as THREE from 'three';
import { CURRENT_VERSION } from './changelog.js';
import { SpaceWorld } from './space.js';
import { createSpaceTrack } from './track.js';
import { Ship } from './ship.js';
import { FreeFlight } from './flight.js';
import { InputHandler } from './input.js';

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
  mode: 'free', // 'race' | 'free'
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
    };
  },
  async advance(seconds) {
    const dt = 1 / 120; // 120 Hz fixed physics step
    const steps = Math.max(1, Math.round(seconds / dt));
    for (let i = 0; i < steps; i++) {
      if (app.race) {
        app.race.step(dt);
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

  status('Initializing Feather S1 & Flight...', 85);
  await nextFrame();
  app.input = new InputHandler();
  app.ship = new Ship('feather');
  app.scene.add(app.ship.root);
  app.ship.attachTrails(app.scene);
  app.flight = new FreeFlight(app.ship, app.track);
  app.flight.respawnOntoTrack(app.track, 10.0);

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
    }
    if (app.input && app.input.consumeTrigger('respawn')) {
      if (app.flight && app.track) app.flight.respawnOntoTrack(app.track, 0);
    }
    if (app.input && app.input.consumeTrigger('toggleCanopy')) {
      if (app.ship) app.ship.toggleCanopy();
    }

    // Free flight arcade mode
    if (app.mode === 'free' && app.flight) {
      app.flight.step(dt, input);

      // Chase camera tracking the ship
      const forwardDir = app.flight.vel.length() > 2.0
        ? app.flight.vel.clone().normalize()
        : new THREE.Vector3(0, 0, -1).applyQuaternion(app.ship.root.quaternion);

      const chasePos = _vCamTarget.copy(app.ship.root.position)
        .addScaledVector(forwardDir, -16.0)
        .addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(app.ship.root.quaternion), 4.5);

      app.camera.position.lerp(chasePos, 0.18);
      app.camera.up.set(0, 1, 0).applyQuaternion(app.ship.root.quaternion);
      app.camera.lookAt(app.ship.root.position.x, app.ship.root.position.y + 1.2, app.ship.root.position.z);
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
