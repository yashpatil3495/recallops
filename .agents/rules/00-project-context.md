# RecallOps - Project Context

- Build order is strict: memory -> agent -> API -> UI.
- Demo-first architecture: no extra services, databases, or auth layers.
- Memory: use `hindsight-client` with `bank_id` (`store_incident`=retain, `recall_similar`=recall, `summarize_learned_patterns`=reflect, `get_memory_stats`=memories.list with local fallback).
- Reasoning: Groq LLM recalls memory, identifies recurrence, extracts failed vs succeeded attempts, and recommends the next diagnostic action.
- Frozen analyze output shape must always be respected.
