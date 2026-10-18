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
- [ ] P11 — v1.2.5 The Broken Giant, Comet R1, Showroom, Ocean Planet
- [ ] P12 — Ocean Polish, Airbrake Charge, Anvil H1, Liveries
- [ ] P13 — Damage, Mixed Fleet, Aces, The Slam (v1.8.0 - v1.11.1)

## Assumptions
- CDN imports use jsDelivr with three.js r170 (`three`, `three/addons/`, `meshoptimizer`).
- Test hooks `window.__feather` provide `state()`, `advance(dt)`, and `shot(name)` for headless verification.
- Assets not loaded from external binary files are procedurally generated in WebGL, Canvas, and WebAudio, with fallback loaders prepared for GLB assets.
- Owner copyright placeholder is `<OWNER>`.
