// tools/test_p1_acceptance.mjs — Test suite for P1 Ship It acceptance criteria
import assert from 'node:assert';
import fs from 'node:fs';
import { CURRENT_VERSION, CHANGELOG } from '../src/changelog.js';
import { SettingsManager, DEFAULT_SETTINGS } from '../src/settings.js';
import { InputHandler } from '../src/input.js';

console.log('--- Testing P1 Ship It Acceptance Criteria ---');

// 1. Version and Changelog
console.log('1. Verifying Changelog...');
const entryP1 = CHANGELOG.find(c => c.version === '1.0.1');
assert(entryP1, 'CHANGELOG must contain 1.0.1 entry');
assert.strictEqual(entryP1.title, 'Ship It');
console.log('   ✓ Version entry 1.0.1 "Ship It" verified in changelog');

// 2. Web App Manifest
console.log('2. Verifying Web App Manifest...');
assert(fs.existsSync('manifest.json'), 'manifest.json must exist');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
assert.strictEqual(manifest.name, 'Need4Space Anti-Gravity Racer');
assert.strictEqual(manifest.display, 'standalone');
assert.strictEqual(manifest.orientation, 'landscape');
assert(manifest.icons && manifest.icons.length > 0, 'Must define icons');
console.log('   ✓ manifest.json is valid with standalone display & landscape orientation');

// 3. Settings & Laptop Mode
console.log('3. Verifying Settings & Laptop Mode...');
assert('laptopMode' in DEFAULT_SETTINGS, 'DEFAULT_SETTINGS must have laptopMode');
const settings = new SettingsManager();
assert.strictEqual(settings.get('laptopMode'), false);

// Test mock app apply
const mockApp = {
  renderer: {
    pixelRatio: 1,
    setPixelRatio(r) { this.pixelRatio = r; }
  },
  post: {
    enabled: true,
    enableAO: true,
    enableSSR: true,
    enableBloom: true,
    enableLook: true
  }
};

settings.set('laptopMode', true);
settings.apply(mockApp);
assert.strictEqual(mockApp.renderer.pixelRatio, 1.0, 'Laptop mode downscales DPR to 1.0');
assert.strictEqual(mockApp.post.enableSSR, false, 'Laptop mode disables SSR');
assert.strictEqual(mockApp.post.enableAO, false, 'Laptop mode disables AO');
assert.strictEqual(mockApp.post.enableBloom, true, 'Laptop mode keeps bloom');

settings.set('laptopMode', false);
settings.set('quality', 'high');
settings.apply(mockApp);
assert.strictEqual(mockApp.post.enableSSR, true, 'High mode enables SSR');
assert.strictEqual(mockApp.post.enableAO, true, 'High mode enables AO');
console.log('   ✓ Laptop mode correctly toggles SSR, AO, and pixel ratio');

// 4. Touch Controls in InputHandler
console.log('4. Verifying Touch Controls...');
const input = new InputHandler();
assert(input.touch !== undefined, 'InputHandler must have touch state container');

input.touch.throttle = true;
let polled = input.poll();
assert.strictEqual(polled.throttle, 1.0, 'Touch throttle sets throttle to 1.0');

input.touch.throttle = false;
input.touch.brake = true;
polled = input.poll();
assert.strictEqual(polled.brake, 1.0, 'Touch brake sets brake to 1.0');

input.touch.brake = false;
input.touch.steerLeft = true;
polled = input.poll();
assert.strictEqual(polled.steer, -1.0, 'Touch steer left sets steer to -1.0');

input.touch.steerLeft = false;
input.touch.steerRight = true;
polled = input.poll();
assert.strictEqual(polled.steer, 1.0, 'Touch steer right sets steer to 1.0');

input.touch.steerRight = false;
input.touch.boost = true;
polled = input.poll();
assert.strictEqual(polled.boost, true, 'Touch boost sets boost to true');
console.log('   ✓ Touch controls correctly synthesize racing inputs');

// 5. Index.html metadata verification
console.log('5. Verifying HTML Metadata...');
const html = fs.readFileSync('index.html', 'utf8');
assert(html.includes('manifest.json'), 'index.html must reference manifest.json');
assert(html.includes('viewport'), 'index.html must have viewport meta');
assert(html.includes('og:title'), 'index.html must have og:title');
assert(html.includes('id="touch-layer"'), 'index.html must contain #touch-layer');
assert(html.includes('id="t-thr"'), 'index.html must contain touch throttle button');
console.log('   ✓ index.html has complete mobile & PWA metadata');

console.log('\n--- ALL P1 ACCEPTANCE CRITERIA PASSED ---');
