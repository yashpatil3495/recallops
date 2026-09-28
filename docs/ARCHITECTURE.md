# RecallOps - System Architecture

## 1. Purpose
RecallOps is an AI incident-response agent with persistent memory. When a production incident
arrives, it recalls similar past incidents from Hindsight memory, reasons over them with an LLM,
and recommends the NEXT diagnostic action. It learns from every resolved incident.

Core differentiator: the LLM does not just retrieve memory, it REASONS over it:
- Detects whether the incident is recurring or new
- Lists what previously FAILED (must never be recommended again) and what SUCCEEDED
- Improves as new outcomes are recorded (visible learning loop)

## 2. Requirements
Functional
- FR1: Submit an incident (service, environment, severity, symptoms, optional logs) and get analysis.
- FR2: Analysis returns recurrence flag + confidence, similar past incidents, failed vs succeeded
  actions, root cause hypothesis, next diagnostic action, recommended fix, reasoning.
- FR3: Record the final outcome of an incident (attempts, root cause, resolution) into memory.
- FR4: Show live memory stats (total incidents, resolved, root causes learned, failed approaches logged).
- FR5: Summarize learned failure patterns across all memory.
- FR6: One-click demo seeding of synthetic incident history.
Non-functional
- NFR1: Analysis response under ~8 seconds.
- NFR2: Secrets only via environment variables.
- NFR3: Robust to malformed LLM output (never crash the API on bad JSON).
- NFR4: Whole demo runnable locally in under 3 minutes of presentation time.

## 3. High-level architecture
```
User -> Next.js Frontend (localhost:3000)
          | REST/JSON
          v
        FastAPI Backend (localhost:8000)
          |-- memory.py -> Hindsight Memory API  (store / recall / list)
          |-- agent.py  -> Groq LLM              (reasoning over recalled memory)
```

## 4. Tech stack
- Backend: Python 3.11+, FastAPI, Pydantic v2, uvicorn, httpx, python-dotenv, groq, pytest
- LLM: Groq, model qwen/qwen3-32b (fallback: openai/gpt-oss-120b). Temperature 0.1 for analysis.
- Memory: Hindsight. The base URL and endpoints in early sketches are PLACEHOLDERS.
  First task: read the real Hindsight docs/client and record the actual store/recall API in
  the "Hindsight findings" section at the bottom.
- Frontend: Next.js (App Router), TypeScript, Tailwind

## 5. Repository layout
```
recallops/
  AGENTS.md
  .agents/rules/ , .agents/workflows/
  docs/ARCHITECTURE.md, docs/API_CONTRACT.md, docs/DEMO_SCRIPT.md
  scripts/smoke.py, scripts/try_memory.py
  backend/  main.py memory.py agent.py seed_data.py requirements.txt .env.example tests/
  frontend/ (Next.js app)
```

## 6. Components

### 6.1 memory.py (Phase 1)
- store_incident(incident) -> dict
  Stores lifecycle text: id, service, severity, environment, timestamp, SYMPTOMS, ATTEMPTS
  (each tagged [FAILED]/[SUCCESS]/[PARTIAL]), ROOT CAUSE, FINAL RESOLUTION, OUTCOME.
  Metadata: incident_id, service, environment, severity, root_cause, outcome, timestamp,
  failed_attempts (int).
- recall_similar(symptoms, service, top_k=5) -> list[dict]
  Query text: "Service: {service}. Symptoms: {joined symptoms}". Returns memories with content,
  metadata, score.
- get_memory_stats() -> {total_incidents, resolved, root_causes_learned, failed_approaches_logged}
  failed_approaches_logged sums the failed_attempts metadata (no substring matching).

### 6.2 agent.py (Phase 2)
- analyze_incident(service, environment, symptoms, logs="") -> dict
  1. recall_similar()  2. build memory context  3. Groq call  4. robust JSON parse  5. attach raw_memories
- summarize_learned_patterns() -> str (LLM summary of top recurring failure patterns, grouped by pattern)
- JSON extractor: strip <think>...</think>, strip ``` fences, json.loads; retry once; else fallback object
  (is_recurring=false, reasoning explains the parse failure).
- System prompt rules: decide recurring vs new; list failed/succeeded actions from memory;
  recommend the single next diagnostic action; NEVER recommend a previously failed action;
  prefer previously succeeded actions; state uncertainty clearly; return JSON only.
- Output shape (exact keys):
```json
{
  "is_recurring": true,
  "recurrence_confidence": 87,
  "similar_incidents": ["INC-001", "INC-003"],
  "identified_pattern": "DB connection pool exhaustion under peak traffic",
  "previously_failed": ["Restart application pods", "Increase request timeout to 30s"],
  "previously_succeeded": ["Increase DB connection pool from 50 to 150"],
  "root_cause_hypothesis": "Connection pool exhausted",
  "next_diagnostic_action": "Check active vs max DB connections in the pool metrics",
  "recommended_fix": "Increase pool size and add pool monitoring alert",
  "reasoning": "2-3 sentences",
  "raw_memories": []
}
```

### 6.3 main.py (Phase 3)
| Method | Path | Purpose |
|---|---|---|
| GET | / | health |
| POST | /analyze | body {service, environment, severity, symptoms[], logs?} -> {success, analysis} |
| POST | /record | body {incident_id, service, environment, severity, symptoms[], logs?, attempts[{action,result}], root_cause, resolution, outcome} -> {success, stored, hindsight_response} |
| GET | /memory/stats | -> {success, stats} |
| GET | /memory/patterns | -> {success, patterns} |
| POST | /seed | load synthetic incidents (idempotent) -> {seeded, results[]} |
Rules: CORS only http://localhost:3000; external failures -> HTTP 502; incident_id auto-generated
(INC-XXXXXX) if blank; timezone-aware timestamps.

### 6.4 Frontend (Phase 4)
Single-page ops dashboard, dark theme.
- MemorySidebar: live stats, refreshes after seed and record
- IncidentForm: service, environment, severity, symptoms (multi-line, one per line), logs
- AnalysisPanel: recurrence badge + confidence, pattern, root cause hypothesis, next diagnostic
  action (highlighted), recommended fix, reasoning
- FixHistory: previously failed (red X), previously succeeded (green check)
- SimilarIncidents: collapsible raw memories with scores
- OutcomeConfirm: confirm root cause, resolution, attempts, then POST /record and refresh stats
- SeedButton and PatternsCard
- lib/api.ts typed client, lib/types.ts; loading/empty/error states everywhere

## 7. Seed data (5 synthetic incidents)
1. INC-001 payment-api critical: HTTP 500, DB connection timeout, latency spike. Attempts: restart pods
   FAILED; timeout to 30s FAILED; clear pool manually PARTIAL; pool 50->150 SUCCESS.
   Root cause: DB connection pool exhaustion under peak traffic.
2. INC-002 auth-service high: login failures, JWT validation errors, 401s. Attempts: restart FAILED;
   clear Redis cache FAILED; rollback JWT secret rotation SUCCESS. Root cause: secret rotation not
   propagated to all instances.
3. INC-003 payment-api critical: HTTP 500, DB connection refused, timeout. Attempts: restart FAILED;
   pool to 200 SUCCESS. Root cause: pool exhaustion (second occurrence).
4. INC-004 recommendation-engine medium: high memory, OOMKilled pods, slow responses. Attempts:
   restart PARTIAL; memory limit 2GB->4GB SUCCESS. Root cause: embedding cache leak.
5. INC-005 notification-service high: emails not sending, queue backlog, worker timeout. Attempts:
   restart workers FAILED; switch to backup SMTP SUCCESS. Root cause: primary SMTP outage.
Include realistic logs and ISO timestamps for each.

## 8. Build phases and gates
- Phase 0 Bootstrap: scaffold, env template, smoke test. Gate: GROQ OK + HINDSIGHT OK.
- Phase 1 Memory: store then recall works. Gate: stored incident is recalled by symptoms.
- Phase 2 Agent: Gate: payment-api HTTP 500 + DB timeout after seeding -> recurring, cites INC-001/003,
  excludes restart; unrelated incident -> not recurring.
- Phase 3 API: Gate: /seed then /memory/stats shows 5; /analyze returns full shape; API_CONTRACT.md written.
- Phase 4 UI: Gate: full browser flow works, no console errors.
- Phase 5 Polish: /verify and /demo-check pass under 3 minutes.

## 9. Demo flow
Seed -> submit recurring payment-api incident -> agent shows recurrence, failed vs succeeded, next
action -> submit unrelated incident (new, low confidence) -> confirm outcome -> stats increase ->
re-run and show updated recommendation.

## 10. Environment variables (backend/.env)
GROQ_API_KEY, HINDSIGHT_API_KEY, HINDSIGHT_PROJECT_ID (plus any base URL or bank ID the real
Hindsight API requires)

## 11. Hindsight findings
- **Package**: `hindsight-client` (official Python SDK by Vectorize.io, available on PyPI, current v0.10.1).
- **Core Architecture & Namespacing**:
  Hindsight groups memories into **Memory Banks** identified by `bank_id`. For RecallOps, `HINDSIGHT_PROJECT_ID` configures the `bank_id` (e.g. `recallops-demo`).
- **Base URL & Cloud vs Local**:
  - Hindsight Cloud base URL: `https://api.hindsight.vectorize.io`
  - Local/Self-hosted base URL: `http://localhost:8888`
- **Authentication**:
  Passed as `api_key` to client initialization or HTTP header `Authorization: Bearer <token>` or `x-api-key: <key>`.
- **SDK Methods**:
  - `client = Hindsight(base_url=HINDSIGHT_API_URL, api_key=HINDSIGHT_API_KEY)`
  - Retain: `client.retain(bank_id=..., content=..., metadata=...)` - stores memory item with structured metadata.
  - Recall: `client.recall(bank_id=..., query=..., top_k=5)` - retrieves relevant memories using multi-strategy search (semantic, BM25, graph, temporal).
  - Reflect: `client.reflect(bank_id=..., query=...)` - performs synthesis reasoning.
- **REST Endpoints**:
  - `POST /v1/default/banks/{bank_id}/retain`
  - `POST /v1/default/banks/{bank_id}/recall`
  - `GET /v1/default/banks/{bank_id}/memories/list`
- **Metadata Handling**:
  Metadata dictionary supports fields like `incident_id`, `service`, `environment`, `severity`, `root_cause`, `outcome`, `timestamp`, and `failed_attempts` (integer count).
