// src/cave.js — Forest Moon hollow hill 2 km cave system
// Why: "the cave 2 km through a hollow hill — in under its own way out, a cavern with a waterfall into a lake
// and a jump over a chasm, a crystal throat, a hall of stalactites, the jungle's roots, giant fungi, a river,
// a fissure, sinkholes of daylight; dressing culled by stretch; the hall's columns a slalom (every 55 m)"

import * as THREE from 'three';
import { TRACK_W } from './track.js';

export const CAVE_START_S = 4200.0;
export const CAVE_END_S = 6200.0;
export const CAVE_LENGTH = CAVE_END_S - CAVE_START_S; // 2000.0 m

// Fast deterministic 3D noise for organic rock surface displacement
function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) & 0x7fffffff) / 0x7fffffff;
}

function noise3D(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uy = fy * fy * (3.0 - 2.0 * fy);
  const uz = fz * fz * (3.0 - 2.0 * fz);

  const n000 = hash3(ix, iy, iz);
  const n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz);
  const n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1);
  const n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1);
  const n111 = hash3(ix + 1, iy + 1, iz + 1);

  const x00 = n000 + ux * (n100 - n000);
  const x10 = n010 + ux * (n110 - n010);
  const x01 = n001 + ux * (n101 - n001);
  const x11 = n011 + ux * (n111 - n011);

  const y0 = x00 + uy * (x10 - x00);
  const y1 = x01 + uy * (x11 - x01);

  return y0 + uz * (y1 - y0);
}

export class ForestCave {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    this.group.name = 'forest_cave_system';

    this.startS = CAVE_START_S;
    this.endS = CAVE_END_S;

    // Chamber definitions along the 2 km run
    this.chambers = [
      { id: 'glowworm', name: 'Glowworm Gallery', s0: 4200, s1: 4450 },
      { id: 'waterfall', name: 'Waterfall Cavern & Chasm', s0: 4450, s1: 4750 },
      { id: 'crystals', name: 'Crystal Throat', s0: 4750, s1: 5000 },
      { id: 'stalactites', name: 'Stalactite Hall & Slalom', s0: 5000, s1: 5300 },
      { id: 'roots', name: 'Overhead Jungle Roots', s0: 5300, s1: 5550 },
      { id: 'fungi', name: 'Giant Fungi Forest', s0: 5550, s1: 5800 },
      { id: 'river', name: 'Subterranean River', s0: 5800, s1: 6000 },
      { id: 'fissure', name: 'Fissure & Sinkholes', s0: 6000, s1: 6200 },
    ];

    // Sinkhole locations along track s
    this.sinkholes = [
      { s: 6060, radius: 24.0, height: 90.0 },
      { s: 6140, radius: 28.0, height: 110.0 }
    ];

    this._initMaterials();
    this._buildContinuousTube();
    this._buildHollowHillIsland();
    this._buildChamberDressings();

    this.scene.add(this.group);
  }

  _initMaterials() {
    // 1. Wet cavern rock with mineral veins
    this.caveRockMat = new THREE.MeshStandardMaterial({
      color: 0x22252a,
      roughness: 0.86,
      metalness: 0.12,
      side: THREE.BackSide, // Viewed from inside the tube
    });

    // 2. Hollow hill exterior rock cliffs
    this.hillCliffMat = new THREE.MeshStandardMaterial({
      color: 0x3d4239,
      roughness: 0.92,
      metalness: 0.06,
      side: THREE.FrontSide
    });

    // 3. Subterranean dark lake and river water
    this.caveWaterMat = new THREE.MeshStandardMaterial({
      color: 0x071e22,
      roughness: 0.12,
      metalness: 0.85,
      transparent: true,
      opacity: 0.88
    });

    // 4. Waterfall sheet material
    this.waterfallMat = new THREE.MeshBasicMaterial({
      color: 0xaef5ea,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide
    });

    // 5. Crystalline quartz/amethyst geode material
    this.crystalMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.9,
      roughness: 0.15,
      metalness: 0.35,
      transparent: true,
      opacity: 0.92
    });

    // 6. Giant bioluminescent fungi caps and gills
    this.fungiCapMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.8,
      roughness: 0.65,
      metalness: 0.1
    });

    this.fungiGillMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide
    });

    // 7. Hanging twisted jungle roots
    this.rootMat = new THREE.MeshStandardMaterial({
      color: 0x3e2c1e,
      roughness: 0.94,
      metalness: 0.05
    });

    // 8. Daylight sinkhole beam shafts
    this.sunShaftMat = new THREE.MeshBasicMaterial({
      color: 0xfff6dd,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false
    });
  }

  // Evaluates cavern tube cross-section radii [rx, ry] at track arc-length s
  _getSectionRadius(s) {
    let rx = 38.0;
    let ry = 22.0;

    if (s < 4450) {
      // Glowworm gallery: intimate arched passage
      rx = 36.0;
      ry = 18.0;
    } else if (s < 4750) {
      // Waterfall cavern: massive grand cathedral cavern
      const f = (s - 4450) / 300.0;
      const w = Math.sin(f * Math.PI);
      rx = 36.0 + 26.0 * w;
      ry = 18.0 + 22.0 * w; // Reaches 40m high ceiling
    } else if (s < 5000) {
      // Crystal throat: narrowing jagged passage
      rx = 33.5;
      ry = 14.5;
    } else if (s < 5300) {
      // Stalactite hall: wide high hall with columns slalom
      rx = 48.0;
      ry = 28.0;
    } else if (s < 5550) {
      // Roots overhead
      rx = 40.0;
      ry = 20.0;
    } else if (s < 5800) {
      // Fungi forest
      rx = 44.0;
      ry = 24.0;
    } else if (s < 6000) {
      // River bend
      rx = 45.0;
      ry = 22.0;
    } else {
      // Fissure & sinkholes opening to the sky
      const f = (s - 6000) / 200.0;
      rx = 36.0 + 8.0 * (1.0 - f);
      ry = 26.0 + 28.0 * f; // Height stretches up toward sinkhole openings
    }

    // Ensure strict clearance of deck and energy barrier:
    // Deck half-width is 28m, field height is 5.0m
    rx = Math.max(rx, TRACK_W * 0.5 + 4.5); // min 32.5m
    ry = Math.max(ry, 12.0); // min 12m overhead clearance
    return { rx, ry };
  }

  // 1. Single continuous tube swept along the track for 2 km
  _buildContinuousTube() {
    const s0 = this.startS;
    const s1 = this.endS;
    const step = 20.0; // 20m longitudinal resolution = 101 slices
    const numSlices = Math.round((s1 - s0) / step) + 1;
    const radialSegs = 24;

    const positions = [];
    const uvs = [];
    const indices = [];

    const _f = {};
    for (let i = 0; i < numSlices; i++) {
      const s = Math.min(s1, s0 + i * step);
      this.track.frame(s, _f);

      const { rx, ry } = this._getSectionRadius(s);
      const isMouth = (i === 0 || i === numSlices - 1);
      const mouthScale = isMouth ? 1.45 : 1.0;

      for (let j = 0; j < radialSegs; j++) {
        const phi = (j / radialSegs) * Math.PI * 2.0;
        const cosP = Math.cos(phi);
        const sinP = Math.sin(phi);

        // Elliptical cross section in track's local R, U frame
        let localX = cosP * rx * mouthScale;
        let localY = sinP * ry * mouthScale;

        // Lift floor slightly under deck and add world-space 3D noise for craggy rock
        if (localY < -ry * 0.4) {
          localY = Math.max(localY, -ry * 0.65);
        }

        const worldP = _f.pos.clone()
          .addScaledVector(_f.R, localX)
          .addScaledVector(_f.U, localY);

        // Add 3D noise displaced outward away from track center
        const n = noise3D(worldP.x * 0.025, worldP.y * 0.025, worldP.z * 0.025);
        const disp = (n - 0.4) * 5.0;
        worldP.addScaledVector(_f.R, cosP * disp);
        worldP.addScaledVector(_f.U, sinP * disp);

        positions.push(worldP.x, worldP.y, worldP.z);
        uvs.push((s - s0) / 100.0, j / radialSegs);
      }
    }

    // Build triangle index buffer
    for (let i = 0; i < numSlices - 1; i++) {
      for (let j = 0; j < radialSegs; j++) {
        const nextJ = (j + 1) % radialSegs;
        const a = i * radialSegs + j;
        const b = (i + 1) * radialSegs + j;
        const c = (i + 1) * radialSegs + nextJ;
        const d = i * radialSegs + nextJ;

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const tubeMesh = new THREE.Mesh(geo, this.caveRockMat);
    tubeMesh.name = 'cave_swept_tube';
    this.group.add(tubeMesh);
  }

  // 2. Hollow Hill Island terrain enclosing the cave
  _buildHollowHillIsland() {
    // Generate an island whose outline is drawn round the cave:
    // Cliffs open where mouths are, top open at sinkholes
    const hillGeo = new THREE.BufferGeometry();
    const positions = [];
    const uvs = [];
    const indices = [];

    const numSlices = 26;
    const radialSegs = 20;
    const hillStep = (this.endS - this.startS) / (numSlices - 1);

    const _f = {};
    for (let i = 0; i < numSlices; i++) {
      const s = this.startS + i * hillStep;
      this.track.frame(s, _f);

      const fMouth = (i === 0 || i === numSlices - 1) ? 0.3 : 1.0;
      const hillR = 95.0 + 35.0 * Math.sin((i / numSlices) * Math.PI) * fMouth;

      for (let j = 0; j < radialSegs; j++) {
        const phi = (j / radialSegs) * Math.PI * 2.0;
        const cosP = Math.cos(phi);
        const sinP = Math.sin(phi);

        let localX = cosP * hillR;
        let localY = sinP * (hillR * 0.7) + 20.0;

        // At sinkhole locations, pull vertices inward to create open shafts
        for (const sink of this.sinkholes) {
          if (Math.abs(s - sink.s) < sink.radius * 1.5 && sinP > 0.6) {
            localY -= 25.0; // Open roof dip
          }
        }

        const worldP = _f.pos.clone()
          .addScaledVector(_f.R, localX)
          .addScaledVector(_f.U, localY);

        const n = noise3D(worldP.x * 0.015, worldP.y * 0.015, worldP.z * 0.015);
        worldP.x += (n - 0.5) * 14.0;
        worldP.y += (n - 0.5) * 10.0;
        worldP.z += (n - 0.5) * 14.0;

        positions.push(worldP.x, worldP.y, worldP.z);
        uvs.push(i / numSlices, j / radialSegs);
      }
    }

    for (let i = 0; i < numSlices - 1; i++) {
      for (let j = 0; j < radialSegs; j++) {
        const nextJ = (j + 1) % radialSegs;
        const a = i * radialSegs + j;
        const b = (i + 1) * radialSegs + j;
        const c = (i + 1) * radialSegs + nextJ;
        const d = i * radialSegs + nextJ;

        indices.push(a, d, b);
        indices.push(b, d, c);
      }
    }

    hillGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    hillGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    hillGeo.setIndex(indices);
    hillGeo.computeVertexNormals();

    const hillMesh = new THREE.Mesh(hillGeo, this.hillCliffMat);
    hillMesh.name = 'hollow_hill_island';
    this.group.add(hillMesh);
  }

  // 3. Chamber dressings across all 8 sectors
  _buildChamberDressings() {
    this._buildGlowworms();
    this._buildWaterfallAndLake();
    this._buildCrystalThroat();
    this._buildStalactiteSlalom();
    this._buildOverheadRoots();
    this._buildGiantFungi();
    this._buildSubterraneanRiver();
    this._buildSinkholeBeams();
  }

  // Chamber 1: Glowworm gallery
  _buildGlowworms() {
    const numGlow = 450;
    const positions = new Float32Array(numGlow * 3);
    const colors = new Float32Array(numGlow * 3);

    const _f = {};
    for (let i = 0; i < numGlow; i++) {
      const s = 4220 + Math.random() * 210;
      this.track.frame(s, _f);

      const phi = (Math.PI * 0.15) + Math.random() * (Math.PI * 0.7); // Ceiling arc
      const rx = 34.0 + Math.random() * 2.0;
      const ry = 16.0 + Math.random() * 2.5;

      const p = _f.pos.clone()
        .addScaledVector(_f.R, Math.cos(phi) * rx)
        .addScaledVector(_f.U, Math.sin(phi) * ry);

      positions[i * 3 + 0] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;

      // Soft bioluminescent cyan to lime green
      const mint = Math.random() > 0.4;
      colors[i * 3 + 0] = mint ? 0.2 : 0.05;
      colors[i * 3 + 1] = mint ? 0.95 : 0.85;
      colors[i * 3 + 2] = mint ? 0.65 : 0.95;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const pMat = new THREE.PointsMaterial({
      size: 4.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });

    const glowPoints = new THREE.Points(geo, pMat);
    glowPoints.name = 'cave_glowworms';
    this.group.add(glowPoints);
  }

  // Chamber 2: Waterfall cavern, subterranean lake, and chasm jump
  _buildWaterfallAndLake() {
    const sFall = 4600.0;
    const _f = {};
    this.track.frame(sFall, _f);

    // Lake surface below track deck
    const lakeGeo = new THREE.PlaneGeometry(160, 260, 16, 16);
    const lakeMesh = new THREE.Mesh(lakeGeo, this.caveWaterMat);
    lakeMesh.rotation.x = -Math.PI * 0.5;
    lakeMesh.position.copy(_f.pos).addScaledVector(_f.U, -26.0);
    lakeMesh.name = 'cave_subterranean_lake';
    this.group.add(lakeMesh);

    // Waterfall sheet crashing from high cavern wall into the lake
    const fallTop = _f.pos.clone().addScaledVector(_f.R, -48.0).addScaledVector(_f.U, 32.0);
    const fallBottom = _f.pos.clone().addScaledVector(_f.R, -42.0).addScaledVector(_f.U, -26.0);

    const fallGeo = new THREE.PlaneGeometry(28, 64, 8, 16);
    const fallMesh = new THREE.Mesh(fallGeo, this.waterfallMat);
    fallMesh.position.copy(fallTop).lerp(fallBottom, 0.5);
    fallMesh.lookAt(_f.pos);
    fallMesh.name = 'cave_waterfall_sheet';
    this.group.add(fallMesh);
  }

  // Chamber 3: Crystal throat (sharp, faceted crystal clusters)
  _buildCrystalThroat() {
    const crystalGeo = new THREE.ConeGeometry(3.5, 14.0, 5);
    const crystalGroup = new THREE.Group();
    crystalGroup.name = 'cave_crystal_clusters';

    const _f = {};
    for (let s = 4760; s <= 4980; s += 22) {
      this.track.frame(s, _f);

      // Flanked on both left and right rock walls
      for (const side of [-1, 1]) {
        const numInCluster = 3 + Math.floor(Math.random() * 3);
        const clusterBase = _f.pos.clone()
          .addScaledVector(_f.R, side * 31.0)
          .addScaledVector(_f.U, -2.0 + Math.random() * 12.0);

        for (let k = 0; k < numInCluster; k++) {
          const crystalMesh = new THREE.Mesh(crystalGeo, this.crystalMat);
          crystalMesh.position.copy(clusterBase).add(new THREE.Vector3(
            (Math.random() - 0.5) * 4.0,
            (Math.random() - 0.5) * 4.0,
            (Math.random() - 0.5) * 4.0
          ));
          crystalMesh.rotation.set(
            (Math.random() - 0.5) * 0.8,
            (Math.random() - 0.5) * 0.8,
            side * (0.6 + Math.random() * 0.4)
          );
          crystalGroup.add(crystalMesh);
        }
      }
    }

    this.group.add(crystalGroup);
  }

  // Chamber 4: Stalactite hall & columns slalom
  // "the hall's columns a slalom (one by the way every 55 m, alternating sides)"
  _buildStalactiteSlalom() {
    const slalomGroup = new THREE.Group();
    slalomGroup.name = 'cave_slalom_columns';

    // Massive column geometry (stalactite merged with stalagmite)
    const colGeo = new THREE.CylinderGeometry(3.8, 5.2, 54.0, 10);
    const colMat = new THREE.MeshStandardMaterial({
      color: 0x33373e,
      roughness: 0.88,
      metalness: 0.1
    });

    const _f = {};
    let sideToggle = -1; // Alternating left (-1) and right (+1)
    const clearanceX = TRACK_W * 0.5 + 4.2; // 32.2m from track center line

    for (let s = 5020; s <= 5280; s += 55.0) {
      this.track.frame(s, _f);

      const colMesh = new THREE.Mesh(colGeo, colMat);
      colMesh.position.copy(_f.pos)
        .addScaledVector(_f.R, sideToggle * clearanceX)
        .addScaledVector(_f.U, 4.0);

      // Align column roughly to track normal
      colMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _f.U);
      slalomGroup.add(colMesh);

      sideToggle *= -1; // Alternate side for the next column 55m down
    }

    this.group.add(slalomGroup);
  }

  // Chamber 5: Giant twisted jungle roots overhead
  _buildOverheadRoots() {
    const rootsGroup = new THREE.Group();
    rootsGroup.name = 'cave_overhead_roots';

    const _f = {};
    for (let s = 5320; s <= 5530; s += 30.0) {
      this.track.frame(s, _f);

      // Arching thick root tube spanning overhead
      const rootCurve = new THREE.CatmullRomCurve3([
        _f.pos.clone().addScaledVector(_f.R, -36.0).addScaledVector(_f.U, 24.0),
        _f.pos.clone().addScaledVector(_f.R, -14.0).addScaledVector(_f.U, 17.0),
        _f.pos.clone().addScaledVector(_f.R, 8.0).addScaledVector(_f.U, 19.0),
        _f.pos.clone().addScaledVector(_f.R, 36.0).addScaledVector(_f.U, 23.0),
      ]);

      const rootGeo = new THREE.TubeGeometry(rootCurve, 16, 2.8, 8, false);
      const rootMesh = new THREE.Mesh(rootGeo, this.rootMat);
      rootsGroup.add(rootMesh);
    }

    this.group.add(rootsGroup);
  }

  // Chamber 6: Giant bioluminescent fungi forest
  _buildGiantFungi() {
    const fungiGroup = new THREE.Group();
    fungiGroup.name = 'cave_giant_fungi';

    const stemGeo = new THREE.CylinderGeometry(1.2, 1.8, 14.0, 8);
    const capGeo = new THREE.ConeGeometry(8.5, 3.8, 12);

    const _f = {};
    for (let s = 5570; s <= 5780; s += 28.0) {
      this.track.frame(s, _f);

      for (const side of [-1, 1]) {
        const stem = new THREE.Mesh(stemGeo, this.rootMat);
        const cap = new THREE.Mesh(capGeo, this.fungiCapMat);

        const base = _f.pos.clone()
          .addScaledVector(_f.R, side * 34.0)
          .addScaledVector(_f.U, 2.0 + Math.random() * 8.0);

        stem.position.copy(base);
        stem.rotation.z = side * 0.25;

        cap.position.copy(base).addScaledVector(_f.U, 7.5);
        cap.rotation.z = side * 0.25;

        fungiGroup.add(stem);
        fungiGroup.add(cap);
      }
    }

    this.group.add(fungiGroup);
  }

  // Chamber 7: Subterranean river inside bend
  _buildSubterraneanRiver() {
    const riverGeo = new THREE.BufferGeometry();
    const positions = [];
    const uvs = [];
    const indices = [];

    const numRiverSlices = 20;
    const riverStep = 200.0 / (numRiverSlices - 1);
    const riverWidth = 14.0;

    const _f = {};
    for (let i = 0; i < numRiverSlices; i++) {
      const s = 5800.0 + i * riverStep;
      this.track.frame(s, _f);

      // Placed inside the bend on the left (R * -32m)
      const riverCenter = _f.pos.clone()
        .addScaledVector(_f.R, -32.0)
        .addScaledVector(_f.U, -8.0);

      const pLeft = riverCenter.clone().addScaledVector(_f.R, -riverWidth * 0.5);
      const pRight = riverCenter.clone().addScaledVector(_f.R, riverWidth * 0.5);

      positions.push(pLeft.x, pLeft.y, pLeft.z);
      positions.push(pRight.x, pRight.y, pRight.z);

      uvs.push(0, i / numRiverSlices);
      uvs.push(1, i / numRiverSlices);
    }

    for (let i = 0; i < numRiverSlices - 1; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;

      indices.push(a, c, b);
      indices.push(b, c, d);
    }

    riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    riverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    riverGeo.setIndex(indices);
    riverGeo.computeVertexNormals();

    const riverMesh = new THREE.Mesh(riverGeo, this.caveWaterMat);
    riverMesh.name = 'cave_subterranean_river';
    this.group.add(riverMesh);
  }

  // Chamber 8: Daylight sinkhole beams
  _buildSinkholeBeams() {
    const beamsGroup = new THREE.Group();
    beamsGroup.name = 'cave_sinkhole_beams';

    const _f = {};
    for (const sink of this.sinkholes) {
      this.track.frame(sink.s, _f);

      const shaftGeo = new THREE.CylinderGeometry(sink.radius * 0.7, sink.radius * 1.3, sink.height, 16, 1, true);
      const shaftMesh = new THREE.Mesh(shaftGeo, this.sunShaftMat);

      shaftMesh.position.copy(_f.pos).addScaledVector(_f.U, sink.height * 0.5);
      shaftMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _f.U);

      beamsGroup.add(shaftMesh);
    }

    this.group.add(beamsGroup);
  }

  // Lighting query: returns darkness, inside state, and sinkhole daylight bleed
  inCave(s) {
    if (s < this.startS - 100 || s > this.endS + 100) {
      return { inside: false, darkness: 0.0, sinkhole: 0.0 };
    }

    let darkness = 1.0;

    // Mouth fade in / fade out
    if (s < this.startS + 120) {
      darkness = Math.max(0.0, Math.min(1.0, (s - (this.startS - 60)) / 180.0));
    } else if (s > this.endS - 140) {
      darkness = Math.max(0.0, Math.min(1.0, ((this.endS + 60) - s) / 200.0));
    }

    // Check sinkhole shafts of daylight
    let sinkhole = 0.0;
    for (const sink of this.sinkholes) {
      const dist = Math.abs(s - sink.s);
      if (dist < sink.radius * 1.6) {
        const factor = 1.0 - (dist / (sink.radius * 1.6));
        sinkhole = Math.max(sinkhole, factor * 0.85);
      }
    }

    return {
      inside: true,
      darkness: Math.max(0.0, darkness * (1.0 - sinkhole * 0.8)),
      sinkhole
    };
  }

  update(dt, time) {
    // Gentle animation for bioluminescent water and crystal glimmer
  }
}
