// src/main.js — Main game loop, boot pipeline, composer, and test harness
// Why: map-agnostic runner connecting track, race, physics, input, audio, and render passes

import * as THREE from 'three';
import { CURRENT_VERSION } from './changelog.js';
import { clamp } from './noise.js';
import { SpaceWorld } from './space.js';
import { ForestWorld } from './forestworld.js';
import { IceWorld } from './iceworld.js';
import { DesertWorld } from './desertworld.js';
import { OceanWorld } from './oceanworld.js';
import { createSpaceTrack, TrackRacer } from './track.js';
import { createForestTrack } from './foresttrack.js';
import { createIceTrack } from './icetrack.js';
import { createDesertTrack } from './deserttrack.js';
import { createOceanTrack } from './ocean.js';
import { Ship } from './ship.js';
import { FreeFlight } from './flight.js';
import { InputHandler } from './input.js';
import { Race } from './race.js';
import { PostPipeline } from './post.js';
import { AudioManager } from './audio.js';
import { ProceduralMusic } from './music.js';
import { CameraController } from './camera.js';
import { HUDController } from './hud.js';
import { FXSystem } from './fx.js';
import { SettingsManager } from './settings.js';
import { MenuManager } from './menu.js';

// Global state container
export const app = {
  version: CURRENT_VERSION,
  renderer: null,
  scene: null,
  camera: null,
  cameraController: null,
  world: null,
  track: null,
  trackMesh: null,
  ship: null,
  flight: null,
  input: null,
  race: null,
  playerRacer: null,
  hud: null,
  fx: null,
  settings: null,
  menu: null,
  post: null,
  audio: null,
  music: null,
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
      circuit: app.track ? app.track.name : 'space',
      trackReady: !!(app.track && app.trackMesh),
      trackLength: app.track ? app.track.length : 0,
      shipReady: !!app.ship,
      shipPower: app.ship ? app.ship.power : 0,
      shipSpeed: app.flight ? app.flight.speed : 0,
      racerSpeed: app.playerRacer ? app.playerRacer.vs : 0,
      racerProgress: app.playerRacer ? app.playerRacer.progress : 0,
      racerLap: app.playerRacer ? app.playerRacer.lap : 0,
      postReady: !!app.post,
      postEnabled: !!(app.post && app.post.enabled),
      laptopMode: !!(app.settings && app.settings.get('laptopMode')),
      touchActive: typeof document !== 'undefined' && document.body.classList.contains('touch-active'),
      audioReady: !!app.audio,
      audioMuted: !!(app.audio && app.audio.isMuted),
      musicPlaying: !!(app.music && app.music.isPlaying),
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
    if (app.post) {
      app.post.render(dt, { speed: app.playerRacer ? app.playerRacer.vs : 0 });
    } else if (app.renderer && app.scene && app.camera) {
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

export function hookRacerEvents(app) {
  if (!app.playerRacer) return;
  app.playerRacer.on('boost_start', () => {
    if (app.audio) app.audio.playBoost();
    if (app.music) app.music.triggerDuck(0.65);
    if (app.fx) app.fx.flash('boost');
    if (app.cameraController) app.cameraController.addTrauma(0.25);
  });
  app.playerRacer.on('pad_hit', () => {
    if (app.audio) app.audio.playBoost();
    if (app.music) app.music.triggerDuck(0.65);
    if (app.fx) app.fx.flash('pad');
    if (app.cameraController) app.cameraController.addTrauma(0.35);
  });
  app.playerRacer.on('jump_launch', () => {
    if (app.audio) app.audio.playJumpLaunch();
  });
  app.playerRacer.on('landing', () => {
    if (app.audio) app.audio.playJumpLand();
    if (app.cameraController) app.cameraController.addTrauma(0.4);
  });
  app.playerRacer.on('wall_hit', (e) => {
    if (app.audio) app.audio.playWallScrape(e.side, e.speed);
    if (app.fx) {
      app.fx.flash('impact');
      if (app.playerRacer.pos && app.playerRacer.frame.R) {
        const contactSide = (e.side >= 0 ? 1 : -1);
        const contactPos = app.playerRacer.pos.clone().addScaledVector(app.playerRacer.frame.R, contactSide * 4.5);
        app.fx.emitSparks(contactPos, app.playerRacer.frame.R, 25);
      }
    }
    if (app.cameraController) app.cameraController.addTrauma(0.5);
  });
  app.playerRacer.on('damage', (e) => {
    if (app.audio) app.audio.playShieldHit();
    if (app.fx) app.fx.flash('damage', Math.min(1.0, e.amount / 25.0));
    if (app.cameraController) app.cameraController.addTrauma(Math.min(0.7, e.amount / 35.0));
  });
  app.playerRacer.on('wreck', (e) => {
    if (app.audio) app.audio.playExplosion();
    if (app.fx) app.fx.emitExplosion(e.pos || app.playerRacer.pos, 75);
    if (app.cameraController) app.cameraController.addTrauma(0.85);
  });
  app.playerRacer.on('slam_fire', (e) => {
    if (app.fx) app.fx.flash('slam', 0.65);
    if (app.cameraController) app.cameraController.addTrauma(0.35);
  });
  app.playerRacer.on('slam_hit', (e) => {
    if (app.audio) app.audio.playSlam();
    if (app.fx && app.playerRacer.pos && app.playerRacer.frame.R) {
      app.fx.emitSlamShockwave(app.playerRacer.pos, app.playerRacer.frame.R, 40);
    }
    if (app.cameraController) app.cameraController.addTrauma(0.75);
  });
  app.playerRacer.on('knock', (e) => {
    if (e.wasSlam) {
      if (app.audio) app.audio.playSlam();
      if (app.fx && app.playerRacer.pos && app.playerRacer.frame.R) {
        app.fx.emitSlamShockwave(app.playerRacer.pos, app.playerRacer.frame.R, 40);
      }
      if (app.cameraController) app.cameraController.addTrauma(0.8);
    } else {
      if (app.audio) app.audio.playShieldHit();
      if (app.cameraController) app.cameraController.addTrauma(0.4);
    }
  });
}

export async function loadCircuit(name = 'space') {
  const circuitTitle = name === 'desert' ? 'Desert Planet' : (name === 'ice' ? 'Ice Planet' : (name === 'forest' ? 'Forest Moon' : 'Space Circuit'));
  status(`Loading ${circuitTitle}...`, 40);
  await nextFrame();

  if (app.scene) {
    while (app.scene.children.length > 0) {
      app.scene.remove(app.scene.children[0]);
    }
  }

  if (name === 'ocean') {
    app.track = createOceanTrack();
    app.trackMesh = app.track.meshes(app.scene);
    app.world = new OceanWorld(app.scene, app.renderer, app.camera, app.track);
  } else if (name === 'desert') {
    app.track = createDesertTrack();
    app.trackMesh = app.track.meshes(app.scene);
    app.world = new DesertWorld(app.scene, app.renderer, app.camera, app.track);
  } else if (name === 'ice') {
    app.track = createIceTrack();
    app.trackMesh = app.track.meshes(app.scene);
    app.world = new IceWorld(app.scene, app.renderer, app.camera, app.track);
  } else if (name === 'forest') {
    app.track = createForestTrack();
    app.trackMesh = app.track.meshes(app.scene);
    app.world = new ForestWorld(app.scene, app.renderer, app.camera, app.track);
  } else {
    app.track = createSpaceTrack();
    app.trackMesh = app.track.meshes(app.scene);
    app.world = new SpaceWorld(app.scene, app.renderer, app.camera, app.track);
  }

  const diff = app.settings ? app.settings.get('difficulty') : 'hard';
  const airPitch = app.settings ? app.settings.get('airPitch') : true;
  app.race = new Race(app.track, { difficulty: diff, numLaps: 3, airPitch, settings: app.settings });
  if (app.world) app.world.race = app.race;
  app.race.attachToScene(app.scene);
  app.playerRacer = app.race.playerRacer;
  app.ship = app.playerRacer.ship;
  app.flight = new FreeFlight(app.ship, app.track);
  hookRacerEvents(app);

  if (app.scene && app.camera) {
    app.fx = new FXSystem(app.scene, app.camera);
  }

  if (app.hud) {
    app.hud.track = app.track;
    app.hud.race = app.race;
    app.hud.bakeMinimap();
    app.hud.currentLapTime = 0;
    app.hud.totalRaceTime = 0;
    app.hud.currentLap = 1;
    app.hud.score = 0;
  }

  if (app.renderer && app.scene && app.camera) {
    try {
      app.renderer.compile(app.scene, app.camera);
    } catch (e) {
      console.warn('[Renderer] Shader precompilation notice:', e);
    }
  }

  status('Systems Flight Ready', 100);
  await nextFrame();
}
app.loadCircuit = loadCircuit;

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
    if (app.post) {
      app.post.setSize(window.innerWidth, window.innerHeight);
    }
  });

  status('Initializing Post-Processing Pipeline...', 20);
  await nextFrame();
  app.post = new PostPipeline(app.renderer, app.scene, app.camera);

  status('Building Space Circuit Meshes...', 40);
  await nextFrame();
  app.track = createSpaceTrack();
  app.trackMesh = app.track.meshes(app.scene);

  status('Creating Space Environment & Derelict Colossus...', 65);
  await nextFrame();
  app.world = new SpaceWorld(app.scene, app.renderer, app.camera, app.track);

  status('Initializing Race & Fleet...', 85);
  await nextFrame();
  app.settings = new SettingsManager();
  app.input = new InputHandler();

  // Create 9-Ship Race (default easy difficulty)
  app.race = new Race(app.track, { difficulty: app.settings.get('difficulty') || 'easy', numLaps: 3, airPitch: true, settings: app.settings });
  app.race.attachToScene(app.scene);
  app.playerRacer = app.race.playerRacer;
  app.ship = app.playerRacer.ship;

  // Initialize free flight model as fallback / mode switch
  app.flight = new FreeFlight(app.ship, app.track);

  status('Initializing Audio Synthesis...', 95);
  await nextFrame();
  app.audio = new AudioManager();
  app.music = new ProceduralMusic(app.audio);

  hookRacerEvents(app);

  status('Initializing UI & Subsystems...', 98);
  await nextFrame();
  app.cameraController = new CameraController(app.camera, {
    fov: app.settings.get('fov'),
    rollFollow: 1.0
  });
  app.hud = new HUDController(app.track, app.race);
  app.fx = new FXSystem(app.scene, app.camera);
  app.menu = new MenuManager(app);
  app.settings.apply(app);

  status('Pre-compiling Shaders & Warming GPU Pipelines...', 99);
  await nextFrame();
  if (app.renderer && app.scene && app.camera) {
    try {
      app.renderer.compile(app.scene, app.camera);
    } catch (e) {
      console.warn('[Renderer] Shader precompilation notice:', e);
    }
  }
  if (app.post && app.post.compileAsync) {
    try {
      await app.post.compileAsync(app.renderer);
    } catch (e) {
      console.warn('[PostPipeline] Shader precompilation notice:', e);
    }
  }

  status('Systems Flight Ready', 100);
  await nextFrame();

  // Hide loading screen and switch to menu/active state
  document.body.dataset.ui = 'active';
  app.running = true;

  let frames = 0;
  let lastTime = performance.now();
  let lowFpsTime = 0;
  let alarmTimer = 0;
  let lastCdSec = 5;
  let lastLapNum = 1;
  const _fCam = {};
  const _fLook = {};
  const _vCamTarget = new THREE.Vector3();
  const _vFreeFwd = new THREE.Vector3();
  const _vFreeUp = new THREE.Vector3();
  const _telemetry = {
    speed: 0,
    lateralG: 0,
    isBoosting: false,
    hitImpulse: 0,
    waterSpray: false,
    world: null
  };
  const _audioState = {
    throttle: 0,
    speed: 0,
    isBoosting: false,
    inAir: false
  };

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

      // Laptop mode auto-detection (<45 FPS sustained for 2 seconds)
      if (app.fps > 0 && app.fps < 45) {
        lowFpsTime += (now - lastTime) / 1000;
        if (lowFpsTime >= 2.0 && app.settings && !app.settings.get('laptopMode')) {
          console.log('[Performance] Sustained low FPS detected (<45 for 2s) — engaging Laptop Mode');
          app.settings.set('laptopMode', true);
          app.settings.apply(app);
          if (app.hud) app.hud.showPrompt('LAPTOP MODE ACTIVATED (OPTIMIZED)');
        }
      } else if (app.fps >= 45) {
        lowFpsTime = 0;
      }

      frames = 0;
      lastTime = now;
    }

    // Input actions
    const input = app.input ? app.input.poll() : {};
    if (app.input && app.input.consumeTrigger('toggleMode')) {
      // Free flight toggle disabled while in menus or paused
      if (!app.paused && (!app.menu || !app.menu.active)) {
        app.mode = (app.mode === 'race') ? 'free' : 'race';
        const elMode = document.getElementById('hud-mode');
        if (elMode) elMode.textContent = app.mode === 'free' ? 'Free flight' : 'Race';
        if (app.mode === 'race' && app.playerRacer) {
          app.playerRacer.reset(app.playerRacer.s, 0, 60.0);
        }
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
    if (app.input && app.input.consumeTrigger('changeCam')) {
      if (app.cameraController) app.cameraController.cycleView();
    }
    if (app.input && app.input.consumeTrigger('toggleMute')) {
      if (app.audio) app.audio.toggleMute();
    }
    if (app.input && app.input.consumeTrigger('nextTrack')) {
      if (app.music) app.music.nextTrack();
    }

    // Active Simulation
    if (!app.paused) {
      if (app.mode === 'race' && app.race && app.playerRacer) {
        app.race.step(dt, input);

        // Update Camera through CameraController
        if (app.cameraController) {
          app.cameraController.update(dt, app.playerRacer, app.track);
        }

        // Lap pass audio chime
        if (app.playerRacer.lap !== lastLapNum) {
          if (app.playerRacer.lap > lastLapNum && app.audio) {
            app.audio.playLapChime();
          }
          lastLapNum = app.playerRacer.lap;
        }

        // Countdown audio sync
        if (app.race.state === 'countdown') {
          const cd = Math.ceil(app.race.countdownTime);
          if (cd !== lastCdSec) {
            lastCdSec = cd;
            if (app.audio) app.audio.playCountdown(cd);
          }
        } else if (app.race.state === 'racing' && app.music && !app.music.isPlaying) {
          app.music.start(0);
        }

        // Update HUD through HUDController
        if (app.hud) {
          app.hud.update(dt, app.playerRacer, input);
        }

        // Update FX and Critical Alarm
        const isCrit = (app.playerRacer.shield <= (app.playerRacer.maxShield * 0.25)) && !app.playerRacer.isDead;
        if (app.fx) {
          app.fx.setCriticalAlarm(isCrit);
          app.fx.update(dt, app.playerRacer);
        }
        if (isCrit) {
          alarmTimer += dt;
          if (alarmTimer >= 0.85) {
            alarmTimer = 0;
            if (app.audio) app.audio.playAlarm();
          }
        } else {
          alarmTimer = 0;
        }

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

        // Check race results screen
        if (app.race.state === 'finished' && app.menu && app.menu.currentView !== 'results') {
          app.menu.showResults(app.race.getResults());
        }
      } else if (app.mode === 'free' && app.flight) {
        app.flight.step(dt, input);

        // Chase camera tracking free flight ship (zero-allocation)
        if (app.flight.vel.lengthSq() > 4.0) {
          _vFreeFwd.copy(app.flight.vel).normalize();
        } else {
          _vFreeFwd.set(0, 0, -1).applyQuaternion(app.ship.root.quaternion);
        }
        _vFreeUp.set(0, 1, 0).applyQuaternion(app.ship.root.quaternion);

        const chasePos = _vCamTarget.copy(app.ship.root.position)
          .addScaledVector(_vFreeFwd, -16.0)
          .addScaledVector(_vFreeUp, 4.5);

        app.camera.position.lerp(chasePos, 0.18);
        app.camera.up.copy(_vFreeUp);
        app.camera.lookAt(app.ship.root.position.x, app.ship.root.position.y + 1.2, app.ship.root.position.z);

        if (elSpd) elSpd.textContent = Math.round(app.flight.speed * 3.6);
        if (elState) elState.textContent = 'FREE FLIGHT';
      }
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
        const shipPos = app.playerRacer ? app.playerRacer.pos : (app.ship ? app.ship.root.position : null);
        const shipS = app.playerRacer ? app.playerRacer.s : 0;
        app.world.update(dt, app.camera, shipPos, shipS, app.renderer);
      }

      // Zero-allocation per-frame telemetry object
      _telemetry.speed = app.playerRacer ? app.playerRacer.vs : (app.flight ? app.flight.speed : 0);
      _telemetry.lateralG = app.playerRacer ? (app.playerRacer.vx || 0) : 0;
      _telemetry.isBoosting = app.playerRacer ? app.playerRacer.isBoosting : false;
      _telemetry.hitImpulse = (app.playerRacer && app.playerRacer.ship) ? (app.playerRacer.ship.hitIntensity || 0) : 0;
      _telemetry.waterSpray = (app.world && app.world.waterSpray) ? true : false;
      _telemetry.world = app.world;

      if (app.audio) {
        if (app.world && typeof app.world.underK === 'number' && app.audio.setUnderwater) {
          app.audio.setUnderwater(app.world.underK);
        }
        _audioState.throttle = input.throttle || 0;
        _audioState.speed = _telemetry.speed;
        _audioState.isBoosting = _telemetry.isBoosting;
        _audioState.inAir = app.playerRacer ? app.playerRacer.inAir : false;
        app.audio.update(dt, _audioState);
      }

      if (app.post) {
        app.post.render(dt, _telemetry);
      } else if (app.scene && app.camera) {
        app.renderer.setRenderTarget(null);
        app.renderer.clear();
        if (app.world && app.world.preRender) {
          app.world.preRender(app.renderer);
        }
        app.renderer.render(app.scene, app.camera);
      }
    }
  }

  requestAnimationFrame(animate);
}

window.addEventListener('DOMContentLoaded', boot);
