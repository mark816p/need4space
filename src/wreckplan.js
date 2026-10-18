// src/wreckplan.js — Derelict Colossus 12 km structural layout, pieces, route, and graveyard
// Why: "the derelict a colossus to thread for 12 km (lap 26.6 km). Rack towers in the hangar,
// hulks lit and painted, the break, trench walls over the deck, turrets up on barbettes"

export const COLOSSUS_LOCATION = {
  name: 'Titan-Class Superdreadnought Derelict (Colossus)',
  pos: { x: -3200.0, y: 15.0, z: 250.0 },
  heading: { x: 0.08, y: -0.02, z: 0.996 },
  totalLength: 12000.0, // 12 km colossus to thread
  hullWidth: 280.0,
  hullHeight: 160.0
};

// Structural pieces along the 12 km colossus
export const COLOSSUS_PIECES = {
  // Sector 1: Massive Rocket Exhaust Bell Entry (12000 - 12800)
  engineBell: {
    startS: 12000.0,
    endS: 12800.0,
    mouthRadius: 135.0,
    throatRadius: 65.0,
    length: 800.0,
    coolingRings: 8,
    wallThickness: 6.5
  },

  // Sector 2: Main Antimatter & Fusion Reactor Containment Hall (12800 - 14400)
  reactorHall: {
    startS: 12800.0,
    endS: 14400.0,
    width: 240.0,
    height: 140.0,
    length: 1600.0,
    cores: [
      { id: 'core_1', distS: 13150.0, radius: 34.0, color: 0xff5500 },
      { id: 'core_2', distS: 13650.0, radius: 36.0, color: 0xff4400 },
      { id: 'core_3', distS: 14150.0, radius: 32.0, color: 0xff6600 },
    ],
    cables: [
      { sag: 22.0, span: 180.0 },
      { sag: 26.5, span: 195.0 },
      { sag: 19.0, span: 175.0 },
      { sag: 24.0, span: 190.0 },
      { sag: 21.5, span: 185.0 },
    ]
  },

  // Sector 3: Catastrophic Hull Fracture (The Break) (14400 - 15600)
  theBreak: {
    startS: 14400.0,
    gapStartS: 14700.0,
    gapEndS: 14850.0, // 150m leap across vacuum between severed halves
    endS: 15600.0,
    fractureWidth: 380.0,
    platingCurl: 26.0, // Bent outward torn armour plates
    boostPadS: 14650.0 // Boost pad before the leap
  },

  // Sector 4: The Upside-Down Hold (15600 - 18600)
  upsideDownHold: {
    startS: 15600.0,
    flip1S: 15900.0, // Roll 180 into inverted flight
    flip2S: 18200.0, // Roll 180 back upright
    endS: 18600.0,
    width: 260.0,
    height: 150.0,
    ribCount: 24,
    holdLights: [
      { color: 0xffaa00, spacing: 120.0 }
    ]
  },

  // Sector 5: Forward Cargo Hangar Bay with Staging Rack Towers (18600 - 20600)
  cargoHangar: {
    startS: 18600.0,
    endS: 20600.0,
    width: 220.0,
    height: 125.0,
    length: 2000.0,
    bays: 8,
    rackTowers: [
      { s: 18850.0, side: -1, width: 38.0, height: 75.0 },
      { s: 19150.0, side: 1, width: 38.0, height: 75.0 },
      { s: 19450.0, side: -1, width: 38.0, height: 75.0 },
      { s: 19750.0, side: 1, width: 38.0, height: 75.0 },
      { s: 20050.0, side: -1, width: 38.0, height: 75.0 },
      { s: 20350.0, side: 1, width: 38.0, height: 75.0 },
    ],
    runningLights: [
      { color: 0xff2222, side: -1 }, // Port red
      { color: 0x22ff44, side: 1 },  // Starboard green
      { color: 0xffaa00, side: 0 },  // Dorsal amber
    ]
  },

  // Sector 6: Trench Run with Trench Walls & Turrets on Barbettes (20600 - 22400)
  trenchRun: {
    startS: 20600.0,
    endS: 22400.0,
    wallHeight: 28.0,
    wallWidth: 68.0, // Flanking 56m road
    barbetteSpacing: 110.0, // Barbettes every 110m along trench rim
    turretScale: 1.4
  },

  // Sector 7: Forward Breach Exit & Colossal Sensor Boom (22400 - 23800)
  breachExit: {
    startS: 22400.0,
    endS: 23800.0,
    breachDiameter: 120.0
  },

  sensorBoom: {
    length: 650.0,
    dishes: [
      { dist: 220.0, radius: 36.0 },
      { dist: 450.0, radius: 26.0 },
      { dist: 590.0, radius: 18.0 },
    ]
  }
};

// Graveyard of secondary escorts, lit and painted hulks drifting in the wake
export const GRAVEYARD = [
  { id: 'hulk_frigate_1', type: 'corvette_hulk', s: 15100, x: -160, y: 120, z: 0, rx: 0.35, ry: 1.2, rz: 0.15, scale: 1.5, livery: 0x00d2ff, lit: true },
  { id: 'hulk_frigate_2', type: 'corvette_hulk', s: 15350, x: 190, y: -90, z: 0, rx: -0.4, ry: 2.1, rz: -0.3, scale: 1.6, livery: 0xff3366, lit: true },
  { id: 'hulk_cargo_1', type: 'cargo_tender', s: 22800, x: -240, y: 140, z: 0, rx: 0.25, ry: 0.8, rz: 0.4, scale: 1.4, livery: 0xffaa00, lit: true },
  { id: 'hulk_prow_1', type: 'shattered_prow', s: 23200, x: 260, y: -110, z: 0, rx: 0.7, ry: -0.6, rz: 0.5, scale: 1.8, livery: 0x00ff88, lit: false },
  { id: 'plate_shard_1', type: 'hull_shard', s: 14900, x: -120, y: 70, z: 0, rx: 1.2, ry: 0.3, rz: 0.8, scale: 2.2, livery: 0x334155, lit: false },
  { id: 'plate_shard_2', type: 'hull_shard', s: 15200, x: 140, y: -80, z: 0, rx: -0.8, ry: 1.5, rz: -0.4, scale: 2.5, livery: 0x334155, lit: false },
  { id: 'solar_wing_1', type: 'solar_wing', s: 23000, x: -290, y: 180, z: 0, rx: 0.1, ry: 0.6, rz: 1.1, scale: 2.4, livery: 0x1e293b, lit: true },
  { id: 'solar_wing_2', type: 'solar_wing', s: 23500, x: 280, y: -150, z: 0, rx: -0.5, ry: 1.8, rz: -0.7, scale: 2.0, livery: 0x1e293b, lit: true },
  { id: 'truss_spar_1', type: 'truss_spar', s: 22950, x: -180, y: -120, z: 0, rx: 0.9, ry: 0.2, rz: -0.3, scale: 2.8, livery: 0x475569, lit: false },
  { id: 'truss_spar_2', type: 'truss_spar', s: 23600, x: 190, y: 130, z: 0, rx: -1.1, ry: 0.7, rz: 0.6, scale: 2.5, livery: 0x475569, lit: false },
  { id: 'freight_pod_1', type: 'freight_pod', s: 14650, x: -110, y: -65, z: 0, rx: 0.3, ry: 0.9, rz: 0.2, scale: 1.8, livery: 0xff8800, lit: true },
  { id: 'freight_pod_2', type: 'freight_pod', s: 23350, x: -130, y: 85, z: 0, rx: -0.6, ry: 1.4, rz: -0.5, scale: 1.8, livery: 0x00d2ff, lit: true },
];

// Returns the control points that thread the Derelict colossus smoothly
export function wreckRoute() {
  return [
    { x: -1647.8, y: 26.6, z: -1197.2, bank: 0, name: 'Derelict Colossus Approach' },
    { x: -1682.7, y: 30.2, z: -857.4, bank: 0, name: 'Engine Bell Ingress' },
    { x: -1716.8, y: 32.6, z: -557.8, bank: 8, name: 'Exhaust Turbopump Throat' },
    { x: -1763.5, y: 30.1, z: -279.3, bank: 0, name: 'Reactor Hall Core 1' },
    { x: -1815.2, y: 20.0, z: -0.0, bank: 0, name: 'The Break' },
    { x: -1852.2, y: 2.3, z: 293.4, bank: -10, name: 'Forward Cargo Bay Ingress' },
    { x: -1855.0, y: -20.3, z: 602.7, bank: -6, name: 'Internal Hangar Backbone' },
    { x: -1812.2, y: -42.6, z: 923.4, bank: 0, name: 'Hull Breach Exit' },
    { x: -1720.4, y: -59.0, z: 1250.0, bank: 18, name: 'Wreck Graveyard Drift Sweeper' },
    { x: -1578.3, y: -65.0, z: 1578.3, bank: 24, name: 'Orbital Graveyard Exit' }
  ];
}
