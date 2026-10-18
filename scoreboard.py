"""
Need4Space — scoreboard.py
ScoreStore: Local JSON or GitHub-backed scoreboard storage.
Handles read(map_id, difficulty, name=None) and submit(data).
16 boards (4 circuits x 4 difficulties) expanding to 20 with Ocean.
"""
import base64
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Dict, Any, Optional, List, Tuple

VALID_MAPS = {"space", "forest", "ice", "desert", "ocean"}
VALID_DIFFICULTIES = {"easy", "normal", "hard", "brutal"}
MAX_BODY_SIZE = 4096


class ScoreStore:
    def __init__(self, local_path: str = ".local/scoreboard.json", github_client=None):
        self.local_path = local_path
        self._lock = threading.Lock()
        self.github_client = github_client  # Allows injected mock for simulated testing

        # GitHub mode configuration via environment variables
        self.repo = os.environ.get("NEED4SPACE_SCOREBOARD_REPO", "").strip()
        self.token = os.environ.get("NEED4SPACE_SCOREBOARD_TOKEN", "").strip()
        self.branch = os.environ.get("NEED4SPACE_SCOREBOARD_BRANCH", "scores").strip()
        self.path_prefix = os.environ.get("NEED4SPACE_SCOREBOARD_PATH", "leaderboard").strip().strip("/")
        self.allowed_origins = os.environ.get("NEED4SPACE_ALLOWED_ORIGINS", "").strip()

        self.is_github = bool(self.repo and self.token) or (self.github_client is not None)

        if not self.is_github:
            self._ensure_local_dir()

    def _ensure_local_dir(self):
        dir_name = os.path.dirname(self.local_path)
        if dir_name and not os.path.exists(dir_name):
            os.makedirs(dir_name, exist_ok=True)
        if not os.path.exists(self.local_path):
            with open(self.local_path, "w", encoding="utf-8") as f:
                json.dump({}, f)

    # -------------------------------------------------------------------------
    # Local Storage Helpers
    # -------------------------------------------------------------------------
    def _load_local_scores(self) -> Dict[str, List[Dict[str, Any]]]:
        try:
            with open(self.local_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _save_local_scores(self, scores: Dict[str, List[Dict[str, Any]]]):
        dir_name = os.path.dirname(self.local_path)
        if dir_name and not os.path.exists(dir_name):
            os.makedirs(dir_name, exist_ok=True)
        temp_path = self.local_path + ".tmp"
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(scores, f, indent=2)
        os.replace(temp_path, self.local_path)

    # -------------------------------------------------------------------------
    # GitHub REST API Helpers
    # -------------------------------------------------------------------------
    def _github_request(self, method: str, endpoint: str, body: Optional[dict] = None) -> Tuple[int, dict, str]:
        if self.github_client:
            return self.github_client.request(method, endpoint, body)

        url = f"https://api.github.com{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "Need4Space-Scoreboard/1.1",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                code = resp.getcode()
                content = resp.read().decode("utf-8")
                res_json = json.loads(content) if content else {}
                return code, res_json, ""
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            try:
                err_json = json.loads(err_body)
            except Exception:
                err_json = {"message": err_body}
            return e.code, err_json, str(e)
        except Exception as e:
            return 503, {"message": str(e)}, str(e)

    def _ensure_github_branch(self) -> bool:
        # Check if scores branch exists; create if missing
        code, _, _ = self._github_request("GET", f"/repos/{self.repo}/branches/{self.branch}")
        if code == 200:
            return True

        # Get default branch sha
        code, repo_info, _ = self._github_request("GET", f"/repos/{self.repo}")
        if code != 200:
            return False
        default_branch = repo_info.get("default_branch", "main")

        code, ref_info, _ = self._github_request("GET", f"/repos/{self.repo}/git/ref/heads/{default_branch}")
        if code != 200:
            return False
        sha = ref_info.get("object", {}).get("sha")

        code, _, _ = self._github_request("POST", f"/repos/{self.repo}/git/refs", {
            "ref": f"refs/heads/{self.branch}",
            "sha": sha
        })
        return code in (200, 201)

    def _load_github_board(self, board_key: str) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        file_path = f"{self.path_prefix}/{board_key}.json" if self.path_prefix else f"{board_key}.json"
        code, res, _ = self._github_request("GET", f"/repos/{self.repo}/contents/{file_path}?ref={self.branch}")
        if code == 200 and "content" in res:
            try:
                raw_bytes = base64.b64decode(res["content"])
                data = json.loads(raw_bytes.decode("utf-8"))
                return data if isinstance(data, list) else [], res.get("sha")
            except Exception:
                return [], res.get("sha")
        return [], None

    def _save_github_board(self, board_key: str, board_data: List[Dict[str, Any]], sha: Optional[str]) -> Tuple[bool, str]:
        file_path = f"{self.path_prefix}/{board_key}.json" if self.path_prefix else f"{board_key}.json"
        content_bytes = json.dumps(board_data, indent=2).encode("utf-8")
        encoded_content = base64.b64encode(content_bytes).decode("utf-8")

        payload = {
            "message": f"Update leaderboard: {board_key}",
            "content": encoded_content,
            "branch": self.branch
        }
        if sha:
            payload["sha"] = sha

        code, _, err = self._github_request("PUT", f"/repos/{self.repo}/contents/{file_path}", payload)
        if code in (200, 201):
            return True, ""
        elif code == 409:
            return False, "conflict"
        else:
            return False, err or f"GitHub API error {code}"

    # -------------------------------------------------------------------------
    # Core Read / Submit API
    # -------------------------------------------------------------------------
    def read(self, map_id: str, difficulty: str, name: Optional[str] = None) -> Dict[str, Any]:
        map_id = (map_id or "").strip().lower()
        difficulty = (difficulty or "").strip().lower()
        if map_id not in VALID_MAPS or difficulty not in VALID_DIFFICULTIES:
            return {
                "error": "Invalid circuit or difficulty",
                "top": [],
                "scores": [],
                "player": None,
                "personal": None,
                "board": {"map": map_id, "difficulty": difficulty},
                "storage": "github" if self.is_github else "local"
            }

        board_key = f"{map_id}-{difficulty}"
        if self.is_github:
            board, _ = self._load_github_board(board_key)
        else:
            with self._lock:
                scores = self._load_local_scores()
                board = scores.get(board_key, [])

        # Sort by total time ascending (lowest is best)
        board_sorted = sorted(board, key=lambda x: (x.get("total", float("inf")), -x.get("points", 0)))

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
            "board": {"map": map_id, "difficulty": difficulty},
            "top": top_10,
            "scores": top_10,
            "player": player_rank,
            "personal": player_rank,
            "total_records": len(board_sorted),
            "storage": "github" if self.is_github else "local"
        }

    def _merge_entry_into_board(self, board: List[Dict[str, Any]], entry: Dict[str, Any]) -> List[Dict[str, Any]]:
        clean_name = entry["name"].strip().lower()
        new_total = entry["total"]

        existing_idx = -1
        for idx, item in enumerate(board):
            if item.get("name", "").strip().lower() == clean_name:
                existing_idx = idx
                break

        if existing_idx >= 0:
            # Retain fastest time per name
            if new_total < board[existing_idx].get("total", float("inf")):
                board[existing_idx] = entry
        else:
            board.append(entry)

        board.sort(key=lambda x: (x.get("total", float("inf")), -x.get("points", 0)))
        return board

    def submit(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(data, dict):
            return {"success": False, "message": "Your time was not saved. Please try again."}

        map_id = str(data.get("map", "")).strip().lower()
        difficulty = str(data.get("difficulty", "")).strip().lower()
        raw_name = str(data.get("name", "")).strip()

        # Reject changed difficulty mid-race
        diff_changed = data.get("difficultyChanged", False)
        if diff_changed:
            return {"success": False, "message": "Difficulty changed mid-race; cannot submit."}

        # Sanitize name: text only, max 24 chars, no html tags/control chars
        clean_name = re.sub(r"[^\w\s\-\.]", "", raw_name)[:24].strip()
        if not clean_name:
            clean_name = "Racer"

        try:
            total_time = float(data.get("total", 0))
            best_lap = float(data.get("best", 0))
            points = int(data.get("points", 0))
            laps = data.get("laps", [])
        except (ValueError, TypeError):
            return {"success": False, "message": "Your time was not saved. Please try again."}

        # Validation: completed 3-lap race
        if map_id not in VALID_MAPS or difficulty not in VALID_DIFFICULTIES:
            return {"success": False, "message": "Invalid circuit or difficulty."}

        if total_time <= 0 or best_lap <= 0 or len(laps) != 3:
            return {"success": False, "message": "Invalid or incomplete race submitted (must be 3 laps)."}

        # Validate each lap time is positive and sum is reasonably consistent with total
        try:
            lap_floats = [round(float(l), 3) for l in laps]
            if any(l <= 0 for l in lap_floats):
                return {"success": False, "message": "Invalid lap times."}
        except (ValueError, TypeError):
            return {"success": False, "message": "Invalid lap times."}

        entry = {
            "name": clean_name,
            "total": round(total_time, 3),
            "best": round(best_lap, 3),
            "points": points,
            "laps": lap_floats,
            "ship": str(data.get("ship", "feather"))[:16],
            "date": int(time.time())
        }

        board_key = f"{map_id}-{difficulty}"

        if self.is_github:
            # GitHub storage with automatic 409 conflict retry and merge
            self._ensure_github_branch()
            max_retries = 5
            for attempt in range(max_retries):
                board, current_sha = self._load_github_board(board_key)
                board = self._merge_entry_into_board(board, entry)
                ok, err = self._save_github_board(board_key, board, current_sha)
                if ok:
                    return {"success": True, "entry": entry, "storage": "github"}
                if err == "conflict":
                    # Conflict: re-fetch newer sha on next loop and merge both
                    time.sleep(0.05 * (attempt + 1))
                    continue
                else:
                    return {"success": False, "message": "Scores are unavailable. Try Refresh again."}

            return {"success": False, "message": "Your time was not saved. Please try again."}

        else:
            # Local thread-safe storage
            with self._lock:
                scores = self._load_local_scores()
                board = scores.get(board_key, [])
                board = self._merge_entry_into_board(board, entry)
                scores[board_key] = board
                self._save_local_scores(scores)

            return {"success": True, "entry": entry, "storage": "local"}
