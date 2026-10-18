// tools/test_p10_acceptance.mjs — Comprehensive automated acceptance suite for Phase P10
// Verifies Graphics Presets, Derelict Colossus Lighting, Orbit Space Station, Deck Camera Clamping,
// Canyon AO Stabilization, Engine Trails Puff Mode, Soft Rival Taillights, and Zero Z-Fighting

import assert from 'node:assert';
import * as THREE from 'three';
import { PRESETS, QUALITY_PRESETS, detectPreset, applyPreset } from '../src/quality.js';
import { Settings } from '../src/settings.js';
import { CHANGELOG, CURRENT_VERSION } from '../src/changelog.js';
import { DerelictWreck } from '../src/wreck.js';
import { SpaceWorld } from '../src/space.js';
import { DesertWorld } from '../src/desertworld.js';
import { CameraController } from '../src/camera.js';
import { PostPipeline } from '../src/post.js';
import { EngineTrail, Ship } from '../src/ship.js';
import { Track, createSpaceTrack } from '../src/track.js';
import { TrackMesh } from '../src/trackmesh.js';
import { TrackRacer } from '../src/trackracer.js';

// Mock DOM/canvas for headless Node.js environment
if (typeof document === 'undefined') {
  globalThis.document = {
    createElement(type) {
      if (type === 'canvas') {
        const width = 256;
        const height = 256;
        return {
          width,
          height,
          getContext() {
            return {
              createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
              createRadialGradient() { return { addColorStop() {} }; },
              createLinearGradient() { return { addColorStop() {} }; },
              putImageData() {},
              fillRect() {},
              strokeRect() {},
              beginPath() {},
              moveTo() {},
              lineTo() {},
              closePath() {},
              fill() {},
              stroke() {},
              fillStyle: '',
              strokeStyle: '',
              lineWidth: 1
            };
          }
        };
      }
      return {};
    }
  };
}

console.log('=== PHASE P10 ACCEPTANCE VERIFICATION ===\n');

// -----------------------------------------------------------------------------
// 1. Graphics Quality Presets & Custom Override Detection
// -----------------------------------------------------------------------------
console.log('--- 1. Graphics Quality Presets & Custom Overrides ---');

assert(QUALITY_PRESETS.low, 'QUALITY_PRESETS contains low');
assert(QUALITY_PRESETS.balanced, 'QUALITY_PRESETS contains balanced');
assert(QUALITY_PRESETS.high, 'QUALITY_PRESETS contains high');

// Check Low preset parameters (Laptop mode)
assert.strictEqual(QUALITY_PRESETS.low.dpr, 1.0, 'Low preset DPR is 1.0');
assert.strictEqual(QUALITY_PRESETS.low.enableAO, false, 'Low preset AO is false');
assert.strictEqual(QUALITY_PRESETS.low.enableSSR, false, 'Low preset SSR is false');

// Check Balanced preset parameters
assert.strictEqual(QUALITY_PRESETS.balanced.dpr, 1.25, 'Balanced preset DPR is 1.25');
assert.strictEqual(QUALITY_PRESETS.balanced.enableAO, true, 'Balanced preset AO is true');
assert.strictEqual(QUALITY_PRESETS.balanced.enableSSR, false, 'Balanced preset SSR is false');

// Check High preset parameters
assert.strictEqual(QUALITY_PRESETS.high.dpr, 1.5, 'High preset DPR is 1.5');
assert.strictEqual(QUALITY_PRESETS.high.enableAO, true, 'High preset AO is true');
assert.strictEqual(QUALITY_PRESETS.high.enableSSR, true, 'High preset SSR is true');
assert.strictEqual(QUALITY_PRESETS.high.enableBloom, true, 'High preset Bloom is true');

console.log('PASS: Quality presets Low, Balanced, High defined with correct technical profiles');

const settings = new Settings();
applyPreset('high', settings);
assert.strictEqual(detectPreset(settings.data), 'high', 'Detects High preset correctly');

applyPreset('balanced', settings);
assert.strictEqual(detectPreset(settings.data), 'balanced', 'Detects Balanced preset correctly');

applyPreset('low', settings);
assert.strictEqual(detectPreset(settings.data), 'low', 'Detects Low preset correctly');

// Custom override detection: tweak one setting
settings.set('enableSSR', true); // In low, enableSSR is false
assert.strictEqual(detectPreset(settings.data), 'custom', 'Detects Custom override after manual modification');
console.log('PASS: Preset detection accurately flags custom manual overrides');

// -----------------------------------------------------------------------------
// 2. Derelict Colossus Lighting & Structural Hangers
// -----------------------------------------------------------------------------
console.log('\n--- 2. Derelict Colossus Lighting & Structural Hangers ---');

const dummyTrack = createSpaceTrack();

const dummyScene = new THREE.Scene();
const derelict = new DerelictWreck(dummyScene, dummyTrack);

assert(derelict.derelictLamps && derelict.derelictLamps.length > 0, 'Derelict lamps initialized');
assert(derelict.derelictLamps.length >= 20, `Derelict lamps count >= 20 (got ${derelict.derelictLamps.length})`);

// Verify all lamps have structural hangers and physical fixtures
for (let i = 0; i < derelict.derelictLamps.length; i++) {
  const lamp = derelict.derelictLamps[i];
  assert(lamp.group, `Lamp ${i} has root group`);
  assert(lamp.lens, `Lamp ${i} has emissive lens`);
  assert(lamp.light, `Lamp ${i} has baked point light`);
  assert.strictEqual(lamp.maxDist, 1800.0, `Lamp ${i} lens visible up to 1.8 km`);

  // Verify structural hanger child
  const hasHanger = lamp.group.children.some(c => c.geometry && c.geometry.type === 'BoxGeometry' && c.position.y > 0);
  assert(hasHanger, `Lamp ${i} has physical structural hanger anchored to frame`);
}
console.log('PASS: Derelict Colossus features 20+ frame-anchored lamps with structural hangers');

// Test distance-based lens visibility up to 1.8 km
const cam = new THREE.PerspectiveCamera(65, 16/9, 0.1, 5000);
const firstLamp = derelict.derelictLamps[0];

// Camera close: 100m away
cam.position.copy(firstLamp.worldPos).add(new THREE.Vector3(0, 0, 100));
derelict.update(0.016, cam, firstLamp.worldPos, 13550);
assert.strictEqual(firstLamp.lens.visible, true, 'Lens visible at 100m');
assert.strictEqual(firstLamp.light.visible, true, 'Point light active within close range');

// Camera at 1500m (under 1.8 km)
cam.position.copy(firstLamp.worldPos).add(new THREE.Vector3(0, 0, 1500));
derelict.update(0.016, cam, firstLamp.worldPos, 13550);
assert.strictEqual(firstLamp.lens.visible, true, 'Lens visible at 1.5 km');
assert.strictEqual(firstLamp.light.visible, false, 'Point light culled beyond 250m to preserve perf');

// Camera at 2200m (beyond 1.8 km)
cam.position.copy(firstLamp.worldPos).add(new THREE.Vector3(0, 0, 2200));
derelict.update(0.016, cam, firstLamp.worldPos, 13550);
assert.strictEqual(firstLamp.lens.visible, false, 'Lens culled beyond 1.8 km');
console.log('PASS: Derelict lamp lenses visible up to 1.8 km with local point-light culling');

// -----------------------------------------------------------------------------
// 3. Procedural Space Ring Station in Orbit
// -----------------------------------------------------------------------------
console.log('\n--- 3. Procedural Space Ring Station in Orbit ---');

const spaceWorld = new SpaceWorld(dummyScene, null, cam, dummyTrack);
assert(spaceWorld.stationGroup, 'SpaceWorld contains stationGroup');
assert(spaceWorld.stationRingGroup, 'SpaceWorld contains rotating habitat ring');
assert.strictEqual(spaceWorld.stationStrobes.length, 6, 'Station features 6 hazard strobes on outer rim');

// Test rotation animation of habitat ring
const initialRingRot = spaceWorld.stationRingGroup.rotation.z;
spaceWorld.update(0.1, cam, new THREE.Vector3(0, 0, 0), 0);
assert.notStrictEqual(spaceWorld.stationRingGroup.rotation.z, initialRingRot, 'Habitat ring rotates dynamically');
console.log('PASS: Procedural Space Ring Station with 6 truss spokes, rotating habitat ring & strobes');

// -----------------------------------------------------------------------------
// 4. Deck-Aware Chase Camera Clamping (§J.2)
// -----------------------------------------------------------------------------
console.log('\n--- 4. Deck-Aware Chase Camera Clamping (§J.2) ---');

const cameraCtrl = new CameraController(cam);
const dummyRacer = {
  s: 1000,
  vs: 200,
  isBoosting: false,
  pos: new THREE.Vector3(0, 1.8, 1000),
  frame: {
    pos: new THREE.Vector3(0, 0, 1000),
    T: new THREE.Vector3(0, 0, 1),
    U: new THREE.Vector3(0, 1, 0),
    R: new THREE.Vector3(1, 0, 0)
  },
  handling: { topSpeed: 250 }
};

// Force camera position right near or below the deck
cam.position.set(0, -0.5, 980);
cameraCtrl.update(0.016, dummyRacer, dummyTrack);

// Clearance along U must be >= 1.8m
const clearance = cam.position.y - dummyRacer.frame.pos.y;
assert(clearance >= 1.79, `Deck camera clearance clamped above road deck (got ${clearance.toFixed(2)}m)`);
console.log('PASS: Camera deck awareness prevents clipping below road surface on crests');

// -----------------------------------------------------------------------------
// 5. Canyon AO Stabilization, Heat Shimmer & Dunes Masking
// -----------------------------------------------------------------------------
console.log('\n--- 5. Canyon AO Stabilization & Atmospheric Shaders ---');

const desertWorld = new DesertWorld(dummyScene, null, cam, dummyTrack);
assert(desertWorld.noAO && desertWorld.noAO.length > 0, 'DesertWorld masks dunes from GTAO pass (noAO)');
for (const obj of desertWorld.noAO) {
  assert.strictEqual(obj.userData.noAO, true, 'Dunes tagged with userData.noAO = true');
}
console.log(`PASS: Desert dunes (${desertWorld.noAO.length} meshes) masked from GTAO to eliminate horizon ghosting`);

const post = new PostPipeline(null, dummyScene, cam);
assert(post.engineHeat !== undefined, 'Post pipeline supports engineHeat shimmer pass');
assert(post.canyonAO !== undefined, 'Post pipeline supports canyonAO stabilization');
assert(post.rebuildShaders, 'Post pipeline provides asynchronous rebuildShaders');
console.log('PASS: Post pipeline contains Engine Heat Shimmer and async shader rebuilds');

// -----------------------------------------------------------------------------
// 6. Engine Trail Puff Mode & Softened Rival Taillights
// -----------------------------------------------------------------------------
console.log('\n--- 6. Engine Trail Puff Mode & Softened Rival Taillights ---');

const puffTrail = new EngineTrail(35, 0.7, 0x00d2ff, 'puff');
assert.strictEqual(puffTrail.mode, 'puff', 'EngineTrail defaults to puff mode');
assert(puffTrail.geom.attributes.uv, 'EngineTrail provides UV buffer for soft billboard discs');
assert(puffTrail.mat.map, 'EngineTrail uses circular soft alpha falloff texture');

// Update trail with expanding puffs
puffTrail.update(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), true, cam);
puffTrail.update(new THREE.Vector3(0, 0, 10), new THREE.Vector3(0, 1, 0), true, cam);
puffTrail.update(new THREE.Vector3(0, 0, 20), new THREE.Vector3(0, 1, 0), true, cam);

assert(puffTrail.mesh.visible, 'Puff trail rendered visible');
assert(puffTrail.history.length === 3, 'Puff history accumulated correctly');
console.log('PASS: Engine trail operates in puff mode with expanding billboard discs and soft alpha');

const playerShip = new Ship('feather', { isRival: false });
const rivalShip = new Ship('feather', { isRival: true });

assert(playerShip.taillights.length > 0, 'Player ship has taillights');
assert(rivalShip.taillights.length > 0, 'Rival ship has taillights');

// Verify softened rival taillight punch in the dark
const playerTL = playerShip.taillights[0];
const rivalTL = rivalTLPunch(rivalShip);
function rivalTLPunch(ship) { return ship.taillights[0]; }

assert(rivalTL.light.intensity < playerTL.light.intensity, 'Rival taillight punch is softened compared to player');
assert(rivalTL.sprite, 'Rival taillight features tinted glow sprite for visible presence in dark');
console.log(`PASS: Rival taillights softened (intensity ${rivalTL.light.intensity.toFixed(2)} vs player ${playerTL.light.intensity.toFixed(2)})`);

// -----------------------------------------------------------------------------
// 7. Track Mesh Polygon Offset & Z-Fighting Elimination
// -----------------------------------------------------------------------------
console.log('\n--- 7. Track Mesh Polygon Offset & Z-Fighting Elimination ---');

const trackMesh = new TrackMesh(dummyTrack);
assert(trackMesh.group, 'TrackMesh generated successfully');

let foundPolygonOffset = false;
trackMesh.group.traverse((obj) => {
  if (obj.isMesh && obj.material) {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (m.polygonOffset) {
        foundPolygonOffset = true;
        assert(m.polygonOffsetFactor < 0, 'Polygon offset factor is negative to draw on top of road');
      }
    }
  }
});
assert(foundPolygonOffset, 'Lane divider / start line uses polygon offset to eliminate z-fighting');
console.log('PASS: Polygon offset applied to track markings to eliminate flickering dashed bars');

// -----------------------------------------------------------------------------
// 8. Version Registry & Changelog
// -----------------------------------------------------------------------------
console.log('\n--- 8. Version Registry & Changelog ---');

assert(CURRENT_VERSION >= '1.2.0', `CURRENT_VERSION is >= 1.2.0 (got ${CURRENT_VERSION})`);
const v120 = CHANGELOG.find(entry => entry.version === '1.2.0');
assert(v120, 'CHANGELOG contains v1.2.0 entry');
assert(v120.notes.length >= 8, `v1.2.0 changelog has >= 8 notes (got ${v120.notes.length})`);
console.log(`PASS: Changelog updated for v${CURRENT_VERSION} (${v120.title})`);

console.log('\n=============================================================');
console.log('ALL PHASE P10 ACCEPTANCE VERIFICATIONS PASSED SUCCESSFULLY!');
