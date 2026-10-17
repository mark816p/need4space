# Need4Space — Project Tracking & Notes

## Phases Progress
- [ ] P0 — The v1.0 Game (space circuit, Feather S1, 8 rivals, HUD, menu, audio, music, post)
  - [x] P0.1 Scaffold, server, loader, noise
  - [x] P0.2 Space backdrop (space.js, celestial.js)
  - [x] P0.3 Track class (track.js)
  - [x] P0.4 Track meshes, deck and hull textures (deck.js, hull.js, rock.js)
  - [x] P0.5 Ship + free flight (ship.js, shipmodels.js, flight.js)
  - [x] P0.6 TrackRacer physics (track.js)
  - [x] P0.7 Race + AI (race.js)
  - [x] P0.8 Post pipeline (post.js, look.js, composer)
  - [x] P0.9 Audio and music (audio.js, music.js)
  - [ ] P0.10 Input, camera, HUD, FX, menu, settings
- [ ] P1 — Ship It: Pages, Performance, Loading, Laptop Mode, Mobile
- [ ] P2 — Forest Moon
- [ ] P3 — Ice Planet
- [ ] P4 — Derelict v1 & 56m Road
- [ ] P5 — Drift, Gravity Flips, Air Pitch
- [ ] P6 — Ice Shelf Crevasse & Desert Planet
- [ ] P7 — Forest Cave & Derelict Colossus
- [ ] P8 — Playtest Tuning, License, v1.1 "Four Worlds"
- [ ] P9 — Global Scoreboard & Perf Campaign
- [ ] P10 — v1.2 Global Scoreboard & Graphics Presets
- [ ] P11 — v1.2.5 The Broken Giant, Comet R1, Showroom, Ocean Planet
- [ ] P12 — Ocean Polish, Airbrake Charge, Anvil H1, Liveries
- [ ] P13 — Damage, Mixed Fleet, Aces, The Slam (v1.8.0 - v1.11.1)

## Assumptions
- CDN imports use jsDelivr with three.js r170 (`three`, `three/addons/`, `meshoptimizer`).
- Test hooks `window.__feather` provide `state()`, `advance(dt)`, and `shot(name)` for headless verification.
- Assets not loaded from external binary files are procedurally generated in WebGL, Canvas, and WebAudio, with fallback loaders prepared for GLB assets.
- Owner copyright placeholder is `<OWNER>`.
