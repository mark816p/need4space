// src/wreck.js — Derelict 12 km Colossus megastructure construction & simulation
// Why: "the derelict a colossus to thread for 12 km (lap 26.6 km). Details in §H.1 (zones).
// Follow-ups: rack towers in the hangar, hulks lit and painted, the break, cheaper light loop;
// trench walls over the deck, turrets up on barbettes, cheaper sun shadow"
// "track passes through bell/hall with correct darkness; ships' lights on; no light floating in the void"

import * as THREE from 'three';
import { COLOSSUS_LOCATION, COLOSSUS_PIECES, GRAVEYARD } from './wreckplan.js';
import { getChamberDarkness, getReactorWarmth, isDarkChamber } from './wreckzones.js';

// Module-level scratch vectors to prevent runtime allocations
const _f = {};
const _fA = {};
const _fB = {};
const _m = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _dir = new THREE.Vector3();

export class DerelictWreck {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    this.group.name = 'derelict_colossus';

    this.cables = [];
    this.runningLights = [];
    this.reactorMeshes = [];
    this.reactorLights = [];
    this.holdBeacons = [];
    this.time = 0;
    this.corePositions = [];

    // Build the Colossus structural sections along the 12 km corridor
    this._buildMaterials();
    this._buildEngineBell();
    this._buildReactorHall();
    this._buildTheBreak();
    this._buildUpsideDownHold();
    this._buildForwardHangar();
    this._buildTrenchRun();
    this._buildSensorBoom();
    this._buildOrangeGate();
    this._buildGraveyard();
    this._buildSparks();

    this.scene.add(this.group);
  }

  _buildMaterials() {
    // Dark weathered hull steel for exterior plating
    this.hullMat = new THREE.MeshStandardMaterial({
      color: 0x242830,
      roughness: 0.82,
      metalness: 0.55,
      side: THREE.DoubleSide
    });

    // Inner structural ribs & bulkheads
    this.innerMat = new THREE.MeshStandardMaterial({
      color: 0x1a1e24,
      roughness: 0.9,
      metalness: 0.35,
      side: THREE.DoubleSide
    });

    // Dark titanium exhaust bell alloy (soot-stained, heat-discolored)
    this.bellMat = new THREE.MeshStandardMaterial({
      color: 0x16191f,
      roughness: 0.75,
      metalness: 0.7,
      side: THREE.DoubleSide
    });

    // Heavy armored trench walls
    this.trenchMat = new THREE.MeshStandardMaterial({
      color: 0x282c35,
      roughness: 0.85,
      metalness: 0.45,
      side: THREE.DoubleSide
    });

    // Gunmetal barbettes and defense turrets
    this.turretMat = new THREE.MeshStandardMaterial({
      color: 0x1e2026,
      roughness: 0.65,
      metalness: 0.75
    });

    this.barrelMat = new THREE.MeshStandardMaterial({
      color: 0x131518,
      roughness: 0.5,
      metalness: 0.85
    });

    // Pulsating warm reactor core material
    this.reactorMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff3300,
      emissiveIntensity: 2.2,
      roughness: 0.3,
      metalness: 0.2
    });

    // Navigation and warning strobe lenses
    this.strobeMatRed = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    this.strobeMatGreen = new THREE.MeshBasicMaterial({ color: 0x22ff44 });
    this.strobeMatAmber = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    this.strobeMatCyan = new THREE.MeshBasicMaterial({ color: 0x00d2ff });

    // Livery material cache for painted graveyard hulks
    this.liveryMats = new Map();
  }

  _getLiveryMaterial(colorHex) {
    if (!this.liveryMats.has(colorHex)) {
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.7,
        metalness: 0.4
      });
      this.liveryMats.set(colorHex, mat);
    }
    return this.liveryMats.get(colorHex);
  }

  _buildEngineBell() {
    const p = COLOSSUS_PIECES.engineBell;
    this.track.frame(p.startS, _fA);

    const bellGroup = new THREE.Group();
    const len = p.length;
    const rMouth = p.mouthRadius;
    const rThroat = p.throatRadius;

    // Truncated conical bell nozzle
    const geom = new THREE.CylinderGeometry(rThroat, rMouth, len, 32, 8, true);
    geom.rotateX(Math.PI / 2);
    const bellMesh = new THREE.Mesh(geom, this.bellMat);
    bellMesh.position.set(0, 0, len * 0.5);
    bellGroup.add(bellMesh);

    // Reinforcement cooling rings along bell exterior
    const ringCount = p.coolingRings || 8;
    for (let i = 0; i < ringCount; i++) {
      const frac = i / (ringCount - 1);
      const ringR = THREE.MathUtils.lerp(rMouth, rThroat, frac) + 1.2;
      const ringGeom = new THREE.TorusGeometry(ringR, 1.8, 8, 32);
      const ringMesh = new THREE.Mesh(ringGeom, this.hullMat);
      ringMesh.position.set(0, 0, frac * len);
      bellGroup.add(ringMesh);
    }

    _m.makeBasis(_fA.R, _fA.U, _fA.T);
    bellGroup.quaternion.setFromRotationMatrix(_m);
    bellGroup.position.copy(_fA.pos);
    this.group.add(bellGroup);
  }

  _buildReactorHall() {
    const p = COLOSSUS_PIECES.reactorHall;
    this.track.frame(p.startS, _fA);
    this.track.frame(p.endS, _fB);

    const steps = 16;
    const hallGroup = new THREE.Group();

    // Ribbed octagonal containment chamber sweeping along track frames
    for (let i = 0; i <= steps; i++) {
      const s = THREE.MathUtils.lerp(p.startS, p.endS, i / steps);
      this.track.frame(s, _f);

      _m.makeBasis(_f.R, _f.U, _f.T);
      const ringGeom = new THREE.TorusGeometry(p.width * 0.5, 3.5, 8, 8);
      const ring = new THREE.Mesh(ringGeom, this.innerMat);
      ring.position.copy(_f.pos).addScaledVector(_f.U, 14.0);
      ring.quaternion.setFromRotationMatrix(_m);
      hallGroup.add(ring);
    }

    // Outer octagonal hull shell
    const shellGeom = new THREE.CylinderGeometry(p.width * 0.52, p.width * 0.52, p.length, 8, 4, true);
    shellGeom.rotateX(Math.PI / 2);
    const shellMesh = new THREE.Mesh(shellGeom, this.hullMat);
    const midPos = _fA.pos.clone().lerp(_fB.pos, 0.5).addScaledVector(_fA.U, 14.0);
    shellMesh.position.copy(midPos);
    _m.makeBasis(_fA.R, _fA.U, _fA.T);
    shellMesh.quaternion.setFromRotationMatrix(_m);
    hallGroup.add(shellMesh);

    // Three Antimatter & Fusion Reactor Cores anchored inside containment hall
    const cores = p.cores || [
      { id: 'core_1', distS: p.startS + 350.0, radius: 34.0, color: 0xff5500 },
      { id: 'core_2', distS: p.startS + 850.0, radius: 36.0, color: 0xff4400 },
      { id: 'core_3', distS: p.startS + 1350.0, radius: 32.0, color: 0xff6600 }
    ];

    for (let k = 0; k < cores.length; k++) {
      const cData = cores[k];
      const fCore = {};
      this.track.frame(cData.distS, fCore);
      const cPos = fCore.pos.clone().addScaledVector(fCore.U, 26.0);
      this.corePositions.push(cPos);

      // Torus magnetic confinement ring
      const coreGeom = new THREE.TorusGeometry(cData.radius, 6.5, 16, 32);
      const coreMesh = new THREE.Mesh(coreGeom, this.reactorMat);
      coreMesh.position.copy(cPos);
      _m.makeBasis(fCore.R, fCore.U, fCore.T);
      coreMesh.quaternion.setFromRotationMatrix(_m);
      hallGroup.add(coreMesh);
      this.reactorMeshes.push(coreMesh);

      // Warm reactor point light fixed strictly inside the hall (Zero light floating in the void!)
      const rLight = new THREE.PointLight(cData.color || 0xff5500, 3.5, 180, 1.8);
      rLight.position.copy(cPos);
      hallGroup.add(rLight);
      this.reactorLights.push(rLight);
    }

    // Swaying Heavy Power Cables
    this._buildSwayingCables(hallGroup, p);

    this.group.add(hallGroup);
  }

  _buildSwayingCables(parentGroup, p) {
    const cableCount = (p.cables && p.cables.length) ? p.cables.length : 5;
    for (let i = 0; i < cableCount; i++) {
      const s = p.startS + 140.0 + i * 260.0;
      this.track.frame(s, _f);
      _m.makeBasis(_f.R, _f.U, _f.T);

      const halfW = p.width * 0.42;
      const sag = 16.0 + i * 2.0;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-halfW, 28, 0),
        new THREE.Vector3(0, 28 - sag, 0),
        new THREE.Vector3(halfW, 28, 0)
      );
      const geom = new THREE.TubeGeometry(curve, 16, 0.9, 6, false);
      const mesh = new THREE.Mesh(geom, this.innerMat);
      mesh.quaternion.setFromRotationMatrix(_m);
      mesh.position.copy(_f.pos);
      parentGroup.add(mesh);
      this.cables.push({ mesh, phase: i * 1.35 });
    }
  }

  _buildTheBreak() {
    const p = COLOSSUS_PIECES.theBreak;
    this.track.frame(p.gapStartS, _fA);
    this.track.frame(p.gapEndS, _fB);

    const breakGroup = new THREE.Group();

    // Shattered hull plates curling outward at fracture lip A
    const tearGeomA = new THREE.BoxGeometry(COLOSSUS_PIECES.reactorHall.width * 1.1, p.platingCurl * 1.5, 8.0);
    const tearMeshA = new THREE.Mesh(tearGeomA, this.hullMat);
    tearMeshA.position.copy(_fA.pos).addScaledVector(_fA.U, 18.0).addScaledVector(_fA.T, -6.0);
    tearMeshA.rotation.x = -0.35;
    breakGroup.add(tearMeshA);

    // Shattered hull plates curling outward at fracture lip B
    const tearMeshB = new THREE.Mesh(tearGeomA, this.hullMat);
    tearMeshB.position.copy(_fB.pos).addScaledVector(_fB.U, 18.0).addScaledVector(_fB.T, 6.0);
    tearMeshB.rotation.x = 0.35;
    breakGroup.add(tearMeshB);

    // Exposed sheared ring frames sticking out into the vacuum gap
    for (let k = -2; k <= 2; k++) {
      const sparGeom = new THREE.BoxGeometry(2.2, 24.0, 2.2);
      const sparA = new THREE.Mesh(sparGeom, this.innerMat);
      sparA.position.copy(_fA.pos).addScaledVector(_fA.R, k * 22.0).addScaledVector(_fA.U, 12.0);
      sparA.rotation.z = k * 0.15;
      breakGroup.add(sparA);

      const sparB = new THREE.Mesh(sparGeom, this.innerMat);
      sparB.position.copy(_fB.pos).addScaledVector(_fB.R, k * 22.0).addScaledVector(_fB.U, 12.0);
      sparB.rotation.z = -k * 0.15;
      breakGroup.add(sparB);
    }

    this.group.add(breakGroup);
  }

  _buildUpsideDownHold() {
    const p = COLOSSUS_PIECES.upsideDownHold;
    const holdGroup = new THREE.Group();
    holdGroup.name = 'upside_down_hold';

    const steps = p.ribCount || 24;
    const ribGeom = new THREE.TorusGeometry(p.width * 0.48, 3.2, 6, 8);
    const beaconGeom = new THREE.SphereGeometry(1.6, 8, 8);

    for (let i = 0; i <= steps; i++) {
      const s = THREE.MathUtils.lerp(p.startS, p.endS, i / steps);
      this.track.frame(s, _f);
      _m.makeBasis(_f.R, _f.U, _f.T);

      // Inverted structural rib spanning the hold ceiling & walls
      const rib = new THREE.Mesh(ribGeom, this.innerMat);
      rib.position.copy(_f.pos).addScaledVector(_f.U, 12.0);
      rib.quaternion.setFromRotationMatrix(_m);
      holdGroup.add(rib);

      // Amber hold warning beacons lining the upper superstructure
      if (i % 2 === 0) {
        const beaconL = new THREE.Mesh(beaconGeom, this.strobeMatAmber);
        beaconL.position.copy(_f.pos).addScaledVector(_f.R, -p.width * 0.42).addScaledVector(_f.U, 16.0);
        holdGroup.add(beaconL);
        this.holdBeacons.push({ mesh: beaconL, phase: i * 0.6 });

        const beaconR = new THREE.Mesh(beaconGeom, this.strobeMatAmber);
        beaconR.position.copy(_f.pos).addScaledVector(_f.R, p.width * 0.42).addScaledVector(_f.U, 16.0);
        holdGroup.add(beaconR);
        this.holdBeacons.push({ mesh: beaconR, phase: i * 0.6 + Math.PI });
      }
    }

    // Outer hull envelope surrounding the hold
    const holdShellGeom = new THREE.CylinderGeometry(p.width * 0.52, p.width * 0.52, p.endS - p.startS, 8, 4, true);
    holdShellGeom.rotateX(Math.PI / 2);
    const holdShell = new THREE.Mesh(holdShellGeom, this.hullMat);
    this.track.frame(p.startS, _fA);
    this.track.frame(p.endS, _fB);
    holdShell.position.copy(_fA.pos).lerp(_fB.pos, 0.5).addScaledVector(_fA.U, 12.0);
    _m.makeBasis(_fA.R, _fA.U, _fA.T);
    holdShell.quaternion.setFromRotationMatrix(_m);
    holdGroup.add(holdShell);

    this.group.add(holdGroup);
  }

  _buildForwardHangar() {
    const p = COLOSSUS_PIECES.cargoHangar;
    const hangarGroup = new THREE.Group();
    hangarGroup.name = 'cargo_hangar';

    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const s = THREE.MathUtils.lerp(p.startS, p.endS, i / steps);
      this.track.frame(s, _f);
      _m.makeBasis(_f.R, _f.U, _f.T);

      // Hangar arch portals
      const archGeom = new THREE.TorusGeometry(p.width * 0.46, 3.0, 6, 8);
      const arch = new THREE.Mesh(archGeom, this.innerMat);
      arch.position.copy(_f.pos).addScaledVector(_f.U, 10.0);
      arch.quaternion.setFromRotationMatrix(_m);
      hangarGroup.add(arch);
    }

    // Multi-tiered staging rack towers flanking the hangar walls
    const rackTowers = p.rackTowers || [];
    const containerGeom = new THREE.BoxGeometry(14.0, 9.0, 24.0);
    const uprightGeom = new THREE.BoxGeometry(2.5, 75.0, 2.5);
    const beamGeom = new THREE.BoxGeometry(36.0, 1.8, 2.5);

    for (let i = 0; i < rackTowers.length; i++) {
      const rt = rackTowers[i];
      this.track.frame(rt.s, _f);
      _m.makeBasis(_f.R, _f.U, _f.T);

      const towerGroup = new THREE.Group();
      towerGroup.quaternion.setFromRotationMatrix(_m);

      // Uprights
      const upL = new THREE.Mesh(uprightGeom, this.innerMat);
      upL.position.set(-16.0, rt.height * 0.5, 0);
      towerGroup.add(upL);

      const upR = new THREE.Mesh(uprightGeom, this.innerMat);
      upR.position.set(16.0, rt.height * 0.5, 0);
      towerGroup.add(upR);

      // Staging shelf beams & stacked freight containers
      for (let tier = 1; tier <= 4; tier++) {
        const yBeam = tier * 16.0;
        const beam = new THREE.Mesh(beamGeom, this.innerMat);
        beam.position.set(0, yBeam, 0);
        towerGroup.add(beam);

        // Container in rack
        const cColor = (tier % 2 === 0) ? 0x00d2ff : 0xffaa00;
        const cMesh = new THREE.Mesh(containerGeom, this._getLiveryMaterial(cColor));
        cMesh.position.set(0, yBeam + 5.0, 0);
        towerGroup.add(cMesh);
      }

      // Position tower flanking the track
      const xOffset = rt.side * (56.0 * 0.5 + rt.width * 0.5 + 4.0);
      towerGroup.position.copy(_f.pos).addScaledVector(_f.R, xOffset);
      hangarGroup.add(towerGroup);
    }

    // Running Navigation Strobes along hangar guide rails
    const lightGeom = new THREE.SphereGeometry(1.4, 8, 8);
    for (let i = 0; i < steps; i += 2) {
      const s = THREE.MathUtils.lerp(p.startS, p.endS, i / steps);
      this.track.frame(s, _f);

      // Port Red
      const lightPort = new THREE.Mesh(lightGeom, this.strobeMatRed);
      lightPort.position.copy(_f.pos).addScaledVector(_f.R, -p.width * 0.44).addScaledVector(_f.U, 6.0);
      hangarGroup.add(lightPort);
      this.runningLights.push({ mesh: lightPort, phase: i * 0.7 });

      // Starboard Green
      const lightStbd = new THREE.Mesh(lightGeom, this.strobeMatGreen);
      lightStbd.position.copy(_f.pos).addScaledVector(_f.R, p.width * 0.44).addScaledVector(_f.U, 6.0);
      hangarGroup.add(lightStbd);
      this.runningLights.push({ mesh: lightStbd, phase: i * 0.7 + Math.PI });
    }

    this.group.add(hangarGroup);
  }

  _buildTrenchRun() {
    const p = COLOSSUS_PIECES.trenchRun;
    const trenchGroup = new THREE.Group();
    trenchGroup.name = 'trench_run';

    const wallH = p.wallHeight || 28.0;
    const trackW = 56.0;
    const wallDist = trackW * 0.5 + 4.5;
    const steps = 24;

    const wallSegmentGeom = new THREE.BoxGeometry(6.0, wallH, 80.0);
    const barbetteBaseGeom = new THREE.CylinderGeometry(5.5, 6.5, 4.0, 16);
    const turretHousingGeom = new THREE.BoxGeometry(7.0, 3.5, 9.0);
    const barrelGeom = new THREE.CylinderGeometry(0.55, 0.55, 14.0, 8);
    barrelGeom.rotateX(Math.PI / 2);

    for (let i = 0; i <= steps; i++) {
      const s = THREE.MathUtils.lerp(p.startS, p.endS, i / steps);
      this.track.frame(s, _f);
      _m.makeBasis(_f.R, _f.U, _f.T);

      // Left trench wall
      const wallL = new THREE.Mesh(wallSegmentGeom, this.trenchMat);
      wallL.position.copy(_f.pos).addScaledVector(_f.R, -wallDist).addScaledVector(_f.U, wallH * 0.5);
      wallL.quaternion.setFromRotationMatrix(_m);
      trenchGroup.add(wallL);

      // Right trench wall
      const wallR = new THREE.Mesh(wallSegmentGeom, this.trenchMat);
      wallR.position.copy(_f.pos).addScaledVector(_f.R, wallDist).addScaledVector(_f.U, wallH * 0.5);
      wallR.quaternion.setFromRotationMatrix(_m);
      trenchGroup.add(wallR);

      // Heavy defense turrets up on barbettes along the trench parapet
      if (i % 2 === 0) {
        const side = (i % 4 === 0) ? -1 : 1;
        const barbette = new THREE.Group();
        barbette.quaternion.setFromRotationMatrix(_m);

        // Circular pedestal
        const bBase = new THREE.Mesh(barbetteBaseGeom, this.trenchMat);
        bBase.position.set(0, 2.0, 0);
        barbette.add(bBase);

        // Armored turret housing
        const tHousing = new THREE.Mesh(turretHousingGeom, this.turretMat);
        tHousing.position.set(0, 5.5, 0);
        barbette.add(tHousing);

        // Twin gun barrels elevated skyward into space
        const bL = new THREE.Mesh(barrelGeom, this.barrelMat);
        bL.position.set(-1.8, 6.2, 5.0);
        bL.rotation.x = -0.38; // 22 deg elevation
        barbette.add(bL);

        const bR = new THREE.Mesh(barrelGeom, this.barrelMat);
        bR.position.set(1.8, 6.2, 5.0);
        bR.rotation.x = -0.38;
        barbette.add(bR);

        // Barbette beacon light
        const bBeacon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), this.strobeMatRed);
        bBeacon.position.set(0, 7.8, 0);
        barbette.add(bBeacon);
        this.runningLights.push({ mesh: bBeacon, phase: i * 0.5 });

        // Position on top of trench wall
        barbette.position.copy(_f.pos).addScaledVector(_f.R, side * wallDist).addScaledVector(_f.U, wallH);
        trenchGroup.add(barbette);
      }
    }

    this.group.add(trenchGroup);
  }

  _buildSensorBoom() {
    const p = COLOSSUS_PIECES.sensorBoom;
    const boomGroup = new THREE.Group();

    // 650 m triangular lattice truss boom extending into open void
    const trussGeom = new THREE.CylinderGeometry(1.8, 6.0, p.length, 3, 16);
    trussGeom.rotateX(Math.PI / 2);
    const trussMesh = new THREE.Mesh(trussGeom, this.hullMat);
    trussMesh.position.set(0, 0, p.length * 0.5);
    boomGroup.add(trussMesh);

    // Parabolic Sensor Dishes
    for (const d of p.dishes) {
      const dishGeom = new THREE.SphereGeometry(d.radius, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.4);
      dishGeom.rotateX(-Math.PI / 2);
      const dishMesh = new THREE.Mesh(dishGeom, this.innerMat);
      dishMesh.position.set(0, 4.0, d.dist);
      boomGroup.add(dishMesh);
    }

    this.track.frame(COLOSSUS_PIECES.breachExit.startS, _f);
    const boomOrigin = _f.pos.clone().addScaledVector(_f.R, 45.0).addScaledVector(_f.U, 25.0);
    boomGroup.position.copy(boomOrigin);
    const boomDir = _f.R.clone().multiplyScalar(0.7).addScaledVector(_f.U, 0.4).addScaledVector(_f.T, 0.5).normalize();
    boomGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), boomDir);

    this.group.add(boomGroup);
  }

  _buildOrangeGate() {
    this.track.frame(COLOSSUS_PIECES.engineBell.startS - 100.0, _f);

    const gateGroup = new THREE.Group();
    gateGroup.name = 'derelict_orange_gate';

    // Orange Neon Timing Light Gate (0xff8800)
    const orangeMat = new THREE.MeshBasicMaterial({ color: 0xff8800 });
    const ringGeom = new THREE.TorusGeometry(36.0, 1.4, 8, 24);
    const ringMesh = new THREE.Mesh(ringGeom, orangeMat);
    ringMesh.position.set(0, 12.0, 0);
    gateGroup.add(ringMesh);

    // Emitter pylons
    const pylonGeom = new THREE.BoxGeometry(3.0, 24.0, 3.0);
    const pL = new THREE.Mesh(pylonGeom, this.hullMat);
    pL.position.set(-36.0, 10.0, 0);
    gateGroup.add(pL);

    const pR = new THREE.Mesh(pylonGeom, this.hullMat);
    pR.position.set(36.0, 10.0, 0);
    gateGroup.add(pR);

    _m.makeBasis(_f.R, _f.U, _f.T);
    gateGroup.quaternion.setFromRotationMatrix(_m);
    gateGroup.position.copy(_f.pos);
    this.group.add(gateGroup);
  }

  _buildGraveyard() {
    const yardGroup = new THREE.Group();
    yardGroup.name = 'wreck_graveyard';

    const shardGeom = new THREE.BoxGeometry(26.0, 1.4, 46.0);
    const podGeom = new THREE.CylinderGeometry(8.5, 8.5, 34.0, 8);
    const wingGeom = new THREE.BoxGeometry(4.5, 0.5, 68.0);
    const corvetteGeom = new THREE.ConeGeometry(18.0, 72.0, 6);
    corvetteGeom.rotateX(Math.PI / 2);

    for (let i = 0; i < GRAVEYARD.length; i++) {
      const g = GRAVEYARD[i];
      let geom = shardGeom;
      if (g.type === 'freight_pod') geom = podGeom;
      if (g.type === 'solar_wing') geom = wingGeom;
      if (g.type === 'corvette_hulk') geom = corvetteGeom;

      // Painted escort hulks with authentic faction liveries
      const mat = g.livery ? this._getLiveryMaterial(g.livery) : this.hullMat;
      const mesh = new THREE.Mesh(geom, mat);

      // Locate along track frame at g.s
      this.track.frame(g.s || 23500.0, _f);
      _pos.copy(_f.pos).addScaledVector(_f.R, g.x).addScaledVector(_f.U, g.y).addScaledVector(_f.T, g.z || 0);

      mesh.position.copy(_pos);
      mesh.rotation.set(g.rx, g.ry, g.rz);
      mesh.scale.setScalar(g.scale);
      yardGroup.add(mesh);

      // Lit hulks with active blinking beacon lights drifting in the wake
      if (g.lit) {
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 8), this.strobeMatCyan);
        beacon.position.copy(_pos).addScaledVector(_f.U, 4.0 * g.scale);
        yardGroup.add(beacon);
        this.runningLights.push({ mesh: beacon, phase: i * 0.95 });
      }
    }

    this.group.add(yardGroup);
  }

  _buildSparks() {
    const sparkCount = 250;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(sparkCount * 3);
    const vel = new Float32Array(sparkCount * 3);

    const refCore = (this.corePositions.length > 0) ? this.corePositions[0] : new THREE.Vector3(-3200, 15, 250);

    for (let i = 0; i < sparkCount; i++) {
      const core = (this.corePositions.length > 0)
        ? this.corePositions[i % this.corePositions.length]
        : refCore;

      pos[i * 3] = core.x + (Math.random() - 0.5) * 32.0;
      pos[i * 3 + 1] = core.y + (Math.random() - 0.5) * 22.0;
      pos[i * 3 + 2] = core.z + (Math.random() - 0.5) * 32.0;

      vel[i * 3] = (Math.random() - 0.5) * 35.0;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 35.0;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 35.0;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sparkVel = vel;

    const sparkMat = new THREE.PointsMaterial({
      color: 0xffaa22,
      size: 2.5,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });

    this.sparkPoints = new THREE.Points(geom, sparkMat);
    this.group.add(this.sparkPoints);
  }

  update(dt, camera, shipPos, s) {
    this.time += dt;

    // 1. Animate swaying power cables (gentle sinusoidal pendulum in zero-G vacuum)
    for (let i = 0; i < this.cables.length; i++) {
      const c = this.cables[i];
      c.mesh.rotation.z = Math.sin(this.time * 0.95 + c.phase) * 0.06;
      c.mesh.rotation.x = Math.cos(this.time * 0.65 + c.phase) * 0.03;
    }

    // 2. Animate pulsating reactor core glow
    const pulse = 1.0 + Math.sin(this.time * 3.5) * 0.25;
    for (let i = 0; i < this.reactorMeshes.length; i++) {
      this.reactorMeshes[i].material.emissiveIntensity = 2.0 * pulse;
    }
    for (let i = 0; i < this.reactorLights.length; i++) {
      this.reactorLights[i].intensity = 3.5 * pulse;
    }

    // 3. Strobe running navigation lights & beacons
    for (let i = 0; i < this.runningLights.length; i++) {
      const rl = this.runningLights[i];
      const flash = Math.sin(this.time * 4.2 + rl.phase) > 0.25;
      rl.mesh.visible = flash;
    }

    // 4. Strobe upside-down hold warning beacons
    for (let i = 0; i < this.holdBeacons.length; i++) {
      const hb = this.holdBeacons[i];
      const flash = Math.sin(this.time * 2.8 + hb.phase) > 0.1;
      hb.mesh.visible = flash;
    }

    // 5. Update electrical sparks simulation
    if (this.sparkPoints && this.corePositions.length > 0) {
      const attr = this.sparkPoints.geometry.attributes.position;
      const pos = attr.array;
      const vel = this.sparkVel;
      const count = pos.length / 3;

      for (let i = 0; i < count; i++) {
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;

        const core = this.corePositions[i % this.corePositions.length];
        const dx = pos[i * 3] - core.x;
        const dy = pos[i * 3 + 1] - core.y;
        const dz = pos[i * 3 + 2] - core.z;
        if (dx * dx + dy * dy + dz * dz > 2500) {
          pos[i * 3] = core.x + (Math.random() - 0.5) * 30.0;
          pos[i * 3 + 1] = core.y + (Math.random() - 0.5) * 20.0;
          pos[i * 3 + 2] = core.z + (Math.random() - 0.5) * 30.0;
        }
      }
      attr.needsUpdate = true;
    }
  }
}
