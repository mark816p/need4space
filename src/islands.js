// src/islands.js — Procedural floating islands with layered rock cliffs, moss, and grass
// Why: Single closed surface generated in rows from top down to lowest tip, with triplanar strata & water streaks
import * as THREE from 'three';

// Generate ONE closed island mesh from top center down to bottom tip
export function createIslandGeometry(radius = 350, height = 450, seed = 1) {
  const rings = 36;
  const segments = 48;
  const vertices = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // Top center apex
  vertices.push(0, height * 0.15, 0);
  normals.push(0, 1, 0);
  uvs.push(0.5, 0.5);

  for (let r = 0; r < rings; r++) {
    const v = (r + 1) / (rings + 1); // 0 to 1 down the island
    let rad = 0;
    let y = 0;

    if (v < 0.28) {
      // 1. Grassy Plateau & Hills (v: 0.0 -> 0.28)
      const t = v / 0.28;
      rad = radius * t;
      y = (height * 0.15) - Math.sin(t * Math.PI * 0.5) * (height * 0.08);
    } else if (v < 0.45) {
      // 2. Rounded Rim & Ledge Overhang (v: 0.28 -> 0.45)
      const t = (v - 0.28) / 0.17;
      rad = radius * (1.0 + Math.sin(t * Math.PI) * 0.08);
      y = (height * 0.07) - t * (height * 0.18);
    } else if (v < 0.8) {
      // 3. Sheer Cliff Walls (v: 0.45 -> 0.8)
      const t = (v - 0.45) / 0.35;
      rad = radius * (1.0 - t * 0.35);
      y = -(height * 0.11) - t * (height * 0.6);
    } else {
      // 4. Underside Lobes & Stalactite Tip (v: 0.8 -> 1.0)
      const t = (v - 0.8) / 0.2;
      rad = radius * 0.65 * Math.pow(1.0 - t, 1.4);
      y = -(height * 0.71) - t * (height * 0.29);
    }

    for (let s = 0; s < segments; s++) {
      const phi = (s / segments) * Math.PI * 2.0;

      // Angular harmonic distortion for natural non-circular organic contours
      const harm1 = Math.sin(phi * 3.0 + seed * 2.1) * 0.14;
      const harm2 = Math.cos(phi * 5.0 - seed * 1.3) * 0.08;
      const harm3 = Math.sin(phi * 8.0) * 0.04;
      const rMod = rad * (1.0 + harm1 + harm2 + harm3);

      // Underside hanging lobes
      let yMod = y;
      if (v > 0.65) {
        yMod += Math.sin(phi * 4.0 + seed) * (height * 0.08) * (v - 0.65);
      }

      const vx = Math.sin(phi) * rMod;
      const vz = Math.cos(phi) * rMod;
      vertices.push(vx, yMod, vz);
      uvs.push(s / segments, v);
    }
  }

  // Lowest tip vertex
  const tipIdx = vertices.length / 3;
  vertices.push(0, -height, 0);
  uvs.push(0.5, 1.0);

  // Top cap triangles
  for (let s = 0; s < segments; s++) {
    const nextS = (s + 1) % segments;
    indices.push(0, 1 + s, 1 + nextS);
  }

  // Body quad strips
  for (let r = 0; r < rings - 1; r++) {
    const rowA = 1 + r * segments;
    const rowB = 1 + (r + 1) * segments;

    for (let s = 0; s < segments; s++) {
      const nextS = (s + 1) % segments;
      const i0 = rowA + s;
      const i1 = rowA + nextS;
      const i2 = rowB + s;
      const i3 = rowB + nextS;

      indices.push(i0, i2, i1);
      indices.push(i1, i2, i3);
    }
  }

  // Bottom cap triangles
  const lastRow = 1 + (rings - 1) * segments;
  for (let s = 0; s < segments; s++) {
    const nextS = (s + 1) % segments;
    indices.push(tipIdx, lastRow + nextS, lastRow + s);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

// Procedural Triplanar Rock, Strata, Moss & Grass Island Shader
export function createIslandMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: new THREE.Vector3(0.5, 0.45, -0.6).normalize() },
      uSunColor: { value: new THREE.Color(0xfffaed) },
      uHazeColor: { value: new THREE.Color(0x184c36) },
      uGrassColor: { value: new THREE.Color(0x238234) },
      uRockColor: { value: new THREE.Color(0x42464b) },
      uStrataColor: { value: new THREE.Color(0x2d3034) },
      uMossColor: { value: new THREE.Color(0x1a5c2b) }
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uHazeColor;
      uniform vec3 uGrassColor;
      uniform vec3 uRockColor;
      uniform vec3 uStrataColor;
      uniform vec3 uMossColor;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
        vec3 N = normalize(vWorldNormal);
        float upDot = dot(N, vec3(0.0, 1.0, 0.0));

        // 1. Horizontal Geological Strata (alternating mineral layers)
        float strata = sin(vWorldPos.y * 0.12) * 0.5 + sin(vWorldPos.y * 0.035) * 0.5;
        vec3 baseRock = mix(uRockColor, uStrataColor, smoothstep(-0.2, 0.6, strata));

        // 2. Vertical Water Stain Streaks down steep cliff faces
        float streak = sin(vWorldPos.x * 0.2 + vWorldPos.z * 0.2);
        if (streak > 0.4 && abs(upDot) < 0.35) {
          baseRock *= 0.72; // Wet darker rock streak
        }

        // 3. Moss drape over rim and down streaks
        float mossFactor = smoothstep(0.15, 0.65, upDot + streak * 0.2);
        vec3 surfaceCol = mix(baseRock, uMossColor, mossFactor * 0.75);

        // 4. Lush Grass on top plateau (upward normals > 0.6)
        float grassFactor = smoothstep(0.55, 0.78, upDot);
        surfaceCol = mix(surfaceCol, uGrassColor, grassFactor);

        // 5. Directional Sunlight & Ambient
        float NdotL = max(0.12, dot(N, uSunDir));
        vec3 litColor = surfaceCol * (uSunColor * NdotL * 1.6 + vec3(0.08, 0.14, 0.1));

        // 6. Jungle haze falloff with distance
        float dist = length(cameraPosition - vWorldPos);
        float haze = 1.0 - exp(-dist * 0.00012);
        litColor = mix(litColor, uHazeColor, clamp(haze, 0.0, 0.85));

        gl_FragColor = vec4(litColor, 1.0);
      }
    `
  });
}

// System managing all floating islands around the circuit
export class IslandField {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    this.islands = [];

    const mat = createIslandMaterial();

    // Island specifications around the circuit
    const configs = [
      { x: 300, y: -220, z: 1200, r: 420, h: 550, seed: 1.2 },  // Emerald plateau
      { x: -900, y: -380, z: 1800, r: 680, h: 800, seed: 3.4 }, // Cascade ridge island
      { x: 1800, y: -280, z: -400, r: 520, h: 620, seed: 2.1 }, // Root tunnel archipelago
      { x: -1400, y: -190, z: -1100, r: 480, h: 580, seed: 5.7 },// Banyan island
      { x: 900, y: -310, z: -2100, r: 850, h: 950, seed: 4.3 }, // Giant plateau under loop
      { x: -2100, y: -450, z: 400, r: 620, h: 720, seed: 6.8 },  // Western cliff island
      { x: -300, y: -260, z: -1600, r: 380, h: 480, seed: 7.9 }, // Ridge rock
    ];

    for (let i = 0; i < configs.length; i++) {
      const cfg = configs[i];
      const geo = createIslandGeometry(cfg.r, cfg.h, cfg.seed);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cfg.x, cfg.y, cfg.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      this.group.add(mesh);
      this.islands.push({ mesh, cfg });
    }

    scene.add(this.group);
  }
}
