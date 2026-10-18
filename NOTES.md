# Need4Space — Project Tracking & Notes

## Phases Progress
- [x] P0 — The v1.0 Game (space circuit, Feather S1, 8 rivals, HUD, menu, audio, music, post)
  - [x] P0.1 Scaffold, server, loader, noise
  - [x] P0.2 Space backdrop (space.js, celestial.js)
  - [x] P0.3 Track class (track.js)
  - [x] P0.4 Track meshes, deck and hull textures (deck.js, hull.js, rock.js)
  - [x] P0.5 Ship + free flight (ship.js, shipmodels.js, flight.js)
  - [x] P0.6 TrackRacer physics (track.js)
  - [x] P0.7 Race + AI (race.js)
  - [x] P0.8 Post pipeline (post.js, look.js, composer)
  - [x] P0.9 Audio and music (audio.js, music.js)
  - [x] P0.10 Input, camera, HUD, FX, menu, settings
- [x] P1 — Ship It: Pages, Performance, Loading, Laptop Mode, Mobile
- [x] P2 — Forest Moon (foresttrack.js, atmo.js, abyss.js, islands.js, flora.js, water.js, creatures.js, overgrowth.js, skeleton.js, forestworld.js, circuit selector, lens water & light shaft post passes)
- [x] P3 — Ice Planet (icetrack.js, frost.js, glacier.js, spires.js, blizzard.js, storm.js, iceworld.js, circuit selector entry)
- [x] P4 — Derelict v1 & 56m Road (wreckplan.js, wreckzones.js, wreck.js, 56m road width, dynamic headlights, space circuit derelict threading)
- [x] P5 — Drift, Gravity Flips, Air Pitch (TrackRacer.drifting=false, gravity flips with 180 turnover and flipFields, airPitch=14 m/s2, camera rollFollow=1)
- [x] P6 — Ice Shelf Crevasse & Desert Planet (shelf.js, ice 14km lap with crevasse & dual gravity flips, desert.js, deserttrack.js, dunes.js, sandstone.js, ruins.js, haze.js, simoom.js, 14.3km desert circuit, sandstorm closed-form optical depth)
- [x] P7 — Forest Cave & Derelict Colossus (cave.js, 2km hollow hill swept tube, underground lake, slalom columns, skull flips, 26.6km space circuit, 12km Colossus, upside-down hold, rack towers, barbette turrets, graveyards, HUD drift/boost overflow)
- [x] P8 — Playtest Tuning, License, v1.1 "Four Worlds" (difficulty tiers & player perks, Four Worlds AI median lap-time ordering, track geometry polish across all 4 circuits, v1.1 What's New modal, interactive menu hints, license & copyright)
- [x] P9 — Global Scoreboard & Perf Campaign (dual-mode Local JSON / GitHub REST API store with HTTP 409 conflict recovery, 16 leaderboards across 4 circuits x 4 difficulties, zero race-loop overhead polling, pilot name persistence, GTAO normal material caching & occluder isolation, Web Worker Pool procedural bakes, difficulty SVG badges and brand wordmark)
- [x] P10 — v1.2 Global Scoreboard & Graphics Presets (quality presets Low/Balanced/High with Custom override detection, mid-session zero-hitch async shader rebuilds, derelict lighting with 1.8km lenses and frame-anchored hangers, procedural space ring station with 6 truss spokes and rotating habitat ring, canyon AO stabilization & dunes noAO masking, engine heat shimmer pass, deck-aware chase camera clamping, trail puff mode with soft expanding billboard discs, softened rival taillights in dark, and polygon offset for zero z-fighting)
- [x] P11 — v1.2.5 The Broken Giant, Comet R1, Showroom, Ocean Planet (12km fractured dreadnought colossus, detailed emitter pylons, road deck bounce light setDeckLight, Comet R1 titanium manta with 18-tooth folding petals, 3D Ship Showroom modal with black glass turntable and softbox lights, 15.2km Drowned World night ocean circuit, 6 Gerstner swells, unified air/water optical model underK, The Keeper colossal statue with 3 LODs and nominal 17m road clearance, Atlantis sunken city of pale stone, underwater audio lowpass filtering, 20 scoreboard boards)
- [x] P12 — Ocean Polish, Airbrake Charge, Anvil H1, Liveries (v1.4.1 - v1.7.0: low causeway raised to 8.5m clear of swell, barrel roll apex at 48m, focused moon glade column, road dive waterline foam, 12s wet ship drying model, living ocean seabed pinnacles/kelp/hydrothermal vents/fish shoals/lanternfish/crabs, sea life dolphins/60m leviathan/jellyfish/seabirds/ripples, the Kraken on grid stack with amber eyes and writhing arms, alien fluted columns ring 650m-1500m tall with pulsing cyan veins, storm rain streaks and road puddles with underwater shutoff, airbrake charge FSM 1.0s hold / 3.0s recharge with HUD meter, The Anvil H1 heavy armoured craft with dual pulse rings/shock diamonds/orbiting magnet balls/anti-dip corner safety clamping, multi-ship livery registry with 3 paints per ship and BAKE tag ?b=2, showroom livery selector with Left/Right cycling)
- [x] P13 — Damage, Mixed Fleet, Aces, The Slam (v1.8.0 - v1.11.1: class-differentiated shield pools and armor resistances, damageCooldown with 3.5s delay and 16 HP/s shield regeneration, kinetic wall scraping and collision damage with debounce cooldown, disintegration explosion on 0 HP with 120-fragment radial physics and 2.2s automatic track centerline respawn, HUD shield gauge with warning amber <50% and critical pulsing red <25%, cockpit 880/660 Hz alarm klaxon and red screen vignette pulsing, 3x3x3 mixed fleet grid across Feather S1, Comet R1, and Anvil H1 models for all 9 teams with class kinematics and procedural liveries, 9 named ace pilot personas with specialized driving personalities: aggressive Slammers, straightaway Speeders, and optimal-line Apex racers, lateral sideswipe slam thrust mechanic triggered on Space or double-tap steer with 10s cooldown delivering directional knockback and class-scaled impact damage to defenders with minor recoil, procedural audio synthesis for critical alarm, explosion detonation, and metallic slam impact crunch)

## Assumptions
- CDN imports use jsDelivr with three.js r170 (`three`, `three/addons/`, `meshoptimizer`).
- Test hooks `window.__feather` provide `state()`, `advance(dt)`, and `shot(name)` for headless verification.
- Assets not loaded from external binary files are procedurally generated in WebGL, Canvas, and WebAudio, with fallback loaders prepared for GLB assets.
- Owner copyright placeholder is `<OWNER>`.
