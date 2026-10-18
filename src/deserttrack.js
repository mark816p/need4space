// src/deserttrack.js — Desert Planet circuit layout (~14.3 km arid wasteland)
// Why: Canyon gorge of layered sandstone, two chasm jumps, a hollow fallen skyscraper,
// great sandstone arches, and high-speed sweepers through a towering sandstorm
import * as THREE from 'three';
import { Track, pt } from './track.js';

export function createDesertTrack() {
  const numPoints = 36;
  const controlPoints = [];
  // Radius ~2160m with harmonic modulations yields ~14.3 km lap
  const R_BASE = 2160.0;

  for (let i = 0; i < numPoints; i++) {
    const theta = (i / numPoints) * Math.PI * 2.0;

    // Harmonic radial modulation to create natural canyon and dune curves
    const r = R_BASE + 320.0 * Math.sin(theta * 2.0) - 190.0 * Math.cos(theta * 3.0) + 110.0 * Math.sin(theta * 5.0);
    const x = Math.sin(theta) * r;
    const z = Math.cos(theta) * r;
    let y = Math.sin(theta * 2.0) * 55.0 + Math.cos(theta * 3.0) * 35.0;
    let bank = 0;
    let name = `Sector ${i + 1}`;

    if (i === 0) {
      name = 'Dunes Oasis Starting Grid';
      bank = 0;
      y = 10.0;
    } else if (i >= 2 && i <= 4) {
      name = 'Red Canyon Gorge Entrance';
      bank = 22;
      y -= 25.0;
    } else if (i === 5) {
      name = 'First Chasm Jump Launch';
      y += 18.0;
      bank = 0;
    } else if (i === 6) {
      name = 'First Chasm Catch Deck';
      y -= 8.0;
      bank = 0;
    } else if (i >= 8 && i <= 10) {
      name = 'Mesa & Butte S-Sweepers';
      // Desert slalom/S swing less, banked into turn
      bank = (i % 2 === 0 ? 14 : -14);
      y += 15.0;
    } else if (i >= 12 && i <= 14) {
      name = 'Fallen Skyscraper Transit (Hollow Ruins)';
      // Straight through the hollow monolithic fallen tower
      bank = 0;
      y = 5.0;
    } else if (i === 16) {
      name = 'The Great Sandstone Arch';
      y -= 15.0;
      bank = 0;
    } else if (i >= 18 && i <= 20) {
      name = 'Simoom Sandstorm Canyon';
      // Entering towering dust ellipsoid — banked into turn
      bank = 20;
      y += 20.0;
    } else if (i === 22) {
      name = 'Second Chasm Launch';
      y += 26.0;
      bank = 0;
    } else if (i === 23) {
      name = 'Second Chasm Landing Ramp';
      y -= 10.0;
      bank = 0;
    } else if (i >= 25 && i <= 27) {
      name = 'Stepped Pyramids High-Speed Sweeper';
      bank = 28;
      y += 10.0;
    } else if (i >= 29 && i <= 32) {
      name = 'Transverse Dune Ridges Fast Run';
      bank = 16; // Banked into turn
      y -= 5.0;
    } else if (i >= 33 && i <= 35) {
      name = 'Home Oasis Straight & Grid Runway';
      // Perfectly flat & unbanked runway to prevent collisions behind start line
      bank = 0;
      y = 10.0;
    }

    controlPoints.push(pt(x, y, z, bank, name));
  }

  // Define circuit features: jumps, boost pads, gates, and sandstone themes
  const features = {
    name: 'desert',
    theme: {
      deckColor: 0x221c18,     // Deep charcoal/basalt road deck
      kerbColor: 0xffaa22,     // Solar-gold/amber neon kerbs
      barrierColor: 0xff9900,  // Warm amber energy barrier
      wallColor: 0x3d2b20,     // Weathered desert composite barrier
      fogColor: 0xd47748,      // Terracotta warm dust fog
    },
    towers: false,
    meteor: false,
    // Two Chasm Jumps across sandstone chasms
    gaps: [
      [2150, 2300],  // First Chasm Jump
      [9350, 9520],  // Second Chasm Jump
    ],
    // High-speed boost pads placed on straights and before jumps
    boostPads: [
      { s: 1950, lateral: 0, duration: 2.2 },
      { s: 4600, lateral: -6, duration: 2.2 },
      { s: 6800, lateral: 0, duration: 2.2 },
      { s: 9150, lateral: 0, duration: 2.2 },
      { s: 11800, lateral: 6, duration: 2.2 },
      { s: 13600, lateral: 0, duration: 2.2 }
    ],
    // Light timing gates
    gates: [
      { s: 0, color: 0xffaa00 },
      { s: 3600, color: 0xff6600 },
      { s: 7200, color: 0xffcc33 },
      { s: 10800, color: 0xff8800 }
    ],
    // Ruins fallen tower straight section
    ruinsSection: [4800, 5600],
    // Sandstorm ellipsoid center & radius
    sandstorm: {
      center: new THREE.Vector3(-1200, 60, -1400),
      radius: new THREE.Vector3(1200, 450, 1000),
      sRange: [7400, 8900]
    }
  };

  const track = new Track(controlPoints, features);
  track.name = 'desert';
  track.features = features;
  return track;
}
