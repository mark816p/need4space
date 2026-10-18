// src/wreckzones.js — Derelict Colossus 12 km zones, chamber boundaries, and lighting properties
// Why: "The sun comes in only where the hull is open... correct darkness inside bell/hall; ships' lights on"
// Provides continuous zone state and optical depth/darkness transitions for physics, lighting, and HUD

import { COLOSSUS_PIECES } from './wreckplan.js';

export const WRECK_ZONES = [
  {
    id: 'approach',
    name: 'Colossus Approach',
    startS: 11400.0,
    endS: 12000.0,
    darkChamber: false,
    sunOcclusion: 0.0,
    reactorWarmth: 0.0,
    headlightBoost: 0.0
  },
  {
    id: 'engine_bell',
    name: 'Colossal Engine Bell',
    startS: 12000.0,
    endS: 12800.0,
    darkChamber: true,
    sunOcclusion: 0.95,
    reactorWarmth: 0.25,
    headlightBoost: 1.0
  },
  {
    id: 'reactor_hall',
    name: 'Antimatter Reactor Containment',
    startS: 12800.0,
    endS: 14400.0,
    darkChamber: true,
    sunOcclusion: 1.0,
    reactorWarmth: 1.0,
    headlightBoost: 1.0
  },
  {
    id: 'the_break',
    name: 'The Break (Hull Fracture Leap)',
    startS: 14400.0,
    endS: 15600.0,
    darkChamber: false,
    sunOcclusion: 0.2, // Open breach to the void
    reactorWarmth: 0.35,
    headlightBoost: 0.4
  },
  {
    id: 'upside_down_hold',
    name: 'The Upside-Down Hold',
    startS: 15600.0,
    endS: 18600.0,
    darkChamber: true,
    sunOcclusion: 0.95,
    reactorWarmth: 0.2,
    headlightBoost: 1.0
  },
  {
    id: 'cargo_hangar',
    name: 'Forward Hangar & Rack Towers',
    startS: 18600.0,
    endS: 20600.0,
    darkChamber: true,
    sunOcclusion: 0.95,
    reactorWarmth: 0.15,
    headlightBoost: 1.0
  },
  {
    id: 'trench_run',
    name: 'Trench Run & Barbettes',
    startS: 20600.0,
    endS: 22400.0,
    darkChamber: false,
    sunOcclusion: 0.35, // High trench walls shading sun
    reactorWarmth: 0.05,
    headlightBoost: 0.5
  },
  {
    id: 'breach_exit',
    name: 'Hull Breach & Sensor Boom',
    startS: 22400.0,
    endS: 23800.0,
    darkChamber: false,
    sunOcclusion: 0.0,
    reactorWarmth: 0.0,
    headlightBoost: 0.0
  },
  {
    id: 'graveyard',
    name: 'Wreck Graveyard',
    startS: 23800.0,
    endS: 25000.0,
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
  const z = getWreckZone(s);
  if (!z) return 0.0;
  return z.sunOcclusion;
}

export function getReactorWarmth(s) {
  const z = getWreckZone(s);
  if (!z) return 0.0;
  return z.reactorWarmth;
}

export function getZoneLighting(s) {
  const z = getWreckZone(s);
  if (!z) {
    return {
      sunOcclusion: 0.0,
      ambientDarkness: 0.0,
      headlightBoost: 0.0,
      reactorWarmth: 0.0
    };
  }
  return {
    sunOcclusion: z.sunOcclusion,
    ambientDarkness: z.darkChamber ? z.sunOcclusion : z.sunOcclusion * 0.5,
    headlightBoost: z.headlightBoost,
    reactorWarmth: z.reactorWarmth
  };
}
