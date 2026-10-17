// src/wreckplan.js — Derelict v1 Colossus structural layout, pieces, route, and graveyard
// Why: "numbers only — no three.js: where the great ship lies, how it broke, frames of its pieces and smaller wrecks"
// Pure geometric data decoupled from rendering, providing deterministic positions for track and scenery

export const COLOSSUS_LOCATION = {
  name: 'Titan-Class Heavy Battleship Derelict (Broken Colossus)',
  pos: { x: -1760.0, y: -10.0, z: 200.0 },
  heading: { x: 0.05, y: -0.04, z: 0.998 },
  totalLength: 2250.0, // meters
  hullWidth: 140.0,
  hullHeight: 90.0
};

// Structural pieces along the colossus
export const COLOSSUS_PIECES = {
  // Sector 1: Massive Rocket Exhaust Bell Entry
  engineBell: {
    startS: 9350.0,
    endS: 9750.0,
    mouthRadius: 95.0,
    throatRadius: 46.0,
    length: 400.0,
    center: { x: -1680.0, y: 30.0, z: -850.0 },
    coolingRings: 6,
    wallThickness: 4.5
  },

  // Sector 2: Main Antimatter/Fusion Reactor Containment Hall
  reactorHall: {
    startS: 9750.0,
    endS: 10450.0,
    width: 138.0,
    height: 88.0,
    length: 700.0,
    center: { x: -1760.0, y: 28.0, z: -250.0 },
    core1: { x: -1755.0, y: 34.0, z: -420.0, radius: 26.0, color: 0xff5500 },
    core2: { x: -1765.0, y: 24.0, z: -90.0, radius: 26.0, color: 0xff4400 },
    // Hanging heavy power cables across ceiling
    cables: [
      { anchorA: { x: -55, y: 38, z: -550 }, anchorB: { x: 55, y: 38, z: -550 }, sag: 16.0 },
      { anchorA: { x: -58, y: 36, z: -430 }, anchorB: { x: 58, y: 36, z: -430 }, sag: 18.5 },
      { anchorA: { x: -52, y: 39, z: -310 }, anchorB: { x: 52, y: 39, z: -310 }, sag: 14.0 },
      { anchorA: { x: -56, y: 37, z: -190 }, anchorB: { x: 56, y: 37, z: -190 }, sag: 17.0 },
      { anchorA: { x: -54, y: 38, z: -70 }, anchorB: { x: 54, y: 38, z: -70 }, sag: 15.5 },
    ]
  },

  // Sector 3: Catastrophic Hull Fracture (The Break)
  theBreak: {
    startS: 10450.0,
    gapStartS: 10520.0,
    gapEndS: 10640.0, // 120m leap across vacuum
    endS: 10700.0,
    center: { x: -1815.0, y: 20.0, z: 0.0 },
    fractureWidth: 220.0,
    platingCurl: 18.0, // Bent outward torn armour plates
    boostPadS: 10480.0 // Boost pad between the halves
  },

  // Sector 4: Forward Modular Cargo Bays & Internal Hangar
  cargoHangar: {
    startS: 10700.0,
    endS: 11400.0,
    width: 120.0,
    height: 76.0,
    length: 700.0,
    center: { x: -1850.0, y: -10.0, z: 450.0 },
    bays: 5,
    runningLights: [
      { x: -58, y: 36, z: 200, color: 0xff2222 }, // Port red
      { x: 58, y: 36, z: 200, color: 0x22ff44 },  // Starboard green
      { x: 0, y: 44, z: 350, color: 0xffaa00 },   // Dorsal amber
      { x: -58, y: 36, z: 500, color: 0xff2222 },
      { x: 58, y: 36, z: 500, color: 0x22ff44 },
      { x: 0, y: 44, z: 650, color: 0xffaa00 },
    ]
  },

  // Sector 5: Jagged Hull Breach Exit & Colossal Sensor Boom
  breachExit: {
    startS: 11400.0,
    endS: 11800.0,
    center: { x: -1810.0, y: -42.0, z: 920.0 },
    breachDiameter: 78.0
  },

  sensorBoom: {
    origin: { x: -1780.0, y: -15.0, z: 750.0 },
    dir: { x: 0.42, y: 0.35, z: 0.84 },
    length: 450.0,
    dishes: [
      { dist: 150.0, radius: 24.0 },
      { dist: 320.0, radius: 18.0 },
      { dist: 430.0, radius: 12.0 },
    ]
  }
};

// Graveyard of secondary escorts, sheared hull fragments, and debris drifting in the wake
export const GRAVEYARD = [
  { id: 'escort_1', type: 'corvette_hulk', x: -1450, y: 140, z: 1250, rx: 0.25, ry: 1.1, rz: 0.15, scale: 0.8 },
  { id: 'escort_2', type: 'cargo_tender', x: -1980, y: -120, z: 1550, rx: -0.4, ry: 2.3, rz: -0.2, scale: 0.9 },
  { id: 'escort_3', type: 'shattered_prow', x: -1300, y: -80, z: 1750, rx: 0.7, ry: -0.8, rz: 0.5, scale: 1.1 },
  { id: 'plate_1', type: 'hull_shard', x: -1680, y: 70, z: 1150, rx: 1.2, ry: 0.3, rz: 0.8, scale: 1.4 },
  { id: 'plate_2', type: 'hull_shard', x: -1920, y: 95, z: 1350, rx: -0.8, ry: 1.5, rz: -0.4, scale: 1.2 },
  { id: 'plate_3', type: 'hull_shard', x: -1550, y: -90, z: 1480, rx: 0.4, ry: -1.2, rz: 0.9, scale: 1.6 },
  { id: 'solar_1', type: 'solar_wing', x: -1380, y: 190, z: 1050, rx: 0.1, ry: 0.6, rz: 1.1, scale: 1.5 },
  { id: 'solar_2', type: 'solar_wing', x: -2100, y: 60, z: 1650, rx: -0.5, ry: 1.8, rz: -0.7, scale: 1.3 },
  { id: 'truss_1', type: 'truss_spar', x: -1720, y: -140, z: 1300, rx: 0.9, ry: 0.2, rz: -0.3, scale: 2.0 },
  { id: 'truss_2', type: 'truss_spar', x: -1600, y: 110, z: 1650, rx: -1.1, ry: 0.7, rz: 0.6, scale: 1.8 },
  { id: 'container_1', type: 'freight_pod', x: -1880, y: -45, z: 1180, rx: 0.3, ry: 0.9, rz: 0.2, scale: 1.0 },
  { id: 'container_2', type: 'freight_pod', x: -1620, y: -65, z: 1420, rx: -0.6, ry: 1.4, rz: -0.5, scale: 1.0 },
];

// Returns the control points that thread the Derelict colossus smoothly
export function wreckRoute() {
  return [
    {
      x: -1647.8, y: 26.6, z: -1197.2, bank: 0,
      name: 'Derelict Colossus Approach'
    },
    {
      x: -1682.7, y: 30.2, z: -857.4, bank: 0,
      name: 'Engine Bell Ingress (Dark Chamber Entry)'
    },
    {
      x: -1716.8, y: 32.6, z: -557.8, bank: 8,
      name: 'Exhaust Turbopump Throat'
    },
    {
      x: -1763.5, y: 30.1, z: -279.3, bank: 0,
      name: 'Reactor Hall Core 1 (Warm Amber Glow)'
    },
    {
      x: -1815.2, y: 20.0, z: -0.0, bank: 0,
      name: 'The Break (Hull Fracture Jump)'
    },
    {
      x: -1852.2, y: 2.3, z: 293.4, bank: -10,
      name: 'Forward Cargo Bay Ingress'
    },
    {
      x: -1855.0, y: -20.3, z: 602.7, bank: -6,
      name: 'Internal Hangar Backbone'
    },
    {
      x: -1812.2, y: -42.6, z: 923.4, bank: 0,
      name: 'Hull Breach Exit (Sensor Boom)'
    },
    {
      x: -1720.4, y: -59.0, z: 1250.0, bank: 18,
      name: 'Wreck Graveyard Drift Sweeper'
    },
    {
      x: -1578.3, y: -65.0, z: 1578.3, bank: 24,
      name: 'Orbital Graveyard Exit'
    }
  ];
}
