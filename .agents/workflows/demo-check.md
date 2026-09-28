---
description: 
---

---
description: Final rehearsal of the full demo in the browser
---
1. Read docs/DEMO_SCRIPT.md. If it does not exist, create it with this flow:
   a. Click Seed. Sidebar shows 5 incidents.
   b. Submit payment-api with HTTP 500 errors and database connection timeout. Agent flags recurring,
      cites INC-001 and INC-003, shows failed restart and successful pool increase.
   c. Submit an unrelated incident. Agent says it is new with low confidence.
   d. Confirm the outcome of (b). Sidebar count increases.
   e. Re-run (b). Recommendation reflects the newly stored incident.
2. Make sure backend (port 8000) and frontend (port 3000) are running.
3. Use the browser agent to perform steps a-e exactly. Time each step.
4. Produce an artifact with screenshots, total time, and any errors or visual glitches.
GATE: total run under 3 minutes with zero errors. List every issue found and suggest fixes.