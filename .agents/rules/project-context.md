---
trigger: always_on
---

---
trigger: always_on
---
# RecallOps - project context
RecallOps is an incident-intelligence agent. It recalls past incidents from Hindsight
memory, reasons over them with Groq, and recommends the NEXT diagnostic action while
avoiding fixes that previously failed.

Flow: Next.js UI -> FastAPI -> (Hindsight recall/store) + (Groq LLM)
Source of truth: docs/ARCHITECTURE.md and docs/API_CONTRACT.md. Read both before coding.

Build order is strict: memory -> agent -> API -> UI.
Never start a phase until the previous phase's gate passes.
This is a hackathon demo: prefer working and demoable over abstract and extensible.
Do not add dependencies, services, auth, or databases that are not in the architecture.
Before writing code for any phase, produce an Implementation Plan artifact and wait for approval.