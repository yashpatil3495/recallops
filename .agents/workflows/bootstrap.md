---
description: 
---

---
description: Phase 0 - scaffold the repo, venv, env template, and connectivity smoke test
---
1. Read docs/ARCHITECTURE.md and all files in .agents/rules/.
2. Produce an Implementation Plan artifact for scaffolding and wait for my approval.
3. Create folders: backend/, backend/tests/, scripts/, frontend/ (empty for now).
4. Create backend/requirements.txt with: fastapi, uvicorn, python-dotenv, groq, httpx, pydantic, pytest.
   Add the official Hindsight client only if the real Hindsight docs recommend it.
5. Create backend/.env.example with GROQ_API_KEY, HINDSIGHT_API_KEY, HINDSIGHT_PROJECT_ID (placeholders only).
6. Create a root .gitignore that ignores .env, venv/, __pycache__/, node_modules/, .next/.
7. Create scripts/smoke.py that loads backend/.env, makes one tiny Groq chat call, and one Hindsight
   store+recall round trip, then prints "GROQ OK" and "HINDSIGHT OK" or the exact error.
8. Create the venv and install requirements.
9. Create docs/API_CONTRACT.md as a stub listing the 6 endpoints (to be filled in Phase 3).
10. Stop and tell me to fill backend/.env, then run: python scripts/smoke.py
GATE: smoke.py prints GROQ OK and HINDSIGHT OK.