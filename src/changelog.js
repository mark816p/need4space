// src/changelog.js — Version registry and release changelog (newest first)
// Why: The title screen and settings menu show the latest version and patch notes

export const CHANGELOG = [
  {
    version: '1.1.0',
    title: 'Four Worlds',
    date: '2026-10-18',
    notes: [
      'Four distinct worlds: Orbital Station (Space), Forest Moon, Ice Planet, and Desert Planet',
      'Difficulty tier overhaul: Easy, Normal, Hard, and Brutal with calibrated rival hierarchies and player perks',
      'Ice Planet: 14 km glacial circuit with crystal garden, 270m crevasse dive, glacier cave, and blizzard snow streaks',
      'Desert Planet: 14.3 km arid gorge with hollow fallen skyscraper, sandstone arches, two chasm jumps, and simoom sandstorm',
      'Forest Moon: 13.8 km jungle route with floating island crest jump, waterfall chasm, verdant loop, and colossal reptile skeleton',
      'Atmospheric effects: GPU blizzard and sandstorm particle volumes, crystal facets, and post-processing light shaft filtering',
      'Controls & ergonomics: Gentle cornering assistance and reduced wall scrape cost on Easy; drift mechanics dormant by default',
      'Interactive menu controls and comprehensive release notes viewer'
    ]
  },
  {
    version: '1.0.1',
    title: 'Ship It',
    date: '2024-10-14',
    notes: [
      'Laptop mode with adaptive dynamic resolution and pass degradation',
      'Shader warm-up precompilation eliminating first-lap hitches',
      'Touch and gamepad virtual controls for mobile and handheld devices',
      'Web manifest and social metadata for offline and standalone play'
    ]
  },
  {
    version: '1.0',
    title: 'First flight',
    date: '2024-10-11',
    notes: [
      'The Feather S1, eight rivals and the space circuit'
    ]
  }
];

export const CURRENT_VERSION = CHANGELOG[0].version;
