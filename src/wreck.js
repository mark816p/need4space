// src/wreck.js — Derelict v1 3D Colossus construction: Engine Bell, Reactor Hall, The Break, and Graveyard
// Why: "sparks, warm reactors, swaying cables, sensor boom; an orange gate before it, a pad between the halves, running lights"
// "track passes through bell/hall with correct darkness; ships' lights on; no light floating in the void"

import * as THREE from 'three';
import { COLOSSUS_LOCATION, COLOSSUS_PIECES, GRAVEYARD } from './wreckplan.js';
import { getChamberDarkness, getReactorWarmth, isDarkChamber } from './wreckzones.js';

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
    this.time = 0;
    this.core1Pos = new THREE.Vector3();
    this.core2Pos = new THREE.Vector3();

    // Build the Colossus structural sections
    this._buildMaterials();
    this._buildEngineBell();
    this._buildReactorHall();
    this._buildTheBreak();
    this._buildForwardHangar();
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

    // Pulsating warm reactor core
    this.reactorMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff3300,
      emissiveIntensity: 2.2,
      roughness: 0.3,
      metalness: 0.2
    });

    // Navigation strobe lenses
    this.strobeMatRed = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    this.strobeMatGreen = new THREE.MeshBasicMaterial({ color: 0x22ff44 });
    this.strobeMatAmber = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  }

  _buildEngineBell() {
    const fBell = {};
    this.track.frame(COLOSSUS_PIECES.engineBell.startS, fBell);

    const bellGroup = new THREE.Group();
    const len = COLOSSUS_PIECES.engineBell.length;
    const rMouth = COLOSSUS_PIECES.engineBell.mouthRadius;
    const rThroat = COLOSSUS_PIECES.engineBell.throatRadius;

    // Truncated conical bell nozzle
    const geom = new THREE.CylinderGeometry(rThroat, rMouth, len, 32, 8, true);
    geom.rotateX(Math.PI / 2);
    const bellMesh = new THREE.Mesh(geom, this.bellMat);
    bellMesh.position.set(0, 0, len * 0.5);
    bellGroup.add(bellMesh);

    // Reinforcement cooling rings along bell exterior
    for (let i = 0; i < 6; i++) {
      const frac = i / 5.0;
      const ringR = THREE.MathUtils.lerp(rMouth, rThroat, frac) + 1.2;
      const ringGeom = new THREE.TorusGeometry(ringR, 1.8, 8, 32);
      const ringMesh = new THREE.Mesh(ringGeom, this.hullMat);
      ringMesh.position.set(0, 0, frac * len);
      bellGroup.add(ringMesh);
    }

    const m = new THREE.Matrix4().makeBasis(fBell.R, fBell.U, fBell.T);
    bellGroup.quaternion.setFromRotationMatrix(m);
    bellGroup.position.copy(fBell.pos);
    this.group.add(bellGroup);
  }

  _buildReactorHall() {
    const p = COLOSSUS_PIECES.reactorHall;
    const fStart = {};
    const fEnd = {};
    this.track.frame(p.startS, fStart);
    this.track.frame(p.endS, fEnd);

    const steps = 14;
    const f = {};
    const hallGroup = new THREE.Group();

    // Ribbed tubular octagonal chamber sweeping along track frames
    for (let i = 0; i <= steps; i++) {
      const s = THREE.MathUtils.lerp(p.startS, p.endS, i / steps);
      this.track.frame(s, f);

      const m = new THREE.Matrix4().makeBasis(f.R, f.U, f.T);
      const ringGeom = new THREE.TorusGeometry(p.width * 0.5, 3.2, 8, 8);
      const ring = new THREE.Mesh(ringGeom, this.innerMat);
      ring.position.copy(f.pos).addScaledVector(f.U, 12.0);
      ring.quaternion.setFromRotationMatrix(m);
      hallGroup.add(ring);
    }

    // Outer octagonal hull shell
    const shellGeom = new THREE.CylinderGeometry(p.width * 0.52, p.width * 0.52, p.length, 8, 4, true);
    shellGeom.rotateX(Math.PI / 2);
    const shellMesh = new THREE.Mesh(shellGeom, this.hullMat);
    const midPos = fStart.pos.clone().lerp(fEnd.pos, 0.5).addScaledVector(fStart.U, 12.0);
    shellMesh.position.copy(midPos);
    const mMid = new THREE.Matrix4().makeBasis(fStart.R, fStart.U, fStart.T);
    shellMesh.quaternion.setFromRotationMatrix(mMid);
    hallGroup.add(shellMesh);

    // Twin Reactor Cores (Torus magnetic confinement rings with warm emission)
    // Anchored directly to track frames inside the hall (Zero floating light in the void!)
    const fCore1 = {};
    this.track.frame(p.startS + 200.0, fCore1);
    this.core1Pos.copy(fCore1.pos).addScaledVector(fCore1.U, 24.0);

    const fCore2 = {};
    this.track.frame(p.startS + 500.0, fCore2);
    this.core2Pos.copy(fCore2.pos).addScaledVector(fCore2.U, 24.0);

    const coreGeom = new THREE.TorusGeometry(p.core1.radius, 6.0, 16, 32);
    const coreMesh1 = new THREE.Mesh(coreGeom, this.reactorMat);
    coreMesh1.position.copy(this.core1Pos);
    hallGroup.add(coreMesh1);
    this.reactorMeshes.push(coreMesh1);

    const coreMesh2 = new THREE.Mesh(coreGeom, this.reactorMat);
    coreMesh2.position.copy(this.core2Pos);
    hallGroup.add(coreMesh2);
    this.reactorMeshes.push(coreMesh2);

    // Warm reactor point lights fixed strictly inside the hall (Zero floating light in the void!)
    const rLight1 = new THREE.PointLight(0xff5500, 3.5, 180, 1.8);
    rLight1.position.copy(this.core1Pos);
    hallGroup.add(rLight1);
    this.reactorLights.push(rLight1);

    const rLight2 = new THREE.PointLight(0xff4400, 3.5, 180, 1.8);
    rLight2.position.copy(this.core2Pos);
    hallGroup.add(rLight2);
    this.reactorLights.push(rLight2);

    // Swaying Heavy Power Cables
    this._buildSwayingCables(hallGroup, p);

    this.group.add(hallGroup);
  }

  _buildSwayingCables(parentGroup, p) {
    for (let i = 0; i < 5; i++) {
      const s = p.startS + 120.0 + i * 110.0;
      const fCable = {};
      this.track.frame(s, fCable);
      const m = new THREE.Matrix4().makeBasis(fCable.R, fCable.U, fCable.T);
      const halfW = p.width * 0.42;
      const sag = 15.0 + i * 1.5;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-halfW, 26, 0),
        new THREE.Vector3(0, 26 - sag, 0),
        new THREE.Vector3(halfW, 26, 0)
      );
      const geom = new THREE.TubeGeometry(curve, 16, 0.85, 6, false);
      const mesh = new THREE.Mesh(geom, this.innerMat);
      mesh.quaternion.setFromRotationMatrix(m);
      mesh.position.copy(fCable.pos);
      parentGroup.add(mesh);
      this.cables.push({ mesh, phase: i * 1.2 });
    }
  }

  _buildTheBreak() {
    const p = COLOSSUS_PIECES.theBreak;
    const fGap0 = {};
    const fGap1 = {};
    this.track.frame(p.gapStartS, fGap0);
    this.track.frame(p.gapEndS, fGap1);

    const breakGroup = new THREE.Group();

    // Shattered hull plates curling outward at fracture lip A
    const tearGeomA = new THREE.BoxGeometry(COLOSSUS_PIECES.reactorHall.width * 1.1, p.platingCurl * 1.5, 8.0);
    const tearMeshA = new THREE.Mesh(tearGeomA, this.hullMat);
    tearMeshA.position.copy(fGap0.pos).addScaledVector(fGap0.U, 18.0).addScaledVector(fGap0.T, -6.0);
    tearMeshA.rotation.x = -0.35;
    breakGroup.add(tearMeshA);

    // Shattered hull plates curling outward at fracture lip B
    const tearMeshB = new THREE.Mesh(tearGeomA, this.hullMat);
    tearMeshB.position.copy(fGap1.pos).addScaledVector(fGap1.U, 18.0).addScaledVector(fGap1.T, 6.0);
    tearMeshB.rotation.x = 0.35;
    breakGroup.add(tearMeshB);

    // Exposed sheared ring frames sticking out into the vacuum gap
    for (let k = -2; k <= 2; k++) {
      const sparGeom = new THREE.BoxGeometry(2.2, 24.0, 2.2);
      const sparA = new THREE.Mesh(sparGeom, this.innerMat);
      sparA.position.copy(fGap0.pos).addScaledVector(fGap0.R, k * 22.0).addScaledVector(fGap0.U, 12.0);
      sparA.rotation.z = k * 0.15;
      breakGroup.add(sparA);

      const sparB = new THREE.Mesh(sparGeom, this.innerMat);
      sparB.position.copy(fGap1.pos).addScaledVector(fGap1.R, k * 22.0).addScaledVector(fGap1.U, 12.0);
      sparB.rotation.z = -k * 0.15;
      breakGroup.add(sparB);
    }

    this.group.add(breakGroup);
  }

  _buildForwardHangar() {
    const p = COLOSSUS_PIECES.cargoHangar;
    const fStart = {};
    const fEnd = {};
    this.track.frame(p.startS, fStart);
    this.track.frame(p.endS, fEnd);

    const hangarGroup = new THREE.Group();
    const f = {};
    const steps = 12;

    // Hangar bays and ribbed bulkheads
    for (let i = 0; i <= steps; i++) {
      const s = THREE.MathUtils.lerp(p.startS, p.endS, i / steps);
      this.track.frame(s, f);

      const m = new THREE.Matrix4().makeBasis(f.R, f.U, f.T);
      const ringGeom = new THREE.TorusGeometry(p.width * 0.48, 2.8, 6, 8);
      const ring = new THREE.Mesh(ringGeom, this.innerMat);
      ring.position.copy(f.pos).addScaledVector(f.U, 10.0);
      ring.quaternion.setFromRotationMatrix(m);
      hangarGroup.add(ring);
    }

    // Running Navigation Strobes along hull frames
    for (let i = 0; i < p.runningLights.length; i++) {
      const l = p.runningLights[i];
      const mat = l.color === 0xff2222 ? this.strobeMatRed : (l.color === 0x22ff44 ? this.strobeMatGreen : this.strobeMatAmber);
      const lightMesh = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 8), mat);
      lightMesh.position.copy(fStart.pos).addScaledVector(fStart.R, l.x * 0.8).addScaledVector(fStart.U, l.y * 0.8).addScaledVector(fStart.T, l.z * 0.8);
      hangarGroup.add(lightMesh);
      this.runningLights.push({ mesh: lightMesh, phase: i * 0.8 });
    }

    this.group.add(hangarGroup);
  }

  _buildSensorBoom() {
    const p = COLOSSUS_PIECES.sensorBoom;
    const boomGroup = new THREE.Group();

    // 450 m triangular lattice truss boom extending into open void
    const trussGeom = new THREE.CylinderGeometry(1.6, 5.5, p.length, 3, 16);
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

    const fExit = {};
    this.track.frame(COLOSSUS_PIECES.breachExit.startS, fExit);
    const boomOrigin = fExit.pos.clone().addScaledVector(fExit.R, 45.0).addScaledVector(fExit.U, 25.0);
    boomGroup.position.copy(boomOrigin);
    const boomDir = fExit.R.clone().multiplyScalar(0.7).addScaledVector(fExit.U, 0.4).addScaledVector(fExit.T, 0.5).normalize();
    boomGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), boomDir);

    this.group.add(boomGroup);
  }

  _buildOrangeGate() {
    const fGate = {};
    this.track.frame(COLOSSUS_PIECES.engineBell.startS - 100.0, fGate);

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

    const m = new THREE.Matrix4().makeBasis(fGate.R, fGate.U, fGate.T);
    gateGroup.quaternion.setFromRotationMatrix(m);
    gateGroup.position.copy(fGate.pos);
    this.group.add(gateGroup);
  }

  _buildGraveyard() {
    const yardGroup = new THREE.Group();
    yardGroup.name = 'wreck_graveyard';

    const shardGeom = new THREE.BoxGeometry(24.0, 1.2, 42.0);
    const podGeom = new THREE.CylinderGeometry(8.0, 8.0, 32.0, 8);
    const wingGeom = new THREE.BoxGeometry(4.0, 0.4, 65.0);

    for (let i = 0; i < GRAVEYARD.length; i++) {
      const g = GRAVEYARD[i];
      let geom = shardGeom;
      if (g.type === 'freight_pod') geom = podGeom;
      if (g.type === 'solar_wing') geom = wingGeom;

      const mesh = new THREE.Mesh(geom, this.hullMat);
      mesh.position.set(g.x, g.y, g.z);
      mesh.rotation.set(g.rx, g.ry, g.rz);
      mesh.scale.setScalar(g.scale);
      yardGroup.add(mesh);
    }

    this.group.add(yardGroup);
  }

  _buildSparks() {
    // 250 particle electrical arc sparks leaping from ruptured reactor conduit junctions
    const sparkCount = 250;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(sparkCount * 3);
    const vel = new Float32Array(sparkCount * 3);

    for (let i = 0; i < sparkCount; i++) {
      const core = (i % 2 === 0) ? this.core1Pos : this.core2Pos;
      pos[i * 3] = core.x + (Math.random() - 0.5) * 30.0;
      pos[i * 3 + 1] = core.y + (Math.random() - 0.5) * 20.0;
      pos[i * 3 + 2] = core.z + (Math.random() - 0.5) * 30.0;

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
    for (const rMesh of this.reactorMeshes) {
      if (rMesh.material) {
        rMesh.material.emissiveIntensity = 2.0 * pulse;
      }
    }
    for (const rLight of this.reactorLights) {
      rLight.intensity = 3.5 * pulse;
    }

    // 3. Strobe running navigation lights
    for (let i = 0; i < this.runningLights.length; i++) {
      const rl = this.runningLights[i];
      const flash = (Math.sin(this.time * 4.0 + rl.phase) > 0.3) ? 1.0 : 0.15;
      if (rl.mesh.material) {
        rl.mesh.visible = flash > 0.5;
      }
    }

    // 4. Update electrical sparks simulation
    if (this.sparkPoints) {
      const attr = this.sparkPoints.geometry.attributes.position;
      const pos = attr.array;
      const vel = this.sparkVel;
      const count = pos.length / 3;

      for (let i = 0; i < count; i++) {
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;

        // Reset if drifted too far from reactor core
        const core = (i % 2 === 0) ? this.core1Pos : this.core2Pos;
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
