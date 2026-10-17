# Scoreboard Deployment Notes

Need4Space supports two deployment models for the global scoreboard:

1. **Local Mode (Default)**
   - When running via `serve.py`, scores are stored in `.local/scoreboard.json`.
   - The `/api/scoreboard` GET and POST endpoints interact with this local file.
   - Ideal for single-player, testing, offline play, and local network setups.

2. **GitHub-backed Mode**
   - Configure environment variables on your backend host:
     - `NEED4SPACE_SCOREBOARD_REPO`: `owner/repo`
     - `NEED4SPACE_SCOREBOARD_TOKEN`: GitHub personal access token with repo write scope
     - `NEED4SPACE_SCOREBOARD_BRANCH`: Branch for storing leaderboard JSONs (default `scores`)
     - `NEED4SPACE_SCOREBOARD_PATH`: Directory prefix (default `leaderboard`)
     - `NEED4SPACE_ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
     - `NEED4SPACE_HOST`: Host URL
   - On submission, `scoreboard.py` uses GitHub API with optimistic concurrency (SHA retry loop) to merge new times.
