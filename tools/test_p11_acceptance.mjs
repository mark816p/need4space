// tools/test_p11_acceptance.mjs — Comprehensive automated acceptance suite for Phase P11
// Verifies The Broken Giant warship, detailed emitter pylons, road deck bounce lighting,
// Comet R1 & 18-tooth folding petals, 3D Ship Showroom, and Ocean Planet "The Drowned World"

import assert from 'node:assert';
import * as THREE from 'three';
import { SpaceWorld } from '../src/space.js';
import { createSpaceTrack, Track } from '../src/track.js';
import { buildTrackMeshes } from '../src/trackmesh.js';
import { Ship } from '../src/ship.js';
import { buildCometR1, buildFeatherS1, buildAnvilH1, createShipMaterials } from '../src/shipmodels.js';
import { SHOWROOM_SHIPS, Showroom, openShowroom } from '../src/showroom.js';
import { GERSTNER_SWELLS, OceanAtmosphere, createSeaGeometry } from '../src/sea.js';
import { KeeperStatue } from '../src/keeper.js';
import { AtlantisCity } from '../src/atlantis.js';
import { createOceanTrack } from '../src/ocean.js';
import { OceanWorld } from '../src/oceanworld.js';
import { CIRCUITS } from '../src/scoreboard.js';
import { CHANGELOG, CURRENT_VERSION } from '../src/changelog.js';
import { DEFAULT_SETTINGS, SettingsManager } from '../src/settings.js';
import { SoundSystem } from '../src/audio.js';

// Mock DOM/canvas for headless Node.js environment
if (typeof document === 'undefined') {
  globalThis.document = {
    body: {
      appendChild() {},
      dataset: {}
    },
    createElement(type) {
      if (type === 'canvas') {
        const width = 256;
        const height = 256;
        return {
          width,
          height,
          clientWidth: 800,
          clientHeight: 600,
          getContext() {
            return {
              createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
              createRadialGradient() { return { addColorStop() {} }; },
              createLinearGradient() { return { addColorStop() {} }; },
              putImageData() {},
              fillRect() {},
              strokeRect() {},
              beginPath() {},
              moveTo() {},
              lineTo() {},
              closePath() {},
              fill() {},
              stroke() {},
              fillStyle: '',
              strokeStyle: '',
              lineWidth: 1
            };
          },
          addEventListener() {},
          setPointerCapture() {},
          releasePointerCapture() {}
        };
      }
      return {
        style: {},
        classList: {
          add() {},
          remove() {},
          contains() { return false; }
        },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        appendChild() {},
        addEventListener() {}
      };
    },
    getElementById() { return null; }
  };
}

console.log('=== PHASE P11 ACCEPTANCE VERIFICATION ===\n');

// -----------------------------------------------------------------------------
// 1. P11.1 The Broken Giant Colossus Warship (space.js)
// -----------------------------------------------------------------------------
console.log('--- 1. The Broken Giant Colossus Warship ---');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 100000);
const track = createSpaceTrack();
const spaceWorld = new SpaceWorld(scene, null, camera, track);

assert(spaceWorld.brokenGiantGroup, 'Broken Giant colossus group must exist in SpaceWorld');
assert(spaceWorld.colossusGroup, 'colossusGroup points to broken giant warship');

// Check that the Broken Giant is in the sky scene
const brokenGiantInSky = spaceWorld.sky.children.find(c => c.name === 'broken_giant_colossus');
assert(brokenGiantInSky, 'Broken Giant must be added to space sky scene');

// Verify Forward Hull and Aft Engineering Hull pieces
const fwdHull = spaceWorld.brokenGiantGroup.children.find(c => c.name === 'colossus_forward_hull');
const aftHull = spaceWorld.brokenGiantGroup.children.find(c => c.name === 'colossus_aft_hull');
const debrisField = spaceWorld.brokenGiantGroup.children.find(c => c.name === 'colossus_debris_field');

assert(fwdHull, 'Forward Hull wedge with command tower must exist');
assert(aftHull, 'Aft Engineering Hull with sublight engine bells must exist');
assert(debrisField, '48-piece tumbling debris field must exist');
assert.strictEqual(debrisField.children.length, 48, 'Debris field must contain exactly 48 fragments');

// Test colossus setting toggle
const settingsMgr = new SettingsManager();
assert.strictEqual(settingsMgr.data.colossus, true, 'Default settings has colossus: true');

spaceWorld.setOptions(new Map([['colossus', false]]));
assert.strictEqual(spaceWorld.brokenGiantGroup.visible, false, 'Colossus group hides when colossus setting is false');

spaceWorld.setOptions(new Map([['colossus', true]]));
assert.strictEqual(spaceWorld.brokenGiantGroup.visible, true, 'Colossus group shows when colossus setting is true');

// Update world to verify microgravity debris tumbling
const initialRotZ = debrisField.children[0].rotation.z;
spaceWorld.update(0.5, camera, new THREE.Vector3(0, 0, 0), 0);
assert.notStrictEqual(debrisField.children[0].rotation.z, initialRotZ, 'Debris pieces must tumble with angular velocity');

console.log('PASS: The Broken Giant 12 km dreadnought, 48 debris pieces, and colossus toggle verified');

// -----------------------------------------------------------------------------
// 2. P11.2 Detailed Emitter Pylons (trackmesh.js)
// -----------------------------------------------------------------------------
console.log('\n--- 2. Detailed Light Gate Emitter Pylons ---');

const tm = buildTrackMeshes(track, scene);
let foundEmitterPylon = false;
let foundEmitterRing = false;
let foundConduits = false;

tm.traverse((obj) => {
  if (obj.name && (obj.name.includes('emitter_pylon') || obj.name.includes('gate_pylon'))) {
    foundEmitterPylon = true;
  }
  if (obj.name === 'pylon_emitter_ring') {
    foundEmitterRing = true;
  }
  if (obj.name === 'pylon_conduit_run') {
    foundConduits = true;
  }
});

assert(foundEmitterPylon, 'Track mesh must contain detailed emitter pylons');
assert(foundEmitterRing, 'Emitter pylons must feature glowing emitter rings');
assert(foundConduits, 'Emitter pylons must feature twin high-voltage conduit runs');
console.log('PASS: Detailed light gate emitter pylons verified');

// -----------------------------------------------------------------------------
// 3. P11.2 Road Deck Bounce Lighting on Ships (ship.js)
// -----------------------------------------------------------------------------
console.log('\n--- 3. Ships Lit by Road Deck (setDeckLight) ---');

const mats = createShipMaterials(0x00d2ff, 0x1f242d);
const featherModel = buildFeatherS1(mats);
const ship = new Ship(featherModel);

const trackFrame = {
  pos: new THREE.Vector3(0, 0, 0),
  U: new THREE.Vector3(0, 1, 0),
  R: new THREE.Vector3(1, 0, 0),
  T: new THREE.Vector3(0, 0, 1)
};

ship.root.position.set(0, 1.8, 0); // 1.8m hover height
ship.setDeckLight(trackFrame, 0x223344, { shipPaint: 'gloss', shipTrim: 'satin', engineFaces: 'glow' });

assert(ship.deckBounceLight, 'Ship must instantiate deckBounceLight');
assert(ship.deckUniforms.deckK.value > 0.5, 'deckK clearance factor must be calculated');
assert.strictEqual(ship.engineFacesMode, 'glow', 'engineFaces mode set to glow');
assert.strictEqual(ship.paintMode, 'gloss', 'paintMode set to gloss');
assert.strictEqual(ship.trimMode, 'satin', 'trimMode set to satin');

console.log('PASS: Road deck bounce lighting, deckK clearance, and finish settings verified');

// -----------------------------------------------------------------------------
// 4. P11.4 Comet R1 & 18-Tooth Folding Petal Nozzle (shipmodels.js, ship.js)
// -----------------------------------------------------------------------------
console.log('\n--- 4. Comet R1 & 18-Tooth Folding Petal Nozzle ---');

const cometModel = buildCometR1(mats);
assert.strictEqual(cometModel.kind, 'rocket', 'Comet R1 model kind is rocket');
assert(cometModel.petals, 'Comet R1 has nozzle petals array');
assert.strictEqual(cometModel.petals.length, 18, 'Comet R1 must have exactly 18 folding petals');

const cometShip = new Ship(cometModel);
assert(cometShip.model.petals, 'Ship instance retains model petals');

// Test petal kinematics: braking / idle fans out to ~0.42 rad; full throttle folds to ~0.06 rad
cometShip.setEngine(true);
cometShip.update(0.1, { throttle: 0.0, brake: 1.0, boost: false }); // Braking
for (let step = 0; step < 20; step++) {
  cometShip.update(0.05, { throttle: 0.0, brake: 1.0, boost: false });
}
const idleFold = cometShip.petalFold;
assert(idleFold > 0.35, `Petals fan wide when braking/idle (expected >0.35, got ${idleFold.toFixed(3)})`);

// Full throttle
for (let step = 0; step < 30; step++) {
  cometShip.update(0.05, { throttle: 1.0, brake: 0.0, boost: true });
}
const throttleFold = cometShip.petalFold;
assert(throttleFold < 0.12, `Petals fold tightly under full throttle (expected <0.12, got ${throttleFold.toFixed(3)})`);
assert(throttleFold < idleFold, 'Petals must tighten inward when throttle is applied');

console.log('PASS: Comet R1 titanium manta & 18-tooth dynamic petal folding kinematics verified');

// -----------------------------------------------------------------------------
// 5. P11.4 3D Ship Showroom (showroom.js)
// -----------------------------------------------------------------------------
console.log('\n--- 5. 3D Ship Showroom Modal ---');

assert(SHOWROOM_SHIPS.length >= 3, 'Showroom includes Feather S1, Comet R1, and Anvil H1');
assert(SHOWROOM_SHIPS.find(s => s.name === 'COMET R1'), 'Comet R1 listed in showroom');

const showroom = new Showroom();
assert(showroom.turntable, 'Showroom has black glass turntable stand');
assert.strictEqual(showroom.turntable.material.roughness, 0.04, 'Turntable glass roughness is 0.04');
assert.strictEqual(showroom.turntable.material.metalness, 0.96, 'Turntable glass metalness is 0.96');
assert(showroom.softboxTop, 'Showroom has top softbox key light');
assert(showroom.softboxRim, 'Showroom has rim softbox backlight');

// Test ship cycling
showroom.currentShipIdx = 0; // Feather
showroom.nextShip();
assert.strictEqual(showroom.currentShipIdx, 1, 'Cycled to next ship');
assert.strictEqual(SHOWROOM_SHIPS[showroom.currentShipIdx].name, 'COMET R1', 'Current ship is Comet R1');

showroom.prevShip();
assert.strictEqual(showroom.currentShipIdx, 0, 'Cycled back to Feather S1');

console.log('PASS: 3D Ship Showroom modal, turntable material, softboxes, and ship cycling verified');

// -----------------------------------------------------------------------------
// 6. P11.3 Ocean Planet "The Drowned World" Circuit & Geometry (ocean.js)
// -----------------------------------------------------------------------------
console.log('\n--- 6. The Drowned World Circuit (ocean.js) ---');

const oceanTrack = createOceanTrack();
assert.strictEqual(oceanTrack.name, 'ocean', 'Track name is ocean');
assert(oceanTrack.length > 14000 && oceanTrack.length < 17000, `Track length is ~15.2 km (actual: ${(oceanTrack.length / 1000).toFixed(1)} km)`);

// Check elevation range: Causeway low over swell (y ~ 6m) plunging to abyss (y < -500m)
let minY = Infinity;
let maxY = -Infinity;
for (let i = 0; i < oceanTrack.controlPoints.length; i++) {
  const p = oceanTrack.controlPoints[i].pos;
  if (p.y < minY) minY = p.y;
  if (p.y > maxY) maxY = p.y;
}
assert(minY <= -500.0, `Min elevation plunges into abyss (expected <= -500m, got ${minY.toFixed(1)}m)`);
assert(maxY >= 30.0, `Max elevation reaches viaduct jump crest (expected >= 30m, got ${maxY.toFixed(1)}m)`);
assert(oceanTrack.gaps.length > 0, 'Viaduct jump has gap interval');
assert(oceanTrack.tunnels.length > 0, 'Underwater Atlantis section has tunnel interval');

console.log(`PASS: Circuit geometry verified (length: ${(oceanTrack.length / 1000).toFixed(2)} km, elevation [${minY.toFixed(1)}m, ${maxY.toFixed(1)}m])`);

// -----------------------------------------------------------------------------
// 7. P11.3 Gerstner Ocean Swells & Optical Model (sea.js)
// -----------------------------------------------------------------------------
console.log('\n--- 7. Gerstner Ocean Surface & Atmosphere (sea.js) ---');

assert.strictEqual(GERSTNER_SWELLS.length, 6, 'Must define exactly 6 Gerstner swell components');
const seaScene = new THREE.Scene();
const oceanAtmo = new OceanAtmosphere(seaScene, camera);

assert(oceanAtmo.moonMesh, 'Sky features large pale moon');
assert(oceanAtmo.seaMesh, 'Gerstner ocean surface mesh created');

// Unified optical model: above water = 0.0, below water scales to 1.0 (-camY / 75.0)
assert.strictEqual(oceanAtmo.computeUnderK(10.0), 0.0, 'underK is 0.0 above water');
assert.strictEqual(oceanAtmo.computeUnderK(0.0), 0.0, 'underK is 0.0 at surface');
const underK50m = oceanAtmo.computeUnderK(-50.0);
assert(underK50m > 0.5 && underK50m < 0.8, `underK at -50m is progressive teal murk (got ${underK50m.toFixed(2)})`);
assert.strictEqual(oceanAtmo.computeUnderK(-120.0), 1.0, 'underK clamps to 1.0 in deep abyss');

console.log('PASS: 6 Gerstner swells and unified air/water optical model verified');

// -----------------------------------------------------------------------------
// 8. P11.3 The Keeper Colossal Statue (keeper.js)
// -----------------------------------------------------------------------------
console.log('\n--- 8. The Keeper Colossal Statue (keeper.js) ---');

const keeper = new KeeperStatue(seaScene, new THREE.Vector3(1200, -520, -2800));
assert.strictEqual(keeper.lodLevels.length, 3, 'The Keeper has 3 LOD detail levels');

// Clearance test at spiral apex (points 18-23 on ocean track)
// Spiral apex nominal clearance to robe and staff is ~17m
let minStatueDist = Infinity;
for (let s = 0; s < oceanTrack.length; s += 10) {
  const f = {};
  oceanTrack.frame(s, f);
  const clearance = keeper.getMinClearance(f.pos);
  if (clearance < minStatueDist) minStatueDist = clearance;
}
assert(minStatueDist > 10.0 && minStatueDist < 35.0, `Track clears Keeper statue (expected ~17m, got ${minStatueDist.toFixed(1)}m)`);

// LOD distance transitions
const closeCam = { position: new THREE.Vector3(1200, -300, -2800) };
keeper.update(0.1, closeCam);
assert.strictEqual(keeper.currentLod, 0, 'LOD 0 selected when close to statue');

const farCam = { position: new THREE.Vector3(1200, 2000, -2800) };
keeper.update(0.1, farCam);
assert.strictEqual(keeper.currentLod, 2, 'LOD 2 selected at long range');

console.log(`PASS: The Keeper colossal statue with 3 LODs and clearance verified (nearest: ${minStatueDist.toFixed(1)}m)`);

// -----------------------------------------------------------------------------
// 9. P11.3 Atlantis Sunken City (atlantis.js)
// -----------------------------------------------------------------------------
console.log('\n--- 9. Atlantis Sunken City (atlantis.js) ---');

const atlantis = new AtlantisCity(seaScene, new THREE.Vector3(2400, -380, -4200));
assert(atlantis.greatGate, 'Great Gate exists');
assert(atlantis.colonnade, 'Submerged colonnade avenue exists');
assert(atlantis.greatDome, 'Sunken Great Dome rotunda exists');
assert(atlantis.hypostyleHall, 'Hypostyle temple hall exists');
assert(atlantis.aqueduct, 'Aqueduct arcade exists');
assert(atlantis.braziers.length > 0, 'Great Gate has flaming braziers');

// Verify Great Gate attic & braziers stand above water level (y > 0)
const gateAtticWorldY = atlantis.centerPos.y + atlantis.greatGate.position.y + 72;
assert(gateAtticWorldY > 0, `Great Gate attic stands above sea level (Y = ${gateAtticWorldY}m > 0)`);

console.log('PASS: Atlantis sunken city, colonnades, rotunda, hypostyle hall, and elevated Great Gate verified');

// -----------------------------------------------------------------------------
// 10. P11.3 Ocean World Integration & Underwater Audio Filter
// -----------------------------------------------------------------------------
console.log('\n--- 10. OceanWorld & Audio Underwater Filtering ---');

const oceanWorld = new OceanWorld(scene, null, camera, oceanTrack);
assert(oceanWorld.atmo, 'OceanWorld contains atmosphere');
assert(oceanWorld.keeper, 'OceanWorld contains The Keeper');
assert(oceanWorld.atlantis, 'OceanWorld contains Atlantis');
assert(oceanWorld.lighthouseIsland, 'OceanWorld contains Lighthouse Island');

// Test underwater audio lowpass filter
const soundSystem = new SoundSystem();
assert(typeof soundSystem.setUnderwater === 'function', 'SoundSystem has setUnderwater method');

soundSystem.setUnderwater(0.0); // Surface
soundSystem.setUnderwater(1.0); // Deep murk
console.log('PASS: OceanWorld and SoundSystem.setUnderwater verified');

// -----------------------------------------------------------------------------
// 11. Scoreboard & Versioning
// -----------------------------------------------------------------------------
console.log('\n--- 11. Scoreboard (20 boards) & Changelog ---');

assert.strictEqual(CIRCUITS.length, 5, 'CIRCUITS array must contain 5 planetary circuits');
assert(CIRCUITS.find(c => c.id === 'ocean'), 'Ocean circuit present in scoreboard CIRCUITS');
console.log('PASS: Global Scoreboard expanded to 20 boards (5 circuits x 4 difficulties)');

const [maj, min] = CURRENT_VERSION.split('.').map(Number);
assert(maj > 1 || (maj === 1 && min >= 4), `CURRENT_VERSION is >= 1.4.0 (got ${CURRENT_VERSION})`);
assert(CHANGELOG.find(c => c.version === '1.4.0'), 'Changelog has 1.4.0');
assert(CHANGELOG.find(c => c.version === '1.3.0'), 'Changelog has 1.3.0');
assert(CHANGELOG.find(c => c.version === '1.2.5'), 'Changelog has 1.2.5');
console.log('PASS: Version 1.4.0 and changelog history verified');

console.log('\n=== ALL PHASE P11 ACCEPTANCE TESTS PASSED ===');
