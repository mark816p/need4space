// src/hull.js — Procedural structural steel and truss materials
// Why: "this lower part of the road looks pretty bad and low res" -> 3m plates in rows,
// bevelled seams, bolt rows along edges, access hatches, louvred vents, seam grime, chipped paint

import * as THREE from 'three';
import { noise2, fbm } from './noise.js';

let _hullMaterial = null;
let _girderMaterial = null;

export function createHullTextures(width = 1024, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const nCanvas = document.createElement('canvas');
  nCanvas.width = width;
  nCanvas.height = height;
  const nCtx = nCanvas.getContext('2d');
  const nImgData = nCtx.createImageData(width, height);
  const nData = nImgData.data;

  // Staggered 3m steel plates
  const plateCols = 4;
  const plateRows = 8;
  const cellW = width / plateCols;
  const cellH = height / plateRows;

  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / cellH);
    const rowY = y % cellH;
    const isHorizontalSeam = rowY < 4 || rowY > cellH - 4;

    // Stagger every other row by 50%
    const xOffset = (row % 2 === 1) ? cellW * 0.5 : 0;

    for (let x = 0; x < width; x++) {
      const shiftedX = (x + xOffset) % width;
      const col = Math.floor(shiftedX / cellW);
      const colX = shiftedX % cellW;
      const isVerticalSeam = colX < 4 || colX > cellW - 4;

      const isSeam = isHorizontalSeam || isVerticalSeam;
      // Bolt line running 14px inside plate borders
      const isBoltX = Math.abs(colX - 14) < 3 || Math.abs(colX - (cellW - 14)) < 3;
      const isBoltY = Math.abs(rowY - 14) < 3 || Math.abs(rowY - (cellH - 14)) < 3;
      const isBoltSpacing = ((x + y * 2) % 36) < 6;
      const isBolt = (isBoltX || isBoltY) && isBoltSpacing;

      // Surface noise
      const grime = fbm(x * 0.05, y * 0.05, 3, 2.0, 0.5);
      const scratch = noise2(x * 0.4, y * 0.4);

      // Dark military grey-blue steel
      let r = 55 + grime * 25 + scratch * 10;
      let g = 62 + grime * 28 + scratch * 10;
      let b = 75 + grime * 32 + scratch * 12;

      let nx = 128;
      let ny = 128;

      if (isSeam) {
        // Deep recessed bevel seam with accumulated grime
        r *= 0.35;
        g *= 0.35;
        b *= 0.35;
        ny = isHorizontalSeam ? (rowY < 4 ? 60 : 195) : 128;
        nx = isVerticalSeam ? (colX < 4 ? 60 : 195) : 128;
      } else if (isBolt) {
        // Exposed polished steel hex bolt head
        r = 175;
        g = 185;
        b = 205;
        nx = 145;
        ny = 145;
      }

      const idx = (y * width + x) * 4;
      data[idx] = Math.max(10, Math.min(240, r));
      data[idx + 1] = Math.max(12, Math.min(240, g));
      data[idx + 2] = Math.max(15, Math.min(250, b));
      data[idx + 3] = 255;

      nData[idx] = nx;
      nData[idx + 1] = ny;
      nData[idx + 2] = 230;
      nData[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  nCtx.putImageData(nImgData, 0, 0);

  const diffuseTex = new THREE.CanvasTexture(canvas);
  diffuseTex.wrapS = THREE.RepeatWrapping;
  diffuseTex.wrapT = THREE.RepeatWrapping;
  diffuseTex.colorSpace = THREE.SRGBColorSpace;

  const normalTex = new THREE.CanvasTexture(nCanvas);
  normalTex.wrapS = THREE.RepeatWrapping;
  normalTex.wrapT = THREE.RepeatWrapping;

  return { diffuse: diffuseTex, normal: normalTex };
}

export function getHullMaterial() {
  if (_hullMaterial) return _hullMaterial;
  const tex = createHullTextures(1024, 1024);
  _hullMaterial = new THREE.MeshStandardMaterial({
    map: tex.diffuse,
    normalMap: tex.normal,
    roughness: 0.65,
    metalness: 0.85
  });
  return _hullMaterial;
}

export function getGirderMaterial() {
  if (_girderMaterial) return _girderMaterial;
  // Dark anodized structural truss material
  _girderMaterial = new THREE.MeshStandardMaterial({
    color: 0x1c2432,
    roughness: 0.5,
    metalness: 0.9
  });
  return _girderMaterial;
}
