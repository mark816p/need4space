"""
Need4Space — scoreboard.py
ScoreStore: Local JSON or GitHub-backed scoreboard storage.
Handles read(map_id, difficulty, name=None) and submit(data).
"""
import json
import os
import re
import sys
import threading
from typing import Dict, Any, Optional, List

VALID_MAPS = {"space", "forest", "ice", "desert", "ocean"}
VALID_DIFFICULTIES = {"easy", "normal", "hard", "brutal"}
MAX_BODY_SIZE = 4096

class ScoreStore:
    def __init__(self, local_path: str = ".local/scoreboard.json"):
        self.local_path = local_path
        self._lock = threading.Lock()
        self._ensure_dir()

    def _ensure_dir(self):
        dir_name = os.path.dirname(self.local_path)
        if dir_name and not os.path.exists(dir_name):
            os.makedirs(dir_name, exist_ok=True)
        if not os.path.exists(self.local_path):
            with open(self.local_path, "w", encoding="utf-8") as f:
                json.dump({}, f)

    def _load_scores(self) -> Dict[str, List[Dict[str, Any]]]:
        try:
            with open(self.local_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _save_scores(self, scores: Dict[str, List[Dict[str, Any]]]):
        temp_path = self.local_path + ".tmp"
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(scores, f, indent=2)
        os.replace(temp_path, self.local_path)

    def read(self, map_id: str, difficulty: str, name: Optional[str] = None) -> Dict[str, Any]:
        map_id = (map_id or "").strip().lower()
        difficulty = (difficulty or "").strip().lower()
        if map_id not in VALID_MAPS or difficulty not in VALID_DIFFICULTIES:
            return {"error": "Invalid circuit or difficulty", "top": [], "player": None}

        board_key = f"{map_id}-{difficulty}"
        with self._lock:
            scores = self._load_scores()
            board = scores.get(board_key, [])

        # Sort by total time ascending
        board_sorted = sorted(board, key=lambda x: x.get("total", float("inf")))

        top_10 = board_sorted[:10]
        player_rank = None

        if name:
            clean_name = name.strip().lower()
            for idx, entry in enumerate(board_sorted):
                if entry.get("name", "").strip().lower() == clean_name:
                    player_rank = {
                        "rank": idx + 1,
                        "entry": entry
                    }
                    break

        return {
            "map": map_id,
            "difficulty": difficulty,
            "top": top_10,
            "player": player_rank
        }

    def submit(self, data: Dict[str, Any]) -> Dict[str, Any]:
        map_id = str(data.get("map", "")).strip().lower()
        difficulty = str(data.get("difficulty", "")).strip().lower()
        raw_name = str(data.get("name", "")).strip()

        # Sanitize name: text only, max 24 chars, no html/control chars
        clean_name = re.sub(r"[^\w\s\-\.]", "", raw_name)[:24].strip()
        if not clean_name:
            clean_name = "Racer"

        total_time = float(data.get("total", 0))
        best_lap = float(data.get("best", 0))
        points = int(data.get("points", 0))
        laps = data.get("laps", [])

        # Validation: completed 3-lap race
        if map_id not in VALID_MAPS or difficulty not in VALID_DIFFICULTIES:
            return {"success": False, "message": "Invalid circuit or difficulty"}
        if total_time <= 0 or best_lap <= 0 or len(laps) != 3:
            return {"success": False, "message": "Invalid or incomplete race submitted"}

        entry = {
            "name": clean_name,
            "total": round(total_time, 3),
            "best": round(best_lap, 3),
            "points": points,
            "laps": [round(float(l), 3) for l in laps],
            "ship": str(data.get("ship", "feather"))[:16]
        }

        board_key = f"{map_id}-{difficulty}"
        with self._lock:
            scores = self._load_scores()
            board = scores.get(board_key, [])

            # Check if player already exists on this board (case-insensitive)
            existing_idx = -1
            for idx, item in enumerate(board):
                if item.get("name", "").strip().lower() == clean_name.lower():
                    existing_idx = idx
                    break

            if existing_idx >= 0:
                # Keep fastest time per name
                if total_time < board[existing_idx].get("total", float("inf")):
                    board[existing_idx] = entry
            else:
                board.append(entry)

            # Keep sorted
            board.sort(key=lambda x: x.get("total", float("inf")))
            scores[board_key] = board
            self._save_scores(scores)

        return {"success": True, "entry": entry}
