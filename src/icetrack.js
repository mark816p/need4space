// src/icetrack.js — Ice Planet circuit layout (~14.0 km frozen world)
// Why: High-speed icy sweepers, glacier cave, rift jumps, frozen falls corkscrew, and loop over the frozen sea
import * as THREE from 'three';
import { Track, pt, TRACK_W } from './track.js';

export function createIceTrack() {
  const numPoints = 36;
  const controlPoints = [];
  const R_BASE = 2120.0; // Perimeter ~ 14.0 km

  for (let i = 0; i < numPoints; i++) {
    const theta = (i / numPoints) * Math.PI * 2.0;

    // Smooth sweeping harmonic radius modulation
    const r = R_BASE + 280.0 * Math.sin(theta * 2.0) - 180.0 * Math.cos(theta * 3.0);
    const x = Math.sin(theta) * r;
    const z = Math.cos(theta) * r;
    let y = Math.sin(theta * 2.0) * 65.0 + Math.cos(theta * 3.0) * 28.0;
    let bank = 0;
    let name = `Sector ${i + 1}`;

    if (i === 0) {
      name = 'Frozen Shore Start';
      bank = 0;
    } else if (i >= 2 && i <= 4) {
      name = 'Glacial Sastrugi Sweeper';
      bank = 24; // Smooth high-speed bank
    } else if (i === 5) {
      name = 'First Rift Chasm Jump';
      y += 28.0;
      bank = 0;
    } else if (i >= 7 && i <= 9) {
      name = 'The Crystal Garden';
      bank = 22; // Sweepers banked into turns not away
      y += 15.0;
    } else if (i === 11) {
      name = 'Wind-Carved Great Arch';
      y -= 10.0;
      bank = 0;
    } else if (i >= 13 && i <= 15) {
      name = 'Glacier Bore Cave (Blue Ice Tunnel)';
      y -= 35.0;
      bank = 0;
    } else if (i === 16) {
      name = 'Cave Portal Breakthrough';
      y -= 15.0;
      bank = 0;
    } else if (i >= 18 && i <= 20) {
      name = 'Ice Shelf Crevasse Dive';
      // Dive into ~270m thick glacier shelf
      y -= 32.0;
      bank = 0;
    } else if (i === 21) {
      name = 'Crevasse Floor Long Sweeper';
      // Long sweep at dive's foot
      y -= 24.0;
      bank = 16;
    } else if (i >= 22 && i <= 24) {
      name = 'Crevasse Canyon Slot (Gentle S-Bend)';
      // Gentler S down the crevasse
      bank = (i % 2 === 0 ? 8 : -8);
      y -= 10.0;
    } else if (i === 26) {
      name = 'Second Rift Launch (Smoother Climb)';
      // Smoother climb to second rift jump
      y += 18.0;
      bank = 0;
    } else if (i === 27) {
      name = 'Sea Floes Gravity Flip Incline';
      y += 18.0;
      bank = 0;
    } else if (i >= 28 && i <= 30) {
      name = 'Inverted Flight Over Floes';
      // Racing upside-down over broken sea ice between two gravity flips
      y += 28.0;
      bank = 180;
    } else if (i === 31) {
      name = 'Second Gravity Flip Recovery';
      y += 10.0;
      bank = 0;
    } else if (i === 32) {
      name = 'Post-Flip 130m Straight';
      // 130 m straight after flips before the S home
      y += 4.0;
      bank = 0;
    } else if (i >= 33 && i <= 34) {
      name = 'Aurora Basin High-Speed Curve';
      bank = 24;
      y += 2.0;
    } else if (i === 35) {
      name = 'Final Glacial Straight';
      bank = 0;
    }

    controlPoints.push(pt(x, y, z, bank, name));
  }

  // Define circuit features: jumps, tunnels, boost pads, and light gates
  const features = {
    name: 'ice',
    theme: {
      deckColor: 0x1a2636, // Deep frost-tinted composite deck
      kerbColor: 0x38bdf8, // Cyan neon kerbs
      barrierColor: 0x00e5ff, // Ice-blue energy barrier
      wallColor: 0x223247, // Cold steel structure
      fogColor: 0x18243b, // Indigo/rose ice fog
    },
    towers: false,
    meteor: false,
    // Gaps (jump cuts where ships fly ballistic arcs across sea rifts)
    gaps: [
      [2050, 2180], // First Rift Jump
      [9800, 9940], // Second Rift Jump
    ],
    // Gravity flips: upside-down over the floes between two flips
    flips: [
      [10400, 10640], // Flip 1: Rolls 180° into inverted flight over floes
      [11600, 11840], // Flip 2: Rolls 180° back upright
    ],
    // Glacier cave
    tunnels: [
      [5100, 6300], // Glacier Bore Cave
    ],
    // High-speed boost pads placed strategically on straights and before jumps (pad moved out)
    pads: [
      { s: 1850, x: 0, kind: 'boost' },
      { s: 4800, x: -12, kind: 'boost' }, // pad moved out off the inside apex
      { s: 7200, x: 8, kind: 'boost' },
      { s: 9550, x: 0, kind: 'boost' },
      { s: 12100, x: 0, kind: 'boost' }
    ],
    boostPads: [
      { s: 1850, lateral: 0, duration: 2.2 },
      { s: 4800, lateral: -12, duration: 2.2 },
      { s: 7200, lateral: 8, duration: 2.2 },
      { s: 9550, lateral: 0, duration: 2.2 },
      { s: 12100, lateral: 0, duration: 2.2 }
    ],
    // Light gates marking sector timing
    gates: [
      { s: 0, color: 0x00f0ff },
      { s: 3500, color: 0x38bdf8 },
      { s: 7000, color: 0xa855f7 },
      { s: 10500, color: 0x00f0ff },
    ]
  };

  const track = new Track(controlPoints, features);
  track.name = 'ice';
  track.features = features;
  return track;
}
