// src/water.js — Procedural waterfalls with ballistic fall physics, spray plumes, and 42-deg rainbow
// Why: Ballistic trajectory p = lip + out*v*t - g*t^2/2 with time-parameterized rows; Cascade river arches over track
import * as THREE from 'three';

export const RAINBOW_ANGLE_RAD = 42.0 * (Math.PI / 180.0); // 42 degrees in radians (~0.733 rad)

// Generate ballistic waterfall geometry
export function createWaterfallGeometry(lipPos, outDir, width = 45.0, v0 = 12.0, totalTime = 4.2) {
  const g = 9.81; // m/s^2
  const timeSteps = 42;
  const widthSteps = 16;
  const vertices = [];
  const uvs = [];
  const indices = [];

  const right = new THREE.Vector3().crossVectors(outDir, new THREE.Vector3(0, 1, 0)).normalize();

  for (let i = 0; i <= timeSteps; i++) {
    // Quadratic time spacing: finer spacing at lip, stretching down
    const frac = i / timeSteps;
    const t = Math.pow(frac, 1.4) * totalTime;

    // Ballistic trajectory p = lip + out*v*t - 0.5*g*t^2
    const center = new THREE.Vector3()
      .copy(lipPos)
      .addScaledVector(outDir, v0 * t)
      .addScaledVector(new THREE.Vector3(0, -1, 0), 0.5 * g * t * t);

    // Stream width expands slightly and frays as it descends
    const currentW = width * (1.0 + frac * 0.45);

    for (let j = 0; j <= widthSteps; j++) {
      const uFrac = j / widthSteps; // 0 to 1
      const offset = (uFrac - 0.5) * currentW;

      // Slight curl and turbulence
      const p = new THREE.Vector3().copy(center).addScaledVector(right, offset);
      if (frac > 0.25) {
        p.y += Math.sin(uFrac * Math.PI * 4.0) * (frac * 2.5);
      }

      vertices.push(p.x, p.y, p.z);
      uvs.push(uFrac, t * 2.0); // UV.y tracks real flight time
    }
  }

  // Generate quad indices
  for (let i = 0; i < timeSteps; i++) {
    const rowA = i * (widthSteps + 1);
    const rowB = (i + 1) * (widthSteps + 1);

    for (let j = 0; j < widthSteps; j++) {
      const i0 = rowA + j;
      const i1 = rowA + j + 1;
      const i2 = rowB + j;
      const i3 = rowB + j + 1;

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

// Waterfall Shader with foam, turbulent ropes, and 42-deg rainbow
export function createWaterfallMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.5, 0.45, -0.6).normalize() },
      uSunColor: { value: new THREE.Color(0xfffaed) },
      uWaterColor: { value: new THREE.Color(0x38bdf8) },
      uFoamColor: { value: new THREE.Color(0xffffff) }
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uWaterColor;
      uniform vec3 uFoamColor;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      // Spectral rainbow palette at 42-deg antisolar angle
      vec3 rainbowColor(float t) {
        return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
      }

      void main() {
        // Accelerating flow texture along UV.y
        float flowY = vUv.y * 3.0 - uTime * 6.5;
        float flowX = vUv.x * 8.0;

        // Turbulent water ropes
        float rope = sin(flowX * 3.1415 + sin(flowY * 0.5) * 2.0) * 0.5 + 0.5;
        float foam = sin(flowY * 2.0 + sin(flowX * 2.0)) * 0.5 + 0.5;

        // Foam density increases as water plunges
        float dropDist = vUv.y * 0.3;
        float foamFactor = smoothstep(0.4, 0.9, foam + dropDist * 0.4);

        vec3 col = mix(uWaterColor, uFoamColor, foamFactor * 0.85);

        // Sun specular highlight
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 H = normalize(uSunDir + V);
        float spec = pow(max(0.0, dot(N, H)), 32.0);
        col += uSunColor * spec * 1.8;

        // 42-deg rainbow in spray when sun is behind camera
        // cos(42 deg) ~= 0.7431
        float sunAngle = dot(V, -uSunDir);
        float rainbowRing = smoothstep(0.72, 0.745, sunAngle) * (1.0 - smoothstep(0.745, 0.77, sunAngle));
        if (rainbowRing > 0.05 && dropDist > 0.4) {
          float spectralPos = (sunAngle - 0.72) / 0.05;
          vec3 rCol = rainbowColor(spectralPos);
          col += rCol * rainbowRing * 1.4;
        }

        float alpha = clamp(0.65 + foamFactor * 0.35, 0.0, 0.95);
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
}

// The Cascade River & Waterfall System
export class WaterfallSystem {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();

    this.waterfalls = [];
    this.mat = createWaterfallMaterial();

    // 1. The Cascade River: Waterfall that arches right over the track at Sector 9 (s ~ 3400m)
    // High island cliff lip above the circuit leaping out and arching across
    const cascadeLip = new THREE.Vector3(-920, 160, 1850);
    const cascadeOut = new THREE.Vector3(0.72, 0.15, -0.68).normalize(); // Shoots over track deck
    const cascadeGeo = createWaterfallGeometry(cascadeLip, cascadeOut, 55.0, 24.0, 4.8);
    this.cascadeMesh = new THREE.Mesh(cascadeGeo, this.mat);
    this.group.add(this.cascadeMesh);
    this.waterfalls.push(this.cascadeMesh);

    // 2. Twin Falls plunging from western floating island
    const falls2Lip = new THREE.Vector3(320, -180, 1260);
    const falls2Out = new THREE.Vector3(0.5, 0.1, 0.86).normalize();
    const falls2Geo = createWaterfallGeometry(falls2Lip, falls2Out, 38.0, 16.0, 5.2);
    const falls2Mesh = new THREE.Mesh(falls2Geo, this.mat);
    this.group.add(falls2Mesh);
    this.waterfalls.push(falls2Mesh);

    // 3. Deep chasm falls near the colossal skull
    const falls3Lip = new THREE.Vector3(880, -260, -2050);
    const falls3Out = new THREE.Vector3(-0.6, 0.08, 0.79).normalize();
    const falls3Geo = createWaterfallGeometry(falls3Lip, falls3Out, 48.0, 18.0, 5.6);
    const falls3Mesh = new THREE.Mesh(falls3Geo, this.mat);
    this.group.add(falls3Mesh);
    this.waterfalls.push(falls3Mesh);

    scene.add(this.group);
  }

  update(dt) {
    if (this.mat && this.mat.uniforms.uTime) {
      this.mat.uniforms.uTime.value += dt;
    }
  }
}
