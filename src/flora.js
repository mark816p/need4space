// src/flora.js — Procedural jungle vegetation, leaf atlas, and instanced emergent giant trees
// Why: Leaf cards with crown-outward normals shade as a soft mass; leaf atlas painted over green avoids mip black-bleed
import * as THREE from 'three';

// Paint procedural leaf texture atlas on canvas
export function createLeafAtlasTexture() {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([27, 94, 32, 255]); // 1x1 leaf green fallback for headless environments
    const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    tex.needsUpdate = true;
    return tex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Background flooded with leaf green so mipmaps never bleed black
  ctx.fillStyle = '#1b5e20';
  ctx.fillRect(0, 0, 512, 512);

  // Helper to draw leaf shapes with natural vein gradients
  const drawBroadleaf = (cx, cy, w, h) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.bezierCurveTo(w / 2, -h / 4, w / 2, h / 4, 0, h / 2);
    ctx.bezierCurveTo(-w / 2, h / 4, -w / 2, -h / 4, 0, -h / 2);
    ctx.fillStyle = '#2e7d32';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#4caf50';
    ctx.stroke();
    // Central vein
    ctx.beginPath();
    ctx.moveTo(0, -h / 2 + 5);
    ctx.lineTo(0, h / 2 - 5);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#81c784';
    ctx.stroke();
    ctx.restore();
  };

  // Top Left: Broadleaf
  drawBroadleaf(128, 128, 140, 210);

  // Top Right: Palm Frond
  ctx.save();
  ctx.translate(384, 128);
  ctx.strokeStyle = '#388e3c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 100);
  ctx.quadraticCurveTo(0, 0, 0, -100);
  ctx.stroke();
  for (let i = -80; i < 90; i += 18) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(50, i - 15);
    ctx.moveTo(0, i);
    ctx.lineTo(-50, i - 15);
    ctx.strokeStyle = '#43a047';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();

  // Bottom: Fern & Vine leaves
  drawBroadleaf(128, 384, 110, 160);
  drawBroadleaf(384, 384, 90, 130);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  return texture;
}

// Procedural Tree Prototype (Wood Trunk + Leaf Volume Cards)
export function createTreePrototype(isGiant = false) {
  const trunkHeight = isGiant ? 95.0 : 38.0;
  const trunkRadius = isGiant ? 6.5 : 2.2;
  const crownRadius = isGiant ? 42.0 : 18.0;

  // 1. Trunk geometry with flaring buttress roots at base
  const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.45, trunkRadius * 1.6, trunkHeight, 10, 8);
  trunkGeo.translate(0, trunkHeight / 2, 0);

  // Deform lower vertices for buttress roots
  const pos = trunkGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < trunkHeight * 0.22) {
      const rootFlare = (1.0 - y / (trunkHeight * 0.22)) * (trunkRadius * 1.5);
      const angle = Math.atan2(pos.getZ(i), pos.getX(i));
      const fluting = Math.sin(angle * 4.0) * rootFlare;
      pos.setX(i, pos.getX(i) + Math.cos(angle) * fluting);
      pos.setZ(i, pos.getZ(i) + Math.sin(angle) * fluting);
    }
  }
  trunkGeo.computeVertexNormals();

  // 2. Leaf Crown volume cards
  const leafCardCount = isGiant ? 64 : 28;
  const cardSize = isGiant ? 16.0 : 7.5;
  const crownCenter = new THREE.Vector3(0, trunkHeight + crownRadius * 0.5, 0);

  const crownGeo = new THREE.BufferGeometry();
  const cardVerts = [];
  const cardNorms = [];
  const cardUvs = [];
  const cardIndices = [];

  for (let c = 0; c < leafCardCount; c++) {
    // Distribute card centers uniformly in a hemisphere crown
    const u = Math.random();
    const v = Math.random();
    const theta = u * Math.PI * 2.0;
    const phi = Math.acos(1.0 - v * 0.85); // Hemispherical spread
    const r = (0.35 + Math.random() * 0.65) * crownRadius;

    const cx = crownCenter.x + Math.sin(phi) * Math.cos(theta) * r;
    const cy = crownCenter.y + Math.cos(phi) * r;
    const cz = crownCenter.z + Math.sin(phi) * Math.sin(theta) * r;

    // Normal points outward from crown center so whole crown shades as soft mass
    const norm = new THREE.Vector3(cx - crownCenter.x, cy - crownCenter.y, cz - crownCenter.z).normalize();

    const idxBase = (c * 4);
    const half = cardSize * 0.5;

    // Random card orientation tangent to sphere
    const tangent = new THREE.Vector3(-norm.z, 0, norm.x).normalize();
    const bitangent = new THREE.Vector3().crossVectors(norm, tangent);

    const p0 = new THREE.Vector3(cx, cy, cz).addScaledVector(tangent, -half).addScaledVector(bitangent, -half);
    const p1 = new THREE.Vector3(cx, cy, cz).addScaledVector(tangent, half).addScaledVector(bitangent, -half);
    const p2 = new THREE.Vector3(cx, cy, cz).addScaledVector(tangent, half).addScaledVector(bitangent, half);
    const p3 = new THREE.Vector3(cx, cy, cz).addScaledVector(tangent, -half).addScaledVector(bitangent, half);

    cardVerts.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
    // Outward-facing normals across the quad
    for (let k = 0; k < 4; k++) cardNorms.push(norm.x, norm.y, norm.z);
    cardUvs.push(0, 0, 1, 0, 1, 1, 0, 1);

    cardIndices.push(idxBase, idxBase + 1, idxBase + 2, idxBase, idxBase + 2, idxBase + 3);
  }

  crownGeo.setAttribute('position', new THREE.Float32BufferAttribute(cardVerts, 3));
  crownGeo.setAttribute('normal', new THREE.Float32BufferAttribute(cardNorms, 3));
  crownGeo.setAttribute('uv', new THREE.Float32BufferAttribute(cardUvs, 2));
  crownGeo.setIndex(cardIndices);

  return { trunkGeo, crownGeo };
}

// Flora Instanced System
export class FloraSystem {
  constructor(scene, islandField) {
    this.scene = scene;
    this.islandField = islandField;
    this.group = new THREE.Group();

    const atlas = createLeafAtlasTexture();

    // 1. Trunk material
    this.trunkMat = new THREE.MeshStandardMaterial({
      color: 0x3d2b1f,
      roughness: 0.9,
      metalness: 0.05
    });

    // 2. Leaf crown material with subsurface scatter glow & wind sway
    this.crownMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      uniforms: {
        uMap: { value: atlas },
        uSunDir: { value: new THREE.Vector3(0.5, 0.45, -0.6).normalize() },
        uSunColor: { value: new THREE.Color(0xfffaed) },
        uTime: { value: 0 }
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vec3 pos = position;

          // Wind sway & foliage flutter
          float wind = sin(uTime * 2.5 + pos.x * 0.15 + pos.z * 0.15) * 0.35;
          pos.x += wind * (pos.y * 0.02);
          pos.z += wind * 0.5 * (pos.y * 0.02);

          vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        varying vec2 vUv;

        void main() {
          vec4 tex = texture2D(uMap, vUv);
          vec3 N = normalize(vWorldNormal);

          // Sunlight diffuse
          float NdotL = max(0.2, dot(N, uSunDir));

          // Subsurface scattering foliage glow when looking towards sun through leaves
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float sss = pow(max(0.0, dot(viewDir, -uSunDir)), 3.0) * 0.75;

          vec3 baseGreen = tex.rgb * 1.1;
          vec3 lit = baseGreen * (uSunColor * NdotL * 1.4 + vec3(0.12, 0.28, 0.16) + sss * vec3(0.3, 0.8, 0.2));

          gl_FragColor = vec4(lit, 0.95);
        }
      `
    });

    this._populateIslands();
    scene.add(this.group);
  }

  _populateIslands() {
    if (!this.islandField) return;

    const protoRegular = createTreePrototype(false);
    const protoGiant = createTreePrototype(true);

    const treePositions = [];
    const giantPositions = [];

    // Distribute trees on island plateaus
    for (const isl of this.islandField.islands) {
      const cfg = isl.cfg;
      const count = Math.floor(cfg.r * 0.18);

      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2.0;
        const rad = Math.sqrt(Math.random()) * (cfg.r * 0.65);
        const tx = cfg.x + Math.sin(ang) * rad;
        const tz = cfg.z + Math.cos(ang) * rad;
        const ty = cfg.y + (cfg.h * 0.12);

        if (i < 2) {
          giantPositions.push({ x: tx, y: ty, z: tz, scale: 0.85 + Math.random() * 0.3 });
        } else {
          treePositions.push({ x: tx, y: ty, z: tz, scale: 0.7 + Math.random() * 0.6 });
        }
      }
    }

    // Instanced regular trees
    if (treePositions.length > 0) {
      const trunkInst = new THREE.InstancedMesh(protoRegular.trunkGeo, this.trunkMat, treePositions.length);
      const crownInst = new THREE.InstancedMesh(protoRegular.crownGeo, this.crownMat, treePositions.length);
      const mat4 = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scl = new THREE.Vector3();

      for (let i = 0; i < treePositions.length; i++) {
        const p = treePositions[i];
        pos.set(p.x, p.y, p.z);
        quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
        scl.set(p.scale, p.scale, p.scale);
        mat4.compose(pos, quat, scl);
        trunkInst.setMatrixAt(i, mat4);
        crownInst.setMatrixAt(i, mat4);
      }
      trunkInst.instanceMatrix.needsUpdate = true;
      crownInst.instanceMatrix.needsUpdate = true;
      this.group.add(trunkInst);
      this.group.add(crownInst);
    }

    // Instanced giant emergent trees
    if (giantPositions.length > 0) {
      const gTrunkInst = new THREE.InstancedMesh(protoGiant.trunkGeo, this.trunkMat, giantPositions.length);
      const gCrownInst = new THREE.InstancedMesh(protoGiant.crownGeo, this.crownMat, giantPositions.length);
      const mat4 = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scl = new THREE.Vector3();

      for (let i = 0; i < giantPositions.length; i++) {
        const p = giantPositions[i];
        pos.set(p.x, p.y, p.z);
        quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
        scl.set(p.scale, p.scale, p.scale);
        mat4.compose(pos, quat, scl);
        gTrunkInst.setMatrixAt(i, mat4);
        gCrownInst.setMatrixAt(i, mat4);
      }
      gTrunkInst.instanceMatrix.needsUpdate = true;
      gCrownInst.instanceMatrix.needsUpdate = true;
      this.group.add(gTrunkInst);
      this.group.add(gCrownInst);
    }
  }

  update(dt) {
    if (this.crownMat && this.crownMat.uniforms.uTime) {
      this.crownMat.uniforms.uTime.value += dt;
    }
  }
}
