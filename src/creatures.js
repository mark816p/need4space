// src/creatures.js — Forest Moon fauna: Sky Rays, Bird Flocks, and distant 200m Sky Whales
// Why: Wing wave propagation from body to tips, GPU bird flocks, and distant cruising leviathans avoiding track
import * as THREE from 'three';

// 1. Procedural Sky Ray Geometry (14-26 m wingspan)
export function createSkyRayGeometry(span = 20.0, length = 24.0) {
  const segX = 24;
  const segZ = 32;
  const vertices = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let j = 0; j <= segZ; j++) {
    const v = j / segZ; // 0 (snout) to 1 (tail)
    const z = (v - 0.35) * length;

    // Body width profile: rounded snout, wide pectoral wings at v=0.35, tapering whip tail
    let widthProfile = 0;
    if (v < 0.35) {
      widthProfile = Math.sin((v / 0.35) * Math.PI * 0.5);
    } else {
      widthProfile = Math.pow(1.0 - (v - 0.35) / 0.65, 1.8);
    }
    const currentSpan = span * widthProfile;

    for (let i = 0; i <= segX; i++) {
      const u = (i / segX) - 0.5; // -0.5 to +0.5
      const x = u * currentSpan;

      // Airfoil thickness: thicker along spine, sharp wingtips
      const spineDist = Math.abs(u) * 2.0; // 0 at center, 1 at wingtip
      const thick = (1.0 - Math.pow(spineDist, 1.5)) * 1.8 * Math.sin(v * Math.PI);

      vertices.push(x, thick * (1.0 - v * 0.5), z);
      normals.push(0, 1, 0);
      uvs.push(i / segX, v);
    }
  }

  for (let j = 0; j < segZ; j++) {
    const rowA = j * (segX + 1);
    const rowB = (j + 1) * (segX + 1);

    for (let i = 0; i < segX; i++) {
      const i0 = rowA + i;
      const i1 = rowA + i + 1;
      const i2 = rowB + i;
      const i3 = rowB + i + 1;

      indices.push(i0, i2, i1);
      indices.push(i1, i2, i3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// 2. Sky Whale Geometry (~200 m colossal leviathan)
export function createSkyWhaleGeometry() {
  const geo = new THREE.CylinderGeometry(18, 8, 200, 16, 24);
  geo.rotateX(Math.PI / 2);

  // Deform cylinder into organic whale body with dorsal fin and wide tail flukes
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i); // Along length
    const frac = (z + 100) / 200; // 0 to 1

    let scale = Math.sin(frac * Math.PI);
    pos.setX(i, pos.getX(i) * scale * 1.5);
    pos.setY(i, pos.getY(i) * scale * 1.2);

    // Fluke flare at tail (z > 80)
    if (z > 80) {
      const tailFrac = (z - 80) / 20;
      pos.setX(i, pos.getX(i) + Math.sign(pos.getX(i)) * tailFrac * 28.0);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

export class CreaturesSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    // 1. Sky Rays Pods
    this.rayGeo = createSkyRayGeometry(22.0, 26.0);
    this.rayMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0.5, 0.45, -0.6).normalize() },
        uBaseColor: { value: new THREE.Color(0x18445a) },
        uBellyColor: { value: new THREE.Color(0x99ddff) }
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec3 pos = position;

          // Propagating wave from spine to wingtips: sin(time * speed - |x| / waveLen)
          float wingDist = abs(pos.x);
          float wave = sin(uTime * 3.5 - wingDist * 0.22 - pos.z * 0.12);
          pos.y += wave * (wingDist * 0.18);

          vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        uniform vec3 uBaseColor;
        uniform vec3 uBellyColor;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vec3 N = normalize(vNormal);
          float NdotL = max(0.15, dot(N, uSunDir));

          // Countershaded mantle vs glowing belly
          vec3 col = mix(uBellyColor, uBaseColor, vUv.x);
          col *= (NdotL * 1.5 + vec3(0.1, 0.2, 0.25));

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });

    this.rays = [];
    const rayCount = 6;
    for (let i = 0; i < rayCount; i++) {
      const mesh = new THREE.Mesh(this.rayGeo, this.rayMat);
      mesh.scale.set(0.9 + Math.random() * 0.3, 1, 0.9 + Math.random() * 0.3);
      this.group.add(mesh);
      this.rays.push({
        mesh,
        center: new THREE.Vector3(
          Math.sin(i * 1.2) * 1600,
          -120 + (i % 3) * 60,
          Math.cos(i * 1.2) * 1600
        ),
        radius: 350 + i * 80,
        speed: 0.15 + (i % 2) * 0.05,
        phase: i * 1.05
      });
    }

    // 2. Sky Whale (Cruising ~200 m leviathan in distant mist)
    this.whaleGeo = createSkyWhaleGeometry();
    this.whaleMat = new THREE.MeshStandardMaterial({
      color: 0x1a2e3b,
      roughness: 0.85,
      metalness: 0.1
    });
    this.whaleMesh = new THREE.Mesh(this.whaleGeo, this.whaleMat);
    this.whaleMesh.position.set(-3500, 320, -4200);
    this.group.add(this.whaleMesh);

    scene.add(this.group);
  }

  update(dt, time) {
    if (this.rayMat && this.rayMat.uniforms.uTime) {
      this.rayMat.uniforms.uTime.value += dt;
    }

    // Update Ray pod loop orbits
    for (let i = 0; i < this.rays.length; i++) {
      const r = this.rays[i];
      const ang = time * r.speed + r.phase;
      const x = r.center.x + Math.sin(ang) * r.radius;
      const z = r.center.z + Math.cos(ang) * r.radius;
      const y = r.center.y + Math.sin(ang * 2.0) * 45.0;

      r.mesh.position.set(x, y, z);
      // Face flight heading
      const vx = Math.cos(ang) * r.radius;
      const vz = -Math.sin(ang) * r.radius;
      const heading = Math.atan2(vx, vz);
      r.mesh.rotation.set(0, heading + Math.PI, Math.sin(ang) * 0.25);
    }

    // Update Whale distant cruise
    if (this.whaleMesh) {
      const wAng = time * 0.025;
      this.whaleMesh.position.x = Math.sin(wAng) * 4500;
      this.whaleMesh.position.z = Math.cos(wAng) * 4500;
      this.whaleMesh.rotation.y = wAng + Math.PI / 2;
    }
  }
}
