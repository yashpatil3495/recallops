# RecallOps

Incident-intelligence AI agent with persistent memory for SRE and DevOps teams.

## Overview
RecallOps recalls past incidents from **Hindsight** memory, reasons over them using **Groq** LLMs, and recommends the next diagnostic action while strictly avoiding fixes that previously failed.

## Architecture & Workflows
- Architecture specification: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Frozen API contract: [docs/API_CONTRACT.md](docs/API_CONTRACT.md)
- Rules: [.agents/rules/](.agents/rules/)
- Workflows: [.agents/workflows/](.agents/workflows/)

## Strict Build Phases
1. **Phase 0 (Bootstrap)**: Scaffolding, dependencies, env template, connectivity smoke test.
2. **Phase 1 (Memory)**: Hindsight memory persistence, lifecycle formatting, metadata tagging, recall, stats.
3. **Phase 2 (Agent)**: Groq reasoning engine, prompt constraints (never repeat failed fixes), JSON parser with `<think>` stripping.
4. **Phase 3 (API)**: FastAPI REST application, endpoints, Pydantic v2 validation, error mapping, contract freeze.
5. **Phase 4 (UI)**: Next.js dashboard making memory visible, dark ops aesthetic, stats sidebar, fix history.
6. **Phase 5 (Verification & Polish)**: Full verification tests, demo rehearsal under 3 minutes.
