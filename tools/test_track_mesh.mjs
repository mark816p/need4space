// tools/test_track_mesh.mjs — Verify track meshes, buffers, and materials headlessly
import * as THREE from 'three';
import { createSpaceTrack } from '../src/track.js';

console.log('Testing Track Meshes in Node.js...');

// Mock browser canvas/DOM for procedural textures in Node.js if needed
if (typeof document === 'undefined') {
  globalThis.document = {
    createElement(type) {
      if (type === 'canvas') {
        const width = 256;
        const height = 256;
        const buffer = new Uint8ClampedArray(width * height * 4);
        return {
          width,
          height,
          getContext() {
            return {
              createImageData(w, h) {
                return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
              },
              putImageData() {},
              fillRect() {},
              beginPath() {},
              moveTo() {},
              lineTo() {},
              closePath() {},
              fill() {},
              fillStyle: '',
              shadowColor: '',
              shadowBlur: 0
            };
          }
        };
      }
      return {};
    }
  };
}

const track = createSpaceTrack();
console.log(`Track created: length=${track.length.toFixed(1)}m, steps=${track.n}`);

const scene = new THREE.Scene();
const meshes = track.meshes(scene);

console.log('Meshes group created:', meshes.name);

// Verify each expected child group/mesh
const expectedNames = [
  'track_deck',
  'track_kerbs',
  'track_walls',
  'track_underhull',
  'track_barriers',
  'gap_lips',
  'gantries',
  'start_gantry',
  'boost_pads',
  'light_gates',
  'glass_tunnel'
];

let totalVertices = 0;
let totalFaces = 0;

for (const name of expectedNames) {
  const child = meshes.getObjectByName(name);
  if (!child) {
    console.error(`FAIL: Missing expected track component '${name}'`);
    process.exit(1);
  }

  if (child.isMesh) {
    const pos = child.geometry.attributes.position;
    const count = pos.count;
    const indexCount = child.geometry.index ? child.geometry.index.count : count;
    totalVertices += count;
    totalFaces += indexCount / 3;

    // Check for NaN positions
    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
        console.error(`FAIL: NaN detected in vertex ${i} of ${name}`);
        process.exit(1);
      }
    }
    console.log(`  ✓ ${name}: ${count} vertices, ${indexCount / 3} faces`);
  } else if (child.isGroup) {
    console.log(`  ✓ ${name}: Group with ${child.children.length} sub-elements`);
  }
}

console.log(`Total track geometry: ${totalVertices} vertices, ${totalFaces} faces`);
console.log('PASS: Track mesh generation verified without error.');
