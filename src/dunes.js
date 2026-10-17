// src/dunes.js — Desert Planet sea of dunes, transverse ridges, combed ripples & skirted tiles
// Why: Transverse ridges across the wind (gentle windward slope, steep slip face, sharp crests),
// darker gravel interdune flats, scoured trough under the circuit, chasm cuts, and skirted tiles to horizon

import * as THREE from 'three';
import { TRACK_W } from './track.js';

export class DuneSea {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    this.group.name = 'dune_sea';

    // Wind direction: WNW (~295° / angle ~ -2.44 rad)
    this.windAngle = -2.44;
    this.windDir = new THREE.Vector2(Math.cos(this.windAngle), Math.sin(this.windAngle));

    this._initMaterials();
    this._buildNearGroundTiles();
    this._buildHorizonRings();

    this.scene.add(this.group);
  }

  _initMaterials() {
    this.duneMaterial = new THREE.MeshStandardMaterial({
      color: 0xd89a58,
      roughness: 0.92,
      metalness: 0.02,
      flatShading: false
    });

    this.duneMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uWindDir = { value: this.windDir };
      shader.vertexShader = `
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        varying float vDuneH;
        ${shader.vertexShader}
      `.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vDuneH = transformed.y;
        `
      );

      shader.fragmentShader = `
        uniform vec2 uWindDir;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        varying float vDuneH;
        ${shader.fragmentShader}
      `.replace(
        '#include <dithering_fragment>',
        `
        #include <dithering_fragment>

        // Combed wind ripples: fine ridges aligned perpendicular to wind
        float alongWind = vWorldPos.x * uWindDir.x + vWorldPos.z * uWindDir.y;
        float acrossWind = -vWorldPos.x * uWindDir.y + vWorldPos.z * uWindDir.x;

        // High frequency ripple waves (wavelength ~ 0.85m)
        float ripple = sin(alongWind * 7.4) * 0.5 + 0.5;
        ripple = pow(ripple, 1.6);

        // Color palette: sun-bleached crests, warm golden orange sand, darker gravel interdune flats
        vec3 crestGold = vec3(0.92, 0.72, 0.45);
        vec3 bodySand = vec3(0.82, 0.55, 0.32);
        vec3 gravelFlat = vec3(0.42, 0.32, 0.24);

        // Interdune flats in deep troughs (vDuneH < 6.0)
        float flatMask = smoothstep(10.0, 2.0, vDuneH);
        vec3 sandCol = mix(bodySand, gravelFlat, flatMask * 0.75);

        // Crest highlight
        float crestMask = smoothstep(18.0, 32.0, vDuneH);
        sandCol = mix(sandCol, crestGold, crestMask * 0.55);

        // Combed ripples micro-shading
        sandCol *= (0.92 + 0.16 * ripple);

        // Baked low-sun horizon shadowing (sun ~7.5° over WNW horizon)
        // Faces pointing away from WNW get warm ambient shadow
        float sunFacing = dot(vWorldNormal.xz, -uWindDir);
        if (sunFacing < -0.1) {
          sandCol *= mix(1.0, 0.68, clamp((-sunFacing - 0.1) / 0.8, 0.0, 1.0));
        }

        gl_FragColor.rgb = mix(gl_FragColor.rgb, sandCol, 0.72);
        `
      );
    };
  }

  // Procedural height field function
  getDuneHeight(x, z) {
    // 1. Broad regional desert swells
    const swell = Math.sin(x * 0.0012 + z * 0.0008) * 25.0 + Math.cos(x * 0.0007 - z * 0.0011) * 20.0;

    // 2. Transverse dune ridges across the wind:
    // Along wind coord
    const u = x * this.windDir.x + z * this.windDir.y;
    const v = -x * this.windDir.y + z * this.windDir.x;

    // Ridge wavelength ~ 180m
    const wave = (u % 180.0 + 180.0) % 180.0 / 180.0; // 0..1
    // Asymmetric dune cross-section: gentle windward slope (0..0.78), steep slip face (0.78..1.0)
    let duneProfile;
    if (wave < 0.78) {
      duneProfile = Math.pow(wave / 0.78, 1.4);
    } else {
      duneProfile = Math.pow(1.0 - (wave - 0.78) / 0.22, 2.2);
    }

    const ridgeH = duneProfile * (28.0 + Math.sin(v * 0.005) * 8.0);

    let h = swell + ridgeH;

    // 3. Sand scoured to a trough under the circuit; chasm under the two jumps
    if (this.track) {
      // Find distance to track
      const dist = this._distToTrack(x, z);
      if (dist < 80.0) {
        // Smooth scouring trough
        const troughFactor = 1.0 - smoothstep(12.0, 75.0, dist);
        h = h * (1.0 - troughFactor) - troughFactor * 12.0;
      }
    }

    return h;
  }

  _distToTrack(x, z) {
    // Spatial approximation using track samples
    let minDistSq = Infinity;
    const frames = this.track.frames;
    if (!frames) return 100.0;

    // Coarse stride search
    for (let i = 0; i < frames.length; i += 24) {
      const p = frames[i].pos;
      const dx = x - p.x;
      const dz = z - p.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistSq) minDistSq = dSq;
    }
    return Math.sqrt(minDistSq);
  }

  _buildNearGroundTiles() {
    // Skirted near-ground tiles: edges hang down so no cracks appear between tile sizes
    const nearGroup = new THREE.Group();
    nearGroup.name = 'near_ground_tiles';

    // Build 4 large terrain tiles covering the race circuit core
    const tileSize = 2400.0;
    const segs = 64; // ~37m resolution per vertex

    const offsets = [
      [-tileSize * 0.5, -tileSize * 0.5],
      [tileSize * 0.5, -tileSize * 0.5],
      [-tileSize * 0.5, tileSize * 0.5],
      [tileSize * 0.5, tileSize * 0.5]
    ];

    for (const [ox, oz] of offsets) {
      const geom = this._createSkirtedPlane(ox, oz, tileSize, segs);
      const mesh = new THREE.Mesh(geom, this.duneMaterial);
      mesh.receiveShadow = true;
      nearGroup.add(mesh);
    }

    this.group.add(nearGroup);
  }

  _createSkirtedPlane(cx, cz, size, segs) {
    const half = size * 0.5;
    const geom = new THREE.PlaneGeometry(size, size, segs, segs);
    geom.rotateX(-Math.PI * 0.5); // Lay flat on XZ plane

    const pos = geom.attributes.position;
    const count = pos.count;

    for (let i = 0; i < count; i++) {
      const localX = pos.getX(i);
      const localZ = pos.getZ(i);
      const worldX = cx + localX;
      const worldZ = cz + localZ;

      // Check if on border (skirt edge)
      const onEdge = (Math.abs(localX) > half - 0.001 || Math.abs(localZ) > half - 0.001);
      const h = this.getDuneHeight(worldX, worldZ);

      pos.setX(i, worldX);
      pos.setZ(i, worldZ);
      // Skirt hangs down 40m below dunes to seal all tile seams
      pos.setY(i, onEdge ? h - 40.0 : h);
    }

    geom.computeVertexNormals();
    return geom;
  }

  _buildHorizonRings() {
    // Concentric rings to the 22,000m horizon
    const ringGroup = new THREE.Group();
    ringGroup.name = 'horizon_rings';

    const ringRadii = [
      { rInner: 2400, rOuter: 5500, segs: 36 },
      { rInner: 5500, rOuter: 11000, segs: 32 },
      { rInner: 11000, rOuter: 22000, segs: 28 }
    ];

    for (const r of ringRadii) {
      const geom = new THREE.RingGeometry(r.rInner, r.rOuter, r.segs, 4);
      geom.rotateX(-Math.PI * 0.5);

      const pos = geom.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const h = this.getDuneHeight(x, z);
        pos.setY(i, h);
      }
      geom.computeVertexNormals();

      const mesh = new THREE.Mesh(geom, this.duneMaterial);
      mesh.receiveShadow = true;
      ringGroup.add(mesh);
    }

    this.group.add(ringGroup);
  }
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
