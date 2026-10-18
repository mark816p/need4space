// tools/test_p8_acceptance.mjs — Acceptance verification test suite for Phase P8
import * as THREE from 'three';
import { readFileSync } from 'fs';
import { createSpaceTrack } from '../src/track.js';
import { createForestTrack } from '../src/foresttrack.js';
import { createIceTrack } from '../src/icetrack.js';
import { createDesertTrack } from '../src/deserttrack.js';
import { Race, AI_LEVELS } from '../src/race.js';
import { PERKS } from '../src/ships.js';
import { DEFAULT_SETTINGS, SettingsManager } from '../src/settings.js';
import { CHANGELOG, CURRENT_VERSION } from '../src/changelog.js';
import { MenuManager } from '../src/menu.js';
import { PostPipeline } from '../src/post.js';

let failed = false;
function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed = true;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

console.log('=== PHASE P8 ACCEPTANCE VERIFICATION ===\n');

// -----------------------------------------------------------------------------
// 1. DIFFICULTY CONFIGURATION, PLAYER ASSISTANCE & DEFAULT SETTINGS
// -----------------------------------------------------------------------------
console.log('--- 1. Difficulty & Player Assistance Perks ---');
assert(DEFAULT_SETTINGS.difficulty === 'easy', 'Default setting difficulty is "easy"');
assert(DEFAULT_SETTINGS.drift === false, 'Drift physics is disabled by default');

const diffLevels = ['easy', 'normal', 'hard', 'brutal'];
for (const d of diffLevels) {
  assert(AI_LEVELS[d] !== undefined, `AI_LEVELS contains tier "${d}"`);
  assert(PERKS[d] !== undefined, `PERKS contains tier "${d}"`);
}

// AI speedMul monotonic progression
assert(
  AI_LEVELS.easy.speedMul < AI_LEVELS.normal.speedMul &&
  AI_LEVELS.normal.speedMul < AI_LEVELS.hard.speedMul &&
  AI_LEVELS.hard.speedMul <= AI_LEVELS.brutal.speedMul,
  'AI_LEVELS speedMul strictly ordered: easy < normal < hard <= brutal'
);

// AI boostInterval monotonic progression (shorter interval = more frequent boosts)
assert(
  AI_LEVELS.easy.boostInterval > AI_LEVELS.normal.boostInterval &&
  AI_LEVELS.normal.boostInterval > AI_LEVELS.hard.boostInterval &&
  AI_LEVELS.hard.boostInterval >= AI_LEVELS.brutal.boostInterval,
  'AI_LEVELS boostInterval strictly ordered: easy > normal > hard >= brutal'
);

// Player perks assistance
assert(PERKS.easy.autoSteerAssist === 0.25, 'Easy difficulty autoSteerAssist is 0.25');
assert(PERKS.normal.autoSteerAssist === 0.0, 'Normal difficulty autoSteerAssist is 0.0');
assert(PERKS.easy.wallScrapeDamp === 0.2, 'Easy difficulty wallScrapeDamp is 0.2 (wall knocks 5x less costly)');
assert(PERKS.normal.wallScrapeDamp === 0.8, 'Normal difficulty wallScrapeDamp is 0.8');

// -----------------------------------------------------------------------------
// 2. TRACK GEOMETRY & CURVATURE REFINEMENTS ACROSS FOUR WORLDS
// -----------------------------------------------------------------------------
console.log('\n--- 2. Track Refinements Across Four Worlds ---');

// A. Space Circuit
const spaceTrack = createSpaceTrack();
const cpBreak = spaceTrack.controlPoints[36];
assert(cpBreak.bank === 0, 'Space: Ramp under boost pad at The Break is straight and unbanked (bank = 0)');
const cpHangar = spaceTrack.controlPoints[46];
assert(Math.abs(cpHangar.bank) <= 3, 'Space: Bulkhead jinks halved either side of flips (bank = -3)');
const cpTrench = spaceTrack.controlPoints[52];
assert(cpTrench.bank <= 2, 'Space: Trench sweepers gentler (bank = 2)');

// Helper to convert controlPoint bank (radians) to degrees
const toDeg = (rad) => Math.round((rad * 180) / Math.PI);

// B. Forest Moon
const forestTrack = createForestTrack();
const cpChasmLand = forestTrack.controlPoints[14];
const cpCaveExitLand = forestTrack.controlPoints[17];
assert(toDeg(cpChasmLand.bank) === 0, 'Forest: Chasm jump landing on straight (bank = 0)');
assert(toDeg(cpCaveExitLand.bank) === 0, 'Forest: Cave exit landing on straight (bank = 0)');
const cpPostLoop = forestTrack.controlPoints[22];
assert(toDeg(cpPostLoop.bank) === 24, 'Forest: Long sweeper out of loop banked (bank = 24)');
const cpHelix = forestTrack.controlPoints[24];
assert(toDeg(cpHelix.bank) === 26, 'Forest: Smoother banked helix through ridge (bank = 26)');
const padCascade = forestTrack.features.pads.find(p => p.s === 3100);
const padPostLoop = forestTrack.features.pads.find(p => p.s === 8700);
assert(padCascade && padCascade.x === 0, 'Forest: Cascade boost pad aligned to track centerline (x = 0)');
assert(padPostLoop && padPostLoop.x === 0, 'Forest: Post-loop boost pad aligned to track centerline (x = 0)');

// C. Ice Planet
const iceTrack = createIceTrack();
const cpCrystal = iceTrack.controlPoints[8];
assert(toDeg(cpCrystal.bank) === 22, 'Ice: Crystal Garden sweeper banked into turn (bank = 22)');
const cpCrevasseFloor = iceTrack.controlPoints[21];
assert(toDeg(cpCrevasseFloor.bank) === 16, 'Ice: Crevasse floor long sweeper banked (bank = 16)');
const cpSlot = iceTrack.controlPoints[23];
assert(Math.abs(toDeg(cpSlot.bank)) <= 8, 'Ice: Gentler S down the crevasse slot (bank = ±8)');
const cpPostFlipIce = iceTrack.controlPoints[32];
assert(toDeg(cpPostFlipIce.bank) === 0, 'Ice: 130m flat straight after flips (bank = 0)');
const padIceApex = iceTrack.features.pads.find(p => p.s === 4800);
assert(padIceApex && padIceApex.x === -12, 'Ice: Boost pad moved out off the inside apex (x = -12)');

// D. Desert Planet
const desertTrack = createDesertTrack();
const cpSimoom = desertTrack.controlPoints[19];
assert(toDeg(cpSimoom.bank) === 20, 'Desert: Simoom canyon sweeper banked into turn (bank = 20)');
const cpTransverse = desertTrack.controlPoints[30];
assert(toDeg(cpTransverse.bank) === 16, 'Desert: Transverse dunes fast run banked into turn (bank = 16)');
const cpGridStart = desertTrack.controlPoints[0];
const cpGridRunway = desertTrack.controlPoints[34];
assert(toDeg(cpGridStart.bank) === 0 && cpGridStart.pos.y === 10.0, 'Desert: Grid start is flat and elevated (bank = 0, y = 10)');
assert(toDeg(cpGridRunway.bank) === 0 && cpGridRunway.pos.y === 10.0, 'Desert: Grid runway CP 33-35 is flat and unbanked (bank = 0, y = 10)');

// -----------------------------------------------------------------------------
// 3. UI, MENUS, CHANGELOG & COPYRIGHT
// -----------------------------------------------------------------------------
console.log('\n--- 3. UI, Menus, Changelog & Copyright ---');
const v110Entry = CHANGELOG.find(c => c.version === '1.1.0');
assert(v110Entry && v110Entry.title === 'Four Worlds', 'Changelog contains "Four Worlds" v1.1.0 entry');
assert(CURRENT_VERSION >= '1.1.0', 'CURRENT_VERSION is >= "1.1.0"');

const menuSource = readFileSync('./src/menu.js', 'utf8');
assert(menuSource.includes('showWhatsNew'), 'MenuManager contains showWhatsNew method');
assert(menuSource.includes('difficulty-row'), 'MenuManager renders difficulty-row');
assert(menuSource.includes('menu-hints'), 'MenuManager renders interactive menu-hints');
assert(menuSource.includes('<OWNER>'), 'MenuManager contains copyright notice with <OWNER> placeholder');

const readmeSource = readFileSync('./README.md', 'utf8');
assert(readmeSource.includes('<OWNER>'), 'README.md preserves <OWNER> placeholder');
assert(readmeSource.includes('All rights reserved'), 'README.md includes All rights reserved notice');
assert(readmeSource.includes('Four Worlds'), 'README.md documents Four Worlds');

// -----------------------------------------------------------------------------
// 4. SHADER & ATMOSPHERE REFINEMENTS
// -----------------------------------------------------------------------------
console.log('\n--- 4. Shaders & Visual Pipeline ---');
const spiresSource = readFileSync('./src/spires.js', 'utf8');
assert(spiresSource.includes('cos(theta * 6.0) * 0.5 + 0.5'), 'Crystal prism facets use continuous trigonometric angle wrapping');

const blizzardSource = readFileSync('./src/blizzard.js', 'utf8');
assert(blizzardSource.includes('smoothstep(5.0, 12.0, dist)'), 'Blizzard particles near-fade keeps snow off camera lens');
assert(blizzardSource.includes('coord.x * 2.2, coord.y * 0.75'), 'Blizzard snow rendered as short streaks');

const postSource = readFileSync('./src/post.js', 'utf8');
assert(postSource.includes('samples: 4'), 'Post pipeline configures single MSAA resolve (samples: 4)');
assert(postSource.includes('async compileAsync'), 'Post pipeline provides async compileAsync for parallel shader precompilation');

// -----------------------------------------------------------------------------
// 5. FOUR WORLDS AI LAP COMPLETION & MEDIAN LAP TIME ORDERING
// "every circuit's AI completes laps on every level with median lap-time ordering
// Easy > Normal > Hard >= Brutal."
// -----------------------------------------------------------------------------
console.log('\n--- 5. Four Worlds AI Lap Completion & Monotonic Ordering ---');
const testCircuits = [
  { name: 'Forest Moon', track: forestTrack },
  { name: 'Ice Planet', track: iceTrack },
  { name: 'Desert Planet', track: desertTrack },
  { name: 'Orbital Station', track: spaceTrack }
];

const DT = 1 / 60; // 60 Hz headless evaluation step

for (const c of testCircuits) {
  console.log(`\nEvaluating Circuit: ${c.name} (${(c.track.length / 1000).toFixed(1)} km)...`);
  const medians = {};

  for (const diff of diffLevels) {
    const race = new Race(c.track, { difficulty: diff, numLaps: 1 });
    race.state = 'racing';

    let simTime = 0;
    const maxSimTime = (c.track.length / 1000 > 20) ? 240.0 : 140.0;

    while (simTime < maxSimTime) {
      simTime += DT;
      // Human assistance line during headless eval
      const playerTarget = race.track.racingLine(race.playerRacer.s);
      const steerCorrection = (playerTarget - race.playerRacer.x) * 0.12;
      race.step(DT, { throttle: 1.0, steer: steerCorrection });

      if (race.racers.every(r => r.lap >= 2 || r.finished)) break;
    }

    const completed = race.racers.filter(r => r.lap >= 2 || r.finished).length;
    assert(completed === 9, `${c.name} [${diff.toUpperCase()}]: All 9/9 ships completed 1 lap (took ${simTime.toFixed(1)}s)`);

    const times = race.racers.map(r => r.finishTime || r.lapTimes?.[0] || simTime).sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    medians[diff] = median;
    console.log(`    ${diff.toUpperCase().padEnd(7)} -> Leader: ${times[0].toFixed(2)}s, Median: ${median.toFixed(2)}s, Pack: ${(times[8] - times[0]).toFixed(2)}s`);
  }

  // Verify median ordering: Easy > Normal > Hard >= Brutal
  console.log(`  Checking monotonic median lap-time ordering on ${c.name}:`);
  console.log(`    Easy (${medians.easy.toFixed(2)}s) > Normal (${medians.normal.toFixed(2)}s) > Hard (${medians.hard.toFixed(2)}s) >= Brutal (${medians.brutal.toFixed(2)}s)`);

  assert(
    medians.easy > medians.normal,
    `${c.name}: Easy median (${medians.easy.toFixed(2)}s) > Normal median (${medians.normal.toFixed(2)}s)`
  );
  assert(
    medians.normal > medians.hard,
    `${c.name}: Normal median (${medians.normal.toFixed(2)}s) > Hard median (${medians.hard.toFixed(2)}s)`
  );
  assert(
    medians.hard >= medians.brutal,
    `${c.name}: Hard median (${medians.hard.toFixed(2)}s) >= Brutal median (${medians.brutal.toFixed(2)}s)`
  );
}

console.log('\n=============================================================');
if (failed) {
  console.error('PHASE P8 VERIFICATION FAILED');
  process.exit(1);
} else {
  console.log('ALL PHASE P8 ACCEPTANCE VERIFICATIONS PASSED SUCCESSFULLY!');
}
