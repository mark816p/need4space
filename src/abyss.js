// src/abyss.js — Continuous jungle canopy terrain mesh on a polar grid ~1.3 km down
// Why: Single polar mesh with per-pixel cellular tree crowns and sinuous river distance fields
import * as THREE from 'three';

export class JungleAbyss {
  constructor(scene) {
    this.scene = scene;

    // Build Polar Grid geometry (fine spacing under the circuit, logarithmic towards horizon)
    const rings = 48;
    const sectors = 64;
    const rMin = 100.0;
    const rMax = 26000.0;

    const vertices = [];
    const uvs = [];
    const indices = [];

    // Center vertex
    vertices.push(0, -1300, 0);
    uvs.push(0.5, 0.5);

    // Rings
    for (let r = 0; r < rings; r++) {
      // Exponential radius spacing: dense near origin, stretching to horizon
      const t = r / (rings - 1);
      const radius = rMin + Math.pow(t, 2.2) * (rMax - rMin);

      for (let s = 0; s < sectors; s++) {
        const phi = (s / sectors) * Math.PI * 2.0;
        const x = Math.sin(phi) * radius;
        const z = Math.cos(phi) * radius;
        const y = -1300.0; // 1.3 km below circuit datum

        vertices.push(x, y, z);
        uvs.push(x / 4000.0, z / 4000.0);
      }
    }

    // Center disc indices
    for (let s = 0; s < sectors; s++) {
      const nextS = (s + 1) % sectors;
      indices.push(0, 1 + s, 1 + nextS);
    }

    // Quad strips between concentric rings
    for (let r = 0; r < rings - 1; r++) {
      const rowA = 1 + r * sectors;
      const rowB = 1 + (r + 1) * sectors;

      for (let s = 0; s < sectors; s++) {
        const nextS = (s + 1) % sectors;
        const i0 = rowA + s;
        const i1 = rowA + nextS;
        const i2 = rowB + s;
        const i3 = rowB + nextS;

        indices.push(i0, i2, i1);
        indices.push(i1, i2, i3);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: new THREE.Vector3(0.5, 0.45, -0.6).normalize() },
        uSunColor: { value: new THREE.Color(0xfffaed) },
        uHazeColor: { value: new THREE.Color(0x184c36) },
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec2 vUv;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uHazeColor;
        uniform float uTime;
        varying vec3 vWorldPos;
        varying vec2 vUv;

        // Hash & 2D Voronoi cellular noise for canopy dome crowns
        vec2 hash2(vec2 p) {
          return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
        }

        // Voronoi returns: x = distance to nearest crown center, yz = offset to center
        vec3 voronoi(vec2 p) {
          vec2 n = floor(p);
          vec2 f = fract(p);
          float minDist = 1.0;
          vec2 minOffset = vec2(0.0);

          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              vec2 g = vec2(float(i), float(j));
              vec2 o = hash2(n + g);
              vec2 diff = g + o - f;
              float d = length(diff);
              if (d < minDist) {
                minDist = d;
                minOffset = diff;
              }
            }
          }
          return vec3(minDist, minOffset);
        }

        // Sinuous River distance field
        float riverSDF(vec2 p) {
          // River 1 winding east-west
          float curve1 = sin(p.x * 0.0003) * 600.0 + cos(p.x * 0.0007) * 350.0;
          float d1 = abs(p.y - curve1) - 45.0;

          // River 2 tributary winding north-south
          float curve2 = cos(p.y * 0.0004) * 800.0 + sin(p.y * 0.001) * 250.0;
          float d2 = abs(p.x - curve2) - 35.0;

          return min(d1, d2);
        }

        void main() {
          vec2 p = vWorldPos.xz;

          // 1. Cellular Canopy Crowns (cell scale ~28m per tree dome)
          vec3 v = voronoi(p * 0.035);
          float crownDist = v.x;
          vec2 crownOffset = v.yz;

          // Crown dome normal
          float domeZ = sqrt(max(0.05, 1.0 - crownDist * crownDist));
          vec3 crownNorm = normalize(vec3(-crownOffset.x, domeZ * 1.5, -crownOffset.y));

          // Color variations across species and crown ages
          vec2 cellId = floor(p * 0.035);
          vec2 h = hash2(cellId);
          vec3 cEmerald = vec3(0.05, 0.28, 0.12);
          vec3 cViridian = vec3(0.03, 0.22, 0.09);
          vec3 cChartreuse = vec3(0.08, 0.36, 0.14);
          vec3 cDarkMoss = vec3(0.02, 0.15, 0.06);

          vec3 canopyCol = mix(cEmerald, cViridian, h.x);
          canopyCol = mix(canopyCol, cChartreuse, h.y * 0.4);
          if (crownDist > 0.85) canopyCol = cDarkMoss; // Shadow crevices between trees

          // 2. Sunlight & Diffuse on Tree Dome
          float NdotL = max(0.12, dot(crownNorm, uSunDir));
          vec3 litCanopy = canopyCol * (uSunColor * NdotL * 1.8 + vec3(0.06, 0.16, 0.1));

          // 3. Rivers & Lakes
          float rDist = riverSDF(p);
          if (rDist < 0.0) {
            // River water surface
            vec3 riverNorm = vec3(0.0, 1.0, 0.0);
            float waterNdotL = max(0.1, dot(riverNorm, uSunDir));
            vec3 waterCol = vec3(0.04, 0.18, 0.22);

            // Specular reflection of sun
            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            vec3 halfDir = normalize(uSunDir + viewDir);
            float spec = pow(max(0.0, dot(riverNorm, halfDir)), 64.0);
            litCanopy = waterCol * waterNdotL + uSunColor * spec * 2.5;
          }

          // 4. Jungle Haze extinction with distance
          float dist = length(cameraPosition.xz - vWorldPos.xz);
          float hazeFactor = 1.0 - exp(-dist * 0.000085);
          vec3 finalColor = mix(litCanopy, uHazeColor, clamp(hazeFactor, 0.0, 0.88));

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  update(dt) {
    this.material.uniforms.uTime.value += dt;
  }
}
