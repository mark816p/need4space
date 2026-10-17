// src/ruins.js — Desert Planet ancient fallen metropolis & colossal stepped pyramids
// Why: Towers of a future that ended: slabs, octagonal shafts, setbacks, fins, glass curtain walls,
// a colossal fallen skyscraper threaded by the track, and two colossal stepped pyramids far NW

import * as THREE from 'three';
import { TRACK_W } from './track.js';

export class DesertRuins {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    this.group.name = 'desert_ruins';

    this._initMaterials();
    this._buildFallenSkyscraper();
    this._buildBuriedTowers();
    this._buildTwinPyramids();

    this.scene.add(this.group);
  }

  _initMaterials() {
    // 1. Weathered Architectural Concrete & Pale Panelling
    this.panelMaterial = new THREE.MeshStandardMaterial({
      color: 0xbaa898,
      roughness: 0.72,
      metalness: 0.12,
      flatShading: false
    });

    // 2. Glass Curtain Wall with sunset interior transmission
    this.glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x223242,
      emissive: 0x442208, // Warm sunset glow from interior
      emissiveIntensity: 0.65,
      roughness: 0.15,
      metalness: 0.75
    });

    // 3. Colossal Pyramids Ancient Megalithic Stone
    this.pyramidMaterial = new THREE.MeshStandardMaterial({
      color: 0x9e7250,
      roughness: 0.92,
      metalness: 0.02,
      flatShading: true
    });
  }

  _buildFallenSkyscraper() {
    // "one fallen across the way, the track straight through its hollow length
    // (floor edges as ribs round the road, windows lit by sunset from inside)"
    const sStart = 4850;
    const sEnd = 5550;
    const sStep = 30.0;
    const count = Math.floor((sEnd - sStart) / sStep);

    const fallenGroup = new THREE.Group();
    fallenGroup.name = 'fallen_skyscraper';

    const halfW = TRACK_W * 0.5;
    const innerW = halfW + 10.0; // 38m half-width = 76m wide interior hollow
    const innerH = 26.0;         // 26m interior clearance above deck
    const wallThick = 4.5;
    const f = {};

    // 1. Structural Floor Ribs encircling the track road
    const ribGeom = new THREE.BoxGeometry(innerW * 2 + wallThick * 2, innerH + wallThick * 2, 6.0);
    // Hollow out center by using 4 perimeter bars for the rib
    const ribGroup = new THREE.Group();

    for (let i = 0; i <= count; i++) {
      const s = sStart + i * sStep;
      this.track.frame(s, f);

      // Create 4 bars: Left column, Right column, Roof lintel, Floor beam
      const frameM = new THREE.Group();

      // Left pillar
      const colL = new THREE.Mesh(new THREE.BoxGeometry(wallThick, innerH + wallThick * 2, 4.0), this.panelMaterial);
      colL.position.set(-innerW - wallThick * 0.5, innerH * 0.5, 0);
      colL.castShadow = true;
      frameM.add(colL);

      // Right pillar
      const colR = new THREE.Mesh(new THREE.BoxGeometry(wallThick, innerH + wallThick * 2, 4.0), this.panelMaterial);
      colR.position.set(innerW + wallThick * 0.5, innerH * 0.5, 0);
      colR.castShadow = true;
      frameM.add(colR);

      // Overhead roof rib
      const roof = new THREE.Mesh(new THREE.BoxGeometry(innerW * 2 + wallThick * 2, wallThick, 4.0), this.panelMaterial);
      roof.position.set(0, innerH + wallThick * 0.5, 0);
      roof.castShadow = true;
      frameM.add(roof);

      // Under deck beam
      const beam = new THREE.Mesh(new THREE.BoxGeometry(innerW * 2 + wallThick * 2, wallThick, 4.0), this.panelMaterial);
      beam.position.set(0, -wallThick * 0.5, 0);
      frameM.add(beam);

      // Position along track
      frameM.position.copy(f.pos);
      frameM.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(f.R, f.U, f.T)
      );
      ribGroup.add(frameM);
    }
    fallenGroup.add(ribGroup);

    // 2. Outer Glass Curtain Walls flanking the hollow tube with sunset illumination
    for (const side of [-1, 1]) {
      const positions = [];
      const uvs = [];
      const indices = [];

      for (let i = 0; i <= count; i++) {
        const s = sStart + i * sStep;
        this.track.frame(s, f);

        const lat = side * (innerW + wallThick);
        const pBot = f.pos.clone().addScaledVector(f.R, lat).addScaledVector(f.U, 0.0);
        const pTop = f.pos.clone().addScaledVector(f.R, lat).addScaledVector(f.U, innerH);

        positions.push(pBot.x, pBot.y, pBot.z);
        positions.push(pTop.x, pTop.y, pTop.z);
        uvs.push(i / count * 16.0, 0.0);
        uvs.push(i / count * 16.0, 1.0);
      }

      for (let i = 0; i < count; i++) {
        const a = i * 2;
        const b = (i + 1) * 2;
        const c = (i + 1) * 2 + 1;
        const d = i * 2 + 1;

        indices.push(a, b, d);
        indices.push(b, c, d);
      }

      const glassGeom = new THREE.BufferGeometry();
      geomSet(glassGeom, positions, uvs, indices);
      const glassMesh = new THREE.Mesh(glassGeom, this.glassMaterial);
      glassMesh.castShadow = true;
      fallenGroup.add(glassMesh);
    }

    this.group.add(fallenGroup);
  }

  _buildBuriedTowers() {
    // "slabs and octagonal shafts with set-backs and fins, glass curtain walls
    // between bands of pale panelling, leaning, tops broken, half buried"
    const towersGroup = new THREE.Group();
    towersGroup.name = 'buried_towers';

    const towerLocs = [
      { x: 1200, z: -1600, w: 75, d: 55, h: 320, lean: 0.12, yaw: 0.4 },
      { x: 1450, z: -1750, w: 60, d: 60, h: 280, lean: -0.15, yaw: 0.9 },
      { x: 950, z: -1850, w: 90, d: 70, h: 380, lean: 0.08, yaw: 0.1 },
      { x: -1600, z: -800, w: 65, d: 65, h: 290, lean: -0.18, yaw: 0.6 },
      { x: -1800, z: -950, w: 80, d: 60, h: 340, lean: 0.14, yaw: 1.2 },
      { x: -1350, z: -650, w: 50, d: 50, h: 260, lean: -0.10, yaw: 0.3 },
      { x: -2100, z: 800, w: 85, d: 70, h: 360, lean: 0.16, yaw: 0.7 },
      { x: -2300, z: 1100, w: 70, d: 55, h: 310, lean: -0.12, yaw: 1.5 }
    ];

    for (const t of towerLocs) {
      const tower = this._createTowerMesh(t);
      towersGroup.add(tower);
    }

    this.group.add(towersGroup);
  }

  _createTowerMesh(t) {
    const group = new THREE.Group();

    // 3 tiered setbacks with architectural fins
    const tiers = 3;
    let curH = 0;
    let curW = t.w;
    let curD = t.d;
    const tierH = t.h / tiers;

    for (let i = 0; i < tiers; i++) {
      // Main octagonal / beveled shaft
      const shaftGeom = new THREE.BoxGeometry(curW, tierH, curD);
      const shaft = new THREE.Mesh(shaftGeom, this.panelMaterial);
      shaft.position.y = curH + tierH * 0.5;
      shaft.castShadow = true;
      shaft.receiveShadow = true;
      group.add(shaft);

      // Aerodynamic exterior fins
      const finGeom = new THREE.BoxGeometry(curW + 12.0, tierH * 0.85, 3.5);
      const fin = new THREE.Mesh(finGeom, this.panelMaterial);
      fin.position.y = curH + tierH * 0.5;
      group.add(fin);

      // Glass bands between panelling
      const glassBandGeom = new THREE.BoxGeometry(curW + 1.5, tierH * 0.35, curD + 1.5);
      const glassBand = new THREE.Mesh(glassBandGeom, this.glassMaterial);
      glassBand.position.y = curH + tierH * 0.5;
      group.add(glassBand);

      curH += tierH;
      curW *= 0.78; // Setback taper
      curD *= 0.78;
    }

    group.position.set(t.x, -25.0, t.z); // Buried in sand
    group.rotation.y = t.yaw;
    group.rotation.z = t.lean; // Leaning tower angle
    return group;
  }

  _buildTwinPyramids() {
    // "two colossal stepped pyramids far NW. Faces carry 'fac' coords."
    const pyramidGroup = new THREE.Group();
    pyramidGroup.name = 'twin_stepped_pyramids';

    // Positioned far northwest
    const pyramidConfigs = [
      { x: -3200, z: 2400, baseW: 580, height: 340, steps: 7 },
      { x: -2300, z: 3200, baseW: 460, height: 280, steps: 6 }
    ];

    for (const cfg of pyramidConfigs) {
      const geom = this._createSteppedPyramidGeometry(cfg.baseW, cfg.height, cfg.steps);
      const mesh = new THREE.Mesh(geom, this.pyramidMaterial);
      mesh.position.set(cfg.x, -10, cfg.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pyramidGroup.add(mesh);
    }

    this.group.add(pyramidGroup);
  }

  _createSteppedPyramidGeometry(baseW, height, steps) {
    const stepH = height / steps;
    const positions = [];
    const normals = [];
    const uvs = [];
    const facCoords = []; // Custom 'fac' face coordinates as required by spec!
    const indices = [];

    let curY = 0;
    let curW = baseW;

    for (let s = 0; s < steps; s++) {
      const nextW = baseW * (1.0 - (s + 1) / steps * 0.85);

      // Step tier box
      const halfW = curW * 0.5;
      const y0 = curY;
      const y1 = curY + stepH;

      // 4 vertical walls of the step
      const corners = [
        [-halfW, -halfW],
        [halfW, -halfW],
        [halfW, halfW],
        [-halfW, halfW]
      ];

      for (let f = 0; f < 4; f++) {
        const c0 = corners[f];
        const c1 = corners[(f + 1) % 4];
        const vStart = positions.length / 3;

        positions.push(c0[0], y0, c0[1]);
        positions.push(c1[0], y0, c1[1]);
        positions.push(c1[0], y1, c1[1]);
        positions.push(c0[0], y1, c0[1]);

        uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

        // 'fac' coordinates: face coordinate (u, v) normalized per step face
        facCoords.push(0, 0, 1, 0, 1, 1, 0, 1);

        indices.push(vStart, vStart + 1, vStart + 2);
        indices.push(vStart, vStart + 2, vStart + 3);
      }

      // Step horizontal ledge
      const halfNext = nextW * 0.5;
      const vLedge = positions.length / 3;

      positions.push(-halfW, y1, -halfW);
      positions.push(halfW, y1, -halfW);
      positions.push(halfW, y1, halfW);
      positions.push(-halfW, y1, halfW);

      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      facCoords.push(0, 0, 1, 0, 1, 1, 0, 1);

      indices.push(vLedge, vLedge + 1, vLedge + 2);
      indices.push(vLedge, vLedge + 2, vLedge + 3);

      curY = y1;
      curW = nextW;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    // Provide 'fac' coords as Float32BufferAttribute
    geom.setAttribute('fac', new THREE.Float32BufferAttribute(facCoords, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }
}

function geomSet(geom, pos, uv, ind) {
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geom.setIndex(ind);
  geom.computeVertexNormals();
}
