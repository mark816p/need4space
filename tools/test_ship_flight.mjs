// tools/test_ship_flight.mjs — Verify Ship and FreeFlight models headlessly
import * as THREE from 'three';
import { buildFeatherS1, buildCometR1, buildAnvilH1, loadShip } from '../src/shipmodels.js';
import { Ship } from '../src/ship.js';
import { FreeFlight } from '../src/flight.js';
import { createSpaceTrack } from '../src/track.js';

console.log('Testing Ships and Free Flight...');

// 1. Verify Ship Models
const feather = buildFeatherS1();
console.log(`Feather S1: span=${feather.halfSpan * 2}m, length=${feather.length}m, rotors=${feather.rotors.length}, plumes=${feather.plumes.length}`);
if (feather.rotors.length !== 2) throw new Error('Expected 2 rotors on Feather S1');
if (feather.plumes.length !== 2) throw new Error('Expected 2 plumes on Feather S1');

const comet = buildCometR1();
console.log(`Comet R1: span=${comet.halfSpan * 2}m, length=${comet.length}m, plumes=${comet.plumes.length}`);

const anvil = buildAnvilH1();
console.log(`Anvil H1: span=${anvil.halfSpan * 2}m, length=${anvil.length}m, plumes=${anvil.plumes.length}`);

// 2. Verify Ship Class
const ship = new Ship('feather');
if (!ship.root || !ship.visual) throw new Error('Ship missing root or visual group');

// Canopy lock test
ship.setEngine(true);
ship.power = 1.0;
const toggledWhileRunning = ship.toggleCanopy();
if (toggledWhileRunning) throw new Error('Canopy should be locked while engine is running');

ship.setEngine(false);
ship.power = 0.0;
const toggledWhileOff = ship.toggleCanopy();
if (!toggledWhileOff) throw new Error('Canopy should toggle when engine is off');

// Hit shake test
ship.hit(new THREE.Vector3(1, 0, 0), 2.0);
if (ship.shakeRot.z === 0) throw new Error('Hit should apply visual shake');

// 3. Spool up test
ship.setEngine(true);
for (let i = 0; i < 60; i++) {
  ship.update(1 / 60, { throttle: 1.0 });
}
console.log(`Engine spooled up: power=${ship.power.toFixed(3)}, ready=${ship.ready}`);
if (ship.power < 0.9) throw new Error('Engine should be spooled up after 1s');

// 4. Free Flight Simulation Test
const track = createSpaceTrack();
const flight = new FreeFlight(ship, track);
flight.respawnOntoTrack(track, 100);

console.log(`Respawn pos: (${flight.pos.x.toFixed(1)}, ${flight.pos.y.toFixed(1)}, ${flight.pos.z.toFixed(1)})`);

// Advance flight under full throttle for 2 seconds
for (let i = 0; i < 120; i++) {
  flight.step(1 / 60, { throttle: 1.0, steer: 0.1 });
}
console.log(`Speed after 2s throttle: ${(flight.speed * 3.6).toFixed(1)} km/h`);
if (flight.speed < 20.0) throw new Error('Flight should accelerate under throttle');

console.log('PASS: All Ship and Free Flight tests passed.');
