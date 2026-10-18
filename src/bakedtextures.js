// src/bakedtextures.js — Baked texture loader with automatic procedural fallback
// Why: High-speed loading campaign; pre-baked terrain/deck textures bypass procedural canvas noise generation
// while ensuring zero-configuration fallback if binary baked assets are missing or offline.

import * as THREE from 'three';

const textureCache = new Map();

/**
 * Load a pre-baked texture from assets/bakes/, falling back to procedural generation.
 * @param {string} name - Base name of the bake (e.g. 'rock_forest', 'sandstone_desert', 'deck_hull')
 * @param {Function} proceduralGenerator - Fallback function returning a HTMLCanvasElement or THREE.Texture
 * @param {Object} options - Texture configuration (wrapS, wrapT, repeat, etc.)
 * @returns {Promise<THREE.Texture>}
 */
export async function loadBakedTexture(name, proceduralGenerator, options = {}) {
  if (textureCache.has(name)) {
    return textureCache.get(name);
  }

  const bakedPath = `assets/bakes/${name}.png`;

  // Attempt to load pre-baked asset
  const texture = await new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      // In headless environment, execute fallback immediately
      const fallback = proceduralGenerator ? proceduralGenerator() : null;
      resolve(fallback instanceof THREE.Texture ? fallback : new THREE.CanvasTexture(fallback));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.needsUpdate = true;
      resolve(tex);
    };

    img.onerror = () => {
      // Missing bake or network error: cleanly invoke procedural generator
      try {
        const fallback = proceduralGenerator ? proceduralGenerator() : null;
        if (fallback instanceof THREE.Texture) {
          resolve(fallback);
        } else if (fallback) {
          const tex = new THREE.CanvasTexture(fallback);
          resolve(tex);
        } else {
          // Empty 1x1 magenta fallback
          const canvas = document.createElement('canvas');
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ff00ff';
          ctx.fillRect(0, 0, 1, 1);
          resolve(new THREE.CanvasTexture(canvas));
        }
      } catch (err) {
        console.warn(`[BakedTextures] Fallback failed for ${name}:`, err);
        resolve(new THREE.Texture());
      }
    };

    img.src = bakedPath;
  });

  // Apply texture options
  if (options.wrapS !== undefined) texture.wrapS = options.wrapS;
  if (options.wrapT !== undefined) texture.wrapT = options.wrapT;
  if (options.repeat) texture.repeat.copy(options.repeat);
  if (options.magFilter) texture.magFilter = options.magFilter;
  if (options.minFilter) texture.minFilter = options.minFilter;
  if (options.generateMipmaps !== undefined) texture.generateMipmaps = options.generateMipmaps;

  texture.needsUpdate = true;
  textureCache.set(name, texture);
  return texture;
}

/**
 * Clear the texture cache.
 */
export function clearBakedTextureCache() {
  textureCache.clear();
}
