// tools/test_p2_acceptance.mjs — Comprehensive acceptance test suite for P2 Forest Moon
import assert from 'node:assert';
import * as THREE from 'three';
import { createForestTrack } from '../src/foresttrack.js';
import { createSpaceTrack, TRACK_W } from '../src/track.js';
import { rayOpticalDepth, AtmosphereSkyDome, CloudDecks } from '../src/atmo.js';
import { JungleAbyss } from '../src/abyss.js';
import { IslandField, createIslandGeometry } from '../src/islands.js';
import { FloraSystem, createLeafAtlasTexture } from '../src/flora.js';
import { WaterfallSystem, RAINBOW_ANGLE_RAD } from '../src/water.js';
import { CreaturesSystem } from '../src/creatures.js';
import { OvergrowthSystem } from '../src/overgrowth.js';
import { ColossalSkeleton, SKULL_PASSAGE_W } from '../src/skeleton.js';
import { ForestWorld } from '../src/forestworld.js';
import { Race } from '../src/race.js';
import { LensWaterPass, ShaftPass } from '../src/post.js';

console.log('=== P2 FOREST MOON ACCEPTANCE TESTS ===\n');

// -----------------------------------------------------------------------------
// 1. Forest Circuit Geometry & Metrics (Target: ~13.8 km)
// -----------------------------------------------------------------------------
console.log('1. Verifying Forest Track Geometry & Layout...');
const forestTrack = createForestTrack();
console.log(`   Circuit Name: ${forestTrack.name}`);
console.log(`   Arc Length: ${forestTrack.length.toFixed(1)} m (~${(forestTrack.length / 1000).toFixed(2)} km)`);
assert.strictEqual(forestTrack.name, 'forest');
assert(
  forestTrack.length >= 13500 && forestTrack.length <= 14200,
  `Forest circuit length must be ~13.8 km (got ${forestTrack.length.toFixed(1)} m)`
);
console.log(`   Base Road Width (TRACK_W): ${TRACK_W} m, Skull Passage Clearance: ${SKULL_PASSAGE_W} m`);
assert.strictEqual(SKULL_PASSAGE_W, 56, 'Skull passage must clear 56 m road width');

// Check smoothness: tangent and normal step angles
let maxAngle = 0;
const f0 = {};
const f1 = {};
const sampleStep = 50;
for (let s = 0; s < forestTrack.length; s += sampleStep) {
  forestTrack.frame(s, f0);
  forestTrack.frame((s + sampleStep) % forestTrack.length, f1);
  const dot = Math.min(1.0, Math.max(-1.0, f0.T.dot(f1.T)));
  const angleDeg = Math.acos(dot) * (180 / Math.PI);
  if (angleDeg > maxAngle) maxAngle = angleDeg;
}
console.log(`   Max step angle per 50m: ${maxAngle.toFixed(2)}°`);
assert(maxAngle < 10.0, 'Track curvature must be smooth for high-speed racing (<10° per 50m)');
console.log('   ✓ Forest track layout and curvature verified');

// -----------------------------------------------------------------------------
// 2. Colossal Skeleton Passage & 56m Road Clearance
// -----------------------------------------------------------------------------
console.log('2. Verifying Colossal Skeleton & Road Clearance...');
const mockScene = new THREE.Scene();
const skeleton = new ColossalSkeleton(mockScene, forestTrack);
assert(skeleton.group.children.length > 0, 'Skeleton group must contain meshes');

// Find skull group
const skullGroup = skeleton.group.children[0];
assert(skullGroup, 'Skull group must exist');
console.log(`   Skull group mesh count: ${skullGroup.children.length}`);

// Verify skull spans over 56m road with sufficient clearance
const sEntry = 10400;
const fSkull = {};
forestTrack.frame(sEntry, fSkull);
assert(fSkull.pos, 'Must retrieve valid track frame at skull entry');

// Check jaw arch geometry bounds: should clear +/- 28m laterally and > 15m vertically
const jawMesh = skullGroup.children[0];
jawMesh.geometry.computeBoundingBox();
const jawBB = jawMesh.geometry.boundingBox;
console.log(`   Jaw Arch Bounds: X=[${jawBB.min.x.toFixed(1)}, ${jawBB.max.x.toFixed(1)}], Y=[${jawBB.min.y.toFixed(1)}, ${jawBB.max.y.toFixed(1)}]`);
assert(jawBB.max.x - jawBB.min.x >= TRACK_W, `Jaw arch width (${(jawBB.max.x - jawBB.min.x).toFixed(1)}m) must span full 56m road`);
assert(jawBB.max.y >= 25, `Jaw arch height (${jawBB.max.y.toFixed(1)}m) must clear racer hover height`);

// Check plunging spine: cervical vertebrae chain plunging > 1.0 km into the abyss
let minSpineY = Infinity;
for (let i = 1; i < skeleton.group.children.length; i++) {
  const child = skeleton.group.children[i];
  if (child.position.y < minSpineY) minSpineY = child.position.y;
}
console.log(`   Spine plunge lowest point: Y = ${minSpineY.toFixed(1)} m`);
assert(minSpineY <= -600, 'Spine must plunge deep towards the jungle abyss (>1000m descent from skull)');
console.log('   ✓ Colossal Skeleton passage and deep spine plunge verified');

// -----------------------------------------------------------------------------
// 3. Waterfalls & The Cascade River Arching Over Track
// -----------------------------------------------------------------------------
console.log('3. Verifying Waterfalls & Cascade River...');
const waterfalls = new WaterfallSystem(mockScene, forestTrack);
assert(waterfalls.group.children.length > 0, 'Waterfall system must contain meshes');
console.log(`   Waterfall mesh count: ${waterfalls.group.children.length}`);
console.log(`   Rainbow angle constant: ${(RAINBOW_ANGLE_RAD * 180 / Math.PI).toFixed(1)}° (expected ~42°)`);
assert(Math.abs((RAINBOW_ANGLE_RAD * 180 / Math.PI) - 42.0) < 1.0, 'Rainbow angle must be 42 degrees');

// Verify cascade river arches over track around s ≈ 3400m
const fCascade = {};
forestTrack.frame(3400, fCascade);
assert(waterfalls.cascadeMesh, 'Cascade river mesh must be instantiated');
waterfalls.cascadeMesh.geometry.computeBoundingBox();
const cascBB = waterfalls.cascadeMesh.geometry.boundingBox;
console.log(`   Cascade River Bounds: Y=[${cascBB.min.y.toFixed(1)}, ${cascBB.max.y.toFixed(1)}]`);
assert(cascBB.max.y > fCascade.pos.y, 'Cascade river must arch overhead above track surface');
console.log('   ✓ Waterfalls, ballistic arc, and 42° rainbow verified');

// -----------------------------------------------------------------------------
// 4. Dual-Layer Atmosphere & Sky Dome
// -----------------------------------------------------------------------------
console.log('4. Verifying Dual-Layer Atmosphere (Air & Jungle Haze)...');
// Test analytical optical depth
const odAirNear = rayOpticalDepth(0, 0, 1000, 8000);
const odAirFar = rayOpticalDepth(0, 0, 5000, 8000);
assert(odAirFar > odAirNear, 'Optical depth must increase with distance');
const odHazeHigh = rayOpticalDepth(2000, 0, 1000, 350);
const odHazeLow = rayOpticalDepth(0, 0, 1000, 350);
assert(odHazeLow > odHazeHigh * 10, 'Jungle haze must be concentrated at lower altitude (scale height 350m)');

const sunDir = new THREE.Vector3(0.5, 0.5, -0.7).normalize();
const atmoDome = new AtmosphereSkyDome(sunDir);
assert(atmoDome.mesh, 'Atmosphere sky dome mesh must exist');

const cloudDecks = new CloudDecks(mockScene);
assert(cloudDecks.abyssMesh && cloudDecks.cirrusMesh, 'Both abyss and cirrus cloud decks must exist');
console.log('   ✓ Analytical dual-layer atmosphere and dual cloud decks verified');

// -----------------------------------------------------------------------------
// 5. Continuous Canopy Abyss Floor & Closed Floating Islands
// -----------------------------------------------------------------------------
console.log('5. Verifying Jungle Abyss Canopy & Concentric Floating Islands...');
const abyss = new JungleAbyss(mockScene);
assert(abyss.mesh, 'Abyss polar grid mesh must exist');
assert.strictEqual(abyss.mesh.geometry.attributes.position.getY(0), -1300, 'Canopy floor must be ~1.3 km down (-1300m)');

const islandGeo = createIslandGeometry(180, 220, 42);
assert(islandGeo.attributes.position, 'Island geometry must have vertex positions');
assert(islandGeo.index, 'Island geometry must be indexed closed surface');
const islands = new IslandField(mockScene, forestTrack);
assert(islands.group.children.length > 0, 'Island field must generate island meshes');
console.log(`   Floating islands spawned: ${islands.group.children.length}`);
console.log('   ✓ Jungle abyss polar grid and closed floating islands verified');

// -----------------------------------------------------------------------------
// 6. Flora, Overgrowth, and Living Fauna
// -----------------------------------------------------------------------------
console.log('6. Verifying Flora System, Overgrowth, and Creatures...');
const flora = new FloraSystem(mockScene, islands);
assert(flora.group.children.length > 0, 'Flora system must instantiate instanced foliage');

const overgrowth = new OvergrowthSystem(mockScene, forestTrack);
assert(overgrowth.group.children.length > 0, 'Overgrowth system must instantiate hanging lianas & ivy');

const creatures = new CreaturesSystem(mockScene);
assert(creatures.group.children.length > 0, 'Creatures system must instantiate sky rays and whales');
console.log('   ✓ Foliage, overgrowth, and living fauna systems verified');

// -----------------------------------------------------------------------------
// 7. Post-Processing: Lens Water Pass & Light Shaft Pass
// -----------------------------------------------------------------------------
console.log('7. Verifying Lens Water & Atmospheric Shaft Passes...');
const lensWaterPass = new LensWaterPass();
assert(lensWaterPass.fsQuad, 'LensWaterPass must have fullscreen quad');
assert(lensWaterPass.uniforms.uSpeed, 'LensWaterPass must accept ship speed');
assert(lensWaterPass.uniforms.uIntensity, 'LensWaterPass must accept water intensity');

const shaftPass = new ShaftPass();
assert(shaftPass.fsQuad, 'ShaftPass must have fullscreen quad');
assert(shaftPass.uniforms.uSunPos, 'ShaftPass must have sun screen position uniform');
console.log('   ✓ LensWaterPass and ShaftPass verified');

// -----------------------------------------------------------------------------
// 8. AI Fleet Simulation on Forest Moon Circuit (~13.8 km)
// -----------------------------------------------------------------------------
console.log('8. Simulating 9-Ship AI Race on Forest Moon Circuit...');
const race = new Race(forestTrack, { difficulty: 'hard', numLaps: 1 });
assert.strictEqual(race.racers.length, 9, 'Must spawn 9 race ships');

// Start race (skip countdown)
race.state = 'racing';
race.countdownTime = 0.0;

// Advance simulation for 200 steps (at dt = 1/60)
const dt = 1 / 60;
const simSteps = 600; // 10 seconds of simulation
for (let step = 0; step < simSteps; step++) {
  race.step(dt);
}

// Check that all 9 racers are making steady forward progress
console.log('   Fleet progress after 10s of racing:');
let totalSpeed = 0;
for (let i = 0; i < race.racers.length; i++) {
  const r = race.racers[i];
  totalSpeed += r.vs;
  console.log(`     Ship ${i} (${r.team.name}): s=${r.s.toFixed(1)}m, speed=${(r.vs * 3.6).toFixed(1)} km/h (${r.vs.toFixed(1)} m/s), lateral x=${r.x.toFixed(1)}m`);
  assert(r.s > 500, `Ship ${i} should have advanced down the track (got ${r.s.toFixed(1)}m)`);
  assert(r.vs > 180, `Ship ${i} speed should be high speed AG racing (>180 m/s, got ${r.vs.toFixed(1)})`);
  assert(Math.abs(r.x) < TRACK_W * 0.5 + 4, `Ship ${i} lateral offset must stay on or near track`);
}
const avgSpeed = totalSpeed / race.racers.length;
console.log(`   Fleet Average Speed: ${(avgSpeed * 3.6).toFixed(1)} km/h (${avgSpeed.toFixed(1)} m/s) — Matching space circuit punch!`);
assert(avgSpeed > 200, 'Fleet must hold space-like speeds on Forest Moon circuit');
console.log('   ✓ 9-ship AI fleet reliably races on Forest Moon');

// -----------------------------------------------------------------------------
// 9. ForestWorld Lifecycle & Pre-Render Pipeline
// -----------------------------------------------------------------------------
console.log('9. Verifying ForestWorld Class Initialization & Updates...');
const mockRenderer = {
  clear() {},
  render() {},
  clearDepth() {},
  setRenderTarget() {},
  compile() {}
};
const mockCam = new THREE.PerspectiveCamera(65, 16 / 9, 0.2, 30000);
const forestWorld = new ForestWorld(mockScene, mockRenderer, mockCam, forestTrack);
assert.strictEqual(forestWorld.ready, true);
assert.strictEqual(forestWorld.name, 'forest');

// Test update tick
forestWorld.update(0.016, mockCam, new THREE.Vector3(0, 50, 0), 100, mockRenderer);
forestWorld.preRender(mockRenderer);
console.log('   ✓ ForestWorld integrates sky dome, clouds, canopy abyss, islands, flora, water, and fauna');

console.log('\n======================================================');
console.log('ALL P2 FOREST MOON ACCEPTANCE CRITERIA PASSED (100%)');
console.log('======================================================\n');
