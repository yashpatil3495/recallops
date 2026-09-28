---
description: 
---

---
description: Run every check and report pass or fail per phase
---
// turbo
1. Run: cd backend && pytest -q
// turbo
2. Run: python scripts/smoke.py
3. If the backend is not running, start it. Curl GET /, GET /memory/stats, and POST /analyze with a sample body.
// turbo
4. Run: cd frontend && npm run build
5. Report a table: Phase 0 smoke, Phase 1 memory, Phase 2 agent, Phase 3 API, Phase 4 UI, each PASS or FAIL
   with the exact error for failures. Do not fix anything until I say so.