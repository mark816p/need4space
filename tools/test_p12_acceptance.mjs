// tools/test_p12_acceptance.mjs — Comprehensive automated acceptance suite for Phase P12
// Verifies Airbrake charge dynamics, The Anvil H1 heavy armoured craft, Multi-ship liveries,
// Ocean Polish, Living Ocean fauna, the Kraken colossus, Alien Pillars ring, and Storm Rain system

import assert from 'node:assert';
import * as THREE from 'three';
import { createOceanTrack } from '../src/ocean.js';
import { createSpaceTrack, Track } from '../src/track.js';
import { TrackRacer } from '../src/trackracer.js';
import { Ship } from '../src/ship.js';
import { buildFeatherS1, buildCometR1, buildAnvilH1, createShipMaterials } from '../src/shipmodels.js';
import { HANDLING, AIRBRAKE_HOLD, AIRBRAKE_WAIT } from '../src/ships.js';
import { SHIP_LIVERIES, getLivery, applyShipLivery, BAKE } from '../src/liveries.js';
import { SHOWROOM_SHIPS, Showroom } from '../src/showroom.js';
import { SeabedEnvironment } from '../src/seabed.js';
import { SeaLife } from '../src/sealife.js';
import { KrakenSquid } from '../src/squid.js';
import { AlienPillarsRing } from '../src/pillars.js';
import { StormRain } from '../src/rain.js';
import { OceanWorld } from '../src/oceanworld.js';
import { CHANGELOG, CURRENT_VERSION } from '../src/changelog.js';

// Mock DOM/canvas for headless Node.js environment
if (typeof document === 'undefined') {
  globalThis.document = {
    body: {
      appendChild() {},
      classList: { add() {}, remove() {} },
      dataset: {}
    },
    createElement(type) {
      if (type === 'canvas') {
        const width = 256;
        const height = 256;
        return {
          width,
          height,
          clientWidth: 800,
          clientHeight: 600,
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
              stroke() {},
              fill() {},
              arc() {},
              save() {},
              restore() {},
              translate() {},
              rotate() {},
              scale() {}
            };
          },
          addEventListener() {},
          removeEventListener() {},
          setPointerCapture() {},
          releasePointerCapture() {}
        };
      }
      return {
        style: {},
        classList: { add() {}, remove() {}, contains() { return false; } },
        appendChild() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        addEventListener() {},
        removeEventListener() {}
      };
    },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {}
  };
}

if (typeof window === 'undefined') {
  globalThis.window = {
    innerWidth: 1920,
    innerHeight: 1080,
    addEventListener() {},
    removeEventListener() {}
  };
}

console.log('=== Need4Space Phase P12 Acceptance Test Suite ===\n');

// -----------------------------------------------------------------------------
// 1. Airbrake Charge Dynamics (ships.js, trackracer.js)
// -----------------------------------------------------------------------------
console.log('--- 1. Airbrake Charge Dynamics (v1.6.0) ---');

assert.strictEqual(AIRBRAKE_HOLD, 1.0, 'AIRBRAKE_HOLD constant is 1.0 s');
assert.strictEqual(AIRBRAKE_WAIT, 3.0, 'AIRBRAKE_WAIT constant is 3.0 s');

assert.strictEqual(HANDLING.feather.airbrakes, 1, 'Feather S1 has 1 airbrake charge');
assert.strictEqual(HANDLING.rocket.airbrakes, 1, 'Comet R1 has 1 airbrake charge');
assert.strictEqual(HANDLING.heavy.airbrakes, 2, 'Anvil H1 has 2 airbrake charges');

const dummyTrack = createSpaceTrack();
const featherModel = buildFeatherS1();
const featherShip = new Ship(featherModel);
const featherRacer = new TrackRacer(dummyTrack, featherShip, { kind: 'feather' });

assert.strictEqual(featherRacer.maxAirbrakes, 1, 'Feather racer initial max airbrakes is 1');
assert.strictEqual(featherRacer.airbrakeCharges, 1, 'Feather racer starts with full charges (1)');

const anvilModel = buildAnvilH1();
const anvilShip = new Ship(anvilModel);
const anvilRacer = new TrackRacer(dummyTrack, anvilShip, { kind: 'heavy' });

assert.strictEqual(anvilRacer.maxAirbrakes, 2, 'Anvil racer initial max airbrakes is 2');
assert.strictEqual(anvilRacer.airbrakeCharges, 2, 'Anvil racer starts with full charges (2)');

// Trigger airbrake on Anvil: should fire 1 charge and leave 1 charge
anvilRacer.step(0.016, { airbrakeL: true });
assert.strictEqual(anvilRacer.airbrakeCharges, 1, 'Anvil has 1 charge remaining after firing left airbrake');
assert.strictEqual(anvilRacer.activeAirbrake, 'L', 'Left airbrake is active');

// Hold airbrake for 0.5s: charge remains active
for (let i = 0; i < 30; i++) {
  anvilRacer.step(0.016, { airbrakeL: true });
}
assert.strictEqual(anvilRacer.activeAirbrake, 'L', 'Airbrake still held under AIRBRAKE_HOLD (1.0s)');

// Hold airbrake past 1.0s: burst expires automatically
for (let i = 0; i < 40; i++) {
  anvilRacer.step(0.016, { airbrakeL: true });
}
assert.strictEqual(anvilRacer.activeAirbrake, null, 'Airbrake expires after holding past 1.0s');

// Let it recharge for 3.0s: charges should recover back to 2
for (let i = 0; i < 200; i++) {
  anvilRacer.step(0.016, { airbrakeL: false, airbrakeR: false });
}
assert.strictEqual(anvilRacer.airbrakeCharges, 2, 'Airbrake charges fully recharged back to 2');

console.log('PASS: Airbrake charge finite-state machine and class limits verified');

// -----------------------------------------------------------------------------
// 2. The Anvil H1 Heavy Armoured Craft (shipmodels.js, ship.js, trackracer.js)
// -----------------------------------------------------------------------------
console.log('\n--- 2. The Anvil H1 Heavy Armoured Craft (v1.7.0) ---');

assert.strictEqual(anvilModel.kind, 'heavy', 'Model kind is heavy');
assert.strictEqual(anvilModel.halfSpan, 6.4, 'Half-span is 6.4m');
assert.strictEqual(anvilModel.length, 12.8, 'Length is 12.8m');
assert(anvilModel.headlampBand, 'Anvil has nose headlamp LED band');
assert(anvilModel.pulseRings && anvilModel.pulseRings.length === 4, 'Anvil has 4 concentric pulse rings');
assert(anvilModel.shockDiamonds && anvilModel.shockDiamonds.length === 6, 'Anvil has 6 exhaust shock diamonds');
assert(anvilModel.orbitBalls && anvilModel.orbitBalls.length === 6, 'Anvil has 6 orbiting magnet balls (3 per engine)');

// Verify kinematics update in Ship.update()
const prevAngle0 = anvilModel.orbitBalls[0].userData.baseAngle;
anvilShip.setEngine(true);
anvilShip.power = 1.0;
anvilShip.update(0.05, { throttle: 1.0, speed: 200, boost: false });
const nextAngle0 = anvilModel.orbitBalls[0].userData.baseAngle;
assert(nextAngle0 !== prevAngle0, 'Orbiting magnet balls rotate dynamically with engine power and throttle');

// Verify Anti-Dip Corner Safety Clamping during sharp banking
// Without clamping, a wide ship (halfSpan = 6.4) hovering at h = 1.8 would clip when rolled > 0.28 rad
anvilRacer.h = 1.8;
anvilRacer.updatePose(1.0); // Hard steer right
const euler = new THREE.Euler().setFromQuaternion(anvilRacer.quat, 'YXZ');
const maxAllowedRoll = Math.asin((anvilRacer.h - 0.25) / anvilModel.halfSpan);
assert(Math.abs(euler.z) <= maxAllowedRoll + 0.05, `Roll angle ${Math.abs(euler.z).toFixed(3)} rad clamped within anti-dip safety bound (${maxAllowedRoll.toFixed(3)} rad)`);

console.log('PASS: Anvil H1 procedural model, engine magnetics, and anti-dip safety verified');

// -----------------------------------------------------------------------------
// 3. Multi-Ship Livery Registry (liveries.js, showroom.js)
// -----------------------------------------------------------------------------
console.log('\n--- 3. Multi-Ship Livery Registry (liveries.js) ---');

assert.strictEqual(BAKE, '?b=2', 'BAKE asset cache tag is "?b=2"');
assert(SHIP_LIVERIES.feather && SHIP_LIVERIES.feather.length === 3, 'Feather S1 has 3 distinct liveries');
assert(SHIP_LIVERIES.rocket && SHIP_LIVERIES.rocket.length === 3, 'Comet R1 has 3 distinct liveries');
assert(SHIP_LIVERIES.heavy && SHIP_LIVERIES.heavy.length === 3, 'Anvil H1 has 3 distinct liveries');

// Test livery retrieval
const featherLivery1 = getLivery('feather', 1);
assert.strictEqual(featherLivery1.id, 'stealth', 'Feather livery 1 is stealth Carbon Pulse');

// Apply livery to ship instance
const applied = applyShipLivery(featherShip, 1);
assert.strictEqual(applied.id, 'stealth', 'Livery applied to ship');
assert.strictEqual(featherShip.currentLivery.id, 'stealth', 'Ship records current livery');

// Showroom integration
const showroom = new Showroom();
assert.strictEqual(SHOWROOM_SHIPS.length, 3, 'Showroom includes Feather S1, Comet R1, and Anvil H1');
showroom.currentShipIdx = 2; // Anvil H1
showroom.currentLiveryIdx = 2; // Obsidian
showroom._rebuildShip();
assert.strictEqual(showroom.shipInstance.model.kind, 'heavy', 'Showroom built heavy Anvil H1');

console.log('PASS: Multi-ship livery registry (9 palettes), BAKE tag, and showroom integration verified');

// -----------------------------------------------------------------------------
// 4. Ocean Polish & Wet Ship Drying Model (ocean.js, ship.js)
// -----------------------------------------------------------------------------
console.log('\n--- 4. Ocean World Polish & Wet Ship Drying Model ---');

const oceanTrack = createOceanTrack();
// Low causeway points (0 to 5)
const causewayPt0 = oceanTrack.controlPoints[0].pos;
const causewayPt1 = oceanTrack.controlPoints[1].pos;
assert(causewayPt0.y >= 8.0, `Start/finish causeway raised clear of swell (expected >= 8m, got ${causewayPt0.y}m)`);
assert(causewayPt1.y >= 7.0, `Low causeway raised clear of swell (expected >= 7m, got ${causewayPt1.y}m)`);

// Barrel roll point (point 33)
const barrelPt = oceanTrack.controlPoints[33].pos;
assert.strictEqual(barrelPt.y, 48.0, `Barrel roll apex raised to 48m (got ${barrelPt.y}m)`);

// Wet ship optical drying model:
// Submerging in water (underK > 0.05) wets the ship
featherShip.update(0.016, { underK: 0.8 });
assert.strictEqual(featherShip.shipWet, 1.0, 'Ship is fully wet (1.0) when submerged');

// Breaching into air: dries over 12 seconds
featherShip.update(3.0, { underK: 0.0 });
assert(featherShip.shipWet < 1.0 && featherShip.shipWet > 0.6, `Ship drying after 3s (got wet = ${featherShip.shipWet.toFixed(2)})`);
featherShip.update(10.0, { underK: 0.0 });
assert.strictEqual(featherShip.shipWet, 0.0, 'Ship fully dry after >12 seconds in air');

console.log('PASS: Low causeway height (8.5m), barrel roll apex (48m), and 12-second ship drying model verified');

// -----------------------------------------------------------------------------
// 5. Living Ocean Fauna Subsystems (seabed.js, sealife.js, squid.js, pillars.js, rain.js)
// -----------------------------------------------------------------------------
console.log('\n--- 5. Living Ocean Fauna Subsystems (seabed, sealife, squid, pillars, rain) ---');

const testScene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);

// Seabed
const seabed = new SeabedEnvironment(testScene, oceanTrack);
assert(seabed.kelpFronds.length > 0, 'Kelp fronds built on seabed');
assert(seabed.bubbleVents.length > 0, 'Hydrothermal bubble vents built');
assert(seabed.fishShoals.length >= 3, 'Multi-species fish shoals built (sardines, tuna, snappers)');
assert(seabed.lanternfish.length > 0, 'Deep lanternfish with bioluminescent lures built');
assert(seabed.crabs.length > 0, 'Road-crossing crabs built on seabed deck');
seabed.update(0.016, 1.0);

// Sea life
const sealife = new SeaLife(testScene, oceanTrack);
assert(sealife.dolphins.length > 0, 'Leaping dolphin pods built');
assert(sealife.leviathan && sealife.leviathanSegments.length >= 6, 'Colossal ~60m leviathan built with body segments');
assert(sealife.jellyfish.length > 0, 'Luminous drifting jellyfish built');
assert(sealife.seabirds.length > 0, 'Wheeling seabirds built');
sealife.update(0.016, 1.0);

// The Kraken
const kraken = new KrakenSquid(testScene, new THREE.Vector3(120, 16, 2820));
assert(kraken.eyes.length === 2, 'The Kraken has 2 amber slit eyes');
assert(kraken.arms.length === 8, 'The Kraken has 8 writhing arms');
assert(kraken.tentacles.length === 2, 'The Kraken has 2 long lashing tentacles');
kraken.update(0.016, 1.0, new THREE.Vector3(100, 20, 2800));

// Alien Pillars Ring
const pillars = new AlienPillarsRing(testScene);
assert.strictEqual(pillars.pillars.length, 8, 'Ring contains 8 colossal alien pillars');
assert(pillars.pillars[0].height >= 650.0, `Colossal pillar height is >= 650m (got ${pillars.pillars[0].height}m)`);
pillars.update(0.016, 1.0);

// Storm Rain System & Underwater Shutoff
const rain = new StormRain(testScene, camera, null);
assert(rain.rainLines, 'Rain streak lines created');
assert(rain.splashes.length > 0, 'Deck splash droplets created');
assert(rain.puddles.length > 0, 'Road puddles created');

// Above water (underK = 0): rain lines visible
rain.update(0.016, camera, 200, 0.0);
assert.strictEqual(rain.rainLines.visible, true, 'Rain lines visible above water');

// Below water (underK > 0.05): rain lines shut off
rain.update(0.016, camera, 200, 0.7);
assert.strictEqual(rain.rainLines.visible, false, 'Rain lines shut off completely underwater');

// Integrated OceanWorld
const oceanWorld = new OceanWorld(testScene, null, camera, oceanTrack);
assert(oceanWorld.seabed, 'OceanWorld integrates SeabedEnvironment');
assert(oceanWorld.sealife, 'OceanWorld integrates SeaLife');
assert(oceanWorld.kraken, 'OceanWorld integrates KrakenSquid');
assert(oceanWorld.pillars, 'OceanWorld integrates AlienPillarsRing');
assert(oceanWorld.rain, 'OceanWorld integrates StormRain');

oceanWorld.update(0.016, camera, new THREE.Vector3(120, 8.5, 2850), 100, null);

console.log('PASS: All 5 Living Ocean fauna and weather subsystems verified');

// -----------------------------------------------------------------------------
// 6. Version Registry (changelog.js)
// -----------------------------------------------------------------------------
console.log('\n--- 6. Version Registry (changelog.js) ---');

const [maj, min] = CURRENT_VERSION.split('.').map(Number);
assert(maj > 1 || (maj === 1 && min >= 7), `CURRENT_VERSION is >= 1.7.0 (got ${CURRENT_VERSION})`);
const v170 = CHANGELOG.find(e => e.version === '1.7.0');
const v160 = CHANGELOG.find(e => e.version === '1.6.0');
const v150 = CHANGELOG.find(e => e.version === '1.5.0');
const v141 = CHANGELOG.find(e => e.version === '1.4.1');

assert(v170, 'Changelog contains v1.7.0 (The Anvil H1 & Ship Liveries)');
assert(v160, 'Changelog contains v1.6.0 (Airbrake Charge Dynamics)');
assert(v150, 'Changelog contains v1.5.0 (Living Ocean & Colossal Fauna)');
assert(v141, 'Changelog contains v1.4.1 (Ocean World Polish)');

console.log(`PASS: Version registry at ${CURRENT_VERSION} with full Phase P12 patch notes`);

console.log('\n=== ALL PHASE P12 ACCEPTANCE CHECKS PASSED ===\n');
