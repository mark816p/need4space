// src/spires.js — Hexagonal-prism crystals, glacier cave, great arch, icicles & frozen falls
// Why: Hexagonal crystals tens-hundreds of meters tall lit from inside, dark glacier cave with glowing blue ice
import * as THREE from 'three';
import { TRACK_W } from './track.js';

export function createCrystalMaterial(emissiveHex = 0x00e5ff) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0a2233,
    emissive: emissiveHex,
    emissiveIntensity: 0.85,
    roughness: 0.18,
    metalness: 0.05,
    transparent: true,
    opacity: 0.92
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vCrystalPos;`
    ).replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vCrystalPos = position;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vCrystalPos;`
    ).replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       // Hexagonal prism facets: continuous trigonometric angle wrap, no branch-cut derivative spikes or dashed false edges
       float theta = atan(vCrystalPos.z, vCrystalPos.x);
       float facet = cos(theta * 6.0) * 0.5 + 0.5;
       totalEmissiveRadiance *= (0.75 + 0.25 * facet);`
    );
  };
  return mat;
}

export class SpiresAndGlacierCave {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();

    this.crystalMat = createCrystalMaterial(0x00e5ff);
    this.darkIceMat = new THREE.MeshStandardMaterial({
      color: 0x08182b,
      emissive: 0x003d5c,
      emissiveIntensity: 0.45,
      roughness: 0.28,
      metalness: 0.1
    });

    if (track) {
      this._buildCrystalGarden();
      this._buildWindCarvedArch();
      this._buildGlacierCave();
      this._buildFrozenFalls();
    }

    scene.add(this.group);
  }

  // 1. The Crystal Garden: Hexagonal-prism crystals tens to hundreds of metres long
  _buildCrystalGarden() {
    const hexGeo = new THREE.CylinderGeometry(8.0, 14.0, 95.0, 6);
    hexGeo.rotateX(Math.PI * 0.5);

    const sBase = 2800;
    const count = 28;
    const _f = {};

    for (let i = 0; i < count; i++) {
      const s = (sBase + i * 45) % this.track.length;
      this.track.frame(s, _f);

      const side = (i % 2 === 0 ? 1 : -1);
      const dist = TRACK_W * 0.5 + 24.0 + (i % 4) * 18.0;
      const crystalPos = _f.pos.clone().addScaledVector(_f.R, side * dist);
      crystalPos.y = Math.max(-4.0, crystalPos.y - 10.0);

      const mesh = new THREE.Mesh(hexGeo, this.crystalMat);
      mesh.position.copy(crystalPos);

      // Scale variation: 40m to 140m height
      const scale = 0.6 + (i % 5) * 0.35;
      mesh.scale.set(scale, scale, scale * (1.2 + (i % 3) * 0.5));

      // Dramatic tilt leaning inward or outward
      mesh.rotation.x = Math.sin(i * 1.7) * 0.35;
      mesh.rotation.y = (i * 0.62) % (Math.PI * 2);
      mesh.rotation.z = side * (0.2 + (i % 3) * 0.12);

      this.group.add(mesh);
    }
  }

  // 2. Wind-Carved Great Arch (spans overhead around s ~ 4400m)
  _buildWindCarvedArch() {
    const sArch = 4400;
    const _f = {};
    this.track.frame(sArch, _f);

    const archCurve = new THREE.CatmullRomCurve3([
      _f.pos.clone().addScaledVector(_f.R, -TRACK_W * 0.5 - 28).addScaledVector(_f.U, -15),
      _f.pos.clone().addScaledVector(_f.R, -TRACK_W * 0.5 - 12).addScaledVector(_f.U, 38),
      _f.pos.clone().addScaledVector(_f.U, 52),
      _f.pos.clone().addScaledVector(_f.R, TRACK_W * 0.5 + 12).addScaledVector(_f.U, 38),
      _f.pos.clone().addScaledVector(_f.R, TRACK_W * 0.5 + 28).addScaledVector(_f.U, -15),
    ]);

    const archGeo = new THREE.TubeGeometry(archCurve, 32, 11.0, 8, false);
    const archMesh = new THREE.Mesh(archGeo, this.darkIceMat);
    this.group.add(archMesh);
  }

  // 3. Glacier Bore Cave (Blue Ice Tunnel, s = 5100m to 6300m)
  _buildGlacierCave() {
    const sStart = 5100;
    const sEnd = 6300;
    const step = 25;
    const points = [];
    const _f = {};

    for (let s = sStart; s <= sEnd; s += step) {
      this.track.frame(s, _f);
      // Lift tunnel center slightly above track surface
      points.push(_f.pos.clone().addScaledVector(_f.U, 12.0));
    }

    const cavePath = new THREE.CatmullRomCurve3(points);
    // Tunnel radius 32m (clears 56m road width + height)
    const caveGeo = new THREE.TubeGeometry(cavePath, 72, 32.0, 12, false);

    // Cave shader with internal blue ice luminosity
    const caveMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uTime: { value: 0 },
        uIceBlue: { value: new THREE.Color(0x00d2ff) },
        uDeepBlue: { value: new THREE.Color(0x031024) }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uIceBlue;
        uniform vec3 uDeepBlue;
        uniform float uTime;
        varying vec3 vWorldPos;
        varying vec3 vNormal;

        void main() {
          // Internal luminous blue veins
          float vein = sin(vWorldPos.x * 0.15 + sin(vWorldPos.z * 0.1) * 3.0) *
                       sin(vWorldPos.y * 0.2 + vWorldPos.z * 0.12);
          float glow = smoothstep(0.4, 0.95, abs(vein));

          vec3 col = mix(uDeepBlue, uIceBlue, glow * 0.65);

          // Subtle pulse
          col += uIceBlue * (sin(uTime * 1.5 + vWorldPos.z * 0.02) * 0.1 + 0.1);

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });

    const caveMesh = new THREE.Mesh(caveGeo, caveMat);
    this.group.add(caveMesh);

    // Add icicles hanging from the cave ceiling
    const icicleGeo = new THREE.ConeGeometry(1.6, 14.0, 5);
    icicleGeo.rotateX(Math.PI); // Point downward

    for (let s = sStart + 50; s <= sEnd - 50; s += 80) {
      this.track.frame(s, _f);
      for (let j = -2; j <= 2; j++) {
        if (j === 0) continue; // Keep center clear of direct ship path
        const icicle = new THREE.Mesh(icicleGeo, this.crystalMat);
        const pos = _f.pos.clone()
          .addScaledVector(_f.U, 36.0)
          .addScaledVector(_f.R, j * 12.0);
        icicle.position.copy(pos);
        this.group.add(icicle);
      }
    }
  }

  // 4. Frozen Falls (Massive frozen waterfalls down glacial cliffs)
  _buildFrozenFalls() {
    const sFall = 7400;
    const _f = {};
    this.track.frame(sFall, _f);

    const fallHeight = 160.0;
    const fallWidth = 75.0;
    const fallGeo = new THREE.PlaneGeometry(fallWidth, fallHeight, 8, 16);
    fallGeo.translate(0, -fallHeight * 0.5, 0);

    const fallMat = new THREE.MeshStandardMaterial({
      color: 0x052238,
      emissive: 0x0088cc,
      emissiveIntensity: 0.6,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide
    });

    const fallMesh = new THREE.Mesh(fallGeo, fallMat);
    const fallPos = _f.pos.clone().addScaledVector(_f.R, -TRACK_W * 0.5 - 45.0).addScaledVector(_f.U, 60.0);
    fallMesh.position.copy(fallPos);
    fallMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _f.R);
    this.group.add(fallMesh);
  }
}
