// src/ocean.js — The Drowned World circuit layout (~15.2 km night ocean circuit)
// Why: "P11.3 Fifth circuit (ca 15.2 km) over a storm-lashed night sea with a huge moon:
// causeway low over the swell, sea stacks and rock arches, viaduct jump, long banked left-hander around the lighthouse island,
// a deep dive into the ocean spiralling round a colossal statue of worn basalt + green bronze holding a lantern high over the sea (The Keeper),
// through a drowned city of pale stone that sank whole, still lit (Atlantis: Great Gate whose attic & braziers stand above water,
// avenue between tall colonnades, great dome, hypostyle temple hall, aqueduct arcade, sunken towers), surge out of the water,
// barrel roll over the swell, loop, return to causeway."

import * as THREE from 'three';
import { Track, pt } from './track.js';

export function createOceanTrack() {
  const numPoints = 38;
  const controlPoints = [];
  // Radius ~2050m with harmonic modulations yields ~15.2 km lap
  const R_BASE = 2050.0;

  for (let i = 0; i < numPoints; i++) {
    const theta = (i / numPoints) * Math.PI * 2.0;

    // Harmonic radial modulation to create natural sea coast and ocean abyss sweeps
    const r = R_BASE + 280.0 * Math.sin(theta * 2.0) - 180.0 * Math.cos(theta * 3.0) + 100.0 * Math.sin(theta * 5.0);
    let x = Math.sin(theta) * r;
    let z = Math.cos(theta) * r;
    let y = 6.0; // Sea surface is y = 0; default causeway y = 6.0m
    let bank = 0;
    let name = `Sector ${i + 1}`;

    // 1. Causeway low over the swell (Points 0 to 6: s ≈ 0 to 2400m)
    if (i === 0) {
      name = 'Night Causeway Start / Finish Grid';
      y = 6.5;
      bank = 0;
    } else if (i >= 1 && i <= 5) {
      name = 'Low Causeway Over Gerstner Swell';
      y = 5.8 + Math.sin(i * 1.2) * 1.5;
      bank = (i % 2 === 0 ? 6 : -6);
    }
    // 2. Sea stacks and rock arches (Points 6 to 11: s ≈ 2400 to 4400m)
    else if (i >= 6 && i <= 10) {
      name = 'Sea Stacks & Basalt Arches Slalom';
      y = 8.0 + Math.sin(i) * 3.0;
      bank = (i % 2 === 0 ? 18 : -18);
    }
    // 3. Viaduct Jump over open ocean channel (Points 11 to 13: s ≈ 4400 to 5200m)
    else if (i === 11) {
      name = 'Viaduct Channel Launch Lip';
      y = 28.0;
      bank = 0;
    } else if (i === 12) {
      name = 'Viaduct Open Channel Air Flight';
      y = 38.0;
      bank = 0;
    } else if (i === 13) {
      name = 'Viaduct Catch Deck';
      y = 12.0;
      bank = 0;
    }
    // 4. Lighthouse Island banked sweeper (Points 14 to 17: s ≈ 5200 to 7000m)
    else if (i >= 14 && i <= 17) {
      name = 'Lighthouse Island Banked Sweeper';
      y = 10.0 + (i - 14) * 2.0;
      bank = 28; // Banked left-hander around the lighthouse
    }
    // 5. The Keeper Abyss Spiral Dive (Points 18 to 23: s ≈ 7000 to 9200m)
    // Plunges 520m down to basalt pedestal at (1200, -520, -2800)
    else if (i >= 18 && i <= 23) {
      name = 'The Keeper Colossus Spiral Dive';
      const diveT = (i - 18) / 5.0; // 0 to 1
      y = THREE.MathUtils.lerp(12.0, -515.0, diveT);
      // Spiral apex positions tightly between robe (32, 280, 0) and staff (65, 280, 24)
      // At y = -240 (diveT ≈ 0.478), spiral angle passes ~0.245 rad (between robe & staff)
      const spiralAngle = (diveT - 0.478) * Math.PI * 2.2 + 0.245;
      x = 1200.0 + Math.cos(spiralAngle) * 48.5;
      z = -2800.0 + Math.sin(spiralAngle) * 48.5;
      bank = 32;
    }
    // 6. Drowned City of Atlantis (Points 24 to 31: s ≈ 9200 to 12600m)
    else if (i === 24) {
      name = 'The Great Gate (Breaching Braziers)';
      y = -480.0;
      bank = 0;
    } else if (i >= 25 && i <= 26) {
      name = 'Submerged Colonnade Avenue';
      y = -460.0;
      bank = 8;
    } else if (i === 27) {
      name = 'The Sunken Great Dome Rotunda';
      y = -420.0;
      bank = 24;
    } else if (i === 28) {
      name = 'Hypostyle Temple Hall';
      y = -380.0;
      bank = 0;
    } else if (i === 29) {
      name = 'The Aqueduct Arcade Underpass';
      y = -340.0;
      bank = 12;
    } else if (i >= 30 && i <= 31) {
      name = 'Sunken Towers & Sunken Obelisks';
      y = -280.0;
      bank = 16;
    }
    // 7. Ocean Surface Surge & Wave Barrel Roll (Points 32 to 35: s ≈ 12600 to 14200m)
    else if (i >= 32 && i <= 34) {
      name = 'Ocean Surface Surge & Water Breach';
      const climbT = (i - 32) / 2.0;
      y = THREE.MathUtils.lerp(-220.0, 16.0, climbT); // Breaches surface (y = 0) with water spray
      bank = (i === 33 ? 45 : 15); // Barrel roll over waves
    }
    // 8. High loop return to Causeway (Points 35 to 37: s ≈ 14200 to 15200m)
    else if (i >= 35) {
      name = 'Storm Sweeper Return to Causeway';
      y = 12.0 - (i - 35) * 3.0;
      bank = 12;
    }

    controlPoints.push(pt(x, y, z, bank, name));
  }

  const track = new Track(controlPoints, {
    name: 'ocean',
    title: 'THE DROWNED WORLD',
    width: 56.0,
    deckColor: 0x142838, // Deep oceanic deck
    step: 5.0
  });

  // Boost pads: causeway sprint, viaduct lip, after Keeper spiral, Atlantis colonnade avenue, post-breach climb
  track.pads = [
    { s: 350.0, x: 0 },
    { s: 1250.0, x: -8.0 },
    { s: 2200.0, x: 8.0 },
    { s: 4320.0, x: 0 },    // Viaduct channel launch pad
    { s: 6100.0, x: -6.0 },   // Lighthouse island pad
    { s: 9150.0, x: 0 },    // Exit Keeper spiral dive
    { s: 10400.0, x: 0 },   // Atlantis Great Gate pad
    { s: 11600.0, x: 6.0 },   // Temple hall pad
    { s: 13100.0, x: 0 },   // Breach surface surge pad
    { s: 14600.0, x: -6.0 }
  ];

  // Light gates at key sector transitions
  track.gates = [
    { s: 0, color: 0x00d2ff },
    { s: 2400.0, color: 0x00ff88 },
    { s: 4350.0, color: 0xffaa00 },
    { s: 6950.0, color: 0x38bdf8 },
    { s: 9200.0, color: 0x00e5ff }, // Entering Atlantis Great Gate
    { s: 12600.0, color: 0xff3366 }, // Breaching ocean surface
    { s: 14200.0, color: 0x00d2ff }
  ];

  // Viaduct jump gap across open channel
  track.gaps = [
    { start: 4420.0, end: 4760.0 }
  ];

  // Atlantis underwater section (for lighting / chamber effects)
  track.tunnels = [
    { start: 9100.0, end: 12700.0 }
  ];

  return track;
}
