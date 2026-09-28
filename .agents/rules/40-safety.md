# RecallOps - Safety & Security Rules

- Never print, log, or commit API keys, tokens, or credentials.
- All secrets come from `backend/.env`.
- Never run destructive commands (rm -rf outside build dirs, git force push, dropping tables).
- Auto-run test and read-only commands without interrupting the user.
- Every external call must have a timeout and map failures cleanly to HTTP 502 without stack traces.