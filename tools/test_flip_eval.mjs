import * as THREE from 'three';
import { Track } from '../src/track.js';

const numPoints = 40;
const controlPoints = [];
const R_BASE = 2022.0;
const excursionScale = 680.0;

for (let i = 0; i < numPoints; i++) {
  const theta = (i / numPoints) * Math.PI * 2.0;
  let r = R_BASE + 320.0 * Math.cos(theta * 2.0) - 180.0 * Math.sin(theta * 3.0);
  let x = Math.sin(theta) * r;
  let z = Math.cos(theta) * r;
  let y = Math.sin(theta * 2.0) * 45.0 + Math.cos(theta * 4.0) * 25.0;
  let bank = 0;
  let name = `Sector ${i + 1}`;

  if (i === 10) {
    name = 'Gravity Flip 1 Approach';
    bank = 0;
  } else if (i === 11) {
    name = 'Gravity Flip 1 Exit (Overhead Deck)';
    y += 24.0;
    bank = 180.0;
  } else if (i >= 12 && i <= 13) {
    name = 'Overhead Inverted Deck';
    y += 24.0;
    bank = 180.0;
  } else if (i === 14) {
    name = 'Gravity Flip 2 Exit (Standard Deck)';
    bank = 0;
  } else if (i >= 26 && i <= 36) {
    const frac = (i - 26) / 10.0;
    const colossusEnvelope = Math.sin(frac * Math.PI) ** 1.8;
    x -= excursionScale * colossusEnvelope;
    y += 18.0 * Math.sin(frac * Math.PI);
    name = `Derelict Sector ${i - 25}`;
  }

  controlPoints.push({
    pos: new THREE.Vector3(x, y, z),
    bank: (bank * Math.PI) / 180,
    name
  });
}

const track = new Track(controlPoints, {
  name: 'space',
  flips: [[3400, 3620], [4780, 5000]],
  gaps: [[1650, 1800], [7500, 7650], [10520, 10640]]
});

console.log('Track created, length =', track.length.toFixed(1));

let maxAngle = 0;
const f0 = {};
const f1 = {};
for (let s = 0; s < track.length; s += 50) {
  track.frame(s, f0);
  track.frame((s + 50) % track.length, f1);
  const dot = Math.min(1.0, Math.max(-1.0, f0.T.dot(f1.T)));
  const deg = (Math.acos(dot) * 180) / Math.PI;
  if (deg > maxAngle) maxAngle = deg;
}
console.log('Max step angle per 50m:', maxAngle.toFixed(2), 'deg');

