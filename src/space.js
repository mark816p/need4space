// src/space.js — Space circuit backdrop and environment world
// Why: Backdrop in its own scene/camera: nebula, Milky-Way band, stars, gas giant, sun, moon
// Three DirectionalLights for shadow cascades; lamps moved to nearest gantries without shader recompiles

import * as THREE from 'three';
import { createGasGiantTexture, createRingsTexture, createMoonTexture, createSunMaterial } from './celestial.js';
import { DerelictWreck } from './wreck.js';
import { getZoneLighting } from './wreckzones.js';

export const SUN_DIR = new THREE.Vector3(0.68, 0.45, -0.58).normalize();

export class SpaceWorld {
  constructor(scene, renderer, camera, track = null) {
    this.name = 'space';
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.sunDir = SUN_DIR.clone();
    this.ready = false;
    this.startIndex = 0;
    this.track = track;
    this.minimap = null;
    this.race = null;
    this.derelict = null;

    // Atmospheric & look parameters
    this.exposure = 1.0;
    this.exposureK = 1.0;
    this.grade = 'space';
    this.headlightK = 0.35;
    this.nightLights = 0.2;
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

    // Sky Backdrop Scene & Camera (rendered first in its own depth range 50m to 200,000m)
    this.sky = new THREE.Scene();
    const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 16 / 9;
    this.skyCam = new THREE.PerspectiveCamera(65, aspect, 50, 300000);

    // Shadow cascades
    this._initLights();

    // Celestial Bodies in sky scene & Space Ring Station
    this._initBackdrop();

    if (this.track) {
      this.attachTrack(this.track);
    }

    this.time = 0;
    this.ready = true;
  }

  attachTrack(track) {
    this.track = track;
    if (!this.derelict && this.scene && this.track) {
      this.derelict = new DerelictWreck(this.scene, this.track);
    }
  }

  _initLights() {
    // Sun cascade 1: Near (fine details, half 12m)
    this.sun = new THREE.DirectionalLight(0xfffaed, 3.2);
    this.sun.position.copy(this.sunDir).multiplyScalar(500);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.width = 2048;
    this.sun.shadow.mapSize.height = 2048;
    this.sun.shadow.camera.near = 100;
    this.sun.shadow.camera.far = 1000;
    this.sun.shadow.camera.left = -25;
    this.sun.shadow.camera.right = 25;
    this.sun.shadow.camera.top = 25;
    this.sun.shadow.camera.bottom = -25;
    this.sun.shadow.bias = -0.0002;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // Sun cascade 2: Mid (gantries, track bends, half 60m)
    this.sunMid = new THREE.DirectionalLight(0xfffaed, 0.0); // Shadow only cascade
    this.sunMid.position.copy(this.sunDir).multiplyScalar(1200);
    this.scene.add(this.sunMid);

    // Sun cascade 3: Far (scenery, derelict)
    this.sunFar = new THREE.DirectionalLight(0xfffaed, 0.0);
    this.sunFar.position.copy(this.sunDir).multiplyScalar(3000);
    this.scene.add(this.sunFar);

    // Faint warm planet-shine & starlight ambient
    this.ambient = new THREE.AmbientLight(0x24364e, 0.85);
    this.scene.add(this.ambient);

    // Planet-shine directional fill light from the ringed gas giant
    this.planetLight = new THREE.DirectionalLight(0x6699dd, 0.65);
    this.planetLight.position.set(-0.45, -0.25, 0.85).normalize().multiplyScalar(400);
    this.scene.add(this.planetLight);
    this.scene.add(this.planetLight.target);

    // Fixed 3 point lights moved to nearest gantries (avoids mid-race shader recompiles)
    this.lamps = [
      new THREE.PointLight(0x00d2ff, 0, 80, 1.8),
      new THREE.PointLight(0x00d2ff, 0, 80, 1.8),
      new THREE.PointLight(0x00d2ff, 0, 80, 1.8),
    ];
    for (const lamp of this.lamps) {
      this.scene.add(lamp);
    }
  }

  _initBackdrop() {
    // 1. Starfield: 14,000 procedural stars with temperature-based spectral colors
    const starCount = 14000;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    const rMin = 80000;
    const rMax = 160000;
    const starPalette = [
      new THREE.Color(0xaaccff), // Blue-white O/B type
      new THREE.Color(0xffffff), // White A type
      new THREE.Color(0xffeedd), // Yellow-white F/G type (Sun-like)
      new THREE.Color(0xffaa55), // Orange K type
      new THREE.Color(0xff5544), // Red M giant
    ];

    for (let i = 0; i < starCount; i++) {
      // Uniform spherical distribution
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = rMin + Math.random() * (rMax - rMin);

      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);

      const color = starPalette[Math.floor(Math.random() * starPalette.length)];
      starCol[i * 3] = color.r;
      starCol[i * 3 + 1] = color.g;
      starCol[i * 3 + 2] = color.b;

      starSizes[i] = Math.random() < 0.05 ? 3.5 : 1.2 + Math.random() * 1.5;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

    const starMat = new THREE.PointsMaterial({
      size: 2.0,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: false,
    });
    this.starField = new THREE.Points(starGeo, starMat);
    this.sky.add(this.starField);

    // 1b. Deep Cosmic Nebula & Milky Way Galactic Dust Clouds
    if (typeof document !== 'undefined') {
      const nebCanvas = document.createElement('canvas');
      nebCanvas.width = 128;
      nebCanvas.height = 128;
      const nctx = nebCanvas.getContext('2d');
      const ngrad = nctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      ngrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      ngrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.45)');
      ngrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.12)');
      ngrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
      nctx.fillStyle = ngrad;
      nctx.fillRect(0, 0, 128, 128);
      const nebTex = new THREE.CanvasTexture(nebCanvas);

      const nebCount = 42;
      const nebColors = [
        new THREE.Color(0x1a3366), // Deep Indigo / Cyan
        new THREE.Color(0x3d1a55), // Cosmic Violet / Purple
        new THREE.Color(0x0e4455), // Dark Teal
        new THREE.Color(0x552233)  // Warm Terracotta / Magenta
      ];
      this.nebulaGroup = new THREE.Group();
      this.nebulaGroup.name = 'space_nebula_clouds';

      for (let i = 0; i < nebCount; i++) {
        // Distribute along an inclined galactic arc
        const u = (i / nebCount) * Math.PI * 2.0;
        const lat = (Math.sin(u * 2.0) * 0.25) + (Math.random() - 0.5) * 0.35;
        const dist = 130000 + (Math.random() - 0.5) * 20000;
        const nx = Math.cos(u) * Math.cos(lat) * dist;
        const ny = Math.sin(lat) * dist;
        const nz = Math.sin(u) * Math.cos(lat) * dist;

        const col = nebColors[i % nebColors.length];
        const sMat = new THREE.SpriteMaterial({
          map: nebTex,
          color: col,
          blending: THREE.AdditiveBlending,
          transparent: true,
          opacity: 0.18 + Math.random() * 0.14,
          depthWrite: false
        });
        const spr = new THREE.Sprite(sMat);
        const sSize = 45000 + Math.random() * 35000;
        spr.scale.set(sSize, sSize, 1);
        spr.position.set(nx, ny, nz);
        this.nebulaGroup.add(spr);
      }
      this.sky.add(this.nebulaGroup);
    }

    // 2. The Sun: Boiling granulation sphere + corona
    const sunDist = 70000;
    const sunPos = this.sunDir.clone().multiplyScalar(sunDist);
    const sunGeo = new THREE.SphereGeometry(3200, 48, 48);
    this.sunMat = createSunMaterial();
    this.sunMesh = new THREE.Mesh(sunGeo, this.sunMat);
    this.sunMesh.position.copy(sunPos);
    this.sky.add(this.sunMesh);

    // Sun Corona Glow Sprite
    if (typeof document !== 'undefined') {
      const coronaCanvas = document.createElement('canvas');
      coronaCanvas.width = 256;
      coronaCanvas.height = 256;
      const cctx = coronaCanvas.getContext('2d');
      const grad = cctx.createRadialGradient(128, 128, 20, 128, 128, 128);
      grad.addColorStop(0.0, 'rgba(255, 250, 235, 1.0)');
      grad.addColorStop(0.2, 'rgba(255, 190, 80, 0.6)');
      grad.addColorStop(0.5, 'rgba(255, 100, 20, 0.2)');
      grad.addColorStop(1.0, 'rgba(255, 60, 0, 0.0)');
      cctx.fillStyle = grad;
      cctx.fillRect(0, 0, 256, 256);
      const coronaTex = new THREE.CanvasTexture(coronaCanvas);

      const coronaMat = new THREE.SpriteMaterial({
        map: coronaTex,
        color: 0xffeedd,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
      });
      const coronaSprite = new THREE.Sprite(coronaMat);
      coronaSprite.scale.set(16000, 16000, 1);
      coronaSprite.position.copy(sunPos);
      this.sky.add(coronaSprite);
    }

    // 3. Ringed Gas Giant
    const planetDist = 95000;
    const planetPos = new THREE.Vector3(-0.45, -0.25, 0.85).normalize().multiplyScalar(planetDist);
    const planetRadius = 8500;
    const planetGeo = new THREE.SphereGeometry(planetRadius, 64, 64);
    const planetTex = createGasGiantTexture(2048, 1024);
    const planetMat = new THREE.MeshStandardMaterial({
      map: planetTex,
      roughness: 0.85,
      metalness: 0.05
    });
    this.planetMesh = new THREE.Mesh(planetGeo, planetMat);
    this.planetMesh.position.copy(planetPos);
    this.planetMesh.rotation.z = THREE.MathUtils.degToRad(26.7); // Saturn-like axial tilt
    this.sky.add(this.planetMesh);

    // Planetary Rings
    const ringInner = planetRadius * 1.35;
    const ringOuter = planetRadius * 2.55;
    const ringGeo = new THREE.RingGeometry(ringInner, ringOuter, 96);
    // Rotate ring geometry so it lies in planet's equatorial plane
    ringGeo.rotateX(-Math.PI * 0.5);
    const ringTex = createRingsTexture(1024, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      map: ringTex,
      side: THREE.DoubleSide,
      transparent: true,
      roughness: 0.9,
      metalness: 0.1
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.planetMesh.add(ringMesh);

    // 4. Cratered Moon
    const moonDist = 82000;
    const moonPos = new THREE.Vector3(0.55, 0.65, 0.45).normalize().multiplyScalar(moonDist);
    const moonGeo = new THREE.SphereGeometry(1800, 32, 32);
    const moonTex = createMoonTexture(1024, 512);
    const moonMat = new THREE.MeshStandardMaterial({
      map: moonTex,
      roughness: 0.95,
      metalness: 0.0
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.copy(moonPos);
    this.sky.add(moonMesh);

    // Lighting for the Sky Scene so the planet and moon are lit consistently with sunDir
    const skySun = new THREE.DirectionalLight(0xfffaed, 2.8);
    skySun.position.copy(this.sunDir).multiplyScalar(200000);
    this.sky.add(skySun);
    this.sky.add(new THREE.AmbientLight(0x0c1424, 0.4));

    // 5. Procedural Space Ring Station in orbit
    this._initSpaceStation();

    // 6. The Broken Giant Colossus warship hanging over the ringed planet
    this._initBrokenGiant();
  }

  _initSpaceStation() {
    const stationDist = 72000;
    const stationPos = new THREE.Vector3(0.58, 0.28, -0.62).normalize().multiplyScalar(stationDist);

    this.stationGroup = new THREE.Group();
    this.stationGroup.name = 'space_ring_station';
    this.stationGroup.position.copy(stationPos);
    this.stationGroup.lookAt(0, 0, 0);
    this.stationGroup.rotateZ(0.35); // Gentle orbital inclination

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0xd8dde4,
      roughness: 0.38,
      metalness: 0.72
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1b222d,
      roughness: 0.5,
      metalness: 0.85
    });

    // 1. Central Docking Hub (cylinder + docking ports)
    const hubGeom = new THREE.CylinderGeometry(420, 420, 1600, 24);
    const hub = new THREE.Mesh(hubGeom, hullMat);
    hub.rotation.x = Math.PI * 0.5;
    this.stationGroup.add(hub);

    const dockRingGeom = new THREE.TorusGeometry(540, 70, 16, 32);
    const dockRing = new THREE.Mesh(dockRingGeom, darkMat);
    this.stationGroup.add(dockRing);

    // Communications Array (mast + parabolic dish)
    const commMastGeom = new THREE.CylinderGeometry(18, 18, 850, 8);
    const commMast = new THREE.Mesh(commMastGeom, darkMat);
    commMast.position.set(0, 0, 1100);
    commMast.rotation.x = Math.PI * 0.5;
    this.stationGroup.add(commMast);

    const dishGeom = new THREE.ConeGeometry(220, 75, 24, 1, true);
    const dish = new THREE.Mesh(dishGeom, hullMat);
    dish.position.set(0, 0, 1500);
    dish.rotation.x = -Math.PI * 0.5;
    this.stationGroup.add(dish);

    // 2. Rotating Habitat Ring & 6 Structural Truss Spokes
    this.stationRingGroup = new THREE.Group();
    this.stationRingGroup.name = 'station_habitat_ring';

    const ringRadius = 3200;
    const spokeGeom = new THREE.CylinderGeometry(55, 55, ringRadius - 400, 8);

    // Procedural observation window texture
    let windowTex = null;
    if (typeof document !== 'undefined') {
      const wCanvas = document.createElement('canvas');
      wCanvas.width = 1024;
      wCanvas.height = 128;
      const wctx = wCanvas.getContext('2d');
      wctx.fillStyle = '#18202c';
      wctx.fillRect(0, 0, 1024, 128);

      // Rows of glowing observation windows
      for (let x = 12; x < 1024; x += 24) {
        for (let y = 30; y < 100; y += 28) {
          if (Math.random() > 0.15) {
            const hue = Math.random() < 0.25 ? '#00d2ff' : (Math.random() < 0.6 ? '#fff4cc' : '#ffffff');
            wctx.fillStyle = hue;
            wctx.fillRect(x, y, 14, 16);
          }
        }
      }
      windowTex = new THREE.CanvasTexture(wCanvas);
      windowTex.wrapS = THREE.RepeatWrapping;
      windowTex.wrapT = THREE.ClampToEdgeWrapping;
      windowTex.repeat.set(12, 1);
    } else {
      const d = new Uint8Array(16 * 16 * 4).fill(220);
      windowTex = new THREE.DataTexture(d, 16, 16, THREE.RGBAFormat);
      windowTex.needsUpdate = true;
    }

    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xccd4df,
      roughness: 0.35,
      metalness: 0.65,
      map: windowTex || undefined,
      emissive: 0xffffff,
      emissiveMap: windowTex || undefined,
      emissiveIntensity: 0.65
    });

    const ringGeom = new THREE.TorusGeometry(ringRadius, 210, 24, 72);
    const habitatRing = new THREE.Mesh(ringGeom, ringMat);
    this.stationRingGroup.add(habitatRing);

    // 6 Structural Truss Spokes connecting Hub to Habitat Ring
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3; // 60 deg
      const spoke = new THREE.Mesh(spokeGeom, darkMat);
      const halfR = (ringRadius + 400) * 0.5;
      spoke.position.set(Math.cos(angle) * halfR, Math.sin(angle) * halfR, 0);
      spoke.rotation.z = angle - Math.PI * 0.5;
      this.stationRingGroup.add(spoke);
    }

    // Hazard Strobes (flashing red beacons on outer rim)
    this.stationStrobes = [];
    const strobeGeom = new THREE.SphereGeometry(30, 8, 8);
    const strobeMat = new THREE.MeshBasicMaterial({
      color: 0xff2222,
      toneMapped: false
    });

    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const strobe = new THREE.Mesh(strobeGeom, strobeMat.clone());
      strobe.position.set(Math.cos(angle) * (ringRadius + 220), Math.sin(angle) * (ringRadius + 220), 0);
      this.stationRingGroup.add(strobe);
      this.stationStrobes.push(strobe);
    }

    this.stationGroup.add(this.stationRingGroup);
    this.sky.add(this.stationGroup);
  }

  _initBrokenGiant() {
    const colossusDist = 66000;
    // Positioned hanging dramatically against the ringed planet backdrop
    const colossusPos = new THREE.Vector3(0.50, 0.38, -0.66).normalize().multiplyScalar(colossusDist);

    this.brokenGiantGroup = new THREE.Group();
    this.brokenGiantGroup.name = 'broken_giant_colossus';
    this.brokenGiantGroup.position.copy(colossusPos);
    this.brokenGiantGroup.lookAt(0, 0, 0);
    this.brokenGiantGroup.rotateZ(0.42);
    this.brokenGiantGroup.rotateY(0.25);

    this.colossusGroup = this.brokenGiantGroup; // Alias for settings / API
    this.brokenDebris = [];

    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x3a4250,
      roughness: 0.55,
      metalness: 0.75
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x181e26,
      roughness: 0.65,
      metalness: 0.85
    });
    const interiorMat = new THREE.MeshStandardMaterial({
      color: 0x242a34,
      roughness: 0.8,
      metalness: 0.5
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      toneMapped: false
    });
    const engineGlowMat = new THREE.MeshBasicMaterial({
      color: 0x4477ff,
      toneMapped: false
    });
    const strobeMat = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      toneMapped: false
    });

    // 1. Forward Hull Section (Prow & Command Superstructure)
    this.forwardHull = new THREE.Group();
    this.forwardHull.name = 'colossus_forward_hull';
    this.forwardHull.position.set(-820, 360, -480);
    this.forwardHull.rotation.set(0.08, -0.15, -0.05);

    // Faceted Prow Wedge
    const prowGeom = new THREE.ConeGeometry(950, 3600, 6);
    prowGeom.rotateX(Math.PI * 0.5);
    prowGeom.scale(1.4, 0.65, 1.0);
    const prowMesh = new THREE.Mesh(prowGeom, armorMat);
    prowMesh.position.set(0, 0, -1800);
    this.forwardHull.add(prowMesh);

    // Command Tower
    const bridgeGeom = new THREE.BoxGeometry(450, 600, 1200);
    const bridgeMesh = new THREE.Mesh(bridgeGeom, frameMat);
    bridgeMesh.position.set(0, 480, -800);
    this.forwardHull.add(bridgeMesh);

    // Glowing Bridge Slits
    const slitGeom = new THREE.BoxGeometry(460, 45, 800);
    const slitMesh = new THREE.Mesh(slitGeom, glowMat);
    slitMesh.position.set(0, 620, -800);
    this.forwardHull.add(slitMesh);

    // Exposed fracture bulkheads on Forward Hull
    for (let d = -4; d <= 4; d++) {
      const bulkheadGeom = new THREE.BoxGeometry(900 - Math.abs(d) * 80, 25, 350);
      const bulkhead = new THREE.Mesh(bulkheadGeom, interiorMat);
      bulkhead.position.set(0, d * 75, 40);
      this.forwardHull.add(bulkhead);
    }
    this.brokenGiantGroup.add(this.forwardHull);

    // 2. Aft Engineering Hull Section (Engines & Reactor)
    this.aftHull = new THREE.Group();
    this.aftHull.name = 'colossus_aft_hull';
    this.aftHull.position.set(960, -440, 680);
    this.aftHull.rotation.set(-0.18, 0.22, 0.12);

    // Engineering hull main body
    const aftBodyGeom = new THREE.BoxGeometry(1600, 900, 4400);
    const aftBody = new THREE.Mesh(aftBodyGeom, armorMat);
    this.aftHull.add(aftBody);

    // 4 Colossal Sub-light Engine Bells
    const bellGeom = new THREE.CylinderGeometry(280, 420, 850, 18, 1, true);
    bellGeom.rotateX(Math.PI * 0.5);
    const bellGlowGeom = new THREE.CircleGeometry(260, 18);
    const bellOffsets = [
      [-480, -220], [480, -220],
      [-480, 220], [480, 220]
    ];
    for (const [bx, by] of bellOffsets) {
      const bell = new THREE.Mesh(bellGeom, frameMat);
      bell.position.set(bx, by, 2500);
      this.aftHull.add(bell);

      const bellGlow = new THREE.Mesh(bellGlowGeom, engineGlowMat);
      bellGlow.position.set(bx, by, 2200);
      this.aftHull.add(bellGlow);
    }

    // Radiator Trench Fins
    for (let i = 0; i < 6; i++) {
      const finGeom = new THREE.BoxGeometry(35, 650, 500);
      const finL = new THREE.Mesh(finGeom, frameMat);
      finL.position.set(-850, 0, -1200 + i * 550);
      this.aftHull.add(finL);
      const finR = new THREE.Mesh(finGeom, frameMat);
      finR.position.set(850, 0, -1200 + i * 550);
      this.aftHull.add(finR);
    }

    // Exposed torn framing at fracture
    for (let k = 0; k < 10; k++) {
      const tornRib = new THREE.Mesh(new THREE.BoxGeometry(45, 750, 45), frameMat);
      tornRib.position.set(-650 + k * 140, 0, -2200 + (k % 3) * 60);
      tornRib.rotation.z = (k - 5) * 0.08;
      this.aftHull.add(tornRib);
    }
    this.brokenGiantGroup.add(this.aftHull);

    // 3. Drifting Wreckage Field between the halves
    this.debrisGroup = new THREE.Group();
    this.debrisGroup.name = 'colossus_debris_field';

    const debrisGeoms = [
      new THREE.BoxGeometry(90, 45, 180),
      new THREE.BoxGeometry(60, 120, 75),
      new THREE.BoxGeometry(140, 25, 220),
      new THREE.CylinderGeometry(15, 15, 320, 6)
    ];

    for (let i = 0; i < 48; i++) {
      const g = debrisGeoms[i % debrisGeoms.length];
      const m = (i % 4 === 0) ? frameMat : armorMat;
      const mesh = new THREE.Mesh(g, m);

      // Distribute across the fracture gap
      const t = (i / 48);
      const px = THREE.MathUtils.lerp(-700, 850, t) + (Math.sin(i * 1.7) * 450);
      const py = THREE.MathUtils.lerp(250, -350, t) + (Math.cos(i * 2.3) * 350);
      const pz = THREE.MathUtils.lerp(-300, 550, t) + (Math.sin(i * 3.1) * 600);
      mesh.position.set(px, py, pz);
      mesh.rotation.set(Math.sin(i), Math.cos(i), i * 0.5);

      this.debrisGroup.add(mesh);
      this.brokenDebris.push({
        mesh,
        rotSpeed: new THREE.Vector3(
          (Math.sin(i * 1.1 + 0.5) * 0.25 + 0.05),
          (Math.cos(i * 1.7) * 0.2 + 0.05),
          (Math.sin(i * 2.3 + 0.8) * 0.15 + 0.05)
        )
      });
    }
    this.brokenGiantGroup.add(this.debrisGroup);

    // 4. Hazard beacons on the wreck
    this.wreckStrobes = [];
    for (let s = 0; s < 8; s++) {
      const strobe = new THREE.Mesh(new THREE.SphereGeometry(25, 6, 6), strobeMat);
      const isFwd = s < 4;
      if (isFwd) {
        strobe.position.set((s % 2 === 0 ? -450 : 450), 300, -2200 + s * 600);
        this.forwardHull.add(strobe);
      } else {
        strobe.position.set((s % 2 === 0 ? -800 : 800), 450, -1800 + (s - 4) * 900);
        this.aftHull.add(strobe);
      }
      this.wreckStrobes.push(strobe);
    }

    this.sky.add(this.brokenGiantGroup);
  }

  follow(targetPos, camera) {
    if (!targetPos) return;
    // Position cascade 1 tight around the ship
    this.sun.position.copy(targetPos).addScaledVector(this.sunDir, 250);
    this.sun.target.position.copy(targetPos);
    this.sun.target.updateMatrixWorld();

    if (this.planetLight) {
      this.planetLight.position.copy(targetPos).add(new THREE.Vector3(-180, -90, 220));
      this.planetLight.target.position.copy(targetPos);
      this.planetLight.target.updateMatrixWorld();
    }
  }

  update(dt, camera, shipPos, s = 0, renderer = null) {
    this.time += dt;

    // Update live boiling sun granulation
    if (this.sunMat && this.sunMat.uniforms.uTime) {
      this.sunMat.uniforms.uTime.value += dt;
    }

    // Animate rotating space station habitat ring & hazard strobes
    if (this.stationRingGroup) {
      this.stationRingGroup.rotation.z += dt * 0.04;
      const strobeOn = Math.sin(this.time * 5.5) > 0.3;
      for (let i = 0; i < this.stationStrobes.length; i++) {
        this.stationStrobes[i].visible = strobeOn;
      }
    }

    // Animate Broken Giant debris field & emergency strobes
    if (this.brokenDebris && this.brokenDebris.length > 0) {
      for (let i = 0; i < this.brokenDebris.length; i++) {
        const d = this.brokenDebris[i];
        d.mesh.rotation.x += d.rotSpeed.x * dt;
        d.mesh.rotation.y += d.rotSpeed.y * dt;
        d.mesh.rotation.z += d.rotSpeed.z * dt;
      }
    }
    if (this.wreckStrobes && this.wreckStrobes.length > 0) {
      const strobeState = Math.sin(this.time * 4.0) > 0.4;
      for (let i = 0; i < this.wreckStrobes.length; i++) {
        this.wreckStrobes[i].visible = strobeState;
      }
    }

    // Sky camera tracks player camera orientation but stays centered at origin
    // Why: Backdrop rendered in its own depth range (near 50, far 200000)
    if (camera && this.skyCam) {
      this.skyCam.aspect = camera.aspect;
      this.skyCam.fov = camera.fov;
      this.skyCam.quaternion.copy(camera.quaternion);
      this.skyCam.updateProjectionMatrix();
    }

    if (shipPos) {
      this.follow(shipPos, camera);
    }

    // Update Derelict Colossus simulation
    if (this.derelict) {
      this.derelict.update(dt, camera, shipPos, s);
    }

    // Dynamic chamber lighting and sun occlusion along the derelict Colossus
    const lighting = getZoneLighting(s);
    if (this.sun) {
      this.sun.intensity = THREE.MathUtils.lerp(3.2, 0.05, lighting.sunOcclusion);
    }
    if (this.ambient) {
      this.ambient.intensity = THREE.MathUtils.lerp(0.6, 0.12, lighting.ambientDarkness);
    }
  }

  preRender(renderer) {
    // Render sky backdrop first, clearing color and depth
    if (this.sky && this.skyCam) {
      renderer.clear();
      renderer.render(this.sky, this.skyCam);
      renderer.clearDepth();
    }
  }

  shadowMode(size, renderer) {
    if (this.sun && this.sun.shadow) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
  }

  setOptions(settings) {
    if (!settings) return;
    let colossusVal = undefined;
    if (settings instanceof Map || (settings.has && typeof settings.has === 'function')) {
      if (settings.has('colossus')) colossusVal = settings.get('colossus');
    } else if (settings.get && typeof settings.get === 'function') {
      colossusVal = settings.get('colossus');
    } else if (settings.colossus !== undefined) {
      colossusVal = settings.colossus;
    }
    if (this.brokenGiantGroup && colossusVal !== undefined) {
      this.brokenGiantGroup.visible = !!colossusVal;
    }
  }
  wetCheck() {}
}
