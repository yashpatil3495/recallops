---
trigger: always_on
---

---
trigger: glob
globs: backend/**
---
- Python 3.11+, FastAPI, Pydantic v2 models for every request and response.
- All secrets come from env via python-dotenv. Never hardcode keys or commit .env.
- Use timezone-aware datetimes: datetime.now(timezone.utc). Never datetime.utcnow().
- All Hindsight and Groq calls live only in memory.py and agent.py. main.py holds no business logic.
- Every external call has a timeout and returns a clean HTTP 502 on failure, never a stack trace.
- LLM output must be parsed with a robust extractor: strip <think>...</think> blocks and
  markdown fences, then json.loads. On failure retry once, then return a fallback object
  with is_recurring=false and a reasoning message explaining the parse failure.
- CORS: allow only http://localhost:3000, never "*".
- Track failed attempts in incident metadata (failed_attempts count), do not count the
  substring "FAILED" in text.
- Every module gets a pytest file in backend/tests with external APIs mocked.