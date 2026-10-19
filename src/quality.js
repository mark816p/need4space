// src/quality.js — Graphics quality presets, mid-session shader rebuilds, and custom override detection
// Why: "b3081c8 Graphics quality presets (Low = old Laptop mode, Balanced, High = defaults; a row changed by hand shows Custom)"
// "d52d979 preset change mid-session rebuilds every shader at once in the menu (High→Low was a 300 ms freeze + ~20 hitches in the race → none)"

export const PRESETS = {
  low: {
    id: 'low',
    name: 'LOW',
    label: 'Low (Perf)',
    laptopMode: true,
    dpr: 1.0,
    enableAO: false,
    enableSSR: false,
    enableBloom: true,
    enableLook: true,
    shadows: false,
    canyonAO: false,
    heatShimmer: false,
    engineHeat: false,
    engineTrails: 'puffs',
    derelictLamps: true,
    bloomThreshold: 0.90
  },
  balanced: {
    id: 'balanced',
    name: 'BALANCED',
    label: 'Balanced',
    laptopMode: false,
    dpr: 1.25,
    enableAO: true,
    enableSSR: false,
    enableBloom: true,
    enableLook: true,
    shadows: true,
    canyonAO: true,
    heatShimmer: true,
    engineHeat: true,
    engineTrails: 'puffs',
    derelictLamps: true,
    bloomThreshold: 0.85
  },
  high: {
    id: 'high',
    name: 'HIGH',
    label: 'High (Default)',
    laptopMode: false,
    dpr: 1.5,
    enableAO: true,
    enableSSR: true,
    enableBloom: true,
    enableLook: true,
    shadows: true,
    canyonAO: true,
    heatShimmer: true,
    engineHeat: true,
    engineTrails: 'ribbon',
    derelictLamps: true,
    bloomThreshold: 0.80
  },
  ultra: {
    id: 'ultra',
    name: 'ULTRA',
    label: 'Ultra (Cinematic)',
    laptopMode: false,
    dpr: 2.0,
    enableAO: true,
    enableSSR: true,
    enableBloom: true,
    enableLook: true,
    shadows: true,
    canyonAO: true,
    heatShimmer: true,
    engineHeat: true,
    engineTrails: 'ribbon',
    derelictLamps: true,
    bloomThreshold: 0.75
  }
};

export const QUALITY_PRESETS = PRESETS;

export const PRESET_KEYS = ['enableAO', 'enableSSR', 'enableBloom', 'enableLook', 'canyonAO', 'heatShimmer', 'laptopMode'];

export function detectPreset(settingsData) {
  if (!settingsData) return 'high';

  // 1. If explicit preset tag exists, verify if all its keys match
  if (settingsData.preset && PRESETS[settingsData.preset]) {
    const candidate = PRESETS[settingsData.preset];
    let match = true;
    for (const key of PRESET_KEYS) {
      if (settingsData[key] !== undefined && settingsData[key] !== candidate[key]) {
        match = false;
        break;
      }
    }
    if (match) return settingsData.preset;
  }

  // 2. Otherwise match against known presets in precedence order
  for (const id of ['low', 'balanced', 'high', 'ultra']) {
    const preset = PRESETS[id];
    if (!preset) continue;
    let match = true;
    for (const key of PRESET_KEYS) {
      if (settingsData[key] !== undefined && settingsData[key] !== preset[key]) {
        match = false;
        break;
      }
    }
    if (match) return id;
  }
  return 'custom';
}

export function applyPreset(presetId, settingsManager, app = null) {
  const preset = PRESETS[presetId];
  if (!preset) return false;

  settingsManager.set('laptopMode', preset.laptopMode);
  settingsManager.set('enableAO', preset.enableAO);
  settingsManager.set('enableSSR', preset.enableSSR);
  settingsManager.set('enableBloom', preset.enableBloom);
  settingsManager.set('enableLook', preset.enableLook);
  settingsManager.set('canyonAO', preset.canyonAO);
  settingsManager.set('heatShimmer', preset.heatShimmer);
  settingsManager.set('engineHeat', preset.engineHeat);
  settingsManager.set('engineTrails', preset.engineTrails);
  settingsManager.set('preset', presetId);
  settingsManager.set('quality', presetId);

  if (app) {
    settingsManager.apply(app);
    // Mid-session shader rebuild in menu to eliminate in-race stutter
    rebuildShaders(app);
  }
  return true;
}

export async function rebuildShaders(app) {
  if (!app) return;
  // Warming state: compile scene and post shaders simultaneously while menu is up
  try {
    if (app.renderer && app.scene && app.camera) {
      if (app.renderer.compileAsync) {
        await app.renderer.compileAsync(app.scene, app.camera);
      } else {
        app.renderer.compile(app.scene, app.camera);
      }
    }
    if (app.post && app.post.compileAsync && app.renderer) {
      await app.post.compileAsync(app.renderer);
    }
  } catch (err) {
    console.warn('[Quality] Shader rebuild notification:', err);
  }
}
