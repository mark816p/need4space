// src/wreckzones.js — Derelict v1 zones, chamber boundaries, and lighting properties
// Why: "The sun comes in only where the hull is open... correct darkness inside bell/hall; ships' lights on"
// Provides continuous zone state and optical depth/darkness transitions for physics, lighting, and HUD

import { COLOSSUS_PIECES } from './wreckplan.js';

export const WRECK_ZONES = [
  {
    id: 'approach',
    name: 'Derelict Approach',
    startS: 9150.0,
    endS: 9350.0,
    darkChamber: false,
    sunOcclusion: 0.0,
    reactorWarmth: 0.0,
    headlightBoost: 0.0
  },
  {
    id: 'engine_bell',
    name: 'Colossal Engine Bell',
    startS: 9350.0,
    endS: 9750.0,
    darkChamber: true,
    sunOcclusion: 0.95,
    reactorWarmth: 0.25,
    headlightBoost: 1.0
  },
  {
    id: 'reactor_hall',
    name: 'Antimatter Reactor Hall',
    startS: 9750.0,
    endS: 10480.0,
    darkChamber: true,
    sunOcclusion: 1.0,
    reactorWarmth: 1.0,
    headlightBoost: 1.0
  },
  {
    id: 'the_break',
    name: 'The Break (Hull Fracture)',
    startS: 10480.0,
    endS: 10680.0,
    darkChamber: false,
    sunOcclusion: 0.2, // Open breach to the void
    reactorWarmth: 0.35,
    headlightBoost: 0.4
  },
  {
    id: 'cargo_hangar',
    name: 'Forward Hangar Bay',
    startS: 10680.0,
    endS: 11400.0,
    darkChamber: true,
    sunOcclusion: 0.95,
    reactorWarmth: 0.15,
    headlightBoost: 1.0
  },
  {
    id: 'breach_exit',
    name: 'Hull Breach & Sensor Boom',
    startS: 11400.0,
    endS: 11800.0,
    darkChamber: false,
    sunOcclusion: 0.0,
    reactorWarmth: 0.0,
    headlightBoost: 0.0
  },
  {
    id: 'graveyard',
    name: 'Wreck Graveyard',
    startS: 11800.0,
    endS: 12600.0,
    darkChamber: false,
    sunOcclusion: 0.0,
    reactorWarmth: 0.0,
    headlightBoost: 0.0
  }
];

export function getWreckZone(s) {
  for (let i = 0; i < WRECK_ZONES.length; i++) {
    const z = WRECK_ZONES[i];
    if (s >= z.startS && s < z.endS) {
      return z;
    }
  }
  return null;
}

export function isDarkChamber(s) {
  const z = getWreckZone(s);
  return z ? z.darkChamber : false;
}

export function getChamberDarkness(s) {
  // Smoothly blend in and out of the dark chambers
  // Bell entrance: 9300 - 9450
  if (s >= 9300 && s < 9450) {
    return (s - 9300) / 150.0;
  }
  // Bell + Reactor: 9450 - 10450
  if (s >= 9450 && s < 10450) {
    return 1.0;
  }
  // Emerging into The Break: 10450 - 10520
  if (s >= 10450 && s < 10520) {
    return 1.0 - (s - 10450) / 70.0 * 0.8; // Drops to 0.2 in the open break
  }
  // Open Break gap: 10520 - 10640
  if (s >= 10520 && s < 10640) {
    return 0.2;
  }
  // Re-entering Hangar: 10640 - 10700
  if (s >= 10640 && s < 10700) {
    return 0.2 + (s - 10640) / 60.0 * 0.8;
  }
  // Inside Hangar: 10700 - 11350
  if (s >= 10700 && s < 11350) {
    return 1.0;
  }
  // Exiting via Breach: 11350 - 11500
  if (s >= 11350 && s < 11500) {
    return 1.0 - (s - 11350) / 150.0;
  }
  return 0.0;
}

export function getReactorWarmth(s) {
  // Peaks inside the reactor hall between 9800 and 10400
  if (s >= 9650 && s < 9950) {
    return (s - 9650) / 300.0;
  }
  if (s >= 9950 && s < 10350) {
    return 1.0;
  }
  if (s >= 10350 && s < 10600) {
    return 1.0 - (s - 10350) / 250.0;
  }
  return 0.0;
}

export function getZoneLighting(s) {
  const darkness = getChamberDarkness(s);
  const warmth = getReactorWarmth(s);
  return {
    sunOcclusion: darkness,
    ambientDarkness: darkness * 0.85,
    reactorWarmth: warmth,
    headlightBoost: darkness > 0.2 ? Math.min(1.0, darkness * 1.2) : 0.0
  };
}
