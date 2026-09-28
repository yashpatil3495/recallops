---
description: 
---

---
description: Phase 3 - FastAPI wiring, seed endpoint, and frozen API contract
---
1. Read docs/ARCHITECTURE.md and .agents/rules/10-backend.md.
2. Confirm test_memory.py and test_agent.py pass. If not, stop.
3. Implement backend/main.py with Pydantic models and exactly these endpoints:
   GET /, POST /analyze, POST /record, GET /memory/stats, GET /memory/patterns, POST /seed.
4. /seed loads incidents from backend/seed_data.py. Make it idempotent (skip incidents already stored).
5. Restrict CORS to http://localhost:3000. Map external failures to HTTP 502 with a short message.
6. Write docs/API_CONTRACT.md with the request JSON and response JSON (real example payloads) for
   every endpoint. This file is the frozen contract for the frontend.
7. Write backend/tests/test_api.py using FastAPI TestClient with memory and agent mocked.
// turbo
8. Run: cd backend && pytest -q
9. Start the server (uvicorn main:app --reload --port 8000) and curl each endpoint. Show the outputs.
10. Produce a walkthrough artifact.
GATE: POST /seed then GET /memory/stats shows 5 incidents, and POST /analyze returns the full
contract shape.