// tools/test_p7_acceptance.mjs — Acceptance verification test suite for Phase P7
import * as THREE from 'three';
import { createForestTrack, ForestWorld, ForestCave, ColossalSkeleton, SKULL_PASSAGE_W } from '../src/forest.js';
import { createSpaceTrack, TRACK_W } from '../src/track.js';
import { SpaceWorld } from '../src/space.js';
import { DerelictWreck } from '../src/wreck.js';
import { COLOSSUS_LOCATION, COLOSSUS_PIECES, GRAVEYARD } from '../src/wreckplan.js';
import { getWreckZone, isDarkChamber, getChamberDarkness, getZoneLighting } from '../src/wreckzones.js';
import { Race } from '../src/race.js';
import { readFileSync } from 'fs';

let failed = false;
function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed = true;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

console.log('=== PHASE P7 ACCEPTANCE VERIFICATION ===\n');

// -----------------------------------------------------------------------------
// 1. FOREST MOON: 2 KM CAVE THROUGH HOLLOW HILL & SETCAVE DARK LIGHTING
// -----------------------------------------------------------------------------
console.log('--- 1. Forest Moon: 2 km Cave Through Hollow Hill ---');
const forestTrack = createForestTrack();
const forestLapKm = forestTrack.length / 1000.0;
console.log(`Forest Track Length: ${forestTrack.length.toFixed(1)} m (~${forestLapKm.toFixed(2)} km)`);
assert(forestLapKm >= 13.5 && forestLapKm <= 14.2, 'Forest lap length is ~13.8 km');

const forestScene = new THREE.Scene();
const forestCam = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 30000);
const forestCave = new ForestCave(forestScene, forestTrack);

assert(forestCave.startS === 4200.0 && forestCave.endS === 6200.0, 'Cave runs from s=4200 m to s=6200 m (2 km long)');
assert(forestCave.chambers.length === 8, 'Cave contains 8 distinct geological chambers');

// Verify cave features in scene group
let hasSweptTube = false;
let hasGlowworms = false;
let hasLake = false;
let hasWaterfall = false;
let hasCrystals = false;
let hasSlalom = false;
let hasRoots = false;
let hasFungi = false;
let hasRiver = false;
let hasSinkholeBeams = false;

forestCave.group.traverse((c) => {
  if (c.name === 'cave_swept_tube') hasSweptTube = true;
  if (c.name === 'cave_glowworms') hasGlowworms = true;
  if (c.name === 'cave_subterranean_lake') hasLake = true;
  if (c.name === 'cave_waterfall_sheet') hasWaterfall = true;
  if (c.name === 'cave_crystal_clusters') hasCrystals = true;
  if (c.name === 'cave_slalom_columns') hasSlalom = true;
  if (c.name === 'cave_overhead_roots') hasRoots = true;
  if (c.name === 'cave_giant_fungi') hasFungi = true;
  if (c.name === 'cave_subterranean_river') hasRiver = true;
  if (c.name === 'cave_sinkhole_beams') hasSinkholeBeams = true;
});

assert(hasSweptTube, 'Cave has continuous swept tube along track');
assert(hasGlowworms, 'Glowworm gallery contains bioluminescent points');
assert(hasLake, 'Waterfall cavern has subterranean lake below the deck');
assert(hasWaterfall, 'Waterfall sheet plunges into subterranean lake');
assert(hasCrystals, 'Crystal throat contains faceted quartz clusters');
assert(hasSlalom, 'Stalactite hall features columns slalom');
assert(hasRoots, 'Cavern ceiling features overhead hanging jungle roots');
assert(hasFungi, 'Giant bioluminescent fungi forest flanks the track');
assert(hasRiver, 'Subterranean river flows inside the bend');
assert(hasSinkholeBeams, 'Daylight sinkhole beams pierce cavern roof');

// Verify entry under its own way out
// Entry CP (12) has y=-65m, overpass CP (16) has y=+40m
const cpEntry = forestTrack.controlPoints[12];
const cpExit = forestTrack.controlPoints[16];
assert(cpEntry.pos.y < -50.0 && cpExit.pos.y > 30.0, 'Track enters cave low under its own way out overpass');

// Verify slalom column placement (alternating sides every 55m)
const slalomGroup = forestCave.group.getObjectByName('cave_slalom_columns');
assert(slalomGroup && slalomGroup.children.length >= 5, 'Slalom columns group has alternating pillars');

// Verify setCave dark lighting
const outsideState = forestCave.inCave(2000);
const deepCaveState = forestCave.inCave(4800);
const sinkholeState = forestCave.inCave(6060);
assert(outsideState.inside === false && outsideState.darkness === 0.0, 'Outside cave: inside=false, darkness=0.0');
assert(deepCaveState.inside === true && deepCaveState.darkness > 0.9, 'Deep cave: inside=true, darkness > 0.9 (setCave dark)');
assert(sinkholeState.sinkhole > 0.5, 'Under sinkhole: daylight bleed sinkhole > 0.5');

// Test ForestWorld lighting integration
const forestWorld = new ForestWorld(forestScene, null, forestCam, forestTrack);
forestWorld.update(0.016, forestCam, { x: 0, y: -60, z: 0 }, 4800);
assert(forestWorld.sun.intensity < 0.5, 'ForestWorld sun intensity dimmed inside cave (setCave dark)');
assert(forestWorld.headlightK > 0.8, 'Headlight boost engaged inside dark cave');

// -----------------------------------------------------------------------------
// 2. FOREST MOON: SKELETON SKULL & DUAL GRAVITY FLIPS
// -----------------------------------------------------------------------------
console.log('\n--- 2. Forest Moon: Colossal Skull & Dual Gravity Flips ---');
assert(Array.isArray(forestTrack.flips) && forestTrack.flips.length === 2, 'Forest track has 2 gravity flips');
const [forestFlip1, forestFlip2] = forestTrack.flips;
assert(forestFlip1[0] === 10000 && forestFlip1[1] === 10240, 'Forest Flip 1 spans [10000, 10240] m');
assert(forestFlip2[0] === 11150 && forestFlip2[1] === 11390, 'Forest Flip 2 spans [11150, 11390] m');

// Check upside-down orientation past the colossal skull
const fBeforeSkull = {};
const fPastSkull = {};
const fAfterSkull = {};
forestTrack.frame(9800, fBeforeSkull);
forestTrack.frame(10600, fPastSkull);
forestTrack.frame(11600, fAfterSkull);

assert(fBeforeSkull.U.y > 0.8, 'Before Flip 1: ship is upright (U.y > 0.8)');
assert(fPastSkull.U.y < -0.8, 'Past colossal skull: ship is flying inverted upside-down (U.y < -0.8)');
assert(fAfterSkull.U.y > 0.8, 'After Flip 2: ship returns upright (U.y > 0.8)');

assert(SKULL_PASSAGE_W === 56.0, 'Skull passage width is scaled to 56 m road deck');

// -----------------------------------------------------------------------------
// 3. SPACE CIRCUIT: 26.6 KM LAP & 12 KM DERELICT COLOSSUS
// -----------------------------------------------------------------------------
console.log('\n--- 3. Space Circuit: 26.6 km Lap & 12 km Derelict Colossus ---');
const spaceTrack = createSpaceTrack();
const spaceLapKm = spaceTrack.length / 1000.0;
console.log(`Space Track Length: ${spaceTrack.length.toFixed(1)} m (~${spaceLapKm.toFixed(2)} km)`);
assert(Math.abs(spaceLapKm - 26.6) < 0.2, 'Space lap length is ≈ 26.6 km');

const spaceScene = new THREE.Scene();
const spaceCam = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 30000);

// Measure DerelictWreck build time
const t0 = performance.now();
const derelict = new DerelictWreck(spaceScene, spaceTrack);
const buildTimeMs = performance.now() - t0;
console.log(`Derelict Colossus built in: ${buildTimeMs.toFixed(2)} ms`);
assert(buildTimeMs < 100.0, 'Derelict build time is within budget (< 100 ms)');

// Check presence of structural zones in DerelictWreck
let hasHangar = false;
let hasHold = false;
let hasTrench = false;
let hasGraveyard = false;
let hasGate = false;
let hasSparks = false;

derelict.group.traverse((c) => {
  if (c.name === 'cargo_hangar') hasHangar = true;
  if (c.name === 'upside_down_hold') hasHold = true;
  if (c.name === 'trench_run') hasTrench = true;
  if (c.name === 'wreck_graveyard') hasGraveyard = true;
  if (c.name === 'derelict_orange_gate') hasGate = true;
});

assert(hasHangar, 'Colossus has Cargo Hangar with staging rack towers');
assert(hasHold, 'Colossus has Upside-Down Hold with structural ribs');
assert(hasTrench, 'Colossus has Trench Run with trench walls and turrets on barbettes');
assert(hasGraveyard, 'Colossus has Graveyard with lit and painted escort hulks');
assert(hasGate, 'Colossus has orange timing gate before engine bell');
assert(derelict.sparkPoints !== undefined, 'Colossus has reactor electrical sparks particle system');
assert(derelict.reactorMeshes.length === 3, 'Colossus has 3 pulsating reactor cores');
assert(derelict.cables.length >= 5, 'Colossus has heavy swaying power cables');

// Test Upside-Down Hold Dual Gravity Flips & Inverted flight
assert(spaceTrack.flips.length >= 4, 'Space track has at least 4 gravity flips (including upside-down hold)');
const holdFlip1 = spaceTrack.flips.find(f => f[0] >= 15500 && f[0] <= 16200);
const holdFlip2 = spaceTrack.flips.find(f => f[0] >= 17800 && f[0] <= 18500);
assert(holdFlip1 !== undefined, 'Upside-Down Hold has entry gravity flip (~15900 m)');
assert(holdFlip2 !== undefined, 'Upside-Down Hold has exit gravity flip (~18100 m)');

const fHoldInvert = {};
spaceTrack.frame(17000, fHoldInvert);
assert(fHoldInvert.U.y < -0.8, 'Inside Upside-Down Hold: craft flies inverted (U.y < -0.8)');

// Test The Break 150m vacuum leap gap
const breakGap = spaceTrack.gaps.find(g => g[0] >= 14500 && g[0] <= 15000);
assert(breakGap !== undefined && (breakGap[1] - breakGap[0]) === 150, 'The Break gap is a 150 m leap across severed halves');

// Test SpaceWorld zone lighting
const zoneBell = getWreckZone(12400);
const zoneReactor = getWreckZone(13500);
const zoneBreak = getWreckZone(14800);
assert(zoneBell.darkChamber === true, 'Engine bell is a dark chamber');
assert(zoneReactor.darkChamber === true, 'Reactor hall is a dark chamber');
assert(zoneBreak.darkChamber === false, 'The Break is open to vacuum');

const spaceWorld = new SpaceWorld(spaceScene, null, spaceCam, spaceTrack);
spaceWorld.update(0.016, spaceCam, { x: 0, y: 0, z: 0 }, 13500);
assert(spaceWorld.sun.intensity < 0.2, 'SpaceWorld sun is occluded inside reactor hall');

// -----------------------------------------------------------------------------
// 4. MENU & HUD VERIFICATION
// -----------------------------------------------------------------------------
console.log('\n--- 4. Menu & HUD Verification ---');
const menuContent = readFileSync('./src/menu.js', 'utf8');
assert(menuContent.includes('26.6 KM'), 'Menu lists 26.6 KM for Orbital Station (Space circuit)');
assert(menuContent.includes('upside-down hold'), 'Menu space line names the colossus and its upside-down hold');

const htmlContent = readFileSync('./index.html', 'utf8');
assert(htmlContent.includes('id="drift-chain"'), 'index.html contains #drift-chain');
assert(htmlContent.includes('id="bst-overflow"'), 'index.html contains #bst-overflow');

// -----------------------------------------------------------------------------
// 5. NINE-SHIP AI RACING SIMULATION
// -----------------------------------------------------------------------------
console.log('\n--- 5. Nine-Ship AI Racing Simulation ---');

// Test 9-ship AI on Forest track
console.log('Simulating 9 racers on Forest Moon circuit...');
const forestRace = new Race(forestTrack);
forestRace.state = 'racing';
for (let step = 0; step < 120; step++) {
  forestRace.step(1 / 120);
}
for (let i = 0; i < forestRace.racers.length; i++) {
  const r = forestRace.racers[i];
  assert(!isNaN(r.s) && !isNaN(r.vs) && r.vs > 0, `Racer ${i} on Forest circuit is active (s=${r.s.toFixed(1)}, vs=${r.vs.toFixed(1)})`);
}

// Test 9-ship AI on 26.6 km Space circuit
console.log('Simulating 9 racers on 26.6 km Space circuit...');
const spaceRace = new Race(spaceTrack);
spaceRace.state = 'racing';
for (let step = 0; step < 120; step++) {
  spaceRace.step(1 / 120);
}
for (let i = 0; i < spaceRace.racers.length; i++) {
  const r = spaceRace.racers[i];
  assert(!isNaN(r.s) && !isNaN(r.vs) && r.vs > 0, `Racer ${i} on Space circuit is active (s=${r.s.toFixed(1)}, vs=${r.vs.toFixed(1)})`);
}

// -----------------------------------------------------------------------------
// FINAL SUMMARY
// -----------------------------------------------------------------------------
console.log('\n=======================================');
if (failed) {
  console.error('❌ PHASE P7 ACCEPTANCE VERIFICATION FAILED');
  process.exit(1);
} else {
  console.log('✅ ALL PHASE P7 ACCEPTANCE CHECKS PASSED!');
  process.exit(0);
}
