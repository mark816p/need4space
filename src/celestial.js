// src/celestial.js — Procedural celestial texture painters and shaders
// Why: User brief: "make the sun and the planets way more detailed, and high quality"
// Everything baked once into canvas/GPU textures at load time to avoid runtime hitches

import * as THREE from 'three';
import { noise2, fbm } from './noise.js';

// Procedural gas-giant texture (zonal jet streams, turbulent eddies, Great Storm)
export function createGasGiantTexture(width = 2048, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  // Base palette for ringed gas giant (golden amber, ochre, pearl, deep terracotta)
  const bandColors = [
    [230, 210, 180], // Cream zone
    [195, 130, 75],  // Terracotta belt
    [220, 175, 120], // Light amber zone
    [160, 95, 55],   // Dark brown belt
    [240, 225, 200], // Equatorial white zone
    [180, 115, 65],  // South equatorial belt
    [210, 160, 110], // South tropical zone
    [140, 80, 50],   // South polar hood
  ];

  for (let y = 0; y < height; y++) {
    const v = y / height;
    const lat = (v - 0.5) * Math.PI; // -PI/2 to PI/2

    // Zonal band index with harmonic distortion
    const bandPos = Math.sin(lat * 9.0) * 0.5 + 0.5;
    const bandIdx = (v * (bandColors.length - 1)) | 0;
    const nextIdx = Math.min(bandIdx + 1, bandColors.length - 1);
    const bandFrac = (v * (bandColors.length - 1)) - bandIdx;

    const baseR = bandColors[bandIdx][0] * (1 - bandFrac) + bandColors[nextIdx][0] * bandFrac;
    const baseG = bandColors[bandIdx][1] * (1 - bandFrac) + bandColors[nextIdx][1] * bandFrac;
    const baseB = bandColors[bandIdx][2] * (1 - bandFrac) + bandColors[nextIdx][2] * bandFrac;

    for (let x = 0; x < width; x++) {
      const u = x / width;
      const lon = u * Math.PI * 2.0;

      // Zonal shearing noise (simulates supersonic wind shear at latitudes)
      const shearX = u * 12.0 + Math.sin(lat * 16.0) * 1.5;
      const shearY = v * 24.0;
      const n1 = fbm(shearX, shearY, 4, 2.0, 0.5);
      const n2 = noise2(shearX * 2.0 + n1 * 1.5, shearY * 2.0);

      // Great Red Storm Oval near 22 deg South latitude
      const stormLon = 0.62;
      const stormLat = 0.64;
      const dLon = Math.abs(u - stormLon);
      const dLat = Math.abs(v - stormLat);
      const stormDist = Math.sqrt((dLon * 3.5) ** 2 + (dLat * 6.0) ** 2);
      let stormInfluence = 0.0;
      if (stormDist < 1.0) {
        const stormVortex = Math.sin(stormDist * Math.PI * 4.0 + n1 * 3.0);
        stormInfluence = (1.0 - stormDist) * (0.8 + 0.2 * stormVortex);
      }

      let r = baseR + n1 * 45.0 - n2 * 25.0;
      let g = baseG + n1 * 25.0 - n2 * 35.0;
      let b = baseB + n1 * 10.0 - n2 * 40.0;

      // Storm coloration (vibrant crimson-amber core)
      if (stormInfluence > 0.0) {
        r = r * (1 - stormInfluence) + 225.0 * stormInfluence;
        g = g * (1 - stormInfluence) + 75.0 * stormInfluence;
        b = b * (1 - stormInfluence) + 45.0 * stormInfluence;
      }

      const idx = (y * width + x) * 4;
      data[idx] = Math.max(0, Math.min(255, r));
      data[idx + 1] = Math.max(0, Math.min(255, g));
      data[idx + 2] = Math.max(0, Math.min(255, b));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural Saturn-like rings texture with Cassini division
export function createRingsTexture(width = 1024, height = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let x = 0; x < width; x++) {
    const r = x / width; // 0 = inner radius, 1 = outer radius
    let density = 0.0;
    let col = [220, 205, 180]; // Warm icy dust

    // Ring system zones: C ring, B ring (dense), Cassini Division, A ring, Encke gap
    if (r >= 0.05 && r < 0.25) {
      // C Ring (faint, semi-transparent)
      density = 0.25 + 0.15 * Math.sin(r * 180.0);
      col = [160, 150, 140];
    } else if (r >= 0.25 && r < 0.65) {
      // B Ring (brightest and densest)
      density = 0.85 + 0.12 * Math.sin(r * 400.0) + 0.05 * Math.cos(r * 900.0);
      col = [240, 225, 200];
    } else if (r >= 0.65 && r < 0.72) {
      // Cassini Division (near void)
      density = 0.03 * Math.random();
    } else if (r >= 0.72 && r < 0.96) {
      // A Ring
      density = 0.65 + 0.15 * Math.sin(r * 320.0);
      // Encke gap
      if (r >= 0.88 && r < 0.90) density = 0.02;
    } else {
      density = 0.0;
    }

    const alpha = Math.max(0, Math.min(255, density * 255));
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      data[idx] = col[0];
      data[idx + 1] = col[1];
      data[idx + 2] = col[2];
      data[idx + 3] = alpha;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural cratered moon texture
export function createMoonTexture(width = 1024, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  // Pre-seed craters (x, y, radius, depth)
  const craters = [];
  for (let i = 0; i < 90; i++) {
    craters.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 4.0 + Math.random() * 45.0,
      depth: 0.3 + Math.random() * 0.7
    });
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const v = y / height;

      // Base lunar maria (dark volcanic plains) and highlands (bright anorthosite)
      const highland = fbm(u * 6.0, v * 6.0, 5, 2.0, 0.5);
      let lum = 120 + highland * 90;

      // Crater stamping
      for (let i = 0; i < craters.length; i++) {
        const c = craters[i];
        let dx = Math.abs(x - c.x);
        if (dx > width * 0.5) dx = width - dx;
        const dy = y - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < c.r) {
          const rimDist = Math.abs(dist - c.r * 0.85);
          if (rimDist < c.r * 0.15) {
            // Raised bright crater rim
            lum += 45 * c.depth;
          } else if (dist < c.r * 0.85) {
            // Depressed dark crater floor
            lum -= 35 * c.depth;
          }
        }
      }

      lum = Math.max(25, Math.min(235, lum));
      const idx = (y * width + x) * 4;
      data[idx] = lum;
      data[idx + 1] = lum * 0.96;
      data[idx + 2] = lum * 0.92;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Live boiling granulation sun shader material
// Why: "the sun's surface boils live (granulation, spots) inside a corona"
export function createSunMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uSunColor: { value: new THREE.Color(0xfff5ea) },
      uCoreColor: { value: new THREE.Color(0xffaa22) },
      uSpotColor: { value: new THREE.Color(0xd43300) }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vViewPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunColor;
      uniform vec3 uCoreColor;
      uniform vec3 uSpotColor;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vViewPos;

      // Simplex-like cellular noise for granulation
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float voronoi(vec2 x) {
        vec2 n = floor(x);
        vec2 f = fract(x);
        float m = 8.0;
        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash(n + g) * vec2(0.8) + vec2(0.1);
            vec2 r = g - f + o;
            float d = dot(r, r);
            if (d < m) m = d;
          }
        }
        return sqrt(m);
      }

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPos);
        float limb = clamp(dot(normal, viewDir), 0.0, 1.0);

        // Granulation convective cells
        vec2 uv = vUv * 64.0;
        float t = uTime * 0.12;
        float g1 = voronoi(uv + vec2(t * 0.3, t * 0.2));
        float g2 = voronoi(uv * 1.5 - vec2(t * 0.2, -t * 0.3));
        float gran = mix(g1, g2, 0.5);

        // Sunspots
        float spotNoise = noise(vUv * 12.0 + vec2(t * 0.05));
        float spot = smoothstep(0.72, 0.85, spotNoise);

        // Solar limb darkening: edge is darker orange, center is incandescent white
        vec3 col = mix(uCoreColor, uSunColor, pow(limb, 0.6));
        col = mix(col, uCoreColor * 0.8, gran * 0.35);
        col = mix(col, uSpotColor, spot * 0.7);

        // Intense emission
        gl_FragColor = vec4(col * 2.2, 1.0);
      }
    `,
    side: THREE.FrontSide
  });
}
