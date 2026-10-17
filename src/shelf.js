// src/shelf.js — Ice Planet glacier shelf, crevasse slot, bergs, and steam geysers
// Why: A ~270m thick glacier slab split top-to-bottom by the crevasse, with leaning walls,
// sky slit, under-deck water slot, ice bridges, calving cliffs, frozen falls, and faceted bergs

import * as THREE from 'three';
import { TRACK_W } from './track.js';

export class IceShelf {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    this.group.name = 'ice_shelf_system';

    // Southern crevasse span along Ice Track (s ~ 6800 to 9200)
    this.sStart = 6800;
    this.sEnd = 9200;
    this.shelfHeight = 270.0; // 270 m thick glacier slab

    this._initMaterials();
    this._buildShelfSurfaces();
    this._buildIceBridges();
    this._buildIceNeedles();
    this._buildCalvingCliffsAndFalls();
    this._buildFacetedBergs();
    this._buildSteamGeysers();

    this.scene.add(this.group);
  }

  _initMaterials() {
    // 1. Glacier Blue Banded Ice with light veins & meltwater scallops
    this.iceMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a82b8,
      emissive: 0x08243c,
      roughness: 0.18,
      metalness: 0.08,
      flatShading: false,
      side: THREE.DoubleSide
    });

    this.iceMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
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
        uniform float uTime;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        ${shader.fragmentShader}
      `.replace(
        '#include <dithering_fragment>',
        `
        #include <dithering_fragment>

        // Strata banding along world Y (~270m thick glacier)
        float strata = sin(vWorldPos.y * 0.18) * 0.5 + 0.5;
        float strataFine = sin(vWorldPos.y * 0.65 + sin(vWorldPos.x * 0.05) * 2.0) * 0.5 + 0.5;
        vec3 deepBlue = vec3(0.04, 0.22, 0.42);
        vec3 azureIce = vec3(0.18, 0.62, 0.88);
        vec3 lightVein = vec3(0.55, 0.92, 1.0);

        // Seams of light along strata
        float veinMask = smoothstep(0.88, 0.98, strataFine) * (1.0 - smoothstep(240.0, 275.0, vWorldPos.y));
        vec3 iceCol = mix(deepBlue, azureIce, strata * 0.6 + 0.4);
        iceCol += lightVein * veinMask * 0.75;

        // Slot under the deck lit from water far below (cyan glow upward)
        if (vWorldPos.y < 15.0) {
          float waterGlow = clamp((15.0 - vWorldPos.y) / 25.0, 0.0, 1.0);
          iceCol += vec3(0.0, 0.55, 0.8) * waterGlow * 1.2;
        }

        // Meltwater scallop perturbation
        float scallop = sin(vWorldPos.x * 0.2 + vWorldPos.z * 0.2) * cos(vWorldPos.y * 0.15);
        iceCol += vec3(0.06, 0.12, 0.18) * scallop;

        gl_FragColor.rgb = mix(gl_FragColor.rgb, iceCol, 0.65);
        `
      );
      this.iceShader = shader;
    };

    // 2. Ice Bridges & Needles Crystalline Material
    this.crystalMaterial = new THREE.MeshStandardMaterial({
      color: 0x88e5ff,
      emissive: 0x145577,
      roughness: 0.1,
      metalness: 0.15,
      transparent: true,
      opacity: 0.92
    });

    // 3. Frozen Waterfall Material
    this.fallsMaterial = new THREE.MeshStandardMaterial({
      color: 0xa8f0ff,
      emissive: 0x1a6688,
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.88
    });
  }

  _buildShelfSurfaces() {
    // "each half of the shelf is one surface (face swept up from under the sea ice
    // to a rounded lip, lip's inner ring closed as top: same vertices, no seam)."
    const sStep = 24.0;
    const numS = Math.floor((this.sEnd - this.sStart) / sStep);
    const halfW = TRACK_W * 0.5;

    // Cross-section profile offsets: [lateralOffset, yOffset]
    // 0: Deep slot bottom under deck (-20m below deck, close to water, width 14m)
    // 1: Crevasse wall just below deck
    // 2: Crevasse wall just beside barrier (+4m off barrier)
    // 3: Mid wall climbing, beginning to lean inward
    // 4: Upper wall leaning in overhead towards sky slit
    // 5: Inner rounded lip overhead
    // 6: Top plateau outer edge (~800m back)
    // 7: Calving cliff edge dropping down into sea
    // 8: Calving cliff base at sea level

    const profileLeft = [
      [-7.0, -22.0],              // 0: slot floor at water
      [-(halfW + 2.0), -4.0],     // 1: slot under deck
      [-(halfW + 4.5), 6.0],      // 2: beside barriers
      [-(halfW + 1.0), 90.0],     // 3: mid wall
      [-16.0, 210.0],             // 4: leaning in overhead
      [-9.0, 270.0],              // 5: rounded lip at sky slit
      [-850.0, 265.0],            // 6: shelf top plateau
      [-1200.0, 255.0],           // 7: calving cliff top
      [-1250.0, -10.0]            // 8: calving cliff base at sea
    ];

    const profileRight = [
      [7.0, -22.0],
      [halfW + 2.0, -4.0],
      [halfW + 4.5, 6.0],
      [halfW + 1.0, 90.0],
      [16.0, 210.0],
      [9.0, 270.0],
      [850.0, 265.0],
      [1200.0, 255.0],
      [1250.0, -10.0]
    ];

    const geomLeft = this._sweepProfile(profileLeft, numS, sStep);
    const geomRight = this._sweepProfile(profileRight, numS, sStep);

    const meshLeft = new THREE.Mesh(geomLeft, this.iceMaterial);
    const meshRight = new THREE.Mesh(geomRight, this.iceMaterial);
    meshLeft.name = 'shelf_left';
    meshRight.name = 'shelf_right';
    meshLeft.castShadow = true;
    meshLeft.receiveShadow = true;
    meshRight.castShadow = true;
    meshRight.receiveShadow = true;

    this.group.add(meshLeft);
    this.group.add(meshRight);
  }

  _sweepProfile(profile, numS, sStep) {
    const P = profile.length;
    const vertexCount = (numS + 1) * P;
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices = [];

    const f = {};
    let vIdx = 0;
    let uvIdx = 0;

    for (let i = 0; i <= numS; i++) {
      const s = this.sStart + i * sStep;
      this.track.frame(s, f);

      // Scalloped noise modulation along crevasse
      const wave = Math.sin(s * 0.04) * 2.5 + Math.cos(s * 0.015) * 3.5;

      for (let j = 0; j < P; j++) {
        const [lat, yRel] = profile[j];
        const actualLat = lat + (j >= 2 && j <= 5 ? wave : 0);

        // Position in world space: f.pos + R * actualLat + U * yRel
        const x = f.pos.x + f.R.x * actualLat + f.U.x * yRel;
        const y = f.pos.y + f.R.y * actualLat + f.U.y * yRel;
        const z = f.pos.z + f.R.z * actualLat + f.U.z * yRel;

        positions[vIdx * 3] = x;
        positions[vIdx * 3 + 1] = y;
        positions[vIdx * 3 + 2] = z;

        uvs[uvIdx * 2] = (s - this.sStart) / (this.sEnd - this.sStart) * 16.0;
        uvs[uvIdx * 2 + 1] = j / (P - 1);

        vIdx++;
        uvIdx++;
      }
    }

    // Connect quads
    for (let i = 0; i < numS; i++) {
      for (let j = 0; j < P - 1; j++) {
        const a = i * P + j;
        const b = (i + 1) * P + j;
        const c = (i + 1) * P + (j + 1);
        const d = i * P + (j + 1);

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  _buildIceBridges() {
    // Crystalline ice bridges spanning overhead between the crevasse lips
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'ice_bridges';

    const bridgeS = [7200, 7650, 8100, 8550, 8950];
    const f = {};

    for (const s of bridgeS) {
      this.track.frame(s, f);
      // Span across overhead slit (~18m to 30m wide)
      const spanW = 28.0;
      const bridgeGeom = new THREE.BoxGeometry(spanW, 8.0, 14.0, 4, 2, 2);

      // Arc curvature in bridge
      const posAttr = bridgeGeom.attributes.position;
      for (let k = 0; k < posAttr.count; k++) {
        const lx = posAttr.getX(k);
        const arch = Math.cos((lx / (spanW * 0.5)) * (Math.PI * 0.5)) * 4.5;
        posAttr.setY(k, posAttr.getY(k) + arch);
      }
      bridgeGeom.computeVertexNormals();

      const bridgeMesh = new THREE.Mesh(bridgeGeom, this.crystalMaterial);
      // Place ~240m above deck near the overhead lips
      const bridgePos = f.pos.clone().addScaledVector(f.U, 245.0);
      bridgeMesh.position.copy(bridgePos);
      bridgeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), f.R);
      bridgeGroup.add(bridgeMesh);
    }

    this.group.add(bridgeGroup);
  }

  _buildIceNeedles() {
    // Sharp icicles and ice needles flanking the track along the crevasse walls
    const needleGroup = new THREE.Group();
    needleGroup.name = 'ice_needles';

    const needleGeom = new THREE.ConeGeometry(1.6, 22.0, 5);
    needleGeom.rotateX(Math.PI); // Point downward

    const f = {};
    const halfW = TRACK_W * 0.5;

    for (let s = this.sStart + 80; s < this.sEnd - 80; s += 70) {
      this.track.frame(s, f);
      // Left and right needle clusters
      for (const side of [-1, 1]) {
        const clusterCount = 3 + Math.floor(Math.sin(s) * 2);
        for (let c = 0; c < clusterCount; c++) {
          const m = new THREE.Mesh(needleGeom, this.crystalMaterial);
          const lat = side * (halfW + 3.5 + c * 2.0);
          const h = 18.0 + (c % 3) * 6.0;
          const pos = f.pos.clone()
            .addScaledVector(f.R, lat)
            .addScaledVector(f.U, h)
            .addScaledVector(f.T, (c - 1) * 4.0);
          m.position.copy(pos);
          m.scale.set(0.8 + c * 0.2, 0.7 + (c % 2) * 0.5, 0.8 + c * 0.2);
          needleGroup.add(m);
        }
      }
    }

    this.group.add(needleGroup);
  }

  _buildCalvingCliffsAndFalls() {
    // Frozen falls cascading down the outer calving face
    const fallsGroup = new THREE.Group();
    fallsGroup.name = 'frozen_falls';

    const f = {};
    const cliffFallS = [7100, 7800, 8400, 9000];

    for (const s of cliffFallS) {
      this.track.frame(s, f);
      // Place on outer western/eastern cliff edge
      for (const side of [-1, 1]) {
        const fallGeom = new THREE.CylinderGeometry(12.0, 32.0, 240.0, 8, 12, true);
        const m = new THREE.Mesh(fallGeom, this.fallsMaterial);
        const pos = f.pos.clone()
          .addScaledVector(f.R, side * 1200.0)
          .addScaledVector(f.U, 120.0);
        m.position.copy(pos);
        fallsGroup.add(m);
      }
    }

    this.group.add(fallsGroup);
  }

  _buildFacetedBergs() {
    // "faceted bergs in front of its western face"
    const bergGroup = new THREE.Group();
    bergGroup.name = 'faceted_bergs';

    // Procedural faceted tabular and tilted icebergs
    const bergMats = [this.iceMaterial, this.crystalMaterial];
    const f = {};

    for (let i = 0; i < 18; i++) {
      const s = this.sStart + 200 + i * 110;
      this.track.frame(s, f);

      const radius = 60.0 + (i % 5) * 25.0;
      const height = 45.0 + (i % 4) * 20.0;
      const geom = new THREE.DodecahedronGeometry(radius, 0);

      // Deform and flatten to create realistic tabular faceted bergs
      const p = geom.attributes.position;
      for (let k = 0; k < p.count; k++) {
        let vy = p.getY(k);
        let vx = p.getX(k);
        let vz = p.getZ(k);
        vy *= height / radius;
        if (vy < -10.0) vy = -15.0; // Sea line flat base
        p.setXYZ(k, vx, vy, vz);
      }
      geom.computeVertexNormals();

      const mat = bergMats[i % 2];
      const bergMesh = new THREE.Mesh(geom, mat);

      // Position in front of the western shelf face (negative lateral offset ~1400 - 2200m)
      const latOffset = -1400.0 - (i % 6) * 160.0;
      const bergPos = f.pos.clone()
        .addScaledVector(f.R, latOffset)
        .addScaledVector(f.T, ((i % 3) - 1) * 80.0);
      bergPos.y = 8.0 + (i % 3) * 6.0; // Floating in broken sea ice

      bergMesh.position.copy(bergPos);
      bergMesh.rotation.y = i * 1.35;
      bergMesh.rotation.z = ((i % 4) - 2) * 0.08; // Slight tilt
      bergGroup.add(bergMesh);
    }

    this.group.add(bergGroup);
  }

  _buildSteamGeysers() {
    // Steam geysers: plumes of geothermal steam venting through cracks in sea ice
    this.geysers = [];
    const geyserGroup = new THREE.Group();
    geyserGroup.name = 'steam_geysers';

    const halfW = TRACK_W * 0.5;
    const geyserCount = 12;
    const f = {};

    for (let i = 0; i < geyserCount; i++) {
      const s = this.sStart + 150 + i * 180;
      this.track.frame(s, f);

      // Particle system for each steam geyser
      const pCount = 60;
      const geom = new THREE.BufferGeometry();
      const pos = new Float32Array(pCount * 3);
      const sizes = new Float32Array(pCount);
      const phases = new Float32Array(pCount);

      for (let p = 0; p < pCount; p++) {
        pos[p * 3] = (Math.random() - 0.5) * 12.0;
        pos[p * 3 + 1] = Math.random() * 90.0;
        pos[p * 3 + 2] = (Math.random() - 0.5) * 12.0;
        sizes[p] = 16.0 + Math.random() * 24.0;
        phases[p] = Math.random();
      }

      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      const mat = new THREE.PointsMaterial({
        color: 0xccf0ff,
        size: 32.0,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const plume = new THREE.Points(geom, mat);
      const side = (i % 2 === 0 ? 1 : -1);
      const lat = side * (halfW + 35.0 + (i % 3) * 20.0);
      const gPos = f.pos.clone().addScaledVector(f.R, lat);
      gPos.y = 0.0; // Sea level vent
      plume.position.copy(gPos);

      geyserGroup.add(plume);
      this.geysers.push({ mesh: plume, geom, phases, speed: 28.0 + (i % 4) * 8.0 });
    }

    this.group.add(geyserGroup);
  }

  update(dt) {
    if (this.iceShader && this.iceShader.uniforms.uTime) {
      this.iceShader.uniforms.uTime.value += dt;
    }

    // Animate steam geysers rising
    if (this.geysers) {
      for (const g of this.geysers) {
        const posAttr = g.geom.attributes.position;
        const count = posAttr.count;
        for (let i = 0; i < count; i++) {
          let y = posAttr.getY(i) + g.speed * dt;
          if (y > 110.0) {
            y = 0.0;
            posAttr.setX(i, (Math.random() - 0.5) * 8.0);
            posAttr.setZ(i, (Math.random() - 0.5) * 8.0);
          } else {
            // Expansion with altitude
            posAttr.setX(i, posAttr.getX(i) + (Math.random() - 0.5) * 1.5 * dt);
            posAttr.setZ(i, posAttr.getZ(i) + (Math.random() - 0.5) * 1.5 * dt);
          }
          posAttr.setY(i, y);
        }
        posAttr.needsUpdate = true;
      }
    }
  }

  inCrevasse(s) {
    return s >= this.sStart && s <= this.sEnd;
  }
}
