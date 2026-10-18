# NEED4SPACE

Anti-gravity racing in space, built with Three.js r170 and plain ES modules. Zero build step, zero bundler, zero runtime dependencies.

Copyright (c) 2026 <OWNER>. All rights reserved.

## Four Worlds (Circuits)

- **Orbital Station (Space — 26.6 km)**: High-speed orbit over gas giant Solaris IV. Threads the 12 km derelict Colossus through its engine bell, pulsing reactor hall, 150m vacuum break leap, upside-down hold, and barbette defense trench run.
- **Forest Moon (13.8 km)**: Lush canopy world with floating island crest jump, subterranean lake cavern through a hollow hill, 600m verdant loop, and inverted flight past a colossal reptile skeleton.
- **Ice Planet (14.0 km)**: Glacial wasteland featuring internal prism crystal facets, a 270m crevasse dive, glacier bore cave, sea floes gravity flips, and howling GPU blizzard snow streaks.
- **Desert Planet (14.3 km)**: Layered sandstone gorge under low WNW sunset, transit through a hollow fallen skyscraper, sandstone arches, two chasm jumps, and sweepers through a towering simoom sandstorm.

## Difficulty Tiers & Assistance

- **Easy (Default)**: Calibrated rival pace with active player cornering assistance toward the racing line and reduced wall friction penalty (`wallScrapeDamp: 0.2`, knocks are a fifth as costly).
- **Normal**: Balanced competitive pacing with standard physics response.
- **Hard**: Tight rival pack with aggressive boost pad utilization and precise racing lines.
- **Brutal**: Relentless competition pushing ships to their absolute physical adhesion limits.

## Running Locally

Run the static server:
```bash
python serve.py 8765
```
Then open `http://localhost:8765/` in your desktop or mobile browser.

## Controls

| Action | Keyboard | Gamepad | Touch |
| :--- | :--- | :--- | :--- |
| **Steer** | A / D or Left / Right (or Mouse) | Left Stick | Left Stick |
| **Throttle** | W or Up | Right Trigger (RT) / A | Right Stick Up |
| **Brake / Reverse** | S or Down | Left Trigger (LT) | Right Stick Down |
| **Airbrakes** | Q / E (or Z / X) | L1 / R1 | Right Stick Left / Right |
| **Boost** | Shift / Space | B / R2 | Boost Button |
| **Slam** | Space | X / R3 | Slam Button |
| **Camera View** | C | Y / D-Pad Up | Cam Button |
| **Toggle Free Flight** | G | D-Pad Down | - |
| **Respawn / Reset** | R | Back / Select | - |
| **Pause / Menu** | Escape | Start | Pause Button |
| **Settings** | O | - | - |
| **Help Card** | H | - | - |

## Audio Credits
Sound effects derived from Kenney CC0 Impact Sounds and Sci-Fi Sounds packs.
Music procedurally generated via WebAudio synthesis.

