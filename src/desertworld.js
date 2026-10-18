// src/desertworld.js — Desert Planet world environment (dunes, sandstone, ruins, haze, simoom)
// Why: Unifies the sea of dunes, layered sandstone canyons & arches, ancient metropolis ruins,
// Mie dust atmosphere, sandstorm ellipsoid, and GPU simoom wind

import * as THREE from 'three';
import { DESERT_SUN_DIR, DesertHaze } from './haze.js';
import { DuneSea } from './dunes.js';
import { SandstoneGeology } from './sandstone.js';
import { DesertRuins } from './ruins.js';
import { SimoomWind } from './simoom.js';

export class DesertWorld {
  constructor(scene, renderer, camera, track) {
    this.name = 'desert';
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.track = track;
    this.sunDir = DESERT_SUN_DIR.clone();
    this.ready = false;

    // Atmospheric & look parameters
    this.exposure = 1.12;
    this.exposureK = 1.0;
    this.grade = 'desert';
    this.headlightK = 0.25; // Broad desert visibility
    this.nightLights = 0.45;
    this.lightShafts = true;
    this.heat = true; // Enables heat shimmer
    this.dust = true;
    this.thunder = false;
    this.underK = 0.0;
    this.inFall = false;
    this.renderScale = 1.0;

    this.noAO = [];
    this.aoOccluders = new Set();
    this.worldOnly = [];

    // Sky Backdrop Scene & Camera (depth range 50 to 300,000m)
    this.sky = new THREE.Scene();
    const aspect = (typeof window !== 'undefined' && window.innerWidth) ? (window.innerWidth / window.innerHeight) : (16 / 9);
    this.skyCam = new THREE.PerspectiveCamera(65, aspect, 50, 300000);

    // 1. Lighting (Sun ~7.5° elevation, warm solar gold + ambient desert sky)
    this._initLights();

    // 2. Atmospheric Sky Dome & Sandstorm Ellipsoid
    this.haze = new DesertHaze(this.sky, this.sunDir);

    // 3. Sea of Dunes, Transverse Ridges, Skirted Tiles & Combed Ripples
    this.dunes = new DuneSea(this.scene, track);
    if (this.dunes && this.dunes.group) {
      this.dunes.group.traverse(obj => {
        if (obj.isMesh) {
          obj.userData.noAO = true;
          this.noAO.push(obj);
        }
      });
    }

    // 4. Layered Sandstone Geology (Canyon Gorge, Mesas, Buttes, Great Arches)
    this.sandstone = new SandstoneGeology(this.scene, track);

    // 5. Ancient Metropolis Ruins (Fallen Skyscraper Transit, Stepped Pyramids)
    this.ruins = new DesertRuins(this.scene, track);

    // 6. GPU Simoom Wind (Sand Veils, Dust Devils, Skimming Wakes)
    this.simoom = new SimoomWind(this.scene, track);

    // Warm tinting on gantries in desert dust to prevent pitch-black silhouettes
    this._tintDesertGantries();

    this.time = 0;
    this.ready = true;
  }

  _initLights() {
    // Primary Sunlight: warm solar gold dusk sun, ~7.5° elevation
    this.sun = new THREE.DirectionalLight(0xffb888, 3.4);
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
    this.sunMid = new THREE.DirectionalLight(0xffb888, 0.0);
    this.sunMid.position.copy(this.sunDir).multiplyScalar(1500);
    this.scene.add(this.sunMid);

    // Warm terracotta ambient fill + rose sky hemisphere
    const hemiLight = new THREE.HemisphereLight(0x703830, 0x3d2014, 0.95);
    this.scene.add(hemiLight);

    // Sky scene lighting
    const skySun = new THREE.DirectionalLight(0xffc090, 2.5);
    skySun.position.copy(this.sunDir).multiplyScalar(200000);
    this.sky.add(skySun);
    this.sky.add(new THREE.AmbientLight(0x402018, 0.7));
  }

  _tintDesertGantries() {
    if (!this.scene) return;
    this.scene.traverse((obj) => {
      if (obj.name === 'gantries' || (obj.parent && obj.parent.name === 'gantries')) {
        obj.traverse((child) => {
          if (child.isMesh && child.material) {
            if (child.material.color && child.material.color.getHex() === 0x1c2432) {
              child.material = child.material.clone();
              child.material.color.setHex(0x382e28);
              child.material.roughness = 0.65;
            }
          }
        });
      }
    });
  }

  follow(targetPos) {
    if (!targetPos) return;
    this.sun.position.copy(targetPos).addScaledVector(this.sunDir, 280);
    this.sun.target.position.copy(targetPos);
    this.sun.target.updateMatrixWorld();
  }

  setOptions(settings) {
    if (!settings) return;
    if (settings.has('heatShimmer')) {
      this.heat = !!settings.get('heatShimmer');
    }
  }

  update(dt, camera, shipPos, s, renderer) {
    this.time += dt;

    // Optical depth in sandstorm
    const stormDepth = this.haze ? this.haze.getOpticalDepthAt(shipPos) : 0.0;

    if (this.haze) this.haze.update(dt, camera);
    if (this.simoom) this.simoom.update(dt, camera, this.race ? this.race.playerRacer : null, stormDepth);

    // Adjust sun intensity when entering sandstorm
    if (stormDepth > 0.05) {
      this.sun.intensity = 3.4 * (1.0 - stormDepth * 0.45);
    } else {
      this.sun.intensity = 3.4;
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
