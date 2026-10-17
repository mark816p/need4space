// src/deck.js — Procedural deck, kerb, and energy-barrier materials
// Why: "the road had like a lot of straight lines" -> periodic noise in metres, round pebbles,
// worn paint, plates with bevelled seams and rivets, polished racing lanes

import * as THREE from 'three';
import { noise2, fbm } from './noise.js';

let _deckMaterial = null;
let _barrierMaterial = null;
let _padMaterial = null;
let _kerbMaterial = null;

export function createDeckTextures(width = 1024, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  // Normal canvas for tangent-space normals
  const nCanvas = document.createElement('canvas');
  nCanvas.width = width;
  nCanvas.height = height;
  const nCtx = nCanvas.getContext('2d');
  const nImgData = nCtx.createImageData(width, height);
  const nData = nImgData.data;

  // Roughness canvas
  const rCanvas = document.createElement('canvas');
  rCanvas.width = width;
  rCanvas.height = height;
  const rCtx = rCanvas.getContext('2d');
  const rImgData = rCtx.createImageData(width, height);
  const rData = rImgData.data;

  for (let y = 0; y < height; y++) {
    const v = y / height;
    // Seam lines every 0.25 (simulates 40m plates)
    const seamV = Math.abs((v % 0.25) - 0.125) * 8.0;
    const isSeam = seamV < 0.04;

    for (let x = 0; x < width; x++) {
      const u = x / width;
      // High-traffic racing groove in the middle lanes (u ~ 0.35 - 0.65)
      const centerDist = Math.abs(u - 0.5) * 2.0;
      const raceGroove = Math.exp(-centerDist * centerDist * 3.5);

      // Aggregate pebble grit noise
      const grit = fbm(u * 64.0, v * 64.0, 3, 2.0, 0.5);
      const microGrit = noise2(u * 256.0, v * 256.0);

      // Base composite tarmac / nano-ceramic deck plate
      let lum = 48 + grit * 26 + microGrit * 10;
      // Dark rubbered-in racing groove
      lum = lum * (1.0 - raceGroove * 0.35);

      // Bevelled plate seam
      if (isSeam) {
        lum *= 0.45;
      }

      const idx = (y * width + x) * 4;

      // Diffuse Color (dark carbon-ceramic with subtle cyan tint)
      data[idx] = Math.max(12, Math.min(180, lum * 0.95));
      data[idx + 1] = Math.max(15, Math.min(195, lum * 1.02));
      data[idx + 2] = Math.max(20, Math.min(215, lum * 1.12));
      data[idx + 3] = 255;

      // Normal Map (perturbations from grit and bevelled seams)
      let nx = (noise2(u * 128.0 + 1.0, v * 128.0) - noise2(u * 128.0 - 1.0, v * 128.0)) * 40.0;
      let ny = (noise2(u * 128.0, v * 128.0 + 1.0) - noise2(u * 128.0, v * 128.0 - 1.0)) * 40.0;
      if (isSeam) {
        ny += (v % 0.25 < 0.125 ? -60 : 60);
      }
      nData[idx] = Math.max(0, Math.min(255, 128 + nx));
      nData[idx + 1] = Math.max(0, Math.min(255, 128 + ny));
      nData[idx + 2] = 240;
      nData[idx + 3] = 255;

      // Roughness (rubbered racing groove is smoother/polished; seams and edges rougher)
      let rough = 0.82 - raceGroove * 0.45 + (1.0 - grit) * 0.15;
      if (isSeam) rough = 0.95;
      rData[idx] = Math.max(0, Math.min(255, rough * 255));
      rData[idx + 1] = rData[idx];
      rData[idx + 2] = rData[idx];
      rData[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  nCtx.putImageData(nImgData, 0, 0);
  rCtx.putImageData(rImgData, 0, 0);

  const diffuseTex = new THREE.CanvasTexture(canvas);
  diffuseTex.wrapS = THREE.RepeatWrapping;
  diffuseTex.wrapT = THREE.RepeatWrapping;
  diffuseTex.colorSpace = THREE.SRGBColorSpace;

  const normalTex = new THREE.CanvasTexture(nCanvas);
  normalTex.wrapS = THREE.RepeatWrapping;
  normalTex.wrapT = THREE.RepeatWrapping;

  const roughTex = new THREE.CanvasTexture(rCanvas);
  roughTex.wrapS = THREE.RepeatWrapping;
  roughTex.wrapT = THREE.RepeatWrapping;

  return { diffuse: diffuseTex, normal: normalTex, roughness: roughTex };
}

export function getDeckMaterial() {
  if (_deckMaterial) return _deckMaterial;
  const tex = createDeckTextures(1024, 1024);
  _deckMaterial = new THREE.MeshStandardMaterial({
    map: tex.diffuse,
    normalMap: tex.normal,
    roughnessMap: tex.roughness,
    roughness: 0.75,
    metalness: 0.25,
  });
  return _deckMaterial;
}

export function getKerbMaterial() {
  if (_kerbMaterial) return _kerbMaterial;
  // Red and white hazard alternating kerb texture
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff2233';
  ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(64, 0, 64, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  _kerbMaterial = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.6,
    metalness: 0.1
  });
  return _kerbMaterial;
}

export function getBarrierMaterial() {
  if (_barrierMaterial) return _barrierMaterial;
  // Semi-transparent energy forcefield barrier atop walls (height 5.0m)
  _barrierMaterial = new THREE.MeshBasicMaterial({
    color: 0x00d2ff,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  return _barrierMaterial;
}

export function getBoostPadMaterial() {
  if (_padMaterial) return _padMaterial;
  // Dynamic glowing chevron arrow for boost pads
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0a101d';
  ctx.fillRect(0, 0, 256, 512);

  ctx.fillStyle = '#ff7700';
  ctx.shadowColor = '#ffaa00';
  ctx.shadowBlur = 20;

  // 3 forward glowing chevrons
  for (let i = 0; i < 3; i++) {
    const yOff = 80 + i * 140;
    ctx.beginPath();
    ctx.moveTo(128, yOff);
    ctx.lineTo(220, yOff + 100);
    ctx.lineTo(185, yOff + 115);
    ctx.lineTo(128, yOff + 35);
    ctx.lineTo(71, yOff + 115);
    ctx.lineTo(36, yOff + 100);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  _padMaterial = new THREE.MeshBasicMaterial({
    map: tex,
    color: 0xffaa00,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  return _padMaterial;
}
