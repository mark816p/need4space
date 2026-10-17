// tools/test_track.mjs — Verify track length, continuity, and loop frame accuracy
import * as THREE from './three.module.js';
import { createSpaceTrack } from '../src/track.js';

const t = createSpaceTrack();
console.log('--- TRACK ACCEPTANCE CHECK ---');
console.log('Track length:', Math.round(t.length), 'm (expected: ~11,000 - 12,000 m)');
console.log('Track frames (n):', t.n);
console.log('Actual step size:', t.actualStep.toFixed(3), 'm');

// Check length
const lengthOk = t.length >= 11000 && t.length <= 12500;
console.log('Length in range (11-12.5km):', lengthOk ? 'PASS' : 'FAIL');

// Check continuity and loop frame error
let maxUAngle = 0;
let maxTAngle = 0;
let maxRAngle = 0;

for (let i = 0; i < t.n; i++) {
  const next = (i + 1) % t.n;

  // Tangent continuity
  const tDot = t.tx[i] * t.tx[next] + t.ty[i] * t.ty[next] + t.tz[i] * t.tz[next];
  const tAngle = Math.acos(Math.max(-1, Math.min(1, tDot))) * (180 / Math.PI);
  if (tAngle > maxTAngle) maxTAngle = tAngle;

  // Up continuity
  const uDot = t.ux[i] * t.ux[next] + t.uy[i] * t.uy[next] + t.uz[i] * t.uz[next];
  const uAngle = Math.acos(Math.max(-1, Math.min(1, uDot))) * (180 / Math.PI);
  if (uAngle > maxUAngle) maxUAngle = uAngle;

  // Right continuity
  const rDot = t.rx[i] * t.rx[next] + t.ry[i] * t.ry[next] + t.rz[i] * t.rz[next];
  const rAngle = Math.acos(Math.max(-1, Math.min(1, rDot))) * (180 / Math.PI);
  if (rAngle > maxRAngle) maxRAngle = rAngle;
}

console.log('Max inter-frame tangent step angle:', maxTAngle.toFixed(4), 'deg');
console.log('Max inter-frame up vector angle:', maxUAngle.toFixed(4), 'deg');
console.log('Max inter-frame right vector angle:', maxRAngle.toFixed(4), 'deg');
console.log('Loop frame error < 1 deg:', maxUAngle < 1.0 ? 'PASS' : 'FAIL');

if (lengthOk && maxUAngle < 1.0) {
  console.log('ALL P0.3 ACCEPTANCE CHECKS PASSED!');
  process.exit(0);
} else {
  console.error('CHECKS FAILED');
  process.exit(1);
}
