// src/sea.js — Ocean surface with 6 Gerstner swells, moon glade, storm sky, bioluminescent plankton, and unified air/water optical model
// Why: "P11.3 Sea (sea.js): night sky with huge pale moon low NNE behind ragged storm cloud (key light, cold silver),
// last of dusk dark red band in the west. Displaced polar grid with six Gerstner swells (vertex shader),
// fine scrolling ripples, moon glade glittering, foam, bioluminescent plankton.
// Unified air and water optical model (underK factor): above sea = night haze; below sea = red absorbed, then green, deep teal murk."

import * as THREE from 'three';
import { clamp } from './noise.js';

// 6 Gerstner Swells [amplitude, wavelength, speed, steepness, dirX, dirZ]
export const GERSTNER_SWELLS = [
  { a: 3.8, lambda: 180.0, speed: 18.0, q: 0.55, dx: 0.85, dz: 0.52 },
  { a: 2.6, lambda: 110.0, speed: 14.5, q: 0.45, dx: 0.94, dz: -0.34 },
  { a: 1.9, lambda: 75.0,  speed: 12.0, q: 0.40, dx: 0.42, dz: 0.91 },
  { a: 1.4, lambda: 48.0,  speed: 9.5,  q: 0.35, dx: -0.71, dz: 0.70 },
  { a: 0.9, lambda: 28.0,  speed: 7.2,  q: 0.30, dx: 0.98, dz: 0.18 },
  { a: 0.6, lambda: 16.0,  speed: 5.5,  q: 0.25, dx: -0.38, dz: -0.92 }
];

export function createSeaGeometry(innerR = 0, outerR = 36000, rings = 80, sectors = 96) {
  const geom = new THREE.BufferGeometry();
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let r = 0; r <= rings; r++) {
    // Non-linear radial distribution: dense grid near track/camera, stretched out to horizon
    const frac = r / rings;
    const radius = Math.pow(frac, 2.2) * outerR;

    for (let s = 0; s <= sectors; s++) {
      const angle = (s / sectors) * Math.PI * 2.0;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      positions.push(x, 0, z);
      uvs.push(x * 0.005, z * 0.005);
    }
  }

  for (let r = 0; r < rings; r++) {
    const rowA = r * (sectors + 1);
    const rowB = (r + 1) * (sectors + 1);

    for (let s = 0; s < sectors; s++) {
      const i0 = rowA + s;
      const i1 = rowA + s + 1;
      const i2 = rowB + s;
      const i3 = rowB + s + 1;

      indices.push(i0, i2, i1);
      indices.push(i1, i2, i3);
    }
  }

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  return geom;
}

export function createSeaMaterial(moonDir) {
  const uniforms = {
    uTime: { value: 0.0 },
    uMoonDir: { value: moonDir.clone().normalize() },
    uCamPos: { value: new THREE.Vector3() },
    uUnderK: { value: 0.0 },
    uLightningFlash: { value: 0.0 }
  };

  const vertexShader = `
    uniform float uTime;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vCrest;

    // 6 Gerstner swell parameters: amplitude, waveNumber, frequency, Q, dirX, dirZ
    void main() {
      vUv = uv;
      vec3 pos = position;

      // SWELL 1
      float a1 = 3.8; float k1 = 6.28318 / 180.0; float w1 = 18.0 * k1; float q1 = 0.55 / (k1 * a1 * 6.0);
      vec2 d1 = vec2(0.85, 0.52);
      float phase1 = dot(d1, pos.xz) * k1 - uTime * w1;
      float c1 = cos(phase1); float s1 = sin(phase1);

      // SWELL 2
      float a2 = 2.6; float k2 = 6.28318 / 110.0; float w2 = 14.5 * k2; float q2 = 0.45 / (k2 * a2 * 6.0);
      vec2 d2 = vec2(0.94, -0.34);
      float phase2 = dot(d2, pos.xz) * k2 - uTime * w2;
      float c2 = cos(phase2); float s2 = sin(phase2);

      // SWELL 3
      float a3 = 1.9; float k3 = 6.28318 / 75.0; float w3 = 12.0 * k3; float q3 = 0.40 / (k3 * a3 * 6.0);
      vec2 d3 = vec2(0.42, 0.91);
      float phase3 = dot(d3, pos.xz) * k3 - uTime * w3;
      float c3 = cos(phase3); float s3 = sin(phase3);

      // SWELL 4
      float a4 = 1.4; float k4 = 6.28318 / 48.0; float w4 = 9.5 * k4; float q4 = 0.35 / (k4 * a4 * 6.0);
      vec2 d4 = vec2(-0.71, 0.70);
      float phase4 = dot(d4, pos.xz) * k4 - uTime * w4;
      float c4 = cos(phase4); float s4 = sin(phase4);

      // SWELL 5
      float a5 = 0.9; float k5 = 6.28318 / 28.0; float w5 = 7.2 * k5; float q5 = 0.30 / (k5 * a5 * 6.0);
      vec2 d5 = vec2(0.98, 0.18);
      float phase5 = dot(d5, pos.xz) * k5 - uTime * w5;
      float c5 = cos(phase5); float s5 = sin(phase5);

      // SWELL 6
      float a6 = 0.6; float k6 = 6.28318 / 16.0; float w6 = 5.5 * k6; float q6 = 0.25 / (k6 * a6 * 6.0);
      vec2 d6 = vec2(-0.38, -0.92);
      float phase6 = dot(d6, pos.xz) * k6 - uTime * w6;
      float c6 = cos(phase6); float s6 = sin(phase6);

      // Displace position
      pos.x += (q1 * a1 * d1.x * c1 + q2 * a2 * d2.x * c2 + q3 * a3 * d3.x * c3 + q4 * a4 * d4.x * c4 + q5 * a5 * d5.x * c5 + q6 * a6 * d6.x * c6);
      pos.z += (q1 * a1 * d1.y * c1 + q2 * a2 * d2.y * c2 + q3 * a3 * d3.y * c3 + q4 * a4 * d4.y * c4 + q5 * a5 * d5.y * c5 + q6 * a6 * d6.y * c6);
      pos.y += (a1 * s1 + a2 * s2 + a3 * s3 + a4 * s4 + a5 * s5 + a6 * s6);

      // Analytical Gerstner surface normal
      float waSumX = (k1 * a1 * d1.x * c1 + k2 * a2 * d2.x * c2 + k3 * a3 * d3.x * c3 + k4 * a4 * d4.x * c4 + k5 * a5 * d5.x * c5 + k6 * a6 * d6.x * c6);
      float waSumZ = (k1 * a1 * d1.y * c1 + k2 * a2 * d2.y * c2 + k3 * a3 * d3.y * c3 + k4 * a4 * d4.y * c4 + k5 * a5 * d5.y * c5 + k6 * a6 * d6.y * c6);
      vec3 norm = normalize(vec3(-waSumX, 1.0, -waSumZ));

      vNormal = norm;
      vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
      vCrest = clamp((pos.y - 1.8) * 0.35, 0.0, 1.0);

      gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 uMoonDir;
    uniform vec3 uCamPos;
    uniform float uUnderK;
    uniform float uTime;
    uniform float uLightningFlash;

    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vCrest;

    // Pseudo-random hash for plankton sparkles
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec3 N = normalize(vNormal);
      vec3 V = normalize(uCamPos - vWorldPos);
      vec3 L = normalize(uMoonDir);
      vec3 H = normalize(L + V);

      // Fresnel reflection factor
      float NdotV = max(0.0, dot(N, V));
      float fresnel = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);

      // Deep ocean water color (indigo deep to oceanic teal surface)
      vec3 deepWater = vec3(0.008, 0.025, 0.055);
      vec3 shallowWater = vec3(0.02, 0.08, 0.14);
      vec3 waterColor = mix(deepWater, shallowWater, vCrest);

      // Moon glade specular glitter
      float NdotH = max(0.0, dot(N, H));
      float spec = pow(NdotH, 140.0) * 4.5 + pow(NdotH, 24.0) * 0.6;
      vec3 moonGlade = vec3(0.85, 0.92, 1.0) * spec;

      // Foam on breaking wave crests
      vec3 foamColor = vec3(0.82, 0.90, 0.96);
      float foamFrac = smoothstep(0.4, 0.95, vCrest);

      // Bioluminescent plankton (cyan-green sparkles in churning water)
      vec2 sparkUv = floor(vWorldPos.xz * 2.2 + uTime * 0.5);
      float sparkRnd = hash(sparkUv);
      float planktonSparkle = (sparkRnd > 0.97 ? 1.0 : 0.0) * vCrest * 2.2;
      vec3 planktonColor = vec3(0.05, 0.95, 0.75) * planktonSparkle;

      // Night sky reflection
      vec3 skyReflect = vec3(0.015, 0.025, 0.045);

      vec3 finalColor = mix(waterColor, skyReflect, fresnel) + moonGlade + foamColor * foamFrac * 0.65 + planktonColor;

      // Lightning flash illumination
      if (uLightningFlash > 0.01) {
        finalColor += vec3(0.35, 0.45, 0.65) * uLightningFlash * max(0.2, N.y);
      }

      // Underwater murk attenuation
      if (uUnderK > 0.01) {
        finalColor = mix(finalColor, vec3(0.01, 0.06, 0.09), uUnderK * 0.85);
      }

      gl_FragColor = vec4(finalColor, 0.92);
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    side: THREE.DoubleSide
  });
}

export class OceanAtmosphere {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.time = 0.0;

    // Moon direction: low NNE (key light, cold silver)
    this.moonDir = new THREE.Vector3(0.38, 0.24, -0.90).normalize();

    // Key moon directional light
    this.moonLight = new THREE.DirectionalLight(0xd8e6ff, 2.2);
    this.moonLight.position.copy(this.moonDir).multiplyScalar(15000);
    this.scene.add(this.moonLight);

    // Ocean storm lightning state
    this.lightningFlash = 0.0;
    this.nextLightningTime = 5.0;

    this._initSky();
    this._initSea();
  }

  _initSky() {
    this.sky = new THREE.Scene();
    this.skyCam = new THREE.PerspectiveCamera(65, 16 / 9, 50, 200000);

    // Huge Pale Moon low NNE
    const moonDist = 85000;
    const moonPos = this.moonDir.clone().multiplyScalar(moonDist);
    const moonGeo = new THREE.SphereGeometry(2400, 32, 32);

    // Pale moon material with cold silver glow
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xebf2fc,
      toneMapped: false
    });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.moonMesh.position.copy(moonPos);
    this.sky.add(this.moonMesh);

    // Moon halo glow disc
    const haloGeom = new THREE.PlaneGeometry(9000, 9000);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x3a6088,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const haloMesh = new THREE.Mesh(haloGeom, haloMat);
    haloMesh.position.copy(moonPos).multiplyScalar(0.99);
    haloMesh.lookAt(0, 0, 0);
    this.sky.add(haloMesh);

    // Dusk twilight red glow band on the western horizon
    const duskGeom = new THREE.CylinderGeometry(95000, 95000, 18000, 32, 1, true, -Math.PI * 0.75, Math.PI * 0.5);
    const duskMat = new THREE.MeshBasicMaterial({
      color: 0x44080a,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });
    const duskBand = new THREE.Mesh(duskGeom, duskMat);
    duskBand.position.set(0, -2000, 0);
    this.sky.add(duskBand);

    // Ragged storm cloud silhouettes
    this.clouds = [];
    const cloudGeom = new THREE.PlaneGeometry(16000, 5000);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0x050a12,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    for (let c = 0; c < 8; c++) {
      const cloud = new THREE.Mesh(cloudGeom, cloudMat.clone());
      const angle = (c * Math.PI) / 4.0;
      cloud.position.set(Math.cos(angle) * 70000, 12000 + (c % 3) * 3500, Math.sin(angle) * 70000);
      cloud.lookAt(0, cloud.position.y, 0);
      this.sky.add(cloud);
      this.clouds.push(cloud);
    }
  }

  _initSea() {
    this.seaGeom = createSeaGeometry();
    this.seaMat = createSeaMaterial(this.moonDir);
    this.seaMesh = new THREE.Mesh(this.seaGeom, this.seaMat);
    this.seaMesh.position.set(0, 0, 0);
    this.scene.add(this.seaMesh);
  }

  computeUnderK(camY) {
    // Optical model: above sea level = 0, below sea level = 1
    if (camY >= 0.0) return 0.0;
    return clamp(-camY / 75.0, 0.0, 1.0);
  }

  update(dt, camera) {
    this.time += dt;

    // Animate Gerstner ocean waves
    if (this.seaMat && this.seaMat.uniforms) {
      this.seaMat.uniforms.uTime.value = this.time;
      if (camera) {
        this.seaMat.uniforms.uCamPos.value.copy(camera.position);
        const underK = this.computeUnderK(camera.position.y);
        this.seaMat.uniforms.uUnderK.value = underK;
      }
    }

    // Drifting storm clouds
    for (let i = 0; i < this.clouds.length; i++) {
      this.clouds[i].rotation.y += dt * 0.008;
    }

    // Storm lightning flashes
    if (this.time > this.nextLightningTime) {
      this.lightningFlash = 1.0;
      this.nextLightningTime = this.time + 4.5 + Math.random() * 6.5;
    } else if (this.lightningFlash > 0.0) {
      this.lightningFlash = Math.max(0.0, this.lightningFlash - dt * 4.5);
    }

    if (this.seaMat && this.seaMat.uniforms) {
      this.seaMat.uniforms.uLightningFlash.value = this.lightningFlash;
    }

    // Update sky camera
    if (camera && this.skyCam) {
      this.skyCam.aspect = camera.aspect;
      this.skyCam.fov = camera.fov;
      this.skyCam.quaternion.copy(camera.quaternion);
      this.skyCam.updateProjectionMatrix();
    }
  }
}
