---
description: 
---

---
description: Phase 1 - implement memory.py against the real Hindsight API
---
1. Read docs/ARCHITECTURE.md and .agents/rules/30-memory-agent-contract.md.
2. Confirm scripts/smoke.py passes. If it does not, stop and tell me.
3. Look up the real Hindsight API (docs or official client). Append findings to docs/ARCHITECTURE.md.
4. Implement backend/memory.py with store_incident(), recall_similar(symptoms, service, top_k=5),
   and get_memory_stats(). Use timeouts and raise clear errors.
5. Put failed-attempt count and root_cause in metadata so stats do not depend on substring matching.
6. Write backend/tests/test_memory.py with the HTTP layer mocked.
// turbo
7. Run: cd backend && pytest tests/test_memory.py -q
8. Write scripts/try_memory.py that stores one fake incident, waits briefly, then recalls it by symptoms
   and prints the result. Run it.
9. Produce a walkthrough artifact showing the recalled output.
GATE: the incident I stored is returned by recall_similar. If not, stop and explain why.