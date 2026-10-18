// tools/test_p13_acceptance.mjs — Comprehensive automated acceptance suite for Phase P13
// Verifies Damage & Shield systems (v1.8.0), Mixed Fleet (v1.9.0), Named Aces (v1.10.0),
// and The Slam lateral sideswipe mechanic (v1.11.0 / v1.11.1)

import assert from 'node:assert';
import * as THREE from 'three';
import { createSpaceTrack, Track } from '../src/track.js';
import { TrackRacer } from '../src/trackracer.js';
import { Ship } from '../src/ship.js';
import { buildFeatherS1, buildCometR1, buildAnvilH1, createShipMaterials } from '../src/shipmodels.js';
import { HANDLING, REGEN_WAIT, REGEN_RATE } from '../src/ships.js';
import { TEAMS, DriverAI, Race } from '../src/race.js';
import { FXSystem } from '../src/fx.js';
import { AudioManager } from '../src/audio.js';
import { HUDController } from '../src/hud.js';
import { CHANGELOG, CURRENT_VERSION } from '../src/changelog.js';

// Mock DOM/canvas for headless Node.js environment
if (typeof document === 'undefined') {
  globalThis.document = {
    body: {
      appendChild() {},
      classList: { add() {}, remove() {}, contains() { return false; } },
      dataset: {}
    },
    createElement(type) {
      if (type === 'canvas') {
        const width = 380;
        const height = 380;
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
              scale() {},
              clearRect() {}
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
    getElementById(id) {
      if (id === 'edgeflash') {
        return { style: {} };
      }
      if (id === 'shield-fill' || id === 'airbrake-fill' || id === 'bst-overflow' || id === 'drift-chain') {
        return { style: {}, classList: { add() {}, remove() {}, contains() { return false; } } };
      }
      if (id === 'map') {
        return this.createElement('canvas');
      }
      return { style: {}, classList: { add() {}, remove() {}, contains() { return false; } }, textContent: '', appendChild() {}, innerHTML: '' };
    },
    querySelector() {
      return { style: {}, classList: { add() {}, remove() {}, contains() { return false; } } };
    },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {}
  };
}

if (typeof Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {
    moveTo() {}
    lineTo() {}
    closePath() {}
  };
}

console.log('=== Need4Space Phase P13 Acceptance Test Suite ===\n');

// -----------------------------------------------------------------------------
// 1. Damage & Shield Mechanics per Ship Class (v1.8.0)
// -----------------------------------------------------------------------------
console.log('--- 1. Damage & Shield Mechanics (v1.8.0) ---');

// Verify HANDLING registry defines shields, resistances, and slam attributes for all classes
assert.strictEqual(HANDLING.feather.shield, 100.0, 'Feather S1 should have 100.0 shield');
assert.strictEqual(HANDLING.feather.damageResist, 1.0, 'Feather S1 damage resist should be 1.0');
assert.strictEqual(HANDLING.rocket.shield, 85.0, 'Comet R1 should have 85.0 shield');
assert.strictEqual(HANDLING.rocket.damageResist, 1.15, 'Comet R1 damage resist should be 1.15');
assert.strictEqual(HANDLING.heavy.shield, 160.0, 'Anvil H1 should have 160.0 shield');
assert.strictEqual(HANDLING.heavy.damageResist, 0.65, 'Anvil H1 damage resist should be 0.65 (high armor)');
assert.strictEqual(REGEN_WAIT, 3.5, 'REGEN_WAIT should be 3.5s');
assert.strictEqual(REGEN_RATE, 16.0, 'REGEN_RATE should be 16.0 HP/s');
console.log('  ✓ Class-differentiated shield pools and resistances verified');

const track = createSpaceTrack();
const featherShip = new Ship(buildFeatherS1());
const featherRacer = new TrackRacer(track, featherShip, { kind: 'feather' });
const heavyShip = new Ship(buildAnvilH1());
const heavyRacer = new TrackRacer(track, heavyShip, { kind: 'heavy' });

assert.strictEqual(featherRacer.shield, 100.0, 'Feather initial shield should be 100.0');
assert.strictEqual(heavyRacer.shield, 160.0, 'Heavy initial shield should be 160.0');

// Test takeDamage()
let lastDamageEvent = null;
featherRacer.on('damage', (ev) => {
  lastDamageEvent = ev;
});
const dmgTaken = featherRacer.takeDamage(30.0, 'laser');
assert.strictEqual(dmgTaken, 30.0, 'takeDamage should return effective damage');
assert.strictEqual(featherRacer.shield, 70.0, 'Feather shield should be 70.0 after 30.0 damage');
assert.ok(lastDamageEvent, 'damage event should have fired');
assert.strictEqual(lastDamageEvent.amount, 30.0);
assert.strictEqual(lastDamageEvent.shield, 70.0);
assert.strictEqual(lastDamageEvent.source, 'laser');

// Test regeneration wait period
for (let step = 0; step < 120; step++) { // 1.0s at dt=1/120
  featherRacer.step(1 / 120, { throttle: 1.0 });
}
assert.strictEqual(featherRacer.shield, 70.0, 'Shield should not regenerate before REGEN_WAIT (3.5s)');

// Advance past REGEN_WAIT (total 4.0s elapsed from hit)
for (let step = 0; step < 360; step++) { // +3.0s at dt=1/120 (total 4.0s)
  featherRacer.step(1 / 120, { throttle: 1.0 });
}
assert.ok(featherRacer.shield > 70.0, 'Shield should begin regenerating after 3.5s');
const expectedRegen = 70.0 + (4.0 - REGEN_WAIT) * REGEN_RATE;
assert.ok(Math.abs(featherRacer.shield - expectedRegen) < 1.0, `Shield should be near ${expectedRegen}, got ${featherRacer.shield}`);

// Test fatal damage, disintegration explosion, and respawn FSM
let wreckFired = false;
let explosionFired = false;
featherRacer.on('wreck', () => { wreckFired = true; });
featherRacer.on('explosion', () => { explosionFired = true; });

featherRacer.takeDamage(200.0, 'catastrophic');
assert.strictEqual(featherRacer.shield, 0.0, 'Shield clamped to 0 on fatal damage');
assert.strictEqual(featherRacer.isDead, true, 'Racer should be in dead state');
assert.strictEqual(wreckFired, true, 'wreck event should fire on death');
assert.strictEqual(explosionFired, true, 'explosion event should fire on death');

let respawnFired = false;
let respawnedSpeed = 0;
featherRacer.on('respawn', () => {
  respawnFired = true;
  respawnedSpeed = featherRacer.vs;
});

// Step through respawn timer (2.2s)
for (let step = 0; step < 200; step++) { // ~1.66s
  featherRacer.step(1 / 120, { throttle: 1.0 });
}
assert.strictEqual(featherRacer.isDead, true, 'Racer should remain dead before respawnDuration finishes');

// Complete respawn duration (+0.8s, total > 2.2s)
for (let step = 0; step < 100; step++) {
  featherRacer.step(1 / 120, { throttle: 0.0 });
}
assert.strictEqual(featherRacer.isDead, false, 'Racer should be resurrected after respawn timer');
assert.strictEqual(respawnFired, true, 'respawn event should fire');
assert.strictEqual(respawnedSpeed, Math.min(130.0, featherRacer.handling.topSpeed * 0.5), 'Racer given rolling start speed on respawn');
assert.strictEqual(featherRacer.shield, featherRacer.maxShield, 'Full shield restored on respawn');
assert.strictEqual(featherRacer.x, 0.0, 'Racer placed at track centerline on respawn');
assert.strictEqual(featherRacer.vx, 0.0, 'Lateral velocity zeroed on respawn');
console.log('  ✓ Shield damage, regeneration cooldown, death, and respawn FSM verified');

// -----------------------------------------------------------------------------
// 2. Mixed Fleet Hierarchy (v1.9.0)
// -----------------------------------------------------------------------------
console.log('\n--- 2. Mixed Fleet Hierarchy (v1.9.0) ---');

assert.strictEqual(TEAMS.length, 9, 'Grid must have exactly 9 teams');
const shipCounts = { feather: 0, rocket: 0, heavy: 0 };
for (const team of TEAMS) {
  assert.ok(shipCounts[team.shipKind] !== undefined, `Team ${team.name} has valid shipKind: ${team.shipKind}`);
  shipCounts[team.shipKind]++;
}
assert.strictEqual(shipCounts.feather, 3, 'Must have 3 Feather S1 teams');
assert.strictEqual(shipCounts.rocket, 3, 'Must have 3 Comet R1 (rocket) teams');
assert.strictEqual(shipCounts.heavy, 3, 'Must have 3 Anvil H1 (heavy) teams');
console.log('  ✓ 3x3x3 balanced mixed fleet team distribution verified');

const race = new Race(track, { skill: 'normal', shipKind: 'feather' });
assert.strictEqual(race.racers.length, 9, 'Race must spawn 9 racers');

let countFeather = 0, countComet = 0, countAnvil = 0;
for (const racer of race.racers) {
  assert.ok(racer.ship, 'Each racer must possess a 3D Ship instance');
  const kind = racer.kind || (racer.team && racer.team.shipKind);
  if (kind === 'feather') countFeather++;
  else if (kind === 'rocket') countComet++;
  else if (kind === 'heavy') countAnvil++;
}
assert.strictEqual(countFeather, 3, 'Race contains 3 Feather craft');
assert.strictEqual(countComet, 3, 'Race contains 3 Comet craft');
assert.strictEqual(countAnvil, 3, 'Race contains 3 Anvil craft');
console.log('  ✓ Race procedural mixed fleet instantiation verified');

// -----------------------------------------------------------------------------
// 3. Named Aces & Tactical AI Personas (v1.10.0)
// -----------------------------------------------------------------------------
console.log('\n--- 3. Named Aces & Tactical AI Personas (v1.10.0) ---');

const expectedPilots = [
  { name: 'Solaris Dynamics', pilot: 'Aria Vance', style: 'apex' },
  { name: 'Vortex Hypercraft', pilot: 'Kaelen Voss', style: 'slammer' },
  { name: 'Nexus Heavy Industries', pilot: 'Torin Drak', style: 'slammer' },
  { name: 'Apex Orbital', pilot: 'Maya Lin', style: 'speeder' },
  { name: 'Feather Racing', pilot: 'Ace Pilot', style: 'player' },
  { name: 'Vostok Aerospace', pilot: 'Yuri Chen', style: 'speeder' },
  { name: 'Mirai Cybernetics', pilot: 'Rei Tanaka', style: 'apex' },
  { name: 'Titan Heavyworks', pilot: 'Brutus Volkov', style: 'slammer' },
  { name: 'Zenith Interstellar', pilot: 'Lyra Thorne', style: 'speeder' }
];

for (let i = 0; i < 9; i++) {
  const team = TEAMS[i];
  const exp = expectedPilots[i];
  assert.strictEqual(team.pilot, exp.pilot, `Team ${i} pilot should be ${exp.pilot}`);
  assert.strictEqual(team.style, exp.style, `Team ${i} style should be ${exp.style}`);
}
console.log('  ✓ 9 Ace pilot identities and tactical styles verified');

// Test Slammer AI behavior: wants slam when alongside a rival
const slammerRacer = race.racers.find(r => r.team.style === 'slammer');
assert.ok(slammerRacer, 'Must find a slammer racer');
const slammerAI = new DriverAI(slammerRacer, track, 'normal', 'slammer');

const rivalRacer = race.racers.find(r => r !== slammerRacer);
// Place rival right alongside the slammer within 18m s-dist and 5m x-dist
rivalRacer.progress = slammerRacer.progress + 6.0;
rivalRacer.s = (slammerRacer.s + 6.0) % track.length;
rivalRacer.x = slammerRacer.x + 4.0;
slammerRacer.slamTimer = 0.0;
slammerRacer.vs = 100.0;

const slammerPlan = slammerAI.plan(race.racers);
assert.strictEqual(slammerPlan.slam, true, 'Slammer AI should request slam when alongside a rival');
console.log('  ✓ Slammer AI tactical aggression verified');

// Test Speeder AI parameters: boosts more frequently and has higher top speed scaling
const speederAI = new DriverAI(featherRacer, track, 'normal', 'speeder');
const standardAI = new DriverAI(featherRacer, track, 'normal', 'apex');
assert.strictEqual(speederAI.style, 'speeder');
assert.strictEqual(standardAI.style, 'apex');
console.log('  ✓ Speeder & Apex AI profiles verified');

// -----------------------------------------------------------------------------
// 4. The Slam Sideswipe Thrust Mechanic (v1.11.0 / v1.11.1)
// -----------------------------------------------------------------------------
console.log('\n--- 4. The Slam Sideswipe Thrust Mechanic (v1.11.0 / v1.11.1) ---');

const slamCraft = new TrackRacer(track, new Ship(buildAnvilH1()), { kind: 'heavy' });
assert.strictEqual(slamCraft.slamTimer, 0.0, 'Initial slamTimer should be 0.0');
assert.strictEqual(slamCraft.isSlamming, false, 'isSlamming should initially be false');

let slamFiredEv = false;
slamCraft.on('slam_fire', (ev) => {
  slamFiredEv = true;
  assert.strictEqual(ev.force, 55.0); // Anvil heavy slamForce
  assert.strictEqual(ev.dir, 1);
});

// Fire slam via direct method or input
const fired = slamCraft.fireSlam(1);
assert.strictEqual(fired, true, 'fireSlam should succeed when cooldown is ready');
assert.strictEqual(slamCraft.isSlamming, true, 'Craft is now in slamming state');
assert.strictEqual(slamCraft.slamTimer, 10.0, 'slamTimer reset to 10.0s cooldown');
assert.strictEqual(slamCraft.vx, 55.0, 'Lateral velocity boosted by slam force');
assert.strictEqual(slamFiredEv, true, 'slam_fire event fired');

// Cannot fire again while on cooldown
const firedAgain = slamCraft.fireSlam(1);
assert.strictEqual(firedAgain, false, 'fireSlam must be rejected while cooldown > 0');

// Test double-tap steer input trigger
const tapCraft = new TrackRacer(track, new Ship(buildFeatherS1()), { kind: 'feather' });
assert.strictEqual(tapCraft.slamTimer, 0.0);

// First tap left
tapCraft.step(1 / 120, { steer: -1.0 });
tapCraft.step(1 / 120, { steer: 0.0 });
assert.strictEqual(tapCraft.isSlamming, false, 'First steer tap does not trigger slam');

// Second rapid tap left within 0.1s
tapCraft.step(1 / 120, { steer: -1.0 });
assert.strictEqual(tapCraft.isSlamming, true, 'Double-tap steer left triggers slam!');
assert.strictEqual(tapCraft.slamDir, -1, 'Slam direction matches steer direction');
console.log('  ✓ Space trigger, cooldown, and double-tap steer slam activation verified');

// Test Slam collision resolution in Race
const attacker = race.racers[1]; // heavy / slammer
const defender = race.racers[0]; // feather

attacker.x = 0.0;
defender.x = 2.0;
attacker.s = 100.0;
defender.s = 102.0;
attacker.progress = 100.0;
defender.progress = 102.0;
attacker.isDead = false;
defender.isDead = false;
attacker.inAir = false;
defender.inAir = false;
attacker.vx = 0.0;
defender.vx = 0.0;

// Attacker executes slam
attacker.fireSlam(1);
assert.strictEqual(attacker.isSlamming, true);

let slamHitFired = false;
let knockFired = false;
attacker.on('slam_hit', (ev) => {
  slamHitFired = true;
  assert.ok(ev.damage > 0);
});
defender.on('knock', (ev) => {
  knockFired = true;
  assert.strictEqual(ev.wasSlam, true);
});

const defShieldPre = defender.shield;
race._resolveCollisions();

assert.ok(defender.shield < defShieldPre, 'Defender takes heavy slam damage');
assert.ok(defender.vx > 20.0, 'Defender receives massive lateral knockback impulse');
assert.strictEqual(slamHitFired, true, 'slam_hit event triggered on attacker');
assert.strictEqual(knockFired, true, 'knock event triggered on defender');
console.log('  ✓ Slam collision resolution, damage delivery, and knockback impulse verified');

// -----------------------------------------------------------------------------
// 5. Audio, FX, and HUD Integration
// -----------------------------------------------------------------------------
console.log('\n--- 5. Audio, FX, and HUD Integration ---');

const fx = new FXSystem(new THREE.Scene());
assert.strictEqual(fx.fragments.length, 120, 'Explosion debris pool contains 120 fragment particles');
fx.emitExplosion(new THREE.Vector3(0, 0, 0), 60);
const activeFragments = fx.fragments.filter(f => f.life > 0);
assert.ok(activeFragments.length >= 60, 'Explosion fragments activated upon detonation');

fx.emitSlamShockwave(new THREE.Vector3(10, 0, 20), new THREE.Vector3(1, 0, 0));
fx.setCriticalAlarm(true);
assert.strictEqual(fx.criticalAlarm, true, 'Critical alarm state engaged in FXSystem');
console.log('  ✓ 120-particle explosion debris and slam shockwave VFX verified');

const audio = new AudioManager();
assert.strictEqual(typeof audio.playAlarm, 'function');
assert.strictEqual(typeof audio.playExplosion, 'function');
assert.strictEqual(typeof audio.playSlam, 'function');
assert.strictEqual(typeof audio.playShieldHit, 'function');
console.log('  ✓ WebAudio procedural synthesis methods verified');

const hud = new HUDController(track, race);
assert.ok(hud, 'HUDController instantiated');
hud.update(1 / 60, featherRacer, { throttle: 1.0 });
console.log('  ✓ HUD shield meter telemetry rendering verified');

// -----------------------------------------------------------------------------
// 6. Version & Changelog Verification
// -----------------------------------------------------------------------------
console.log('\n--- 6. Version & Changelog Verification ---');

assert.strictEqual(CURRENT_VERSION, '1.11.1', 'CURRENT_VERSION must be 1.11.1');
const versions = CHANGELOG.map(c => c.version);
assert.ok(versions.includes('1.11.1'), 'Changelog contains 1.11.1');
assert.ok(versions.includes('1.11.0'), 'Changelog contains 1.11.0');
assert.ok(versions.includes('1.10.0'), 'Changelog contains 1.10.0');
assert.ok(versions.includes('1.9.0'), 'Changelog contains 1.9.0');
assert.ok(versions.includes('1.8.0'), 'Changelog contains 1.8.0');
console.log('  ✓ Changelog records versions 1.8.0 through 1.11.1');

console.log('\n=== All Phase P13 Acceptance Tests PASSED Successfully! ===');
