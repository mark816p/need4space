// tools/test_p5_acceptance.mjs — Acceptance verification test suite for Phase P5
import * as THREE from 'three';
import { Track, createSpaceTrack, TRACK_W, TrackRacer, PITCH_AIR } from '../src/track.js';
import { flipFields } from '../src/trackmesh.js';
import { CameraController } from '../src/camera.js';
import { FXSystem } from '../src/fx.js';
import { HUDController } from '../src/hud.js';
import { DEFAULT_SETTINGS } from '../src/settings.js';
import { Race, DriverAI } from '../src/race.js';

let failed = false;
function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed = true;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

console.log('=== PHASE P5 ACCEPTANCE VERIFICATION ===\n');

// 1. Settings & Constants
assert(DEFAULT_SETTINGS.airPitch === true, 'DEFAULT_SETTINGS has airPitch: true');
assert(PITCH_AIR === 14.0, 'PITCH_AIR equals 14.0 m/s²');

// 2. Track & Gravity Flips
const spaceTrack = createSpaceTrack();
assert(Array.isArray(spaceTrack.flips) && spaceTrack.flips.length >= 2, 'Space track has at least 2 gravity flips');
const [flip1, flip2] = spaceTrack.flips;
assert(flip1[0] === 3440 && flip1[1] === 3680, 'Flip 1 spans [3440, 3680] (240 m)');
assert(flip2[0] === 4520 && flip2[1] === 4760, 'Flip 2 spans [4520, 4760] (240 m)');
assert(spaceTrack.inFlip(3560) === true, 'spaceTrack.inFlip(3560) is true');
assert(spaceTrack.inFlip(1000) === false, 'spaceTrack.inFlip(1000) is false');

// Verify flips are also included in track.gaps for mesh generation
const hasFlip1InGaps = spaceTrack.gaps.some(([g0, g1]) => Math.abs(g0 - flip1[0]) < 5 && Math.abs(g1 - flip1[1]) < 5);
assert(hasFlip1InGaps, 'Gravity flip 1 is included in track.gaps for mesh cuts and lips');

// Check 180 bank turnover
const fApproach = {};
const fOverhead = {};
spaceTrack.frame(3300, fApproach);
spaceTrack.frame(4000, fOverhead);
const bankApproachDeg = Math.round(fApproach.bank * 180 / Math.PI);
const bankOverheadDeg = Math.round(fOverhead.bank * 180 / Math.PI);
console.log(`Approach bank: ${bankApproachDeg}°, Overhead bank: ${bankOverheadDeg}°`);
assert(Math.abs(bankOverheadDeg - 180) < 5, 'Overhead deck is inverted by ~180°');

// Verify flipFields mesh generator
const flipGroup = flipFields(spaceTrack);
assert(flipGroup && flipGroup.children.length > 0, 'flipFields() returns mesh group with light tubes and hoops');
let hasFlipColor = false;
flipGroup.traverse((child) => {
  if (child.material && child.material.color) {
    const c = child.material.color;
    // Magenta-violet theme flip:[0.62, 0.24, 1.0]
    if (Math.abs(c.r - 0.62) < 0.05 && Math.abs(c.b - 1.0) < 0.05) {
      hasFlipColor = true;
    }
  }
});
assert(hasFlipColor, 'flipFields() meshes use magenta-violet theme flip:[0.62, 0.24, 1.0]');

// 3. AI Gravity Flip Survivability at 900 km/h
console.log('\nTesting AI flip survivability at 900 km/h (250 m/s)...');
const race = new Race(spaceTrack, { difficulty: 'brutal' });
const dt = 1 / 120; // 120 Hz simulation step
const SPEED_900KMH = 250.0; // 900 km/h = 250 m/s

let allSurvive = true;
for (let i = 0; i < race.racers.length; i++) {
  const r = race.racers[i];
  const driver = race.drivers[i];

  // Position 100m before flip 1
  r.reset(3300, 0, SPEED_900KMH);

  // Step across flip 1 (from 3300m to 3800m, ~2.0 seconds)
  for (let step = 0; step < 260; step++) {
    const input = driver ? driver.plan(race.racers) : { throttle: 1, brake: 0, steer: 0 };
    r.step(dt, input);

    if (isNaN(r.pos.x) || isNaN(r.pos.y) || isNaN(r.pos.z) || isNaN(r.vs)) {
      console.error(`AI racer ${i} hit NaN at s=${r.s.toFixed(1)}`);
      allSurvive = false;
      break;
    }
    if (Math.abs(r.x) > (TRACK_W * 0.5 + 1.0)) {
      console.error(`AI racer ${i} fell off track at s=${r.s.toFixed(1)}, x=${r.x.toFixed(1)}`);
      allSurvive = false;
      break;
    }
  }

  // Check orientation at overhead deck
  assert(r.frame.U.y < 0, `Racer ${i} inverted on overhead deck (U.y = ${r.frame.U.y.toFixed(2)})`);
}
assert(allSurvive, 'All AI racers survived gravity flip 1 at 900 km/h with zero NaN and zero fall-offs');

// 4. Camera rollFollow = 1 on track
console.log('\nTesting Camera rollFollow = 1 on track...');
const dummyCam = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 5000);
const camCtrl = new CameraController(dummyCam, { rollFollow: 1.0 });
assert(camCtrl.rollFollow === 1.0, 'CameraController has rollFollow = 1.0');

const testRacer = race.playerRacer;
testRacer.reset(3300, 0, 200.0);
// Approach upright deck
testRacer.step(dt, { throttle: 1 });
camCtrl.update(dt, testRacer, spaceTrack);
assert(dummyCam.up.length() > 0.99, 'Camera up vector is normalized and non-zero on approach');
assert(dummyCam.up.y > 0.5, 'Camera up vector points upwards on standard deck');

// Invert on overhead deck
testRacer.reset(4000, 0, 200.0);
for (let k = 0; k < 10; k++) {
  testRacer.step(dt, { throttle: 1 });
  camCtrl.update(dt, testRacer, spaceTrack);
}
assert(dummyCam.up.length() > 0.99, 'Camera up vector is normalized and non-zero on inverted deck');
assert(dummyCam.up.y < -0.5, 'Camera rolls with inverted deck (dummyCam.up.y < -0.5)');

// 5. Air Pitch Control (PITCH_AIR = 14 m/s²)
console.log('\nTesting airPitch nose control in the air...');
// Setup gap jump at gap [1650, 1800]
const pDown = new TrackRacer(spaceTrack, null, { isPlayer: true, airPitch: true });
const pUp = new TrackRacer(spaceTrack, null, { isPlayer: true, airPitch: true });

// Jump launch into gap at 150 m/s
pDown.reset(1640, 0, 150.0);
pUp.reset(1640, 0, 150.0);

// Step until both launch into air
while (!pDown.inAir) pDown.step(dt, { throttle: 1.0 });
while (!pUp.inAir) pUp.step(dt, { throttle: 0.0 });

console.log('Both racers launched into gap air flight. Applying pitch commands...');
// pDown presses KeyW / ArrowUp (nose down)
// pUp presses KeyS / ArrowDown (nose up)
let downLanded = false;
let upLanded = false;
let downAirSteps = 0;
let upAirSteps = 0;

for (let s = 0; s < 400; s++) {
  if (pDown.inAir) {
    pDown.step(dt, { throttle: 1.0, brake: 0.0 });
    downAirSteps++;
  } else {
    downLanded = true;
  }

  if (pUp.inAir) {
    pUp.step(dt, { throttle: 0.0, brake: 1.0 });
    upAirSteps++;
  } else {
    upLanded = true;
  }
}

console.log(`Nose Down air steps: ${downAirSteps}, Nose Up air steps: ${upAirSteps}`);
assert(downAirSteps < upAirSteps, 'Nose down pulls hull back to deck sooner (fewer air steps than nose up)');
assert(pDown.pitchAccel < 0, `Nose down produces downward acceleration: ${pDown.pitchAccel.toFixed(2)} m/s²`);
assert(pUp.pitchAccel > 0, `Nose up produces upward acceleration: ${pUp.pitchAccel.toFixed(2)} m/s²`);

// Verify pitch control is disabled during gravity flips
const pFlip = new TrackRacer(spaceTrack, null, { isPlayer: true, airPitch: true });
pFlip.reset(3500, 0, 150.0);
pFlip.step(dt, { throttle: 1.0, brake: 0.0 });
assert(pFlip.isInFlip === true, 'pFlip.isInFlip is true in gravity flip');
assert(pFlip.inAir === false, 'pFlip does not enter ballistic air flight in gravity flip');
assert(pFlip.pitchAccel === 0.0, 'Air pitch is disabled during gravity flip');

// 6. Drift Architecture & Dormant Systems
console.log('\nTesting Drift architecture (TrackRacer.drifting = false)...');
assert(TrackRacer.drifting === false, 'TrackRacer.drifting is false by default');

// Verify Rivals never drift
const aiRacer = race.racers[0];
assert(aiRacer.isPlayer === false, 'AI racer isPlayer is false');
aiRacer.step(dt, { throttle: 1.0, brake: 1.0, steer: 1.0 });
assert(aiRacer.isDrifting === false, 'Rivals never drift even when brake+throttle+steer is applied');

// Test drift mechanics when enabled
TrackRacer.drifting = true;
const dRacer = new TrackRacer(spaceTrack, null, { isPlayer: true });
dRacer.reset(100, 0, 180.0);

// Initiate drift on brake + throttle + steer
dRacer.step(dt, { throttle: 1.0, brake: 1.0, steer: 1.0 });
assert(dRacer.isDrifting === true, 'Drift initiated on brake + throttle + steer');
assert(dRacer.vh > 1.0, 'Lateral hop impulse applied on drift initiation');

// Hold drift for 1.0s (should reach Tier 1: Blue)
for (let t = 0; t < 120; t++) {
  dRacer.step(dt, { throttle: 1.0, brake: 1.0, steer: 1.0 });
}
assert(dRacer.driftTier === 1, `Drift reached Tier 1 (tier = ${dRacer.driftTier})`);
assert(Math.abs(dRacer.driftYaw) > 0.25, `Nose held in corner (driftYaw = ${(dRacer.driftYaw * 180 / Math.PI).toFixed(1)}°)`);

// Hold drift for another 1.0s (total 2.0s -> Tier 2: Orange)
for (let t = 0; t < 120; t++) {
  dRacer.step(dt, { throttle: 1.0, brake: 1.0, steer: 1.0 });
}
assert(dRacer.driftTier === 2, `Drift reached Tier 2 (tier = ${dRacer.driftTier})`);

// Release brake to trigger straight recovery kick
const preKickEnergy = dRacer.boostEnergy;
dRacer.step(dt, { throttle: 1.0, brake: 0.0, steer: 0.0 });
assert(dRacer.isDrifting === false, 'Drift ended upon straight recovery');
assert(dRacer.boostEnergy > 1.0, `Straight recovery kick topped boost energy past 1.0: ${dRacer.boostEnergy.toFixed(2)}`);
assert(dRacer.driftChain === 1, 'Drift chain started (chain = 1)');
assert(dRacer.driftChainTimer > 2.0, 'Drift chain timer set (2.5s)');

// Test energy overflow bleed-back
const overEnergy = dRacer.boostEnergy;
for (let t = 0; t < 120; t++) {
  dRacer.step(dt, { throttle: 1.0, brake: 0.0, steer: 0.0 });
}
assert(dRacer.boostEnergy < overEnergy && dRacer.boostEnergy >= 1.0, `Boost energy overflow bleeds back slowly: ${dRacer.boostEnergy.toFixed(3)}`);

// Reset static flag back to false
TrackRacer.drifting = false;
assert(TrackRacer.drifting === false, 'TrackRacer.drifting restored to false');

// Verify FX and HUD dormant support
const dummyScene = new THREE.Scene();
const fx = new FXSystem(dummyScene, dummyCam);
assert(fx.drift && Array.isArray(fx.drift.tierColors), 'fx.drift exists with tierColors [blue, orange, violet]');
assert(fx.drift.tierColors.length === 3, 'fx.drift defines 3 tier colors');

const hud = new HUDController(spaceTrack, race);
assert(typeof hud.update === 'function', 'hud.update function exists');

console.log('\n=== ACCEPTANCE TEST RESULT ===');
if (failed) {
  console.error('FAILED: One or more acceptance checks did not pass.');
  process.exit(1);
} else {
  console.log('ALL PHASE P5 ACCEPTANCE CHECKS PASSED SUCCESSFULLY!');
  process.exit(0);
}
