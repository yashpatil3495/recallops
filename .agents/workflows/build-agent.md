---
description: 
---

---
description: Phase 2 - implement the reasoning agent over Hindsight memory
---
1. Read docs/ARCHITECTURE.md and .agents/rules/30-memory-agent-contract.md.
2. Confirm backend/tests/test_memory.py passes. If not, stop and tell me.
3. Implement backend/agent.py: analyze_incident() and summarize_learned_patterns().
4. Add a robust JSON extractor: strip <think> tags and code fences, retry once, then fallback object.
5. The system prompt must enforce: never recommend previously failed actions, prefer previously
   succeeded actions, return the exact JSON keys from rule 30, say so clearly when uncertain.
6. Write backend/tests/test_agent.py with Groq and recall mocked, including a case where the model
   returns <think> text plus fenced JSON.
// turbo
7. Run: cd backend && pytest tests/test_agent.py -q
8. Live check: create backend/seed_data.py (5 synthetic incidents from docs/ARCHITECTURE.md), seed them,
   then call analyze_incident with service payment-api, symptoms "HTTP 500 errors" and
   "database connection timeout". Print the JSON.
9. Produce a walkthrough artifact with the live output.
GATE: is_recurring is true, similar_incidents include INC-001 and INC-003, and previously_failed
includes restarting pods. Also run a clearly unrelated incident and confirm is_recurring is false.