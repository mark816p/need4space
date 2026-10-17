// src/glacier.js — Frozen sea, cracked black ice with cyan seams, sastrugi, rifts & dark peaks
// Why: Black ice mirroring sky, cyan glowing seams from ocean below, combed sastrugi, two rift chasms jumped by track
import * as THREE from 'three';

export class GlacierSea {
  constructor(scene) {
    this.scene = scene;

    // 1. Frozen Sea Polar Plane (Radius 25 km, Y = -8.0 m below track datum)
    const rings = 48;
    const sectors = 64;
    const rMin = 60.0;
    const rMax = 25000.0;

    const vertices = [];
    const uvs = [];
    const indices = [];

    // Center vertex
    vertices.push(0, -8.0, 0);
    uvs.push(0.5, 0.5);

    for (let r = 0; r < rings; r++) {
      const t = r / (rings - 1);
      const radius = rMin + Math.pow(t, 2.0) * (rMax - rMin);

      for (let s = 0; s < sectors; s++) {
        const phi = (s / sectors) * Math.PI * 2.0;
        const x = Math.sin(phi) * radius;
        const z = Math.cos(phi) * radius;
        let y = -8.0;

        // Distant ring of dark jagged mountain peaks (r > 16,000 m)
        if (radius > 16000.0) {
          const mountainFrac = (radius - 16000.0) / 9000.0;
          const peakNoise = Math.sin(phi * 18.0) * Math.cos(phi * 7.0) * Math.sin(phi * 31.0);
          y += Math.max(0.0, peakNoise) * mountainFrac * 2200.0;
        }

        vertices.push(x, y, z);
        uvs.push(x / 2000.0, z / 2000.0);
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
        uSunDir: { value: new THREE.Vector3(-0.70, 0.139, 0.70).normalize() },
        uSunColor: { value: new THREE.Color(0xffcca0) },
        uSkyIndigo: { value: new THREE.Color(0x060c1e) },
        uTime: { value: 0 }
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
        uniform vec3 uSkyIndigo;
        uniform float uTime;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        varying vec2 vUv;

        // Hash & Voronoi for ice plate cracks
        vec2 hash2(vec2 p) {
          return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
        }

        // Returns distance to nearest crack seam
        float iceCracks(vec2 p) {
          vec2 n = floor(p);
          vec2 f = fract(p);
          float d1 = 1.0;
          float d2 = 1.0;
          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              vec2 g = vec2(float(i), float(j));
              vec2 o = hash2(n + g);
              vec2 diff = g + o - f;
              float d = length(diff);
              if (d < d1) {
                d2 = d1;
                d1 = d;
              } else if (d < d2) {
                d2 = d;
              }
            }
          }
          return d2 - d1; // Distance to cell boundary
        }

        void main() {
          vec2 p = vWorldPos.xz;
          float dist = length(p);

          // 1. Check if Mountain Peak (elevated above datum)
          if (vWorldPos.y > 50.0) {
            // Dark basalt peaks dusted with snow
            float snowMask = smoothstep(0.4, 0.8, vWorldNormal.y);
            vec3 rockCol = vec3(0.04, 0.05, 0.07);
            vec3 snowCol = vec3(0.85, 0.90, 0.98);
            vec3 col = mix(rockCol, snowCol, snowMask);
            gl_FragColor = vec4(col, 1.0);
            return;
          }

          // 2. Black Ice Sheet & Plate Fractures
          // Multi-scale cracks: large plates (scale 120m) and fine cracks (scale 24m)
          float crack1 = iceCracks(p * 0.008);
          float crack2 = iceCracks(p * 0.04);
          float seam = smoothstep(0.04, 0.0, crack1) + smoothstep(0.03, 0.0, crack2) * 0.6;

          // 3. Combed Snow Sastrugi (directional ripples along wind angle SW -> NE)
          vec2 windDir = normalize(vec2(1.0, 1.0));
          float sastrugi = sin(dot(p, windDir) * 0.15 + sin(dot(p, vec2(-windDir.y, windDir.x)) * 0.05) * 2.0);
          float snowDrift = smoothstep(0.2, 0.8, sastrugi) * (sin(p.x * 0.005) * 0.5 + 0.5);

          // 4. Two Major Sea Rifts (Track Jump chasms with exposed open water)
          // Rift 1 around x ~ 1800, z ~ 1000
          float rift1 = abs(p.x - 1750.0 + sin(p.y * 0.003) * 120.0);
          float isRift1 = smoothstep(85.0, 30.0, rift1);

          // Base black ice color
          vec3 blackIceCol = vec3(0.03, 0.05, 0.08);
          vec3 snowCol = vec3(0.88, 0.92, 0.98);
          vec3 cyanGlow = vec3(0.0, 0.95, 0.88); // Cyan water glow through seams
          vec3 openWaterCol = vec3(0.01, 0.03, 0.06);

          vec3 col = blackIceCol;

          // Blend snow sastrugi
          col = mix(col, snowCol, clamp(snowDrift * 0.65, 0.0, 0.85));

          // Glowing cyan crack seams from ocean depth below
          col += cyanGlow * clamp(seam * 2.2, 0.0, 3.0);

          // Open water at rifts
          if (isRift1 > 0.05) {
            col = mix(col, openWaterCol, isRift1);
            // Cyan glowing edges on the calving lip
            col += cyanGlow * smoothstep(0.05, 0.4, isRift1) * (1.0 - smoothstep(0.4, 0.9, isRift1)) * 1.5;
          }

          // 5. Specular Reflection of Low Sun on Black Ice
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 H = normalize(uSunDir + V);
          vec3 N = normalize(vWorldNormal);
          float spec = pow(max(0.0, dot(N, H)), 64.0);
          col += uSunColor * spec * (1.0 - snowDrift * 0.7) * 2.4;

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = 0;
    scene.add(this.mesh);
  }

  update(dt) {
    if (this.material && this.material.uniforms.uTime) {
      this.material.uniforms.uTime.value += dt;
    }
  }
}
