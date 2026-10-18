// src/settings.js — User settings management, graphics presets, and persistent storage
// Why: Robust options model with localStorage persistence and instant runtime reconfiguration
// "b3081c8 Graphics quality presets (Low = old Laptop mode, Balanced, High = defaults; a row changed by hand shows Custom)"

import { PRESETS, detectPreset, PRESET_KEYS } from './quality.js';

export const DEFAULT_SETTINGS = {
  preset: 'high', // 'low' | 'balanced' | 'high' | 'custom'
  quality: 'high', // 'low' | 'balanced' | 'high' | 'custom'
  difficulty: 'easy', // Easy difficulty as default ('easy' | 'normal' | 'hard' | 'brutal')
  laptopMode: false, // Performance optimization for low-power or integrated GPUs
  enableAO: true,
  enableSSR: true,
  enableBloom: true,
  enableLook: true,
  canyonAO: true,
  heatShimmer: true,
  engineHeat: true,
  engineTrails: 'ribbon', // 'ribbon' | 'puffs'
  derelictLamps: true,
  fov: 65,
  airPitch: true, // Nose control in the air (PITCH_AIR = 14 m/s²)
  drift: false, // Drift off by default (code dormant behind TrackRacer.drifting)
  volumeMaster: 0.9,
  volumeSFX: 0.85,
  volumeEngine: 0.8,
  volumeMusic: 0.65,
  cameraMode: 'chase',
  colossus: true, // The Broken Giant space scenery
  deckLight: true, // Ships lit by road deck
  hullShadows: true, // Ship seam shadows from baked occlusion
  engineFaces: 'dark', // 'dark' | 'glow'
  shipPaint: 'gloss', // 'gloss' | 'classic'
  shipTrim: 'satin', // 'satin' | 'matte'
  shipAccents: true, // Engine-color accent light strips
  selectedShip: 'feather', // 'feather' | 'rocket' | 'heavy'
  waterSpray: true,
  oceanStorm: true,
  oceanLightning: true,
  plankton: true,
  seaSwells: true,
  // Ice planet switches
  iceSnow: true,
  iceDust: true,
  aurora: true,
  iceStorm: true,
  iceGeysers: true
};

const STORAGE_KEY = 'need4space_settings';

export class SettingsManager {
  constructor() {
    this.data = { ...DEFAULT_SETTINGS };
    this.load();
  }

  load() {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.data = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn('[Settings] Failed to read localStorage:', e);
    }
    // Synchronize detected preset
    this.data.preset = detectPreset(this.data);
  }

  save() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('[Settings] Failed to write localStorage:', e);
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    // If an individual visual key was changed by hand, update preset detection
    if (PRESET_KEYS.includes(key)) {
      this.data.preset = detectPreset(this.data);
    }
    this.save();
  }

  has(key) {
    return this.data[key] !== undefined;
  }

  apply(app) {
    if (!app) return;

    // 1. Audio Volumes
    if (app.audio) {
      if (app.audio.masterGain) app.audio.masterGain.gain.value = this.data.volumeMaster;
      if (app.audio.sfxGain) app.audio.sfxGain.gain.value = this.data.volumeSFX;
      if (app.audio.engineGain) app.audio.engineGain.gain.value = this.data.volumeEngine;
      if (app.audio.musicGain) app.audio.musicGain.gain.value = this.data.volumeMusic;
    }

    // 2. Graphics Quality Presets & Dynamic Resolution
    const isLaptop = !!this.data.laptopMode;
    const presetId = this.data.preset || 'high';
    const preset = PRESETS[presetId] || PRESETS.high;

    if (app.renderer) {
      let dpr = 1.0;
      if (isLaptop || presetId === 'low') {
        dpr = 1.0;
      } else {
        const winDpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
        dpr = Math.min(winDpr, preset.dpr || 1.5);
      }
      app.renderer.setPixelRatio(dpr);
    }

    if (app.post) {
      app.post.enabled = true;
      app.post.enableAO = isLaptop ? false : (this.data.enableAO !== undefined ? this.data.enableAO : preset.enableAO);
      app.post.enableSSR = isLaptop ? false : (this.data.enableSSR !== undefined ? this.data.enableSSR : preset.enableSSR);
      app.post.enableBloom = this.data.enableBloom !== undefined ? this.data.enableBloom : preset.enableBloom;
      app.post.enableLook = this.data.enableLook !== undefined ? this.data.enableLook : preset.enableLook;
    }

    // 3. Camera FOV
    if (app.cameraController) {
      app.cameraController.baseFov = this.data.fov;
    }
  }
}

export const Settings = SettingsManager;
