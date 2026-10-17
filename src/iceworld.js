// src/iceworld.js — Ice Planet world environment (frozen sea, frost sky, spires, blizzard, storm)
// Why: Unifies the frozen sea, frost atmosphere dome, crystal spires, glacier cave, GPU blizzard, and distant storm
import * as THREE from 'three';
import { FrostAtmosphereDome, ICE_SUN_DIR } from './frost.js';
import { GlacierSea } from './glacier.js';
import { SpiresAndGlacierCave } from './spires.js';
import { BlizzardWeather } from './blizzard.js';
import { HorizonStorm } from './storm.js';

export class IceWorld {
  constructor(scene, renderer, camera, track) {
    this.name = 'ice';
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.track = track;
    this.sunDir = ICE_SUN_DIR.clone();
    this.ready = false;

    // Atmospheric & look parameters
    this.exposure = 1.08;
    this.exposureK = 1.0;
    this.grade = 'ice';
    this.headlightK = 0.85; // High headlight necessity in the glacier cave
    this.nightLights = 0.35;
    this.lightShafts = true;
    this.heat = false;
    this.dust = false;
    this.thunder = false;
    this.underK = 0.0;
    this.inFall = false;
    this.renderScale = 1.0;

    this.noAO = [];
    this.aoOccluders = new Set();
    this.worldOnly = [];

    // Feature switches
    this.iceSnow = true;
    this.iceDust = true;
    this.aurora = true;
    this.iceStorm = true;
    this.iceGeysers = true;
    this.canyonAO = true;

    // Sky Backdrop Scene & Camera (depth range 50 to 300,000m)
    this.sky = new THREE.Scene();
    const aspect = (typeof window !== 'undefined' && window.innerWidth) ? (window.innerWidth / window.innerHeight) : (16 / 9);
    this.skyCam = new THREE.PerspectiveCamera(65, aspect, 50, 300000);

    // 1. Lighting (Warm dusk sun low over horizon + cold indigo ambient)
    this._initLights();

    // 2. Atmospheric Sky Dome (Sun disc, 22° halo, sun dogs, light pillar, ringed ice giant, aurora)
    this.atmoDome = new FrostAtmosphereDome(this.sunDir);
    this.sky.add(this.atmoDome.mesh);

    // 3. Frozen Sea & Cracked Black Ice Sheet
    this.glacier = new GlacierSea(this.scene);

    // 4. Hexagonal Crystals, Great Arch & Glacier Cave
    this.spires = new SpiresAndGlacierCave(this.scene, track);

    // 5. GPU Blizzard Weather & Diamond Dust
    this.blizzard = new BlizzardWeather(this.scene);

    // 6. Horizon Storm Thunderheads & Lightning
    this.storm = new HorizonStorm(this.scene);

    this.time = 0;
    this.ready = true;
  }

  _initLights() {
    // Primary Sunlight (low warm orange/gold dusk sun, ~8° elevation)
    this.sun = new THREE.DirectionalLight(0xffcca0, 3.2);
    this.sun.position.copy(this.sunDir).multiplyScalar(600);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.width = 2048;
    this.sun.shadow.mapSize.height = 2048;
    this.sun.shadow.camera.near = 100;
    this.sun.shadow.camera.far = 1200;
    this.sun.shadow.camera.left = -30;
    this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -30;
    this.sun.shadow.bias = -0.0002;
    this.scene.add(this.sun);

    // Secondary cascade
    this.sunMid = new THREE.DirectionalLight(0xffcca0, 0.0);
    this.sunMid.position.copy(this.sunDir).multiplyScalar(1500);
    this.scene.add(this.sunMid);

    // Cold Indigo Sky Light + Cyan Ice Bounce Hemisphere Ambient
    const hemiLight = new THREE.HemisphereLight(0x182848, 0x004055, 0.82);
    this.scene.add(hemiLight);

    // Sky scene lighting
    const skySun = new THREE.DirectionalLight(0xffcca0, 2.2);
    skySun.position.copy(this.sunDir).multiplyScalar(200000);
    this.sky.add(skySun);
    this.sky.add(new THREE.AmbientLight(0x0a1428, 0.6));
  }

  follow(targetPos) {
    if (!targetPos) return;
    this.sun.position.copy(targetPos).addScaledVector(this.sunDir, 280);
    this.sun.target.position.copy(targetPos);
    this.sun.target.updateMatrixWorld();
  }

  setOptions(settings) {
    if (!settings) return;
    if (settings.has('iceSnow')) this.iceSnow = settings.get('iceSnow');
    if (settings.has('iceDust')) this.iceDust = settings.get('iceDust');
    if (settings.has('aurora')) this.aurora = settings.get('aurora');
    if (settings.has('iceStorm')) this.iceStorm = settings.get('iceStorm');
    if (settings.has('iceGeysers')) this.iceGeysers = settings.get('iceGeysers');

    if (this.blizzard && this.blizzard.snowPoints) {
      this.blizzard.snowPoints.visible = !!this.iceSnow;
    }
    if (this.storm && this.storm.group) {
      this.storm.group.visible = !!this.iceStorm;
    }
  }

  update(dt, camera, shipPos, s, renderer) {
    this.time += dt;

    if (this.atmoDome) this.atmoDome.update(dt);
    if (this.glacier) this.glacier.update(dt);
    if (this.blizzard) this.blizzard.update(dt, camera);
    if (this.storm) this.storm.update(dt);

    // Dynamic environmental lightning flicker from distant storm
    if (this.storm && this.storm.flashIntensity > 0.05) {
      this.sun.intensity = 3.2 + this.storm.flashIntensity * 1.8;
    } else {
      this.sun.intensity = 3.2;
    }

    // Sky camera tracks player camera orientation
    if (camera && this.skyCam) {
      this.skyCam.aspect = camera.aspect;
      this.skyCam.fov = camera.fov;
      this.skyCam.quaternion.copy(camera.quaternion);
      this.skyCam.updateProjectionMatrix();
    }

    if (shipPos) {
      this.follow(shipPos);
    }
  }

  preRender(renderer) {
    if (this.sky && this.skyCam && renderer) {
      renderer.clear();
      renderer.render(this.sky, this.skyCam);
      renderer.clearDepth();
    }
  }
}
