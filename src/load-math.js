// src/load-math.js — Pure numeric calculation kernels for procedural generation and workers
// Why: Decoupled numeric math with zero DOM/Three.js dependencies for parallel execution in Web Workers

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// 2D Noise Kernel
export function hash2d(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) & 0x7fffffff) / 2147483647.0;
}

// Perlin-style value noise
export function valueNoise2D(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const u = xf * xf * (3.0 - 2.0 * xf);
  const v = yf * yf * (3.0 - 2.0 * yf);

  const n00 = hash2d(xi, yi);
  const n10 = hash2d(xi + 1, yi);
  const n01 = hash2d(xi, yi + 1);
  const n11 = hash2d(xi + 1, yi + 1);

  const x1 = lerp(n00, n10, u);
  const x2 = lerp(n01, n11, u);
  return lerp(x1, x2, v);
}

// Fractal Brownian Motion (FBM)
export function fbm2D(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
  let total = 0.0;
  let frequency = 1.0;
  let amplitude = 1.0;
  let maxValue = 0.0;

  for (let i = 0; i < octaves; i++) {
    total += valueNoise2D(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return total / maxValue;
}

// Generate heightmap grid chunk
export function generateHeightmapChunk(startX, startZ, sizeX, sizeZ, scale = 0.02, heightScale = 40.0) {
  const heights = new Float32Array(sizeX * sizeZ);
  for (let z = 0; z < sizeZ; z++) {
    for (let x = 0; x < sizeX; x++) {
      const worldX = (startX + x) * scale;
      const worldZ = (startZ + z) * scale;
      const h = fbm2D(worldX, worldZ, 5, 0.5, 2.0) * heightScale;
      heights[z * sizeX + x] = h;
    }
  }
  return heights;
}
