// src/sandstone.js — Desert Planet layered sandstone geology (mesas, buttes, arches, gorge walls)
// Why: Beds of deep red/orange/cream and purple shale running level across all formations,
// caprock ledges, desert-varnish streaks, sand on upward faces, mesas, fluted cliffs, and great arches

import * as THREE from 'three';
import { TRACK_W } from './track.js';

export class SandstoneGeology {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    this.group.name = 'sandstone_geology';

    this._initMaterials();
    this._buildCanyonGorgeWalls();
    this._buildMesasAndButtes();
    this._buildGreatArches();

    this.scene.add(this.group);
  }

  _initMaterials() {
    // Procedural Layered Sandstone Material
    // Bands run level across world Y with red/orange/cream/purple shale beds
    this.sandstoneMaterial = new THREE.MeshStandardMaterial({
      color: 0xc86438,
      roughness: 0.88,
      metalness: 0.04,
      flatShading: false
    });

    this.sandstoneMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = `
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        ${shader.vertexShader}
      `.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        `
      );

      shader.fragmentShader = `
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        ${shader.fragmentShader}
      `.replace(
        '#include <dithering_fragment>',
        `
        #include <dithering_fragment>

        // Level horizontal geological strata from world Y position
        float y = vWorldPos.y;

        // Bed thickness variation using non-linear sinusoids
        float bedIndex = y * 0.12 + sin(y * 0.04) * 2.2;
        float bedFine = sin(y * 1.8) * 0.5 + 0.5; // Fine laminations

        // Palette: deep red, solar orange, cream sandstone, purple shale
        vec3 deepRed = vec3(0.62, 0.22, 0.15);
        vec3 solarOrange = vec3(0.82, 0.42, 0.20);
        vec3 creamSand = vec3(0.88, 0.74, 0.55);
        vec3 purpleShale = vec3(0.38, 0.18, 0.24);

        // Stratified color selection
        float s = fract(bedIndex);
        vec3 bedCol;
        if (s < 0.38) {
          bedCol = mix(deepRed, solarOrange, s / 0.38);
        } else if (s < 0.62) {
          bedCol = mix(solarOrange, creamSand, (s - 0.38) / 0.24);
        } else if (s < 0.78) {
          bedCol = mix(creamSand, deepRed, (s - 0.62) / 0.16);
        } else {
          // Occasional purple shale beds
          bedCol = mix(deepRed, purpleShale, (s - 0.78) / 0.22);
        }

        // Sub-laminations within beds
        bedCol *= (0.92 + 0.16 * bedFine);

        // Desert varnish: dark iron/manganese stains on sheer cliff faces
        float steepness = 1.0 - abs(vWorldNormal.y);
        float varnish = pow(clamp(steepness, 0.0, 1.0), 4.0) * (sin(vWorldPos.x * 0.1 + vWorldPos.z * 0.1) * 0.5 + 0.5);
        bedCol = mix(bedCol, vec3(0.18, 0.12, 0.10), varnish * 0.45);

        // Sand accumulation wherever a face looks up
        if (vWorldNormal.y > 0.45) {
          float sandAmount = smoothstep(0.45, 0.85, vWorldNormal.y);
          bedCol = mix(bedCol, vec3(0.88, 0.68, 0.44), sandAmount * 0.85);
        }

        gl_FragColor.rgb = mix(gl_FragColor.rgb, bedCol, 0.75);
        `
      );
    };
  }

  _buildCanyonGorgeWalls() {
    // Layered sandstone gorge walls flanking canyon stretches
    const gorgeGroup = new THREE.Group();
    gorgeGroup.name = 'canyon_gorge_walls';

    // Canyon sectors: s ~ 800 to 2150 (before Jump 1), and s ~ 6800 to 9350 (before Jump 2)
    const gorgeSpans = [
      { start: 800, end: 2150, baseWidth: 68.0, height: 110.0 },
      { start: 6800, end: 9350, baseWidth: 72.0, height: 140.0 }
    ];

    const f = {};
    const halfW = TRACK_W * 0.5;

    for (const span of gorgeSpans) {
      const sStep = 32.0;
      const count = Math.floor((span.end - span.start) / sStep);

      for (const side of [-1, 1]) {
        const positions = [];
        const uvs = [];
        const indices = [];

        for (let i = 0; i <= count; i++) {
          const s = span.start + i * sStep;
          this.track.frame(s, f);

          // "gorge walls only ever widening"
          const prog = i / count;
          const widen = 1.0 + prog * 0.45;
          const latDist = side * (halfW + 6.0 + span.baseWidth * 0.5 * widen);

          // Fluted cliff noise
          const flute = Math.sin(s * 0.06) * 3.5 + Math.cos(s * 0.15) * 1.5;

          // Wall profile vertices: base in sand, bench, cliff top
          const pBase = f.pos.clone().addScaledVector(f.R, latDist + flute).addScaledVector(f.U, -15.0);
          const pMid = f.pos.clone().addScaledVector(f.R, latDist * 1.08 + flute).addScaledVector(f.U, span.height * 0.45);
          const pTop = f.pos.clone().addScaledVector(f.R, latDist * 1.25 + flute * 0.5).addScaledVector(f.U, span.height);
          const pBack = f.pos.clone().addScaledVector(f.R, latDist * 2.2).addScaledVector(f.U, span.height - 4.0);

          positions.push(pBase.x, pBase.y, pBase.z);
          positions.push(pMid.x, pMid.y, pMid.z);
          positions.push(pTop.x, pTop.y, pTop.z);
          positions.push(pBack.x, pBack.y, pBack.z);

          uvs.push(prog * 8.0, 0.0);
          uvs.push(prog * 8.0, 0.35);
          uvs.push(prog * 8.0, 0.85);
          uvs.push(prog * 8.0, 1.0);
        }

        // Connect quads
        for (let i = 0; i < count; i++) {
          for (let j = 0; j < 3; j++) {
            const a = i * 4 + j;
            const b = (i + 1) * 4 + j;
            const c = (i + 1) * 4 + (j + 1);
            const d = i * 4 + (j + 1);

            if (side > 0) {
              indices.push(a, b, d);
              indices.push(b, c, d);
            } else {
              indices.push(a, d, b);
              indices.push(b, d, c);
            }
          }
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geom.setIndex(indices);
        geom.computeVertexNormals();

        const wallMesh = new THREE.Mesh(geom, this.sandstoneMaterial);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        gorgeGroup.add(wallMesh);
      }
    }

    this.group.add(gorgeGroup);
  }

  _buildMesasAndButtes() {
    // Mesas and Buttes: wobbly outline, caprock cliff, bench, fluted main cliff, talus skirt
    const mesaGroup = new THREE.Group();
    mesaGroup.name = 'mesas_and_buttes';

    // 16 iconic mesas and buttes positioned across the desert
    const mesaConfigs = [
      { x: 1800, z: 1200, r: 240, h: 180 },
      { x: 2600, z: -400, r: 320, h: 220 },
      { x: 2200, z: -1800, r: 260, h: 195 },
      { x: 800, z: -2800, r: 290, h: 210 },
      { x: -900, z: -2900, r: 350, h: 240 },
      { x: -2500, z: -1800, r: 280, h: 200 },
      { x: -2900, z: 200, r: 340, h: 230 },
      { x: -2200, z: 1900, r: 270, h: 185 },
      { x: -800, z: 2700, r: 310, h: 215 },
      { x: 800, z: 2600, r: 250, h: 190 },
      // Smaller sharp buttes
      { x: 1200, z: -800, r: 140, h: 160 },
      { x: -1400, z: -1000, r: 150, h: 175 },
      { x: -1600, z: 1000, r: 130, h: 165 },
      { x: 1400, z: 1600, r: 160, h: 170 },
      { x: -400, z: -1800, r: 120, h: 150 },
      { x: 400, z: 1800, r: 135, h: 155 }
    ];

    for (const cfg of mesaConfigs) {
      const geom = this._createMesaGeometry(cfg.r, cfg.h);
      const mesh = new THREE.Mesh(geom, this.sandstoneMaterial);
      mesh.position.set(cfg.x, 0, cfg.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesaGroup.add(mesh);
    }

    this.group.add(mesaGroup);
  }

  _createMesaGeometry(radius, height) {
    // 6 profile rings: Talus base, Talus top, Fluted cliff base, Bench, Caprock cliff, Flat summit
    const rings = 6;
    const segments = 24;
    const positions = [];
    const uvs = [];
    const indices = [];

    // Profile definitions: [relativeRadius, relativeHeight]
    const profile = [
      [1.65, -10.0],          // 0: Talus skirt sunk in dunes
      [1.35, height * 0.28],  // 1: Talus top slope
      [1.05, height * 0.35],  // 2: Bench shelf
      [1.00, height * 0.78],  // 3: Fluted cliff top
      [0.92, height * 0.88],  // 4: Caprock ledge
      [0.85, height]          // 5: Summit plateau
    ];

    for (let r = 0; r < rings; r++) {
      const [rScale, h] = profile[r];
      for (let s = 0; s <= segments; s++) {
        const theta = (s / segments) * Math.PI * 2.0;

        // Wobbly outline modulation
        const wobble = 1.0 + Math.sin(theta * 3.0) * 0.08 + Math.cos(theta * 7.0) * 0.04;
        const curR = radius * rScale * wobble;

        // Fluted erosion noise on vertical cliff rings (r == 3 or 4)
        const fluting = (r >= 2 && r <= 4) ? Math.sin(theta * 18.0) * (radius * 0.035) : 0;

        const x = Math.sin(theta) * (curR + fluting);
        const z = Math.cos(theta) * (curR + fluting);
        const y = h;

        positions.push(x, y, z);
        uvs.push(s / segments, r / (rings - 1));
      }
    }

    // Connect rings
    for (let r = 0; r < rings - 1; r++) {
      for (let s = 0; s < segments; s++) {
        const a = r * (segments + 1) + s;
        const b = (r + 1) * (segments + 1) + s;
        const c = (r + 1) * (segments + 1) + (s + 1);
        const d = r * (segments + 1) + (s + 1);

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    // Flat caprock summit disk
    const topCenterIdx = positions.length / 3;
    positions.push(0, height, 0);
    uvs.push(0.5, 0.5);

    const summitRingStart = (rings - 1) * (segments + 1);
    for (let s = 0; s < segments; s++) {
      indices.push(topCenterIdx, summitRingStart + s, summitRingStart + s + 1);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  _buildGreatArches() {
    // Natural Arches: a tube swept along an arc soaring over the track
    const archGroup = new THREE.Group();
    archGroup.name = 'great_sandstone_arches';

    // The Great Arch spans over s ~ 6400 (The Great Sandstone Arch sector)
    const archS = [3200, 6400, 11200];
    const f = {};

    for (const s of archS) {
      this.track.frame(s, f);

      const spanW = 140.0;
      const archH = 95.0;
      const tubeR = 14.0;
      const numSteps = 24;
      const radSteps = 10;

      const positions = [];
      const uvs = [];
      const indices = [];

      for (let i = 0; i <= numSteps; i++) {
        const t = (i / numSteps) * Math.PI; // Arc from 0 to PI
        const lat = Math.cos(t) * (spanW * 0.5);
        const h = Math.sin(t) * archH;

        // Arch center point
        const cPos = f.pos.clone().addScaledVector(f.R, lat).addScaledVector(f.U, h);

        // Tangent along arch arc
        const tArc = new THREE.Vector3()
          .addScaledVector(f.R, -Math.sin(t))
          .addScaledVector(f.U, Math.cos(t))
          .normalize();
        const normalArc = new THREE.Vector3().crossVectors(tArc, f.T).normalize();

        for (let j = 0; j <= radSteps; j++) {
          const phi = (j / radSteps) * Math.PI * 2.0;
          // Organic wobble on tube
          const wobble = 1.0 + Math.sin(phi * 3.0 + t * 4.0) * 0.15;
          const r = tubeR * wobble;

          const p = cPos.clone()
            .addScaledVector(f.T, Math.cos(phi) * r)
            .addScaledVector(normalArc, Math.sin(phi) * r);

          positions.push(p.x, p.y, p.z);
          uvs.push(i / numSteps * 4.0, j / radSteps);
        }
      }

      for (let i = 0; i < numSteps; i++) {
        for (let j = 0; j < radSteps; j++) {
          const a = i * (radSteps + 1) + j;
          const b = (i + 1) * (radSteps + 1) + j;
          const c = (i + 1) * (radSteps + 1) + (j + 1);
          const d = i * (radSteps + 1) + (j + 1);

          indices.push(a, b, d);
          indices.push(b, c, d);
        }
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geom.setIndex(indices);
      geom.computeVertexNormals();

      const archMesh = new THREE.Mesh(geom, this.sandstoneMaterial);
      archMesh.castShadow = true;
      archMesh.receiveShadow = true;
      archGroup.add(archMesh);
    }

    this.group.add(archGroup);
  }
}
