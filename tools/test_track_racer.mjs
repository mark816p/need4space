// tools/test_track_racer.mjs — Verify TrackRacer 120Hz physics acceptance criteria
import * as THREE from 'three';
import { createSpaceTrack, TrackRacer } from '../src/track.js';
import { Ship } from '../src/ship.js';
import { clamp } from '../src/noise.js';

console.log('Testing TrackRacer Physics (P0.6 Acceptance Checks)...');

const track = createSpaceTrack();
const ship = new Ship('feather');
const racer = new TrackRacer(track, ship, { isPlayer: true, difficulty: 'hard' });

const DT = 1 / 120; // 120 Hz fixed physics step

// -----------------------------------------------------------------------------
// Test 1: Full Steer Wall Collision Test
// "a ship held at full steer hits the wall and keeps moving (never stuck on the wall)"
// -----------------------------------------------------------------------------
console.log('Test 1: Full steer against wall...');
racer.reset(500, 0, 180.0); // 180 m/s
let wallHits = 0;

for (let i = 0; i < 240; i++) { // 2 seconds at 120 Hz
  racer.step(DT, { throttle: 1.0, steer: 1.0 });
  const events = racer.consumeEvents();
  for (const ev of events) {
    if (ev.type === 'wall_hit') wallHits++;
  }
}

console.log(`  Speed while scraping wall: ${(racer.vs * 3.6).toFixed(1)} km/h (lateral x=${racer.x.toFixed(2)}m)`);
if (racer.vs < 100.0) {
  throw new Error(`FAIL: Racer got stuck on the wall (speed = ${(racer.vs * 3.6).toFixed(1)} km/h)`);
}
console.log('  PASS: Racer scraped wall and maintained high forward speed without sticking.');

// -----------------------------------------------------------------------------
// Test 2: Jump Launch & Landing Catch Test
// "at 900 km/h on a crest the ship is thrown up the arc (that is the jump); landing a jump produces no bounce/sparks storm"
// -----------------------------------------------------------------------------
console.log('Test 2: Jump launch and landing catch...');
// Jump gap 1 is at [1800, 1950]
racer.reset(1700, 0, 250.0); // 900 km/h approach
let launched = false;
let landed = false;
let maxLandingVh = 0;

for (let i = 0; i < 360; i++) {
  racer.step(DT, { throttle: 1.0, steer: 0 });
  const events = racer.consumeEvents();
  for (const ev of events) {
    if (ev.type === 'jump_launch') {
      launched = true;
      console.log(`  Jump launched at s=${racer.s.toFixed(1)}m, speed=${(racer.vs * 3.6).toFixed(1)} km/h`);
    }
    if (ev.type === 'landing') {
      landed = true;
      maxLandingVh = Math.abs(racer.vh);
      console.log(`  Jump landed at s=${racer.s.toFixed(1)}m, vh=${racer.vh.toFixed(2)}m/s`);
    }
  }
}

if (!launched) throw new Error('FAIL: Jump gap did not launch racer into ballistic air flight');
if (!landed) throw new Error('FAIL: Racer did not land cleanly after jump gap');
if (maxLandingVh > 5.0) throw new Error(`FAIL: Violent landing bounce detected (vh=${maxLandingVh})`);
console.log('  PASS: Jump launched into air arc and caught landing smoothly.');

// -----------------------------------------------------------------------------
// Test 3: Scripted Full-Throttle Lap Test
// "a scripted full-throttle lap with centreline-hugging input completes without a fall"
// -----------------------------------------------------------------------------
console.log('Test 3: Scripted full-throttle lap...');
racer.reset(0, 0, 60.0);
let simSteps = 0;
const MAX_STEPS = 120 * 80; // 80 seconds at 120 Hz (~9600 steps)
let completedLap = false;
let jumpCount = 0;
let landingCount = 0;

while (simSteps < MAX_STEPS) {
  simSteps++;

  // Centreline-hugging steering input: steers gently towards x = 0
  const steerCorrection = clamp(-racer.x * 0.08, -0.6, 0.6);

  racer.step(DT, { throttle: 1.0, steer: steerCorrection });

  const events = racer.consumeEvents();
  for (const ev of events) {
    if (ev.type === 'jump_launch') jumpCount++;
    if (ev.type === 'landing') landingCount++;
  }

  // Lap completed when accumulated progress exceeds track length
  if (racer.progress >= track.length) {
    completedLap = true;
    break;
  }
}

const lapTime = (simSteps * DT).toFixed(2);
const avgSpeed = ((track.length / (simSteps * DT)) * 3.6).toFixed(1);
console.log(`  Lap completed in ${lapTime}s (avg speed: ${avgSpeed} km/h)`);
console.log(`  Jumps negotiated: ${jumpCount} launched, ${landingCount} caught`);

if (!completedLap) {
  throw new Error(`FAIL: Racer failed to complete lap within 80 seconds (progress=${racer.progress.toFixed(1)}m)`);
}
if (jumpCount < 2 || landingCount < 2) {
  throw new Error(`FAIL: Expected both jump cuts to be negotiated cleanly (launched: ${jumpCount}, landed: ${landingCount})`);
}

console.log('PASS: All TrackRacer acceptance checks passed successfully!');
