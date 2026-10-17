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
    } else if (i >= 12 && i <= 14) {
      name = 'The Root Tunnel';
      y -= 45.0;
      bank = 0;
    } else if (i === 16) {
      name = 'Floating Ridge Launch';
      y += 60.0;
      bank = 0;
    } else if (i >= 18 && i <= 20) {
      name = 'Verdant Loop Approach';
      y += 40.0;
      bank = 0;
    } else if (i === 21) {
      name = 'Verdant Loop Zenith (Inverted)';
      y += 140.0;
      bank = 0;
    } else if (i >= 23 && i <= 26) {
      // 360-deg continuous roll through the mountain cut
      name = 'Jungle Ridge Corkscrew';
      const rollFrac = (i - 23) / 3.0;
      bank = rollFrac * 360.0;
    } else if (i >= 28 && i <= 30) {
      name = 'The Colossal Skull (Jaws & Ribs)';
      y += 20.0;
      bank = 0;
    } else if (i === 31) {
      name = 'Skull Cranium Exit Cut';
      y += 10.0;
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
    gaps: [
      [1950, 2120],   // Island Crest Jump (170 m leap)
      [6100, 6260],   // Floating Ridge Launch (160 m leap)
      [11800, 11950], // Cranium Exit Cut Jump (150 m leap)
    ],
    loops: [
      [7800, 8400],   // Verdant Loop (~600 m circumference)
    ],
    tunnels: [
      [4500, 5600],   // The Root Tunnel (1100 m)
      [10400, 11600], // Skeleton Skull Interior (1200 m)
    ],
    cascade: {
      s: 3400,        // Cascade River waterfall arches over the track at s=3400m
      width: 60.0,
      dropHeight: 180.0
    },
    skeleton: {
      sEntry: 10400,  // Skull jaws entry
      sExit: 11600,   // Cranium exit
      fangHeight: 38.0,
      ribSpan: 58.0
    },
    pads: [
      { s: 500, x: 0, kind: 'boost' },
      { s: 1800, x: 0, kind: 'boost' },  // Pre-jump 1
      { s: 3100, x: -6, kind: 'boost' }, // Cascade approach
      { s: 4300, x: 0, kind: 'boost' },  // Tunnel entry
      { s: 5900, x: 0, kind: 'boost' },  // Pre-jump 2
      { s: 7600, x: 0, kind: 'boost' },  // Pre-loop boost
      { s: 8900, x: 6, kind: 'boost' },  // Post-loop straight
      { s: 10200, x: 0, kind: 'boost' }, // Pre-skull entry
      { s: 11650, x: 0, kind: 'boost' }, // Cranium exit leap
      { s: 12800, x: 0, kind: 'boost' }, // Final straight
    ],
    gates: [
      { s: 400, color: 0x00ff88 },
      { s: 1850, color: 0x00d2ff },
      { s: 3300, color: 0x38bdf8 },
      { s: 5800, color: 0xffaa00 },
      { s: 7500, color: 0x00ff88 },
      { s: 8700, color: 0xa855f7 },
      { s: 10100, color: 0xff3366 },
      { s: 11700, color: 0x00d2ff },
      { s: 13200, color: 0x00ff88 },
    ]
  };

  return new Track(controlPoints, features);
}
