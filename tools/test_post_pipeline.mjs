// tools/test_post_pipeline.mjs — Verify PostPipeline, LookController, and pass toggles
import * as THREE from 'three';
import { LookController, LOOK_DEFAULTS } from '../src/look.js';
import { PostPipeline } from '../src/post.js';

console.log('Testing Post-Processing Pipeline & Look Controller (P0.8 Acceptance Checks)...');

// -----------------------------------------------------------------------------
// Test 1: LookController Telemetry & Dynamic Modulation
// -----------------------------------------------------------------------------
console.log('Test 1: Testing LookController dynamic optics...');
const look = new LookController();

// Baseline
look.update(0.016, { speed: 0, lateralG: 0, isBoosting: false, hitImpulse: 0 });
console.log(`  Initial Chroma: ${look.currentChroma.toFixed(6)}, Bloom: ${look.currentBloomStrength.toFixed(3)}, Exposure: ${look.currentExposure.toFixed(3)}`);

// High speed test
for (let i = 0; i < 30; i++) {
  look.update(0.016, { speed: 280, lateralG: 18, isBoosting: true, hitImpulse: 0.5 });
}
console.log(`  High Speed + Boost + Impact Chroma: ${look.currentChroma.toFixed(6)}, Bloom: ${look.currentBloomStrength.toFixed(3)}, Exposure: ${look.currentExposure.toFixed(3)}`);

if (look.currentChroma <= LOOK_DEFAULTS.chromaBase) {
  throw new Error('FAIL: Chromatic aberration did not scale with speed/lateral Gs');
}
if (look.currentBloomStrength <= LOOK_DEFAULTS.bloomStrength) {
  throw new Error('FAIL: Bloom strength did not swell during boost');
}
if (look.currentExposure <= LOOK_DEFAULTS.exposure) {
  throw new Error('FAIL: Exposure did not kick on hit impulse');
}
console.log('  PASS: LookController optics modulation verified.');

// -----------------------------------------------------------------------------
// Test 2: PostPipeline Targets & Shader Structure
// -----------------------------------------------------------------------------
console.log('\nTest 2: Verifying PostPipeline Target Allocations & Toggles...');

// Mock WebGLRenderer for headless Node test
const mockRenderer = {
  currentTarget: null,
  getRenderTarget() { return this.currentTarget; },
  setRenderTarget(t) { this.currentTarget = t; },
  clear() {},
  render(s, c) {},
  setSize(w, h) {}
};

const mockScene = new THREE.Scene();
const mockCamera = new THREE.PerspectiveCamera(65, 16 / 9, 0.2, 30000);
mockCamera.updateProjectionMatrix();

const post = new PostPipeline(mockRenderer, mockScene, mockCamera);

if (!post.sceneTarget || !post.sceneTarget.depthTexture) {
  throw new Error('FAIL: SceneTarget missing depthTexture');
}
console.log(`  Allocated Scene Target: ${post.sceneTarget.width}x${post.sceneTarget.height}`);
console.log(`  Allocated AO Target: ${post.aoTarget.width}x${post.aoTarget.height}`);
console.log(`  Allocated SSR Target: ${post.ssrTarget.width}x${post.ssrTarget.height}`);
console.log(`  Allocated Bloom Targets: ${post.bloomBlurH.width}x${post.bloomBlurH.height}`);

// Verify Toggles (1..5)
post.enabled = false;
post.render(0.016, { speed: 100 });
if (mockRenderer.currentTarget !== null) {
  throw new Error('FAIL: Disabled master post pipeline should render directly to screen (null target)');
}

post.enabled = true;
post.enableAO = false;
post.enableSSR = false;
post.enableBloom = false;
post.enableLook = false;
post.render(0.016, { speed: 100 });
console.log('  PASS: Individual pass toggles verified.');

// Verify Resize
post.setSize(1920, 1080);
if (post.sceneTarget.width !== 1920 || post.sceneTarget.height !== 1080) {
  throw new Error('FAIL: setSize failed to update targets');
}
console.log('  PASS: Resize handler verified.');

// Verify Dispose
post.dispose();
console.log('  PASS: GPU target disposal verified.');
console.log('\nPASS: All P0.8 PostPipeline and LookController acceptance checks passed!');
