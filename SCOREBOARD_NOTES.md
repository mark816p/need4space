# Need4Space — Global Scoreboard Architecture & Deployment Guide

## Overview
Need4Space features a dual-mode Global Scoreboard architecture:
1. **Local JSON Mode**: Zero configuration for local development and offline play. Records are stored in `.local/scoreboard.json`.
2. **GitHub-Backed Repository Mode**: Cloud persistence backed by a GitHub repository branch (`scores`), leveraging GitHub's REST API with automated HTTP 409 conflict detection and branch merge retries.

The frontend is hosted as a static web application (e.g. GitHub Pages or local static server), while the backend API runs independently and handles CORS validation and data sanitization.

---

## 1. Storage Modes

### Local Mode (Default)
- Active when `NEED4SPACE_SCOREBOARD_REPO` or `NEED4SPACE_SCOREBOARD_TOKEN` is unset.
- Scores are stored in `.local/scoreboard.json` in atomic writes with an internal file-lock mutex.
- Provides thread-safe concurrent saves and persistence across server restarts.

### GitHub Mode
- Active when both `NEED4SPACE_SCOREBOARD_REPO` and `NEED4SPACE_SCOREBOARD_TOKEN` environment variables are populated.
- Scores are saved per leaderboard as JSON files: `leaderboard/<circuit>-<difficulty>.json` on the designated branch (default `scores`).
- The branch is created automatically on the first submission if it does not exist.
- When saving, if a concurrent push creates an HTTP 409 Conflict, the store fetches the newer remote commit, merges both submissions (keeping the fastest lap/total per pilot name), and retries up to 5 times.

---

## 2. Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `NEED4SPACE_SCOREBOARD_REPO` | Target GitHub repository (`owner/repo`) | `""` (Local mode) |
| `NEED4SPACE_SCOREBOARD_TOKEN` | Fine-grained or Personal Access Token with repo read/write scope | `""` |
| `NEED4SPACE_SCOREBOARD_BRANCH` | Git branch storing leaderboard JSON files | `scores` |
| `NEED4SPACE_SCOREBOARD_PATH` | Path prefix inside the branch | `leaderboard` |
| `NEED4SPACE_ALLOWED_ORIGINS` | Comma-separated list of allowed frontend origins (CORS) | `""` (allow all in dev) |
| `NEED4SPACE_HOST` | Host binding for server | `""` |

---

## 3. GitHub Token Configuration & Security

To configure a GitHub token:
1. Create a Fine-grained Personal Access Token (PAT) on GitHub.
2. Grant **Repository permissions**:
   - **Contents**: Read and Write
   - **Metadata**: Read-only
3. Assign access exclusively to the scoreboard storage repository.
4. Export the environment variables on the backend server:
   ```bash
   export NEED4SPACE_SCOREBOARD_REPO="my-org/need4space-scores"
   export NEED4SPACE_SCOREBOARD_TOKEN="github_pat_..."
   export NEED4SPACE_SCOREBOARD_BRANCH="scores"
   export NEED4SPACE_ALLOWED_ORIGINS="https://my-org.github.io"
   ```

---

## 4. API Specification

### Endpoint Configuration: `scoreboard-config.json`
```json
{
  "endpoint": "/api/scoreboard"
}
```
If deployed across different domains (e.g., GitHub Pages frontend talking to a cloud VPS backend), configure `scoreboard-config.json`:
```json
{
  "endpoint": "https://scores.example.com/api/scoreboard"
}
```

### GET `/api/scoreboard`
Query parameters:
- `map`: `space` | `forest` | `ice` | `desert` | `ocean`
- `difficulty`: `easy` | `normal` | `hard` | `brutal`
- `name` *(optional)*: Pilot name to query personal rank

Response (200 OK):
```json
{
  "map": "space",
  "difficulty": "normal",
  "board": { "map": "space", "difficulty": "normal" },
  "scores": [
    {
      "name": "AcePilot",
      "total": 165.25,
      "best": 54.12,
      "points": 100,
      "laps": [55.6, 55.53, 54.12],
      "ship": "feather",
      "date": 1774000000
    }
  ],
  "player": {
    "rank": 1,
    "entry": { ... }
  },
  "personal": {
    "rank": 1,
    "entry": { ... }
  },
  "total_records": 48,
  "storage": "github"
}
```

### POST `/api/scoreboard`
Request body (max 4096 bytes):
```json
{
  "map": "space",
  "difficulty": "normal",
  "name": "Viper",
  "total": 164.25,
  "best": 54.1,
  "points": 250,
  "laps": [55.1, 55.05, 54.1],
  "ship": "feather"
}
```
Validation rules:
- Race must consist of exactly 3 positive lap times.
- Total time must match the completed race.
- Mid-race difficulty changes are flagged (`difficultyChanged: true`) and rejected.
- Pilot name is sanitized (alphanumeric, spaces, dashes, dots; max 24 chars).
- Case-insensitive alias matching: faster total time is always retained.

---

## 5. Frontend Scoreboard (`src/scoreboard.js`)
- **Auto-Refresh**: Polls the active board every 15 seconds when visible (`document.visibilityState === 'visible'`). Paused when closed or game loop is active (zero race-loop overhead).
- **Navigation**:
  - `↑` / `↓` or click circuit tabs (Space, Forest Moon, Ice Planet, Desert Planet)
  - `←` / `→` or click difficulty tabs (Easy, Normal, Hard, Brutal)
  - `R`: Force immediate refresh
  - `Esc`: Return to menu / game
- **Results Integration**: Allows pilot name entry directly upon completing a 3-lap race with persistent `localStorage` memory (`n4s_pilot_name`) and instant board display.
