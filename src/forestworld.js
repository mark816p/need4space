// src/forestworld.js — Forest Moon world environment (jungle canopy, floating islands, waterfalls, fauna)
// Why: Unifies dual-layer atmosphere, abyss floor, floating islands, flora, waterfalls, fauna, and colossal skeleton
import * as THREE from 'three';
import { AtmosphereSkyDome, CloudDecks } from './atmo.js';
import { JungleAbyss } from './abyss.js';
import { IslandField } from './islands.js';
import { FloraSystem } from './flora.js';
import { WaterfallSystem } from './water.js';
import { CreaturesSystem } from './creatures.js';
import { OvergrowthSystem } from './overgrowth.js';
import { ColossalSkeleton } from './skeleton.js';
import { ForestCave } from './cave.js';

export const FOREST_SUN_DIR = new THREE.Vector3(0.55, 0.52, -0.65).normalize();

export class ForestWorld {
  constructor(scene, renderer, camera, track) {
    this.name = 'forest';
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.track = track;
    this.sunDir = FOREST_SUN_DIR.clone();
    this.ready = false;

    // Atmospheric & look parameters
    this.exposure = 1.05;
    this.exposureK = 1.0;
    this.grade = 'forest';
    this.headlightK = 0.2;
    this.nightLights = 0.1;
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

    // Sky Backdrop Scene & Camera (depth range 50 to 300,000m)
    this.sky = new THREE.Scene();
    const aspect = (typeof window !== 'undefined' && window.innerWidth) ? (window.innerWidth / window.innerHeight) : (16 / 9);
    this.skyCam = new THREE.PerspectiveCamera(65, aspect, 50, 300000);

    // 1. Directional Sun Cascades & Forest Ambient
    this._initLights();

    // 2. Atmospheric Sky Dome & Sun Disc
    this.atmoDome = new AtmosphereSkyDome(this.sunDir);
    this.sky.add(this.atmoDome.mesh);

    // 3. Dual Cloud Decks (Abyss Deck & High Cirrus Deck)
    this.cloudDecks = new CloudDecks(this.scene);

    // 4. Jungle Canopy Abyss Floor (~1.3 km below datum)
    this.abyss = new JungleAbyss(this.scene);

    // 5. Floating Islands
    this.islands = new IslandField(this.scene, track);

    // 6. Instanced Flora & Giant Emergent Trees
    this.flora = new FloraSystem(this.scene, this.islands);

    // 7. Waterfalls & The Cascade River
    this.waterfalls = new WaterfallSystem(this.scene, track);

    // 8. Fauna (Sky Rays, Bird Flocks, Sky Whale)
    this.creatures = new CreaturesSystem(this.scene);

    // 9. Lianas and Overgrowth along Track
    this.overgrowth = new OvergrowthSystem(this.scene, track);

    // 10. The Colossal Skeleton (Jaws, Cranium, Spine, Ribs)
    this.skeleton = new ColossalSkeleton(this.scene, track);

    // 11. Hollow Hill 2 km Cave System (Glowworms, Waterfall & Lake, Crystals, Slalom, Roots, Fungi, River, Sinkholes)
    this.cave = new ForestCave(this.scene, track);

    this.time = 0;
    this.ready = true;
  }

  _initLights() {
    this.baseSunIntensity = 3.4;
    this.baseSunMidIntensity = 0.0;
    this.baseHemiIntensity = 0.85;

    // Primary Sunlight (rich warm daylight 5800K)
    this.sun = new THREE.DirectionalLight(0xfffaed, this.baseSunIntensity);
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
    this.sunMid = new THREE.DirectionalLight(0xfffaed, this.baseSunMidIntensity);
    this.sunMid.position.copy(this.sunDir).multiplyScalar(1500);
    this.scene.add(this.sunMid);

    // Sky Light + Jungle Canopy Bounce Ambient
    // Top = Blue sky hemisphere (0x38bdf8), Bottom = Emerald canopy bounce (0x0f3d1f)
    this.hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f3d1f, this.baseHemiIntensity);
    this.scene.add(this.hemiLight);

    // Sky scene lighting
    const skySun = new THREE.DirectionalLight(0xfffaed, 2.5);
    skySun.position.copy(this.sunDir).multiplyScalar(200000);
    this.sky.add(skySun);
    this.sky.add(new THREE.AmbientLight(0x0c2418, 0.5));
  }

  follow(targetPos) {
    if (!targetPos) return;
    this.sun.position.copy(targetPos).addScaledVector(this.sunDir, 280);
    this.sun.target.position.copy(targetPos);
    this.sun.target.updateMatrixWorld();
  }

  update(dt, camera, shipPos, s, renderer) {
    this.time += dt;

    if (this.atmoDome) this.atmoDome.update(dt);
    if (this.cloudDecks) this.cloudDecks.update(dt);
    if (this.abyss) this.abyss.update(dt);
    if (this.flora) this.flora.update(dt);
    if (this.waterfalls) this.waterfalls.update(dt);
    if (this.creatures) this.creatures.update(dt, this.time);
    if (this.cave) {
      this.cave.update(dt, this.time);

      // Cave lighting modulation: setCave dark
      const arcS = s !== undefined ? s : 0;
      const caveState = this.cave.inCave(arcS);
      if (caveState.inside) {
        const daylight = 1.0 - (caveState.darkness * (1.0 - caveState.sinkhole));
        this.sun.intensity = this.baseSunIntensity * daylight;
        this.hemiLight.intensity = this.baseHemiIntensity * (0.12 + 0.88 * daylight);
        this.headlightK = 0.2 + 0.8 * caveState.darkness;
      } else {
        this.sun.intensity = this.baseSunIntensity;
        this.hemiLight.intensity = this.baseHemiIntensity;
        this.headlightK = 0.2;
      }
    }

    // Sky camera tracks player camera orientation but stays centered at origin
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
    if (this.sky && this.skyCam) {
      renderer.clear();
      renderer.render(this.sky, this.skyCam);
      renderer.clearDepth();
    }
  }
}
