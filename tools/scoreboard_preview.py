#!/usr/bin/env python3
"""
tools/scoreboard_preview.py
Seeds 10 distinct pilot aliases per board for all 16 boards for local preview and development.
Refuses to seed if remote GitHub mode is active to prevent accidental remote overwrites.
"""
import os
import sys

# Ensure project root is importable even when running python with -I flag
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from scoreboard import ScoreStore, VALID_MAPS, VALID_DIFFICULTIES

PILOT_NAMES = [
    "Viper-01", "GhostRider", "AeroKnight", "NovaStrike", "Blaze",
    "Phantom", "Solaris", "ApexPredator", "IronClad", "Velocity"
]

CIRCUITS = ["space", "forest", "ice", "desert"]
DIFFICULTIES = ["easy", "normal", "hard", "brutal"]

BASE_TIMES = {
    "space": 105.0,
    "forest": 55.0,
    "ice": 54.0,
    "desert": 56.5
}

DIFF_DELTAS = {
    "easy": 4.0,
    "normal": 2.0,
    "hard": 0.5,
    "brutal": 0.0
}


def main():
    store = ScoreStore()

    if store.is_github:
        print("[ERROR] Scoreboard is configured in GitHub mode (NEED4SPACE_SCOREBOARD_REPO).")
        print("Refusing to seed remote repository with preview test data.")
        sys.exit(1)

    print("Seeding local scoreboard (.local/scoreboard.json) with 10 pilots across 16 boards...")

    total_seeded = 0
    for circuit in CIRCUITS:
        base_lap = BASE_TIMES.get(circuit, 60.0)
        for diff in DIFFICULTIES:
            diff_add = DIFF_DELTAS.get(diff, 0.0)
            for idx, name in enumerate(PILOT_NAMES):
                # Ascending times with staggered variation
                lap_time = round(base_lap + diff_add + (idx * 0.85), 3)
                lap1 = round(lap_time + 0.3, 3)
                lap2 = round(lap_time - 0.2, 3)
                lap3 = round(lap_time + 0.1, 3)
                total_time = round(lap1 + lap2 + lap3, 3)
                best_lap = min(lap1, lap2, lap3)
                points = max(10, (10 - idx) * 20)

                payload = {
                    "map": circuit,
                    "difficulty": diff,
                    "name": name,
                    "total": total_time,
                    "best": best_lap,
                    "points": points,
                    "laps": [lap1, lap2, lap3],
                    "ship": "feather"
                }

                res = store.submit(payload)
                if res.get("success"):
                    total_seeded += 1
                else:
                    print(f"Failed to seed {name} for {circuit}-{diff}: {res.get('message')}")

    print(f"[SUCCESS] Seeded {total_seeded} pilot records across 16 leaderboards.")
    print("Local scoreboard ready for UI preview at .local/scoreboard.json")


if __name__ == "__main__":
    main()
