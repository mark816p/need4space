// src/settings.js — User settings management, graphics presets, and persistent storage
// Why: Robust options model with localStorage persistence and instant runtime reconfiguration

export const DEFAULT_SETTINGS = {
  quality: 'high', // 'low' | 'medium' | 'high' | 'ultra'
  difficulty: 'hard', // 'normal' | 'hard' | 'brutal'
  laptopMode: false, // Performance optimization for low-power or integrated GPUs
  fov: 65,
  airPitch: true, // Nose control in the air (PITCH_AIR = 14 m/s²)
  volumeMaster: 0.9,
  volumeSFX: 0.85,
  volumeEngine: 0.8,
  volumeMusic: 0.65,
  cameraMode: 'chase',
  // Ice planet switches
  iceSnow: true,
  iceDust: true,
  aurora: true,
  iceStorm: true,
  iceGeysers: true,
  canyonAO: true
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
    this.save();
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

    // 2. Graphics Quality Presets & Laptop Mode
    const isLaptop = !!this.data.laptopMode;
    const q = this.data.quality;

    if (app.renderer) {
      let dpr = 1.0;
      if (isLaptop) {
        dpr = 1.0;
      } else {
        const winDpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
        dpr = (q === 'ultra') ? 2.0 : (q === 'high' ? Math.min(winDpr, 1.5) : 1.0);
      }
      app.renderer.setPixelRatio(dpr);
    }

    if (app.post) {
      if (isLaptop) {
        // Laptop Mode: downscale and disable heavy passes (SSR, GTAO), keep lightweight bloom and look composite
        app.post.enabled = true;
        app.post.enableAO = false;
        app.post.enableSSR = false;
        app.post.enableBloom = true;
        app.post.enableLook = true;
      } else if (q === 'low') {
        app.post.enabled = false;
      } else if (q === 'medium') {
        app.post.enabled = true;
        app.post.enableAO = true;
        app.post.enableSSR = false;
        app.post.enableBloom = true;
        app.post.enableLook = true;
      } else if (q === 'high' || q === 'ultra') {
        app.post.enabled = true;
        app.post.enableAO = true;
        app.post.enableSSR = true;
        app.post.enableBloom = true;
        app.post.enableLook = true;
      }
    }

    // 3. Camera FOV
    if (app.cameraController) {
      app.cameraController.baseFov = this.data.fov;
    }
  }
}
