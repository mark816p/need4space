// tools/test_p6_acceptance.mjs — Acceptance verification test suite for Phase P6
import * as THREE from 'three';
import { createIceTrack } from '../src/icetrack.js';
import { IceWorld } from '../src/iceworld.js';
import { IceShelf } from '../src/shelf.js';
import { createDesertTrack, DesertWorld, DESERT_SUN_DIR, DuneSea, SandstoneGeology, DesertRuins, DesertHaze, SimoomWind } from '../src/desert.js';
import { Race } from '../src/race.js';
import { TRACK_W } from '../src/track.js';
import { MenuManager } from '../src/menu.js';

let failed = false;
function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed = true;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

console.log('=== PHASE P6 ACCEPTANCE VERIFICATION ===\n');

// -----------------------------------------------------------------------------
// 1. ICE PLANET: SHELF CREVASSE & 14 KM LAP WITH TWO GRAVITY FLIPS
// -----------------------------------------------------------------------------
console.log('--- 1. Ice Shelf Crevasse & 14 km Lap ---');
const iceTrack = createIceTrack();
const iceLapKm = iceTrack.length / 1000.0;
console.log(`Ice Track Length: ${iceTrack.length.toFixed(1)} m (~${iceLapKm.toFixed(2)} km)`);
assert(iceLapKm >= 13.5 && iceLapKm <= 14.5, 'Ice planet lap length is ~14 km');

assert(Array.isArray(iceTrack.flips) && iceTrack.flips.length === 2, 'Ice track has 2 gravity flips');
const [iceFlip1, iceFlip2] = iceTrack.flips;
assert(iceFlip1[0] === 10400 && iceFlip1[1] === 10640, 'Ice Flip 1 spans [10400, 10640] m');
assert(iceFlip2[0] === 11600 && iceFlip2[1] === 11840, 'Ice Flip 2 spans [11600, 11840] m');

// Check upside-down orientation between the two flips over floes
const fApproach = {};
const fOverFloes = {};
const fAfter = {};
iceTrack.frame(10200, fApproach);
iceTrack.frame(11100, fOverFloes);
iceTrack.frame(12000, fAfter);
assert(fApproach.U.y > 0.8, 'Approach to Flip 1 is upright (U.y > 0.8)');
assert(fOverFloes.U.y < -0.8, 'Between flips craft is inverted upside-down over the floes (U.y < -0.8)');
assert(fAfter.U.y > 0.8, 'After Flip 2 craft returns upright (U.y > 0.8)');

// Test Ice Shelf geometry & features
const iceScene = new THREE.Scene();
const iceCam = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 30000);
const iceShelf = new IceShelf(iceScene, iceTrack);
assert(iceShelf.shelfHeight === 270.0, 'Ice shelf slab is ~270 m thick');
assert(iceShelf.inCrevasse(7500) === true, 's = 7500 m is inside crevasse');
assert(iceShelf.inCrevasse(2000) === false, 's = 2000 m is outside crevasse');

let hasLeftShelf = false;
let hasRightShelf = false;
let hasBridges = false;
let hasNeedles = false;
let hasFalls = false;
let hasBergs = false;
let hasGeysers = false;

iceShelf.group.traverse((c) => {
  if (c.name === 'shelf_left') hasLeftShelf = true;
  if (c.name === 'shelf_right') hasRightShelf = true;
  if (c.name === 'ice_bridges') hasBridges = true;
  if (c.name === 'ice_needles') hasNeedles = true;
  if (c.name === 'frozen_falls') hasFalls = true;
  if (c.name === 'faceted_bergs') hasBergs = true;
  if (c.name === 'steam_geysers') hasGeysers = true;
});

assert(hasLeftShelf && hasRightShelf, 'Shelf has both seamless left and right swept surfaces');
assert(hasBridges, 'Ice bridges span overhead across the crevasse slit');
assert(hasNeedles, 'Ice needles flank the track near barriers');
assert(hasFalls, 'Frozen falls cascade down outer calving cliffs');
assert(hasBergs, 'Faceted bergs float in broken sea ice in front of western face');
assert(hasGeysers, 'Steam geyser plumes vent through cracks in sea ice');

// Test IceWorld environment
const iceWorld = new IceWorld(iceScene, null, iceCam, iceTrack);
iceWorld.update(0.016, iceCam, { x: 0, y: 0, z: -2000 }, 7500);
assert(iceWorld.shelf !== null, 'IceWorld incorporates IceShelf');
assert(iceWorld.blizzard.snowMat.uniforms.uShelter.value > 0.05, 'Blizzard shelters from wind in crevasse (uShelter active)');

// -----------------------------------------------------------------------------
// 2. DESERT PLANET CIRCUIT & GEOLOGY
// -----------------------------------------------------------------------------
console.log('\n--- 2. Desert Planet Circuit & Geology ---');
const desertTrack = createDesertTrack();
const desertLapKm = desertTrack.length / 1000.0;
console.log(`Desert Track Length: ${desertTrack.length.toFixed(1)} m (~${desertLapKm.toFixed(2)} km)`);
assert(Math.abs(desertLapKm - 14.3) < 0.2, 'Desert lap length is ≈ 14.3 km');

assert(Array.isArray(desertTrack.gaps) && desertTrack.gaps.length >= 2, 'Desert circuit features two chasm jumps');
const [chasm1, chasm2] = desertTrack.gaps;
assert(chasm1[0] === 2150 && chasm1[1] === 2300, 'First Chasm Jump spans [2150, 2300] m');
assert(chasm2[0] === 9350 && chasm2[1] === 9520, 'Second Chasm Jump spans [9350, 9520] m');

// Test Dunes, Sandstone, Ruins, Haze, Simoom
const desertScene = new THREE.Scene();
const desertCam = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 30000);
const desertWorld = new DesertWorld(desertScene, null, desertCam, desertTrack);

assert(desertWorld.name === 'desert', 'DesertWorld name is "desert"');
assert(desertWorld.heat === true, 'DesertWorld has heat shimmer enabled');
assert(desertWorld.dust === true, 'DesertWorld has dust enabled');
assert(desertWorld.sunDir.y > 0.10 && desertWorld.sunDir.y < 0.16, 'Sun elevation is ~7.5° over horizon');
assert(desertWorld.sunDir.x < -0.85, 'Sun azimuth is WNW (west-northwest)');

// Verify Dunes
assert(desertWorld.dunes && desertWorld.dunes.group, 'DuneSea is initialized');
const duneH0 = desertWorld.dunes.getDuneHeight(500, 500);
const duneHTrough = desertWorld.dunes.getDuneHeight(desertTrack.controlPoints[0].pos.x, desertTrack.controlPoints[0].pos.z);
assert(duneHTrough < duneH0, 'Sand is scoured to a trough under the circuit');

// Verify Sandstone Gorge Walls & Arches
assert(desertWorld.sandstone && desertWorld.sandstone.group, 'SandstoneGeology is initialized');
let hasGorgeWalls = false;
let hasMesas = false;
let hasArches = false;
desertWorld.sandstone.group.traverse((c) => {
  if (c.name === 'canyon_gorge_walls') hasGorgeWalls = true;
  if (c.name === 'mesas_and_buttes') hasMesas = true;
  if (c.name === 'great_sandstone_arches') hasArches = true;
});
assert(hasGorgeWalls, 'Layered sandstone gorge walls flank canyon stretch');
assert(hasMesas, 'Mesas and buttes with caprock cliffs and talus skirts exist');
assert(hasArches, 'Great Sandstone Arch spans over the low track run');

// Verify Ruins & Pyramids
assert(desertWorld.ruins && desertWorld.ruins.group, 'DesertRuins is initialized');
let hasFallenSkyscraper = false;
let hasBuriedTowers = false;
let hasPyramids = false;
let pyramidHasFacAttribute = false;

desertWorld.ruins.group.traverse((c) => {
  if (c.name === 'fallen_skyscraper') hasFallenSkyscraper = true;
  if (c.name === 'buried_towers') hasBuriedTowers = true;
  if (c.name === 'twin_stepped_pyramids') hasPyramids = true;
  if (c.geometry && c.geometry.attributes && c.geometry.attributes.fac) {
    pyramidHasFacAttribute = true;
  }
});
assert(hasFallenSkyscraper, 'Hollow fallen skyscraper with floor ribs threaded by track exists');
assert(hasBuriedTowers, 'Leaning buried towers with setbacks and fins exist');
assert(hasPyramids, 'Two colossal stepped pyramids NW exist');
assert(pyramidHasFacAttribute, 'Pyramid geometry faces carry "fac" coordinates attribute');

// -----------------------------------------------------------------------------
// 3. SANDSTORM OPTICAL DEPTH & NEVER BLACKS OUT
// -----------------------------------------------------------------------------
console.log('\n--- 3. Sandstorm Ellipsoid & Optical Depth ---');
assert(desertWorld.haze && desertWorld.haze.group, 'DesertHaze is initialized');
assert(desertWorld.haze.stormCenter && desertWorld.haze.stormRadius, 'Sandstorm dust ellipsoid defined');

const stormPos = desertWorld.haze.stormCenter.clone();
const outsidePos = new THREE.Vector3(2000, 20, 2000);
const tauInside = desertWorld.haze.getOpticalDepthAt(stormPos);
const tauOutside = desertWorld.haze.getOpticalDepthAt(outsidePos);

console.log(`Optical Depth at storm center: ${tauInside.toFixed(2)}, outside: ${tauOutside.toFixed(2)}`);
assert(tauInside > 0.8, 'Optical depth inside sandstorm core is high (> 0.8)');
assert(tauOutside === 0.0, 'Optical depth outside sandstorm is 0.0');

// Verify that inside sandstorm, sun is attenuated but never zero (obscures without blacking out)
desertWorld.update(0.016, desertCam, stormPos, 8000);
console.log(`Sun intensity inside sandstorm: ${desertWorld.sun.intensity.toFixed(2)} (base 3.4)`);
assert(desertWorld.sun.intensity > 1.5 && desertWorld.sun.intensity < 3.4, 'Sandstorm obscures but never blacks out sun/lighting');

// Verify Simoom GPU wind
assert(desertWorld.simoom && desertWorld.simoom.group, 'Simoom wind system is initialized');
assert(desertWorld.simoom.devils.length > 0, 'Dust devils wander across dunes');

// -----------------------------------------------------------------------------
// 4. 9-SHIP FLEET SIMULATION ON DESERT CIRCUIT
// -----------------------------------------------------------------------------
console.log('\n--- 4. 9-Ship Fleet Simulation on Desert Circuit ---');
const desertRace = new Race(desertTrack, { difficulty: 'hard' });
desertRace.state = 'racing';
const dt = 1 / 120;
let raceClean = true;

// Advance 120 steps (~1 second) across starting grid
for (let step = 0; step < 120; step++) {
  desertRace.step(dt, { throttle: 1, brake: 0, steer: 0 });
}

for (let i = 0; i < desertRace.racers.length; i++) {
  const r = desertRace.racers[i];
  if (isNaN(r.pos.x) || isNaN(r.vs) || r.vs <= 0) {
    raceClean = false;
    console.error(`Racer ${i} invalid state on Desert circuit`);
  }
}
assert(raceClean, 'All 9 racers simulate cleanly on Desert circuit without errors or NaN');

// Test leap across Chasm Jump 1 at 200 m/s
console.log('Testing Chasm Jump 1 ballistic flight...');
const jumpRacer = desertRace.playerRacer;
jumpRacer.reset(2100, 0, 200.0);
let jumpedChasm = false;
let landedChasm = false;

for (let s = 0; s < 360; s++) {
  jumpRacer.step(dt, { throttle: 1.0 });
  if (jumpRacer.inAir) jumpedChasm = true;
  if (jumpedChasm && !jumpRacer.inAir && jumpRacer.s > 2300) {
    landedChasm = true;
    break;
  }
}
assert(jumpedChasm && landedChasm, 'Racer successfully jumps First Chasm and lands cleanly on catch deck');

console.log('\n=== ACCEPTANCE TEST RESULT ===');
if (failed) {
  console.error('FAILED: One or more acceptance checks did not pass.');
  process.exit(1);
} else {
  console.log('ALL PHASE P6 ACCEPTANCE CHECKS PASSED SUCCESSFULLY!');
  process.exit(0);
}
