// src/foresttrack.js — Forest Moon circuit layout (~13.8 km high-speed jungle world)
// Why: Fast track curvature matching space circuit speeds, through floating islands, waterfalls, and the colossal skeleton
import * as THREE from 'three';
import { Track, pt, TRACK_W } from './track.js';

export function createForestTrack() {
  const numPoints = 36;
  const controlPoints = [];
  const R_BASE = 2060.0; // Perimeter ~ 13.8 km

  for (let i = 0; i < numPoints; i++) {
    const theta = (i / numPoints) * Math.PI * 2.0;

    // Harmonic radius modulation for natural sweeping layout
    const r = R_BASE + 380.0 * Math.cos(theta * 2.0) - 260.0 * Math.sin(theta * 3.0);
    const x = Math.sin(theta) * r;
    const z = Math.cos(theta) * r;
    let y = Math.sin(theta * 2.0) * 85.0 + Math.cos(theta * 3.0) * 45.0;
    let bank = 0;
    let name = `Sector ${i + 1}`;

    if (i === 0) {
      name = 'Canopy Gantry Start';
      bank = 0;
    } else if (i >= 2 && i <= 4) {
      name = 'Emerald Sweeper';
      bank = -26; // Smooth high-speed bank
    } else if (i === 5) {
      name = 'Island Crest Jump';
      y += 35.0;
      bank = 0;
    } else if (i >= 8 && i <= 10) {
      name = 'Cascade River Crossing'; // Waterfall arches overhead
      y -= 20.0;
      bank = 15;
    } else if (i === 11) {
      name = 'Hollow Hill Cave Approach';
      y -= 35.0;
      bank = 0;
    } else if (i === 12) {
      name = 'Cave Entry (Under Own Way Out)';
      y -= 65.0;
      bank = 0;
    } else if (i === 13) {
      name = 'Waterfall Cavern & Chasm Jump';
      y -= 60.0;
      bank = 0;
    } else if (i === 14) {
      name = 'Stalactite Hall & Slalom';
      y -= 10.0;
      bank = 0;
    } else if (i === 15) {
      name = 'Fungi Forest & Sinkholes';
      y += 45.0;
      bank = 0;
    } else if (i === 16) {
      name = 'Hollow Hill Way Out Overpass';
      y += 115.0;
      bank = 0;
    } else if (i === 17) {
      name = 'Hollow Hill Exit Straight';
      y += 85.0;
      bank = 0;
    } else if (i >= 18 && i <= 20) {
      name = 'Verdant Loop Approach';
      y += 45.0;
      bank = 0;
    } else if (i === 21) {
      name = 'Verdant Loop Zenith (Inverted)';
      y += 140.0;
      bank = 0;
    } else if (i === 22) {
      name = 'Post-Loop Long Sweeper';
      // Long sweep out of the loop
      bank = 24;
      y += 30.0;
    } else if (i >= 23 && i <= 25) {
      // Smoother banked helix through the jungle ridge
      name = 'Jungle Ridge Banked Helix';
      bank = 26;
      y += 10.0;
    } else if (i === 26) {
      name = 'Pre-Skull Gravity Flip 1 Approach';
      bank = 0;
    } else if (i === 27) {
      name = 'Gravity Flip 1 (180 Inversion onto Overhead Deck)';
      y += 24.0;
      bank = 180.0;
    } else if (i >= 28 && i <= 29) {
      name = 'Inverted Run Past Skull (Jaws, Palate, Ribs)';
      y += 24.0;
      bank = 180.0;
    } else if (i === 30) {
      name = 'Gravity Flip 2 (180 Roll Back Upright)';
      bank = 0;
    } else if (i === 31) {
      name = 'Skull Cranium Exit Straight (True Half-Turn Behind Skull)';
      bank = 0;
    } else if (i >= 32 && i <= 34) {
      name = 'Ancient Banyan Sweeper';
      bank = 28;
    } else if (i === 35) {
      name = 'Final Canopy Straight';
      bank = 0;
    }

    controlPoints.push(pt(x, y, z, bank, name));
  }

  // Feature markers aligned to arc length positions
  const features = {
    name: 'forest',
    theme: 'forest',
    towers: false,
    meteor: false,
    flips: [
      [10000, 10240], // Flip 1: Rolls 180 into inverted flight past colossal skull
      [11150, 11390], // Flip 2: Rolls 180 back upright onto home sweeper
    ],
    gaps: [
      [1950, 2120],   // Island Crest Jump (170 m leap)
      [4550, 4700],   // Waterfall Cavern Chasm Jump (150 m leap over lake)
      [5700, 5860],   // Hollow Hill Exit Launch (160 m leap)
    ],
    loops: [
      [7600, 8200],   // Verdant Loop (~600 m circumference)
    ],
    tunnels: [
      [4200, 6200],   // Hollow Hill 2 km Cave (tube through hollow hill)
      [10400, 11100], // Skeleton Skull Interior (inverted passage)
    ],
    cascade: {
      s: 3400,        // Cascade River waterfall arches over the track at s=3400m
      width: 60.0,
      dropHeight: 180.0
    },
    cave: {
      sStart: 4200,   // Cave 2 km through hollow hill
      sEnd: 6200,
    },
    skeleton: {
      sEntry: 10400,  // Skull jaws entry
      sExit: 11100,   // Cranium exit
      fangHeight: 38.0,
      ribSpan: 58.0
    },
    pads: [
      { s: 500, x: 0, kind: 'boost' },
      { s: 1800, x: 0, kind: 'boost' },  // Pre-jump 1
      { s: 3100, x: 0, kind: 'boost' },  // Cascade approach (moved off bend onto centerline)
      { s: 4100, x: 0, kind: 'boost' },  // Cave entry boost
      { s: 4500, x: 0, kind: 'boost' },  // Pre-chasm jump in waterfall cavern
      { s: 5600, x: 0, kind: 'boost' },  // Cave exit boost
      { s: 7400, x: 0, kind: 'boost' },  // Pre-loop boost
      { s: 8700, x: 0, kind: 'boost' },  // Post-loop straight (moved off bend onto centerline)
      { s: 9900, x: 0, kind: 'boost' },  // Pre-flip 1 boost pad
      { s: 11050, x: 0, kind: 'boost' }, // Pre-flip 2 boost pad
      { s: 12800, x: 0, kind: 'boost' }, // Final straight
    ],
    gates: [
      { s: 400, color: 0x00ff88 },
      { s: 1850, color: 0x00d2ff },
      { s: 3300, color: 0x38bdf8 },
      { s: 4150, color: 0x00ff88 }, // Cave entry gate
      { s: 6250, color: 0xffaa00 }, // Cave exit gate
      { s: 7300, color: 0x00ff88 },
      { s: 8600, color: 0xa855f7 },
      { s: 9950, color: 0xec4899 }, // Magenta-violet gate before gravity flip 1
      { s: 11100, color: 0xec4899 }, // Magenta-violet gate before gravity flip 2
      { s: 12200, color: 0x00d2ff },
      { s: 13200, color: 0x00ff88 },
    ]
  };

  return new Track(controlPoints, features);
}
