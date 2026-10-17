// src/noise.js — Deterministic noise and mathematical utilities
// Why: deterministic procedural generation across all clients without frame-to-frame allocation

export function clamp(val, min, max) {
  return val < min ? min : val > max ? max : val;
}

// Exponential damping factor / smoother:
// Call damp(k, dt) -> factor: 1 - exp(-k * dt)
// Call damp(current, target, k, dt) -> smoothly lerps current towards target: lerp(current, target, 1 - exp(-k * dt))
export function damp(a, b, c, d) {
  if (c !== undefined && d !== undefined) {
    return a + (b - a) * (1.0 - Math.exp(-c * d));
  }
  if (b !== undefined) {
    return 1.0 - Math.exp(-a * b);
  }
  return 1.0 - Math.exp(-a * (1.0 / 60.0));
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Mulberry32: fast 32-bit seeded pseudo-random number generator
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Permutation table for deterministic 2D/3D noise
const PERM = new Uint8Array(512);
const P_SRC = [
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,
  8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,
  35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,
  134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,
  55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,
  18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,
  250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,
  189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,
  172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,
  228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,
  107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,
  138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
];
for (let i = 0; i < 256; i++) {
  PERM[i] = P_SRC[i];
  PERM[i + 256] = P_SRC[i];
}

function fade(t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

function grad2(hash, x, y) {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
}

// 2D Perlin noise in range [-1, 1]
export function noise2(x, y) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = fade(xf);
  const v = fade(yf);

  const A = PERM[X] + Y;
  const B = PERM[X + 1] + Y;

  const g00 = grad2(PERM[A], xf, yf);
  const g10 = grad2(PERM[B], xf - 1.0, yf);
  const g01 = grad2(PERM[A + 1], xf, yf - 1.0);
  const g11 = grad2(PERM[B + 1], xf - 1.0, yf - 1.0);

  const x1 = lerp(g00, g10, u);
  const x2 = lerp(g01, g11, u);

  return lerp(x1, x2, v);
}

// Fractal Brownian Motion
export function fbm(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let sum = 0.0;
  let amp = 1.0;
  let freq = 1.0;
  let maxAmp = 0.0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq);
    maxAmp += amp;
    freq *= lacunarity;
    amp *= gain;
  }
  return sum / maxAmp;
}
