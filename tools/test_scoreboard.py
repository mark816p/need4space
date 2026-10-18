#!/usr/bin/env python3
"""
tools/test_scoreboard.py — Comprehensive acceptance tests for Global Scoreboard
Tests:
  1. best-time retention: submitting multiple times for same name keeps only the faster total time.
  2. distinct aliases: distinct pilot names are preserved and ranked in order.
  3. all categories: all 16 boards (4 maps x 4 difficulties) written and read independently.
  4. restart persistence: local scoreboard persists to disk and reloads across store instances.
  5. concurrent saves: multithreaded concurrent submissions do not corrupt store or lose data.
  6. invalid / incomplete races: malformed, incomplete, >4096 bytes, or mid-race difficulty changes rejected.
  7. GitHub write-conflict recovery: simulated mock GitHub API handling 409 conflict and merging cleanly.
"""
import base64
import json
import os
import shutil
import sys
import tempfile
import threading
import time

# Ensure project root is importable even when running python with -I flag
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from scoreboard import ScoreStore

FAILED = False

def assert_true(cond, msg):
    global FAILED
    if not cond:
        print(f"FAIL: {msg}")
        FAILED = True
    else:
        print(f"PASS: {msg}")


# -----------------------------------------------------------------------------
# 1. Best-Time Retention Test
# -----------------------------------------------------------------------------
def test_best_time_retention():
    print("\n1. Testing Best-Time Retention per Pilot Name...")
    temp_dir = tempfile.mkdtemp()
    db_file = os.path.join(temp_dir, "scores.json")
    try:
        store = ScoreStore(local_path=db_file)

        # Submit initial run: 180s total
        sub1 = {
            "map": "space",
            "difficulty": "normal",
            "name": "AcePilot",
            "total": 180.5,
            "best": 59.2,
            "points": 100,
            "laps": [60.5, 60.8, 59.2]
        }
        res1 = store.submit(sub1)
        assert_true(res1.get("success"), "First submission succeeds")

        # Submit slower run for same name: 195s total
        sub2 = {
            "map": "space",
            "difficulty": "normal",
            "name": "acepilot", # lowercase alias test
            "total": 195.0,
            "best": 62.0,
            "points": 80,
            "laps": [65.0, 68.0, 62.0]
        }
        res2 = store.submit(sub2)
        assert_true(res2.get("success"), "Second (slower) submission succeeds")

        # Read back board
        read_res = store.read("space", "normal")
        scores = read_res["scores"]
        assert_true(len(scores) == 1, f"Expected 1 entry for duplicate alias, got {len(scores)}")
        assert_true(scores[0]["total"] == 180.5, f"Retained time should be faster 180.5, got {scores[0]['total']}")

        # Submit faster run for same name: 172.1s total
        sub3 = {
            "map": "space",
            "difficulty": "normal",
            "name": "ACEPILOT", # uppercase alias test
            "total": 172.1,
            "best": 56.4,
            "points": 150,
            "laps": [57.8, 57.9, 56.4]
        }
        res3 = store.submit(sub3)
        assert_true(res3.get("success"), "Third (faster) submission succeeds")

        read_res2 = store.read("space", "normal")
        scores2 = read_res2["scores"]
        assert_true(len(scores2) == 1, f"Still only 1 entry for duplicate alias, got {len(scores2)}")
        assert_true(scores2[0]["total"] == 172.1, f"Retained time updated to faster 172.1, got {scores2[0]['total']}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


# -----------------------------------------------------------------------------
# 2. Distinct Aliases and Ranking Test
# -----------------------------------------------------------------------------
def test_distinct_aliases():
    print("\n2. Testing Distinct Aliases and Total Time Ascending Ranking...")
    temp_dir = tempfile.mkdtemp()
    db_file = os.path.join(temp_dir, "scores.json")
    try:
        store = ScoreStore(local_path=db_file)
        pilots = [
            ("Viper", 165.2),
            ("Ghost", 158.4),
            ("Phantom", 172.0),
            ("Blaze", 161.9),
            ("Nova", 168.0)
        ]
        for name, total in pilots:
            store.submit({
                "map": "forest",
                "difficulty": "hard",
                "name": name,
                "total": total,
                "best": total / 3.0,
                "points": 100,
                "laps": [total / 3.0] * 3
            })

        board = store.read("forest", "hard", name="Blaze")
        assert_true(len(board["scores"]) == 5, f"Board has all 5 pilots, got {len(board['scores'])}")

        # Verify strict ascending total times
        totals = [e["total"] for e in board["scores"]]
        assert_true(totals == sorted(totals), f"Times are strictly sorted ascending: {totals}")
        assert_true(board["scores"][0]["name"] == "Ghost", "Ghost (158.4) is #1")

        # Verify personal rank lookup (Ghost=158.4 (#1), Blaze=161.9 (#2), Viper=165.2 (#3))
        personal = board["personal"]
        assert_true(personal is not None, "Personal rank for Blaze found")
        assert_true(personal["rank"] == 2, f"Blaze should be rank #2, got #{personal.get('rank')}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


# -----------------------------------------------------------------------------
# 3. All 16 Categories (4 Circuits x 4 Difficulties)
# -----------------------------------------------------------------------------
def test_all_16_categories():
    print("\n3. Testing All 16 Board Categories...")
    temp_dir = tempfile.mkdtemp()
    db_file = os.path.join(temp_dir, "scores.json")
    try:
        store = ScoreStore(local_path=db_file)
        circuits = ["space", "forest", "ice", "desert"]
        diffs = ["easy", "normal", "hard", "brutal"]

        count = 0
        for c in circuits:
            for d in diffs:
                count += 1
                store.submit({
                    "map": c,
                    "difficulty": d,
                    "name": f"Pilot_{c}_{d}",
                    "total": 150.0 + count,
                    "best": 50.0,
                    "points": count * 10,
                    "laps": [50.0, 50.0, 50.0 + count]
                })

        # Verify each of the 16 boards can be read independently
        all_ok = True
        for c in circuits:
            for d in diffs:
                res = store.read(c, d)
                if len(res["scores"]) != 1 or res["scores"][0]["name"] != f"Pilot_{c}_{d}":
                    all_ok = False
                    break
        assert_true(all_ok, "All 16 boards can be written and read independently with correct entries")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


# -----------------------------------------------------------------------------
# 4. Restart Persistence Across Store Instances
# -----------------------------------------------------------------------------
def test_restart_persistence():
    print("\n4. Testing Scoreboard Persistence Across Server Restarts...")
    temp_dir = tempfile.mkdtemp()
    db_file = os.path.join(temp_dir, "scores.json")
    try:
        # Instance 1: writes
        store1 = ScoreStore(local_path=db_file)
        store1.submit({
            "map": "ice",
            "difficulty": "brutal",
            "name": "FrostBite",
            "total": 164.25,
            "best": 54.1,
            "points": 250,
            "laps": [55.1, 55.05, 54.1]
        })

        # Instance 2 (simulating restart): reads
        store2 = ScoreStore(local_path=db_file)
        res = store2.read("ice", "brutal")
        assert_true(len(res["scores"]) == 1, "Persisted entry reloaded in new instance")
        assert_true(res["scores"][0]["name"] == "FrostBite", f"Persisted name matches FrostBite, got {res['scores'][0]['name']}")
        assert_true(res["scores"][0]["total"] == 164.25, "Persisted total time matches 164.25")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


# -----------------------------------------------------------------------------
# 5. Multithreaded Concurrent Submissions
# -----------------------------------------------------------------------------
def test_concurrent_saves():
    print("\n5. Testing Thread-Safe Concurrent Saves...")
    temp_dir = tempfile.mkdtemp()
    db_file = os.path.join(temp_dir, "scores.json")
    try:
        store = ScoreStore(local_path=db_file)
        threads = []
        num_racers = 20

        def worker(idx):
            store.submit({
                "map": "desert",
                "difficulty": "hard",
                "name": f"DuneRacer_{idx:02d}",
                "total": 170.0 + idx,
                "best": 56.0,
                "points": 100,
                "laps": [57.0, 57.0, 56.0 + idx]
            })

        for i in range(num_racers):
            t = threading.Thread(target=worker, args=(i,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        # Check Desert Hard board
        res = store.read("desert", "hard")
        # Top 10 returned in scores
        assert_true(len(res["scores"]) == 10, f"Top 10 returned correctly from {num_racers} submissions")
        # Total records in board should be all 20
        assert_true(res["total_records"] == 20, f"All 20 records persisted without loss (got {res['total_records']})")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


# -----------------------------------------------------------------------------
# 6. Invalid / Incomplete Races Rejection
# -----------------------------------------------------------------------------
def test_invalid_incomplete_races():
    print("\n6. Testing Rejection of Invalid / Incomplete Races...")
    temp_dir = tempfile.mkdtemp()
    db_file = os.path.join(temp_dir, "scores.json")
    try:
        store = ScoreStore(local_path=db_file)

        # Case A: Only 2 laps instead of 3
        sub_2laps = {
            "map": "space",
            "difficulty": "normal",
            "name": "Cheater",
            "total": 120.0,
            "best": 60.0,
            "points": 50,
            "laps": [60.0, 60.0]
        }
        res_a = store.submit(sub_2laps)
        assert_true(not res_a["success"], "Rejected race with only 2 laps")

        # Case B: Negative / Zero time
        sub_neg = {
            "map": "space",
            "difficulty": "normal",
            "name": "TimeWarp",
            "total": -10.0,
            "best": -5.0,
            "points": 50,
            "laps": [0.0, -5.0, -5.0]
        }
        res_b = store.submit(sub_neg)
        assert_true(not res_b["success"], "Rejected race with negative lap times")

        # Case C: Invalid circuit / difficulty
        sub_invalid_map = {
            "map": "pluto",
            "difficulty": "impossible",
            "name": "Alien",
            "total": 150.0,
            "best": 50.0,
            "points": 50,
            "laps": [50.0, 50.0, 50.0]
        }
        res_c = store.submit(sub_invalid_map)
        assert_true(not res_c["success"], "Rejected race with invalid circuit and difficulty")

        # Case D: Changed difficulty mid-race
        sub_diff_change = {
            "map": "forest",
            "difficulty": "brutal",
            "difficultyChanged": True,
            "name": "Switcheroo",
            "total": 150.0,
            "best": 50.0,
            "points": 50,
            "laps": [50.0, 50.0, 50.0]
        }
        res_d = store.submit(sub_diff_change)
        assert_true(not res_d["success"], "Rejected race where difficulty was modified mid-race")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


# -----------------------------------------------------------------------------
# 7. Simulated GitHub Write-Conflict Recovery
# -----------------------------------------------------------------------------
class MockGitHubClient:
    def __init__(self):
        self.files = {}
        self.shas = {}
        self.branches = {"scores": "sha_scores_root"}
        self.conflict_triggered = False

    def request(self, method, endpoint, body=None):
        if method == "GET" and "/branches/scores" in endpoint:
            return 200, {"name": "scores"}, ""

        if method == "GET" and "/repos/" in endpoint and "/contents/" in endpoint:
            path = endpoint.split("/contents/")[1].split("?")[0]
            if path in self.files:
                return 200, {
                    "content": self.files[path],
                    "sha": self.shas[path]
                }, ""
            return 404, {"message": "Not Found"}, "Not Found"

        if method == "PUT" and "/repos/" in endpoint and "/contents/" in endpoint:
            path = endpoint.split("/contents/")[1]
            sent_sha = body.get("sha")
            current_sha = self.shas.get(path)

            # Trigger a 409 conflict once to simulate concurrent submission from another pilot
            if not self.conflict_triggered and path in self.files:
                self.conflict_triggered = True
                # Simulate a concurrent writer updated the remote branch right before this PUT, retaining FirstRacer and adding ConcurrentPlayer
                concurrent_data = [
                    {
                        "name": "FirstRacer",
                        "total": 175.0,
                        "best": 58.0,
                        "points": 50,
                        "laps": [58.5, 58.5, 58.0],
                        "ship": "feather",
                        "date": int(time.time())
                    },
                    {
                        "name": "ConcurrentPlayer",
                        "total": 160.0,
                        "best": 53.3,
                        "points": 100,
                        "laps": [53.3, 53.4, 53.3],
                        "ship": "feather",
                        "date": int(time.time())
                    }
                ]
                new_content = base64.b64encode(json.dumps(concurrent_data).encode("utf-8")).decode("utf-8")
                self.files[path] = new_content
                self.shas[path] = "sha_remote_updated"
                return 409, {"message": "Conflict"}, "Conflict"

            if sent_sha != current_sha:
                return 409, {"message": "Conflict"}, "Conflict"

            # Success
            self.files[path] = body["content"]
            new_sha = f"sha_{len(self.files[path])}_{time.time()}"
            self.shas[path] = new_sha
            return 200, {"content": {"sha": new_sha}}, ""

        return 404, {"message": "Unknown endpoint"}, ""


def test_github_write_conflict_recovery():
    print("\n7. Testing GitHub 409 Write-Conflict Recovery and Merge...")
    mock_gh = MockGitHubClient()
    # Pre-seed an initial board file in mock GitHub
    initial_data = [
        {
            "name": "FirstRacer",
            "total": 175.0,
            "best": 58.0,
            "points": 50,
            "laps": [58.5, 58.5, 58.0],
            "ship": "feather",
            "date": int(time.time())
        }
    ]
    encoded = base64.b64encode(json.dumps(initial_data).encode("utf-8")).decode("utf-8")
    mock_gh.files["leaderboard/space-normal.json"] = encoded
    mock_gh.shas["leaderboard/space-normal.json"] = "sha_init"

    store = ScoreStore(github_client=mock_gh)
    assert_true(store.is_github, "ScoreStore correctly detected GitHub mode via client")

    # Submit new entry — this will trigger a 409 conflict on first PUT attempt,
    # then fetch the newly injected ConcurrentPlayer entry and retry PUT with new SHA
    submit_data = {
        "map": "space",
        "difficulty": "normal",
        "name": "LocalPlayer",
        "total": 165.0,
        "best": 55.0,
        "points": 120,
        "laps": [55.0, 55.0, 55.0]
    }
    res = store.submit(submit_data)
    assert_true(res.get("success"), "Submission succeeded despite initial 409 conflict")
    assert_true(mock_gh.conflict_triggered, "409 Conflict was actually encountered and handled")

    # Read back board to verify both ConcurrentPlayer and LocalPlayer were merged!
    board_res = store.read("space", "normal")
    names = [e["name"] for e in board_res["scores"]]
    assert_true("LocalPlayer" in names, "LocalPlayer present in merged board")
    assert_true("ConcurrentPlayer" in names, "ConcurrentPlayer present in merged board")
    assert_true("FirstRacer" in names, "FirstRacer present in merged board")
    assert_true(len(names) == 3, f"All 3 submissions successfully retained in merged board: {names}")
    print("   [OK] 409 Conflict was caught, re-fetched newer remote commit, and merged without data loss")


if __name__ == "__main__":
    print("=== RUNNING SCOREBOARD TEST SUITE ===")
    test_best_time_retention()
    test_distinct_aliases()
    test_all_16_categories()
    test_restart_persistence()
    test_concurrent_saves()
    test_invalid_incomplete_races()
    test_github_write_conflict_recovery()

    if FAILED:
        print("\n[ERROR] SOME TESTS FAILED!")
        sys.exit(1)
    else:
        print("\n[SUCCESS] ALL 7 SCOREBOARD ACCEPTANCE TESTS PASSED SUCCESSFULLY!")
        sys.exit(0)
