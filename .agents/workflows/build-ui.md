---
description: 
---

---
description: Phase 4 - Next.js frontend that makes memory visible
---
1. Read docs/API_CONTRACT.md and .agents/rules/20-frontend.md. Also read the frontend-design skill.
2. Confirm the backend is running on http://localhost:8000 (curl GET /). If not, tell me to start it.
3. Produce an Implementation Plan artifact (component list, layout sketch) and wait for approval.
4. Scaffold Next.js (App Router, TypeScript, Tailwind) inside frontend/. Add NEXT_PUBLIC_API_URL to .env.local.
5. Create lib/api.ts (typed client) and lib/types.ts from docs/API_CONTRACT.md.
6. Build components:
   - IncidentForm (service, environment, severity, symptoms, logs)
   - AnalysisPanel (recurrence badge + confidence, pattern, root cause, next action, recommended fix, reasoning)
   - FixHistory (previously failed with red X, previously succeeded with green check)
   - SimilarIncidents (raw memories, collapsible)
   - MemorySidebar (live stats, refresh after seed and after record)
   - OutcomeConfirm (form to confirm root cause, resolution, and attempts, then POST /record)
   - SeedButton and PatternsCard (GET /memory/patterns)
7. Every panel has loading, empty, and error states.
// turbo
8. Run: cd frontend && npm run build
9. Use the browser to open http://localhost:3000 and run the full flow: seed, submit a payment-api
   incident, view the analysis, confirm an outcome, and check the sidebar updated. Attach screenshots
   and a recording.
GATE: the full flow works in the browser with no console errors.