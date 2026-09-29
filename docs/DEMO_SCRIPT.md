# RecallOps Demo Script (Target: < 3 Minutes)

This script demonstrates the core value proposition: **The agent learns from failures and never repeats them.**

## Preparation
- Ensure `backend/.env` has valid keys.
- Start backend: `cd backend && uvicorn main:app --reload`
- Start frontend: `cd frontend && npm run dev`
- Open `http://localhost:3000`

## Step 1: The Setup (0:00 - 0:30)
1. Point to the empty dashboard. "This is RecallOps, an incident intelligence agent that remembers past outages."
2. Click **Seed Synthetic Incidents** in the sidebar.
3. "We just preloaded the Hindsight memory bank with 5 past incidents so it's not starting from zero."

## Step 2: A Recurring Incident (0:30 - 1:15)
1. Click the **Payment Outage** preset button.
2. Click **Analyze Incident & Recommend Next Action**.
3. Point out the results:
   - **Recurrence Banner**: It detected a recurring issue (cites INC-001 / INC-003).
   - **Fix History**: Point to the red X ("Previously Failed"). "It knows restarting pods failed last time."
   - **Recommended Fix**: Point to the green check. "It recommends scaling the connection pool, because that worked."
   - **Evidence Trail**: Expand the structured evidence trail and Hindsight memory badges.

## Step 3: A New Incident (1:15 - 1:45)
1. Click the **New Scenario** preset button.
2. Click **Analyze Incident & Recommend Next Action**.
3. Point out the results:
   - "New Incident Pattern" banner (low confidence).
   - Fix History is empty. "It hasn't seen this before, so it gives a generic safe recommendation."

## Step 4: The Learning Loop (1:45 - 2:45)
1. Go back to the **Payment Outage** preset and hit **Analyze Incident & Recommend Next Action** again.
2. "Let's say we try a brand new fix, and it fails."
3. Scroll down to **Outcome Capture: What did you actually try?**
4. Click **+ add another action**.
5. Type: `Disable rate limiting`
6. Set the dropdown to **Failed**.
7. Ensure Root Cause and Resolution have text.
8. Click **Confirm & Record Incident Outcome**.
9. "This writes the failure back into Hindsight memory. Now watch what happens when the next engineer sees this symptom."
10. Click **↻ Re-run analysis**.
11. Scroll up to the **Previously Failed** section.
12. "Look! 'Disable rate limiting' is now instantly listed as a known failure. The agent will never recommend it, saving the team hours of wasted effort."

## Step 5: Wrap Up (2:45 - 3:00)
- "Behind the scenes, deterministic guardrails intercept the LLM to enforce safety."
- "You can prove this with our adversarial evaluation harness: `python scripts/eval.py --adversarial`."
- End demo.
