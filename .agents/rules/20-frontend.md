---
trigger: always_on
---

---
trigger: glob
globs: frontend/**
---
- Next.js (App Router) + TypeScript + Tailwind. API base URL from NEXT_PUBLIC_API_URL.
- Typed API client in lib/api.ts written from docs/API_CONTRACT.md. No inline fetch calls in components.
- Every async panel has loading, empty, and error states.
- The UI's job is to make memory VISIBLE:
  1. Recurrence badge with confidence percentage
  2. Fix history with failed (red X) vs succeeded (green check) actions
  3. Live memory stats sidebar (total incidents, resolved, root causes learned, failed approaches)
  4. Outcome-confirm button that POSTs to /record
  5. Seed demo data button
- Follow the frontend-design skill. Dark ops-dashboard aesthetic, monospace for logs and IDs.
- Do not change the API shape. If the UI needs a change, update docs/API_CONTRACT.md first and ask me.