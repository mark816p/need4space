// src/oceanworld.js — The Drowned World environment (storm sea, moonlit sky, Keeper colossus, Atlantis sunken city, lighthouse island)
// Why: "P11.3 Fifth circuit (ca 15.2 km) over a storm-lashed night sea with a huge moon:
// causeway low over the swell, sea stacks and rock arches, viaduct jump, long banked left-hander around the lighthouse island,
// a deep dive into the ocean spiralling round a colossal statue of worn basalt + green bronze holding a lantern high over the sea (The Keeper),
// through a drowned city of pale stone that sank whole, still lit (Atlantis: Great Gate whose attic & braziers stand above water,
// avenue between tall colonnades, great dome, hypostyle temple hall, aqueduct arcade, sunken towers), surge out of the water,
// barrel roll over the swell, loop, return to causeway."

import * as THREE from 'three';
import { OceanAtmosphere } from './sea.js';
import { KeeperStatue } from './keeper.js';
import { AtlantisCity } from './atlantis.js';
import { SeabedEnvironment } from './seabed.js';
import { SeaLife } from './sealife.js';
import { KrakenSquid } from './squid.js';
import { AlienPillarsRing } from './pillars.js';
import { StormRain } from './rain.js';

export class OceanWorld {
  constructor(scene, renderer, camera, track) {
    this.name = 'ocean';
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.track = track;
    this.ready = false;

    // Atmospheric & look parameters
    this.exposure = 1.05;
    this.exposureK = 1.0;
    this.grade = 'ocean';
    this.headlightK = 0.95; // High headlight necessity in underwater abyss & Atlantis
    this.nightLights = 0.75;
    this.lightShafts = true;
    this.heat = false;
    this.dust = false;
    this.thunder = true;
    this.underK = 0.0;
    this.inFall = false;
    this.waterSpray = false;

    this.noAO = [];
    this.aoOccluders = new Set();
    this.worldOnly = [];

    // Feature switches
    this.oceanLightning = true;
    this.plankton = true;
    this.seaSwells = true;

    // 1. Storm Atmosphere & Gerstner Ocean Surface
    this.atmo = new OceanAtmosphere(this.scene, this.camera);
    this.sky = this.atmo.sky;
    this.skyCam = this.atmo.skyCam;

    // 2. Colossal Keeper Statue (Abyss dive spiral at (1200, -520, -2800))
    this.keeper = new KeeperStatue(this.scene, new THREE.Vector3(1200, -520, -2800));

    // 3. Atlantis Sunken City of Pale Stone
    this.atlantis = new AtlantisCity(this.scene, new THREE.Vector3(2400, -380, -4200));

    // 4. Sea Stacks, Basalt Rock Arches & Lighthouse Island
    this._buildSeaFeatures();

    // 5. Directional / Ambient lighting
    this._initLighting();

    // 6. Seabed environment (pinnacles, kelp beds, hydrothermal bubble vents, fish shoals, lanternfish, crabs)
    this.seabed = new SeabedEnvironment(this.scene, this.track);

    // 7. Sea life (dolphins, 60m leviathan, jellyfish, seabirds, surface ripples)
    this.sealife = new SeaLife(this.scene, this.track);

    // 8. The Kraken colossal cephalopod on grid sea stack
    this.kraken = new KrakenSquid(this.scene, new THREE.Vector3(120, 16, 2820));

    // 9. Colossal Alien Fluted Columns Ring
    this.pillars = new AlienPillarsRing(this.scene, new THREE.Vector3(2000, -520, -3500), 2200, 8);

    // 10. Storm Rain System (speed-elongated streaks, splashes, puddles, underwater shutoff)
    this.rain = new StormRain(this.scene, this.camera, null);

    this.time = 0;
    this.ready = true;
  }

  _initLighting() {
    // Ambient light: cold oceanic indigo above water, deep teal murk underwater
    this.oceanAmbient = new THREE.AmbientLight(0x0a1826, 0.9);
    this.scene.add(this.oceanAmbient);

    // Underwater teal depth light
    this.underwaterLight = new THREE.DirectionalLight(0x004555, 0.0);
    this.underwaterLight.position.set(0, -600, 0);
    this.scene.add(this.underwaterLight);
  }

  _buildSeaFeatures() {
    this.featuresGroup = new THREE.Group();
    this.featuresGroup.name = 'ocean_surface_features';

    const basaltMat = new THREE.MeshStandardMaterial({
      color: 0x1b232c,
      roughness: 0.88,
      metalness: 0.2
    });

    const graniteMat = new THREE.MeshStandardMaterial({
      color: 0x38414a,
      roughness: 0.72,
      metalness: 0.15
    });

    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xffe899,
      toneMapped: false
    });

    // 1. Sea Stacks & Rock Arches along Causeway Slalom
    // Towering sea pillars rising from seabed through waves to y = +45m
    const stackGeoms = [
      new THREE.CylinderGeometry(18, 38, 90, 8),
      new THREE.CylinderGeometry(24, 48, 110, 8),
      new THREE.CylinderGeometry(14, 32, 85, 8)
    ];

    const stackPositions = [
      [1450, 15, 1850],
      [1820, 20, 1620],
      [2150, 22, 1340],
      [2500, 18, 980],
      [2850, 25, 520],
      [1100, 16, 2100],
      [780, 20, 2450],
      [420, 18, 2750]
    ];

    for (let i = 0; i < stackPositions.length; i++) {
      const p = stackPositions[i];
      const geom = stackGeoms[i % stackGeoms.length];
      const mesh = new THREE.Mesh(geom, basaltMat);
      mesh.position.set(p[0], p[1], p[2]);
      mesh.rotation.y = (i * 1.3);
      this.featuresGroup.add(mesh);
    }

    // Basalt Rock Arch spanning near Sector 8
    const archGroup = new THREE.Group();
    archGroup.position.set(2200, 10, 1200);
    const archLegL = new THREE.Mesh(new THREE.BoxGeometry(22, 90, 28), basaltMat);
    archLegL.position.set(-38, 35, 0);
    archLegL.rotation.z = -0.12;
    archGroup.add(archLegL);

    const archLegR = new THREE.Mesh(new THREE.BoxGeometry(22, 90, 28), basaltMat);
    archLegR.position.set(38, 35, 0);
    archLegR.rotation.z = 0.12;
    archGroup.add(archLegR);

    const archSpan = new THREE.Mesh(new THREE.BoxGeometry(95, 20, 32), basaltMat);
    archSpan.position.set(0, 72, 0);
    archGroup.add(archSpan);
    this.featuresGroup.add(archGroup);

    // 2. Lighthouse Island on High-Speed Banked Left-Hander
    // Located at (2950, 0, 180) inside the sweeping curve
    this.lighthouseIsland = new THREE.Group();
    this.lighthouseIsland.position.set(2950, 0, 180);

    // Rocky island base
    const islandBaseGeom = new THREE.CylinderGeometry(160, 240, 48, 16);
    const islandBase = new THREE.Mesh(islandBaseGeom, basaltMat);
    islandBase.position.set(0, 12, 0);
    this.lighthouseIsland.add(islandBase);

    // Octagonal Granite Lighthouse Tower (y = 24 to y = 145m)
    const towerGeom = new THREE.CylinderGeometry(9, 16, 95, 8);
    const tower = new THREE.Mesh(towerGeom, graniteMat);
    tower.position.set(0, 75, 0);
    this.lighthouseIsland.add(tower);

    // Lantern room gallery & dome
    const galleryGeom = new THREE.CylinderGeometry(15, 12, 12, 8);
    const gallery = new THREE.Mesh(galleryGeom, graniteMat);
    gallery.position.set(0, 128, 0);
    this.lighthouseIsland.add(gallery);

    const lanternCupolaGeom = new THREE.SphereGeometry(11, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const cupola = new THREE.Mesh(lanternCupolaGeom, graniteMat);
    cupola.position.set(0, 134, 0);
    this.lighthouseIsland.add(cupola);

    // Rotating Lighthouse Fresnel Beacon Beam
    this.beaconGroup = new THREE.Group();
    this.beaconGroup.position.set(0, 130, 0);

    const beaconLight = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 12), beaconMat);
    this.beaconGroup.add(beaconLight);

    // Sweeping beam volume (cone projecting over ocean swell)
    const beamGeom = new THREE.ConeGeometry(85, 950, 16);
    beamGeom.rotateX(Math.PI * 0.5);
    beamGeom.translate(0, 0, 475);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffeaad,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.beaconBeam = new THREE.Mesh(beamGeom, beamMat);
    this.beaconGroup.add(this.beaconBeam);

    this.lighthouseIsland.add(this.beaconGroup);
    this.featuresGroup.add(this.lighthouseIsland);

    this.scene.add(this.featuresGroup);
  }

  follow(targetPos) {
    if (!targetPos || !this.atmo) return;
    if (this.atmo.moonLight) {
      this.atmo.moonLight.position.copy(targetPos).addScaledVector(this.atmo.moonDir, 800);
      this.atmo.moonLight.target.position.copy(targetPos);
      this.atmo.moonLight.target.updateMatrixWorld();
    }
  }

  setOptions(settings) {
    if (!settings) return;
    if (settings.has('oceanLightning')) this.oceanLightning = settings.get('oceanLightning');
    if (settings.has('plankton')) this.plankton = settings.get('plankton');
    if (settings.has('seaSwells')) this.seaSwells = settings.get('seaSwells');
  }

  update(dt, camera, shipPos, s, renderer) {
    this.time += dt;

    // 1. Update ocean atmosphere & sea shader
    if (this.atmo) {
      this.atmo.update(dt, camera);
      if (camera) {
        this.underK = this.atmo.computeUnderK(camera.position.y);
      }
    }

    // 2. Update The Keeper colossal statue LOD
    if (this.keeper) {
      this.keeper.update(dt, camera);
    }

    // 3. Update Atlantis Sunken City
    if (this.atlantis) {
      this.atlantis.update(dt, camera);
    }

    // 4. Rotate Lighthouse searchlight beam
    if (this.beaconGroup) {
      this.beaconGroup.rotation.y += dt * 0.75;
    }

    // 5. Water spray evaluation:
    // When skimming close to wave crests (y < 4m && y > -8m) or breaching ocean surface
    if (shipPos) {
      const nearSurface = (shipPos.y < 4.5 && shipPos.y > -12.0);
      this.waterSpray = nearSurface;
      this.follow(shipPos);
    } else {
      this.waterSpray = false;
    }

    // 6. Dynamic lighting adjustment based on underK
    if (this.oceanAmbient) {
      // Above water: indigo night sky (0x0a1826)
      // Deep underwater: murky dark teal (0x021218)
      const r = THREE.MathUtils.lerp(0.04, 0.01, this.underK);
      const g = THREE.MathUtils.lerp(0.09, 0.07, this.underK);
      const b = THREE.MathUtils.lerp(0.15, 0.09, this.underK);
      this.oceanAmbient.color.setRGB(r, g, b);
      this.oceanAmbient.intensity = 0.9 - this.underK * 0.35;
    }

    // 7. Update Seabed Environment
    if (this.seabed) {
      this.seabed.update(dt, this.time);
    }

    // 8. Update Sea Life
    if (this.sealife) {
      this.sealife.update(dt, this.time);
    }

    // 9. Update Kraken
    if (this.kraken) {
      this.kraken.update(dt, this.time, shipPos);
    }

    // 10. Update Alien Pillars Ring
    if (this.pillars) {
      this.pillars.update(dt, this.time);
    }

    // 11. Update Storm Rain System
    if (this.rain) {
      const speed = shipPos ? 160.0 : 0.0;
      this.rain.update(dt, camera, speed, this.underK);
    }

    // Sky camera tracks player camera orientation
    if (camera && this.skyCam) {
      this.skyCam.aspect = camera.aspect;
      this.skyCam.fov = camera.fov;
      this.skyCam.quaternion.copy(camera.quaternion);
      this.skyCam.updateProjectionMatrix();
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
