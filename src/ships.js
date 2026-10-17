// src/ships.js — Ship specifications, handling table, liveries, and perks
// Why: "Ship-specific physics numbers live in HANDLING (ships.js), never in track.js.
// Player assistance by difficulty lives in PERKS; rivals get none."

export const HANDLING = {
  feather: {
    name: 'Feather S1',
    mass: 1000,              // kg
    topSpeed: 250.0,         // m/s (~900 km/h)
    accel: 115.0,            // m/s2
    boostSpeed: 295.0,       // m/s (~1060 km/h)
    boostAccel: 190.0,       // m/s2
    boostDuration: 2.8,      // s
    boostRefillRate: 0.15,   // 1 / s (~6.6 s to refill full tank)
    turnRate: 2.25,          // rad/s
    grip: 12.5,              // Lateral adherence
    airbrakeTurn: 1.6,       // Additional turn rate with airbrakes
    airbrakeDrag: 45.0,      // m/s2 deceleration under full airbrakes
    hoverHeight: 1.8,        // m above deck
    hoverStiffness: 140.0,   // N/m spring
    hoverDamping: 22.0,      // Ns/m damper
    magHold: 320.0,          // m/s2 magnetic hold adhering to track & inverted loops
    wallBounce: 0.25,        // Restitution on wall collision
    wallFriction: 0.12,      // Tangential velocity retention along wall
    slamCool: 10.0           // s
  },
  rocket: {
    name: 'Comet R1',
    mass: 880,
    topSpeed: 275.0,
    accel: 130.0,
    boostSpeed: 320.0,
    boostAccel: 225.0,
    boostDuration: 2.5,
    boostRefillRate: 0.14,
    turnRate: 1.95,
    grip: 10.0,
    airbrakeTurn: 1.8,
    airbrakeDrag: 50.0,
    hoverHeight: 1.7,
    hoverStiffness: 150.0,
    hoverDamping: 24.0,
    magHold: 300.0,
    wallBounce: 0.28,
    wallFriction: 0.14,
    slamCool: 10.0
  },
  heavy: {
    name: 'Anvil H1',
    mass: 1500,
    topSpeed: 242.0,
    accel: 102.0,
    boostSpeed: 305.0,
    boostAccel: 240.0,
    boostDuration: 3.2,
    boostRefillRate: 0.16,
    turnRate: 2.1,
    grip: 14.5,
    airbrakeTurn: 1.4,
    airbrakeDrag: 40.0,
    hoverHeight: 1.9,
    hoverStiffness: 170.0,
    hoverDamping: 26.0,
    magHold: 360.0,
    wallBounce: 0.18,
    wallFriction: 0.08,
    slamCool: 10.0
  }
};

// Player assistance perks by difficulty level
export const PERKS = {
  easy: {
    gripMul: 1.25,
    topSpeedMul: 1.05,
    wallScrapeDamp: 0.5,
    boostRefillMul: 1.4,
    autoSteerAssist: 0.25
  },
  normal: {
    gripMul: 1.10,
    topSpeedMul: 1.0,
    wallScrapeDamp: 0.8,
    boostRefillMul: 1.0,
    autoSteerAssist: 0.0
  },
  hard: {
    gripMul: 1.0,
    topSpeedMul: 1.0,
    wallScrapeDamp: 1.0,
    boostRefillMul: 1.0,
    autoSteerAssist: 0.0
  },
  brutal: {
    gripMul: 0.95,
    topSpeedMul: 1.0,
    wallScrapeDamp: 1.15,
    boostRefillMul: 0.9,
    autoSteerAssist: 0.0
  }
};
