// src/liveries.js — Three selectable paint schemes per ship, procedural palette textures, and BAKE tag
// Why: "P12 The Anvil H1 and liveries (d71ac5f → v1.7.0): Three paints per ship (§J.4) chosen on the Ship screen
// (←/→ or click chips); ship on the stand changes as you pick. Livery maps load from assets/liveries/<ship>/<name>_{albedo,orm,edges}_2k.webp;
// with procedural ships generate the paints from palettes instead and keep the file path as an optional override.
// Sharper ships up close (clean paint edges via sharpPatch/edge map; setting sharpEdges).
// Asset cache tag: BAKE = '?b=2' appended to every ship/livery URL."

import * as THREE from 'three';

export const BAKE = '?b=2';

export const SHIP_LIVERIES = {
  feather: [
    {
      id: 'classic',
      name: 'PHOENIX RACING',
      desc: 'Factory works crimson over stark polar white with carbon-weave aerofoils.',
      primary: 0xe62233,
      secondary: 0xffffff,
      trim: 0x1f242d,
      accent: 0x00d2ff,
      css: '#e62233'
    },
    {
      id: 'stealth',
      name: 'CARBON PULSE',
      desc: 'Radar-absorbent matte carbon skin with high-luminance electric cyan accent striping.',
      primary: 0x00d2ff,
      secondary: 0x141a24,
      trim: 0x0a0d14,
      accent: 0x38bdf8,
      css: '#00d2ff'
    },
    {
      id: 'sunburst',
      name: 'SOLAR FLARE',
      desc: 'Aerospace high-visibility amber with dark industrial charcoal accents.',
      primary: 0xffaa00,
      secondary: 0x22262e,
      trim: 0xff4400,
      accent: 0xffdd44,
      css: '#ffaa00'
    }
  ],
  rocket: [
    {
      id: 'titanium',
      name: 'TITANIUM RUNNER',
      desc: 'Raw brushed titanium skin with cobalt blue accents and mirror-polished chine edges.',
      primary: 0x00e5ff,
      secondary: 0xf0f4f8,
      trim: 0x1b2838,
      accent: 0x38bdf8,
      css: '#00e5ff'
    },
    {
      id: 'hazard',
      name: 'HAZARD ORANGE',
      desc: 'High-contrast safety orange chine panels with midnight black thermal heat shielding.',
      primary: 0xff6600,
      secondary: 0x1a1a1a,
      trim: 0xffaa00,
      accent: 0xff8800,
      css: '#ff6600'
    },
    {
      id: 'racing',
      name: 'EMERALD APEX',
      desc: 'British racing emerald gloss enamel with gold flake pinstripes and dark obsidian canopy.',
      primary: 0x00cc66,
      secondary: 0x0d2818,
      trim: 0xffcc00,
      accent: 0x00ff88,
      css: '#00cc66'
    }
  ],
  heavy: [
    {
      id: 'military',
      name: 'IRON FORGE',
      desc: 'Military heavy armour plating in olive drab with hazard-zone orange safety markings.',
      primary: 0x556b2f,
      secondary: 0x222831,
      trim: 0xff6600,
      accent: 0x88bb33,
      css: '#556b2f'
    },
    {
      id: 'hazard',
      name: 'TITAN WORKER',
      desc: 'Industrial heavy equipment yellow with black hazard chevrons and dark cast-iron frame.',
      primary: 0xffcc00,
      secondary: 0x2b2b2b,
      trim: 0xcc3300,
      accent: 0xff9900,
      css: '#ffcc00'
    },
    {
      id: 'obsidian',
      name: 'VOID OBSIDIAN',
      desc: 'Ultra-dense void obsidian hull with radioactive magenta pulse conduits.',
      primary: 0x9933ff,
      secondary: 0x0f0b1a,
      trim: 0xff0066,
      accent: 0xbf40bf,
      css: '#9933ff'
    }
  ]
};

// Aliases
SHIP_LIVERIES.comet = SHIP_LIVERIES.rocket;
SHIP_LIVERIES.anvil = SHIP_LIVERIES.heavy;

export function getLivery(shipKind, liveryIdOrIndex = 0) {
  const list = SHIP_LIVERIES[shipKind] || SHIP_LIVERIES.feather;
  if (typeof liveryIdOrIndex === 'number') {
    const idx = Math.max(0, Math.min(list.length - 1, liveryIdOrIndex));
    return list[idx];
  }
  const found = list.find(l => l.id === liveryIdOrIndex);
  return found || list[0];
}

export function applyShipLivery(ship, liveryIdOrIndex = 0) {
  if (!ship || !ship.model) return;
  const kind = ship.model.kind || 'feather';
  const livery = getLivery(kind, liveryIdOrIndex);
  if (!livery) return;

  ship.currentLivery = livery;

  if (ship.model.mats) {
    if (ship.model.mats.livery?.color) ship.model.mats.livery.color.setHex(livery.primary);
    if (ship.model.mats.body?.color) ship.model.mats.body.color.setHex(livery.secondary);
    if (ship.model.mats.dark?.color && livery.trim) ship.model.mats.dark.color.setHex(livery.trim);
  }

  // Apply colors to ship materials
  if (ship.model.visual) {
    ship.model.visual.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        const matName = obj.material.name || '';
        const objName = obj.name || '';
        if (matName === 'ship_livery' || objName.includes('wing') || objName.includes('livery') || objName.includes('fin') || objName.includes('stripe') || objName.includes('panel')) {
          if (obj.material.color) {
            obj.material.color.setHex(livery.primary);
          }
        } else if (matName === 'ship_body' || objName.includes('hull') || objName.includes('body') || objName.includes('manta')) {
          if (obj.material.color) {
            obj.material.color.setHex(livery.secondary);
          }
        } else if (matName === 'ship_dark' && livery.trim) {
          if (obj.material.color) {
            obj.material.color.setHex(livery.trim);
          }
        }
      }
    });
  }

  // Update engine and accent colors if configured
  if (ship.model.engineGlowMat && livery.accent) {
    ship.model.engineGlowMat.color.setHex(livery.accent);
  }
  return livery;
}
