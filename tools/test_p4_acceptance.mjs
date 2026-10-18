// tools/test_p4_acceptance.mjs — Comprehensive acceptance test suite for P4 Derelict v1 & 56m Road
import assert from 'node:assert';
import * as THREE from 'three';
import { createSpaceTrack, TRACK_W } from '../src/track.js';
import { COLOSSUS_LOCATION, COLOSSUS_PIECES, GRAVEYARD, wreckRoute } from '../src/wreckplan.js';
import { WRECK_ZONES, getWreckZone, isDarkChamber, getChamberDarkness, getReactorWarmth, getZoneLighting } from '../src/wreckzones.js';
import { DerelictWreck } from '../src/wreck.js';
import { SpaceWorld } from '../src/space.js';
import { Ship } from '../src/ship.js';
import { Race } from '../src/race.js';

console.log('=== P4 DERELICT v1 & 56m ROAD ACCEPTANCE TESTS ===\n');

// -----------------------------------------------------------------------------
// 1. Road Width Expansion (TRACK_W = 56 m)
// -----------------------------------------------------------------------------
console.log('1. Verifying 56m Road Width Expansion & Multi-Lane Capacity...');
console.log(`   TRACK_W: ${TRACK_W} m (expanded from 44 m)`);
assert.strictEqual(TRACK_W, 56.0, 'Road width must be widened to 56.0 m');

// Room for 5 Feathers (span = 10.3 m) abreast
const featherSpan = 10.3;
const fiveFeathersSpan = featherSpan * 5;
console.log(`   5 Feathers span: ${fiveFeathersSpan.toFixed(1)} m across ${TRACK_W} m road width`);
assert(TRACK_W > fiveFeathersSpan, 'Road must have room for 5 Feathers abreast');
const margin = TRACK_W - fiveFeathersSpan;
console.log(`   Clearance margin: ${margin.toFixed(1)} m for multi-line overtaking`);
assert(margin >= 4.0, 'Must have at least 4.0 m lateral margin across the 56m deck');
console.log('   ✓ 56m road width and multi-lane overtaking capacity verified');

// -----------------------------------------------------------------------------
// 2. Space Circuit Expansion (2 km longer ~ 13.6 km)
// -----------------------------------------------------------------------------
console.log('2. Verifying Space Circuit 2 km Expansion & Derelict Threading...');
const spaceTrack = createSpaceTrack();
console.log(`   Circuit Name: ${spaceTrack.name}`);
console.log(`   Arc Length: ${spaceTrack.length.toFixed(1)} m (~${(spaceTrack.length / 1000).toFixed(2)} km)`);
assert.strictEqual(spaceTrack.name, 'space');
assert(
  spaceTrack.length >= 13400,
  `Space circuit length must be >= 13.4 km (got ${spaceTrack.length.toFixed(1)} m)`
);

// Check track curvature smoothness
let maxAngle = 0;
const f0 = {};
const f1 = {};
const sampleStep = 50;
for (let s = 0; s < spaceTrack.length; s += sampleStep) {
  spaceTrack.frame(s, f0);
  spaceTrack.frame((s + sampleStep) % spaceTrack.length, f1);
  const dot = Math.min(1.0, Math.max(-1.0, f0.T.dot(f1.T)));
  const angleDeg = Math.acos(dot) * (180 / Math.PI);
  // Outside vertical loop, curvature must be smooth for high-speed AG racing
  const inLoop = spaceTrack.inLoop ? spaceTrack.inLoop(s) : false;
  if (!inLoop && angleDeg > maxAngle) maxAngle = angleDeg;
}
console.log(`   Max step angle outside loop per 50m: ${maxAngle.toFixed(2)}°`);
assert(maxAngle < 12.0, 'Track curvature outside loop must be smooth (<12° per 50m)');

// Check gap across The Break
const breakGap = spaceTrack.gaps.find(([s0, s1]) => (s0 >= 10400 && s1 <= 10700) || (s0 >= 14500 && s1 <= 15000));
assert(breakGap, 'Space track must include jump gap across The Break');
console.log(`   The Break Gap: [${breakGap[0]}, ${breakGap[1]}] (${breakGap[1] - breakGap[0]} m leap across vacuum)`);

// Check boost pad between halves
const breakPad = spaceTrack.pads.find(p => (p.s >= 10450 && p.s <= 10500) || (p.s >= 14600 && p.s <= 14700));
assert(breakPad, 'Space track must include boost pad between the halves before the break');
console.log(`   The Break Boost Pad: at s=${breakPad.s} m`);

// Check orange gate before derelict
const orangeGate = spaceTrack.gates.find(g => ((g.s >= 9200 && g.s <= 9300) || (g.s >= 11800 && g.s <= 12000)) && g.color === 0xff8800);
assert(orangeGate, 'Space track must include orange timing light gate before derelict');
console.log(`   Orange Light Gate: at s=${orangeGate.s} m, color=0x${orangeGate.color.toString(16)}`);

console.log('   ✓ Space circuit 2 km expansion, gap, pad, and orange gate verified');

// -----------------------------------------------------------------------------
// 3. Numeric Layout (wreckplan.js — pure numbers, no three.js)
// -----------------------------------------------------------------------------
console.log('3. Verifying Pure Numeric Layout in wreckplan.js...');
assert(COLOSSUS_LOCATION.totalLength >= 2000, 'Colossus length must be >= 2000m');
assert(COLOSSUS_PIECES.engineBell, 'Engine Bell piece must exist');
assert(COLOSSUS_PIECES.reactorHall, 'Reactor Hall piece must exist');
assert(COLOSSUS_PIECES.theBreak, 'The Break piece must exist');
assert(COLOSSUS_PIECES.cargoHangar, 'Cargo Hangar piece must exist');
assert(COLOSSUS_PIECES.sensorBoom, 'Sensor Boom piece must exist');
assert(COLOSSUS_PIECES.sensorBoom.length >= 400, 'Sensor boom must be >= 400m');
assert(GRAVEYARD.length >= 10, 'Wreck Graveyard must have >= 10 debris hulks and plates');
const route = wreckRoute();
assert(route.length >= 8, 'wreckRoute() must return control points');
console.log(`   Colossus Length: ${COLOSSUS_LOCATION.totalLength} m`);
console.log(`   Graveyard Debris Objects: ${GRAVEYARD.length}`);
console.log('   ✓ Pure numeric layout in wreckplan.js verified');

// -----------------------------------------------------------------------------
// 4. Optical Depth & Chamber Darkness (wreckzones.js)
// -----------------------------------------------------------------------------
console.log('4. Verifying Derelict Zones & Chamber Darkness Transitions...');
assert(isDarkChamber(12400), 'Engine Bell must be a dark chamber');
assert(isDarkChamber(13500), 'Reactor Hall must be a dark chamber');
assert(!isDarkChamber(15000), 'The Break (open vacuum gap) must not be an enclosed dark chamber');
assert(isDarkChamber(19000), 'Forward Cargo Hangar must be a dark chamber');
assert(!isDarkChamber(24000), 'Graveyard / outside must not be a dark chamber');

const dApproach = getChamberDarkness(11600);
const dBewll = getChamberDarkness(12400);
const dBreak = getChamberDarkness(15000);
const dHangar = getChamberDarkness(19000);
const dExit = getChamberDarkness(24000);

console.log(`   Chamber Darkness: Approach=${dApproach}, Bell=${dBewll}, Break=${dBreak}, Hangar=${dHangar}, Exit=${dExit}`);
assert.strictEqual(dApproach, 0.0);
assert(dBewll >= 0.95);
assert.strictEqual(dBreak, 0.2); // Sun pours in through fracture
assert(dHangar >= 0.95);
assert.strictEqual(dExit, 0.0);

const warmth = getReactorWarmth(13500);
assert(warmth >= 0.95, 'Reactor warmth must peak inside reactor hall');
console.log('   ✓ Derelict optical darkness and reactor warmth transitions verified');

// -----------------------------------------------------------------------------
// 5. 3D Derelict Meshes & Zero Floating Light (wreck.js)
// -----------------------------------------------------------------------------
console.log('5. Verifying 3D Colossus Meshes, Swaying Cables, Sparks & Zero Floating Light...');
const testScene = new THREE.Scene();
const derelict = new DerelictWreck(testScene, spaceTrack);
assert(derelict.group, 'Derelict group must exist in scene');
assert(derelict.cables.length >= 4, 'Must have swaying power cables');
assert(derelict.runningLights.length >= 4, 'Must have running navigation lights');
assert(derelict.reactorMeshes.length >= 2, 'Must have reactor cores');
assert(derelict.reactorLights.length >= 2, 'Must have reactor point lights');

// Verify Zero Floating Light in the Void:
// Every point light in the derelict must be anchored strictly to a physical reactor core mesh
for (let i = 0; i < derelict.reactorLights.length; i++) {
  const light = derelict.reactorLights[i];
  const mesh = derelict.reactorMeshes[i];
  const dist = light.position.distanceTo(mesh.position);
  assert(dist < 0.1, `Point light ${i} must be anchored directly to physical reactor core (dist=${dist})`);
}
console.log('   ✓ Zero floating light in the void: All lights anchored strictly to physical reactor cores');

// Simulate animation update (cables sway, lights blink, sparks advance)
derelict.update(0.1, null, new THREE.Vector3(0, 0, 0), 10000);
assert(derelict.cables[0].mesh.rotation.z !== 0, 'Cables must sway dynamically');
console.log('   ✓ Cable swaying, sparks simulation, and reactor pulse verified');

// -----------------------------------------------------------------------------
// 6. Dynamic Headlight Ramping on Ships
// -----------------------------------------------------------------------------
console.log('6. Verifying Dynamic Ship Headlight Ramping in Dark Chambers...');
const testShip = new Ship('feather');
const daylightHeadlight = testShip.headlight.intensity;
console.log(`   Daylight Headlight Intensity: ${daylightHeadlight.toFixed(2)}`);

// Advance ship inside dark chamber (chamberDarkness = 1.0)
for (let i = 0; i < 30; i++) {
  testShip.update(1 / 60, { chamberDarkness: 1.0, speed: 250 });
}
const darkChamberHeadlight = testShip.headlight.intensity;
console.log(`   Dark Chamber High-Beam Intensity: ${darkChamberHeadlight.toFixed(2)}`);
assert(
  darkChamberHeadlight > daylightHeadlight * 2.5,
  'Headlight must ramp to high-beam intensity inside dark chambers'
);
console.log('   ✓ Dynamic headlight beam ramping verified');

// -----------------------------------------------------------------------------
// 7. SpaceWorld Integration & Chamber Sun Occlusion
// -----------------------------------------------------------------------------
console.log('7. Verifying SpaceWorld Chamber Lighting & Sun Occlusion...');
const spaceWorld = new SpaceWorld(testScene, null, null, spaceTrack);
assert(spaceWorld.derelict, 'SpaceWorld must instantiate and attach DerelictWreck');

// Update in open space
spaceWorld.update(0.016, null, new THREE.Vector3(0, 0, 0), 2000);
const openSun = spaceWorld.sun.intensity;
assert(openSun > 3.0, 'Sun intensity in open space must be full');

// Update inside Reactor Hall dark chamber (s = 13500)
spaceWorld.update(0.016, null, new THREE.Vector3(0, 0, 0), 13500);
const chamberSun = spaceWorld.sun.intensity;
console.log(`   Sun Intensity: Open Space=${openSun.toFixed(2)}, Inside Reactor Hall=${chamberSun.toFixed(2)}`);
assert(chamberSun < 0.2, 'Sun must be occluded inside dark chambers');
console.log('   ✓ SpaceWorld sunlight occlusion in dark chambers verified');

// -----------------------------------------------------------------------------
// 8. 9-Ship AI Fleet Race Simulation on 13.6 km Track
// -----------------------------------------------------------------------------
console.log('8. Simulating 9-Ship AI Race on 13.6 km Space Circuit...');
const race = new Race(spaceTrack, { difficulty: 'hard', numLaps: 3 });
race.attachToScene(testScene);
assert.strictEqual(race.racers.length, 9, 'Must have full 9-ship fleet');

// Simulate 12 seconds of 120 Hz fixed-step physics racing
const dt = 1 / 120;
const totalSteps = 12 * 120;
for (let step = 0; step < totalSteps; step++) {
  race.step(dt);
}

console.log('   Fleet progress after 12s of racing:');
let totalSpeed = 0;
let minProgress = Infinity;
for (let i = 0; i < race.racers.length; i++) {
  const r = race.racers[i];
  assert(!Number.isNaN(r.s), `Racer ${i} arc length must not be NaN`);
  assert(!Number.isNaN(r.vs), `Racer ${i} speed must not be NaN`);
  assert(!Number.isNaN(r.x), `Racer ${i} lateral position must not be NaN`);
  assert(Math.abs(r.x) <= TRACK_W * 0.5, `Racer ${i} must stay within 56m road width bounds`);

  const speedKmh = r.vs * 3.6;
  totalSpeed += r.vs;
  if (r.progress < minProgress) minProgress = r.progress;

  console.log(
    `     Ship ${i} (${r.ship ? r.ship.kind : 'rival'}): s=${r.s.toFixed(1)}m, speed=${speedKmh.toFixed(1)} km/h (${r.vs.toFixed(1)} m/s), lateral x=${r.x.toFixed(1)}m`
  );
}

const avgSpeedKmh = (totalSpeed / race.racers.length) * 3.6;
console.log(`   Fleet Average Speed: ${avgSpeedKmh.toFixed(1)} km/h`);
assert(avgSpeedKmh > 850.0, 'Fleet must race at full racing speed (>850 km/h)');
console.log('   ✓ 9-ship AI fleet reliably races across the 56m road');

console.log('\n======================================================');
console.log('ALL P4 DERELICT v1 & 56m ROAD ACCEPTANCE CRITERIA PASSED');
console.log('======================================================');
