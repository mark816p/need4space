// src/changelog.js — Version registry and release changelog (newest first)
// Why: The title screen and settings menu show the latest version and patch notes

export const CHANGELOG = [
  {
    version: '1.2.0',
    title: 'Graphics Presets & Visual Polish',
    date: '2026-10-18',
    notes: [
      'Graphics Quality Presets: Low (Laptop mode: DPR 1.0, AO/SSR off), Balanced (DPR 1.25, AO on), and High (DPR 1.5, full AO/SSR/Bloom) with Custom override detection',
      'Zero-hitch preset switching: asynchronous mid-session shader rebuilds that compile scene and post-processing materials without race hitches',
      'Derelict Colossus lighting overhaul: baked fixtures with emissive lenses visible up to 1.8 km, structural hangers, and wall lights strictly anchored to standing frames',
      'Procedural Space Ring Station in orbit: central docking hub, comms array, 6 structural truss spokes, and rotating habitat ring with illuminated windows and hazard strobes',
      'Canyon AO stabilization and terrain masking: desert dunes tagged noAO to eliminate horizon ghosting, stabilized AO on steep canyon walls',
      'Engine heat shimmer pass: screen-space refractive distortion ripple behind active ship exhaust nozzles',
      'Deck-aware chase camera: track frame sampling and elevation clamping prevents camera from dipping below the road on crests and rolling straights',
      'Engine trail puff mode: expanding billboard discs with non-linear soft alpha falloff',
      'Softened rival taillights: warm tinted glow sprites and calibrated point-light punch in dark chambers',
      'Eliminated z-fighting on start line and lane divider lights via polygon offset'
    ]
  },
  {
    version: '1.1.1',
    title: 'Global Scoreboard & Perf Campaign',
    date: '2026-10-18',
    notes: [
      'Global Scoreboard: 16 cross-circuit leaderboards with dual-mode storage (Local JSON and GitHub-backed REST API)',
      'Automated conflict recovery: HTTP 409 re-fetch and merge keeping fastest personal time and best lap',
      'Race results integration: pilot name entry, time registration, and persistent local highlighting',
      'GTAO optimization: normal override material caching by program key and non-mesh occluder isolation',
      'Web Worker Pool architecture: background procedural heightmap generation off the render thread',
      'Terrain baking system: asynchronous texture loader with content hashing and procedural fallback',
      'Brand wordmark and difficulty-specific SVG rank badges (Easy, Normal, Hard, Brutal)'
    ]
  },
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
