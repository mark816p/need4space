// src/deck.js — Procedural deck, kerb, and energy-barrier materials
// Why: "the road had like a lot of straight lines" -> periodic noise in metres, round pebbles,
// worn paint, plates with bevelled seams and rivets, polished racing lanes
// Widen road 44 -> 56 m (TRACK_W = 56): room for five Feathers (10.3 m) abreast and multiple lines

import * as THREE from 'three';
import { noise2, fbm } from './noise.js';

let _deckMaterial = null;
let _barrierMaterial = null;
let _padMaterial = null;
let _kerbMaterial = null;

export function createDeckTextures(width = 1024, height = 1024) {
  if (typeof document === 'undefined') {
    // Headless DOM guard: construct dummy 4x4 DataTextures
    const dummyData = new Uint8Array(16 * 4);
    dummyData.fill(128);
    const dTex = new THREE.DataTexture(dummyData, 4, 4);
    dTex.needsUpdate = true;
    return { diffuse: dTex, normal: dTex, roughness: dTex };
  }

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

  // 56m road width layout:
  // 5 distinct lanes across width (u = 0.1, 0.3, 0.5, 0.7, 0.9)
  // Longitudinal seams between plates at u = 0.2, 0.4, 0.6, 0.8
  // Transverse seams every 40m along length (v % 0.25 == 0)
  const laneCenters = [0.1, 0.3, 0.5, 0.7, 0.9];
  const longSeams = [0.2, 0.4, 0.6, 0.8];

  for (let y = 0; y < height; y++) {
    const v = y / height;
    const transverseSeamDist = Math.abs((v % 0.25) - 0.125) * 8.0;
    const isTransverseSeam = transverseSeamDist < 0.045;

    for (let x = 0; x < width; x++) {
      const u = x / width;

      // 1. Five polished racing lines (room for 5 Feathers abreast)
      let minLaneDist = 1.0;
      for (let l = 0; l < laneCenters.length; l++) {
        const d = Math.abs(u - laneCenters[l]);
        if (d < minLaneDist) minLaneDist = d;
      }
      // Polished groove in each lane
      const laneGroove = Math.exp(-minLaneDist * minLaneDist * 160.0);

      // 2. Longitudinal and transverse plate seams
      let minSeamDist = 1.0;
      for (let s = 0; s < longSeams.length; s++) {
        const d = Math.abs(u - longSeams[s]);
        if (d < minSeamDist) minSeamDist = d;
      }
      const isLongSeam = minSeamDist < 0.008;
      const isSeam = isTransverseSeam || isLongSeam;

      // 3. Rivets along plate edges
      const isRivetLine = (minSeamDist > 0.012 && minSeamDist < 0.02) || (transverseSeamDist > 0.06 && transverseSeamDist < 0.09);
      const rivetPhase = Math.sin(u * 120.0 * Math.PI) * Math.sin(v * 160.0 * Math.PI);
      const isRivet = isRivetLine && rivetPhase > 0.82;

      // 4. Aggregate noise and worn paint
      const grit = fbm(u * 64.0, v * 64.0, 3, 2.0, 0.5);
      const microGrit = noise2(u * 256.0, v * 256.0);
      const wornPaint = noise2(u * 16.0, v * 16.0);

      // Carbon weave micro-texture for high-tech composite aerospace appearance
      const carbonWeave = Math.sin((u * 440.0 + v * 440.0) * Math.PI) * Math.sin((u * 440.0 - v * 440.0) * Math.PI);

      // Base carbon-ceramic deck plate
      let lum = 46 + grit * 26 + microGrit * 8 + carbonWeave * 4;
      if (wornPaint > 0.4) lum += 14; // Weathered markings / bleached resin

      // Dark rubbered racing lanes
      lum = lum * (1.0 - laneGroove * 0.32);

      // Bevelled seams
      if (isSeam) lum *= 0.42;
      if (isRivet) lum += 42; // Bright metallic rivet head

      const idx = (y * width + x) * 4;

      // Diffuse Color (high-durability titanium-ceramic composite)
      data[idx] = Math.max(12, Math.min(190, lum * 0.94));
      data[idx + 1] = Math.max(15, Math.min(205, lum * 1.02));
      data[idx + 2] = Math.max(20, Math.min(225, lum * 1.14));
      data[idx + 3] = 255;

      // Normal Map (perturbations from pebble grit, carbon weave, bevelled seams, and rivets)
      let nx = (noise2(u * 128.0 + 1.0, v * 128.0) - noise2(u * 128.0 - 1.0, v * 128.0)) * 36.0;
      let ny = (noise2(u * 128.0, v * 128.0 + 1.0) - noise2(u * 128.0, v * 128.0 - 1.0)) * 36.0;

      // Subtle directional carbon weave normal
      nx += carbonWeave * 6.0;
      ny += carbonWeave * 6.0;

      if (isTransverseSeam) {
        ny += ((v % 0.25) < 0.125 ? -60 : 60);
      }
      if (isLongSeam) {
        nx += ((u % 0.2) < 0.1 ? -60 : 60);
      }
      if (isRivet) {
        nx += (rivetPhase > 0 ? 45 : -45);
        ny += (rivetPhase > 0 ? 45 : -45);
      }

      nData[idx] = Math.max(0, Math.min(255, 128 + nx));
      nData[idx + 1] = Math.max(0, Math.min(255, 128 + ny));
      nData[idx + 2] = 240;
      nData[idx + 3] = 255;

      // Roughness (rubbered racing lanes are slick; seams and grit are rougher)
      let rough = 0.78 - laneGroove * 0.52 + (1.0 - grit) * 0.10;
      if (isSeam) rough = 0.95;
      if (isRivet) rough = 0.20; // High specular reflective rivets
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
    roughness: 0.68,
    metalness: 0.32,
  });
  return _deckMaterial;
}

export function getKerbMaterial() {
  if (_kerbMaterial) return _kerbMaterial;
  if (typeof document === 'undefined') {
    _kerbMaterial = new THREE.MeshStandardMaterial({ color: 0xff2233 });
    return _kerbMaterial;
  }
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
  if (typeof document === 'undefined') {
    _padMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    return _padMaterial;
  }
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
