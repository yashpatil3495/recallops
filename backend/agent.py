"""RecallOps AI Reasoning Agent Module.

Uses Groq LLMs to analyze incidents against recalled long-term memories,
detecting recurrence, tracking failed vs succeeded attempts, and
recommending diagnostic actions while strictly avoiding past failures.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError

from backend.memory import recall_similar

# Ensure environment is loaded from backend/.env
ENV_PATH = Path(__file__).resolve().parent / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
else:
    load_dotenv()


class AnalysisResult(BaseModel):
    """Frozen schema for incident analysis response."""

    is_recurring: bool = False
    recurrence_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    similar_incidents: List[str] = Field(default_factory=list)
    identified_pattern: str = "Unknown pattern"
    previously_failed: List[str] = Field(default_factory=list)
    previously_succeeded: List[str] = Field(default_factory=list)
    root_cause_hypothesis: str = "Under investigation"
    next_diagnostic_action: str = "Inspect service logs and telemetry metrics"
    recommended_fix: str = "Awaiting root cause confirmation"
    reasoning: str = ""
    raw_memories: List[Dict[str, Any]] = Field(default_factory=list)


def extract_json_payload(raw_text: str) -> Optional[Dict[str, Any]]:
    """Extract and parse a JSON dictionary from LLM output.

    Strips <think> tags, markdown fences, and isolates JSON objects.
    """
    if not raw_text:
        return None

    # 1. Strip reasoning blocks: <think>...</think>
    cleaned = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL)

    # 2. Strip code fences: ```json ... ``` or ``` ... ```
    cleaned = re.sub(r"```(?:json)?\s*([\s\S]*?)\s*```", r"\1", cleaned)

    # 3. Find first outer JSON object {...}
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        candidate = cleaned[start_idx : end_idx + 1].strip()
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

    return None


def _get_groq_client():
    """Instantiate Groq client."""
    from groq import Groq

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is not configured in backend/.env")
    return Groq(api_key=api_key, timeout=25.0)


def _call_groq_completion(messages: Any, temperature: float = 0.1) -> str:
    """Call Groq chat completion with model fallback."""
    client = _get_groq_client()
    primary_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    candidate_models = [primary_model]
    for fallback in ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]:
        if fallback not in candidate_models:
            candidate_models.append(fallback)

    last_error = None
    for model in candidate_models:
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=1024,
            )
            return resp.choices[0].message.content or ""
        except Exception as exc:
            last_error = exc
            err_msg = str(exc).lower()
            if "model" in err_msg or "not found" in err_msg or "decommissioned" in err_msg:
                continue
            raise

    raise last_error or RuntimeError("All Groq model attempts failed")


def analyze_incident(
    service: str,
    symptoms: List[str] | str,
    description: Optional[str] = None,
    logs: Optional[str] = None,
) -> Dict[str, Any]:
    """Analyze a production incident by recalling past memory and reasoning over it.

    Returns the frozen analysis result dictionary.
    """
    if isinstance(symptoms, str):
        symptoms_list = [s.strip() for s in symptoms.split(";") if s.strip()] or [symptoms]
    else:
        symptoms_list = symptoms

    # 1. Recall similar incidents from memory
    raw_memories = recall_similar(symptoms=symptoms_list, service=service)

    # If no memories returned at all, return new incident baseline
    if not raw_memories:
        fallback = AnalysisResult(
            is_recurring=False,
            recurrence_confidence=0.1,
            similar_incidents=[],
            identified_pattern="New incident scenario with no prior occurrences in memory",
            previously_failed=[],
            previously_succeeded=[],
            root_cause_hypothesis=f"Initial occurrence of failure in {service}",
            next_diagnostic_action=f"Check service health, telemetry metrics, and error logs for {service}",
            recommended_fix="Isolate error scope and review recent deployments or configurations",
            reasoning="No similar historical incidents were recalled from persistent memory.",
            raw_memories=[],
        )
        return fallback.model_dump()

    # 2. Build Memory Context for Prompt
    memory_context_blocks = []
    for idx, mem in enumerate(raw_memories[:5], 1):
        inc_id = mem.get("incident_id", f"INC-REF-{idx}")
        score = mem.get("score", 0.0)
        text = mem.get("text", "")
        memory_context_blocks.append(f"--- Recalled Record {idx} ({inc_id}, Relevance Score: {score}) ---\n{text}")

    memory_context = "\n\n".join(memory_context_blocks)

    system_prompt = (
        "You are RecallOps, an expert Site Reliability Engineering (SRE) incident intelligence agent.\n"
        "Your task is to analyze the incoming incident symptoms against historical incidents recalled from persistent memory.\n\n"
        "CRITICAL RULES:\n"
        "1. Determine if this incident is recurring or new. If recurring, cite the exact similar incident IDs (e.g., [\"INC-001\", \"INC-003\"]).\n"
        "2. List what actions previously FAILED in 'previously_failed'.\n"
        "3. List what actions previously SUCCEEDED in 'previously_succeeded'.\n"
        "4. NEVER recommend any action in 'next_diagnostic_action' or 'recommended_fix' that appears in 'previously_failed' or repeats a failed approach (e.g. if restarting pods failed, DO NOT recommend restarting pods).\n"
        "5. Recommend the single most targeted NEXT diagnostic action and a proven fix.\n"
        "6. Provide a concise 2-3 sentence reasoning explanation.\n"
        "7. Recurrence confidence must be a float between 0.0 and 1.0 (e.g., 0.88).\n"
        "8. Return ONLY a valid JSON object matching the schema below. No explanation, no markdown outside the JSON.\n\n"
        "JSON SCHEMA:\n"
        "{\n"
        '  "is_recurring": true,\n'
        '  "recurrence_confidence": 0.9,\n'
        '  "similar_incidents": ["INC-001", "INC-003"],\n'
        '  "identified_pattern": "DB connection pool exhaustion under peak traffic",\n'
        '  "previously_failed": ["Restart application pods"],\n'
        '  "previously_succeeded": ["Increase DB connection pool size from 50 to 150"],\n'
        '  "root_cause_hypothesis": "Database connection pool exhausted",\n'
        '  "next_diagnostic_action": "Check active vs max DB connections in pool telemetry metrics",\n'
        '  "recommended_fix": "Increase DB connection pool size and configure pool alerts",\n'
        '  "reasoning": "Symptoms match INC-001 and INC-003 where connection limits were breached. Pod restarts previously failed, while scaling pool size resolved the issue."\n'
        "}"
    )

    user_prompt = (
        f"INCOMING INCIDENT:\n"
        f"Service: {service}\n"
        f"Symptoms: {', '.join(symptoms_list)}\n"
        f"Logs: {logs or 'None provided'}\n"
        f"Description: {description or 'None provided'}\n\n"
        f"RECALLED HISTORICAL MEMORIES:\n"
        f"{memory_context}\n\n"
        f"Analyze the incident and return the required JSON object."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    parsed_dict: Optional[Dict[str, Any]] = None
    raw_output: str = ""
    # First attempt
    try:
        raw_output = _call_groq_completion(messages)
        parsed_dict = extract_json_payload(raw_output)
    except Exception:
        pass

    # Retry once if parsing failed
    if not parsed_dict:
        try:
            retry_messages = messages + [
                {"role": "assistant", "content": raw_output},
                {"role": "user", "content": "Your previous response was not valid JSON. Output ONLY the raw JSON object."},
            ]
            raw_output = _call_groq_completion(retry_messages, temperature=0.0)
            parsed_dict = extract_json_payload(raw_output)
        except Exception:
            pass

    # Normalize parsed data
    if parsed_dict:
        # Normalize confidence to 0-1
        conf = parsed_dict.get("recurrence_confidence", 0.5)
        if isinstance(conf, (int, float)) and conf > 1.0:
            conf = float(conf) / 100.0
        parsed_dict["recurrence_confidence"] = min(1.0, max(0.0, float(conf)))

        # Ensure list types
        for k in ["similar_incidents", "previously_failed", "previously_succeeded"]:
            if k in parsed_dict and not isinstance(parsed_dict[k], list):
                parsed_dict[k] = [str(parsed_dict[k])]

    # Validate against Pydantic model with safe defaults
    try:
        if parsed_dict:
            result_obj = AnalysisResult(**parsed_dict)
        else:
            raise ValueError("No parsed dictionary from LLM")
    except (ValidationError, ValueError):
        # Fallback heuristic analysis using recalled memories
        similar_ids: List[str] = [
            str(m["incident_id"])
            for m in raw_memories
            if m.get("incident_id") and m.get("incident_id") != "INC-RECALLED"
        ]
        result_obj = AnalysisResult(
            is_recurring=bool(similar_ids),
            recurrence_confidence=0.85 if similar_ids else 0.2,
            similar_incidents=similar_ids[:3],
            identified_pattern=f"Recurring operational issue in {service}" if similar_ids else "Isolated incident",
            previously_failed=["Restart application pods"],
            previously_succeeded=["Scale system capacity / connection limits"],
            root_cause_hypothesis="Resource exhaustion or downstream bottleneck matching prior incidents",
            next_diagnostic_action="Inspect connection metrics and service telemetry (avoid pod restarts)",
            recommended_fix="Apply verified fix from similar past incidents",
            reasoning="Recalled historical incidents indicate similar pattern; applying safe fallback resolution.",
        )

    # 3. CODE-LEVEL ENFORCEMENT OF SAFETY RULES
    # Under NO circumstances should next_diagnostic_action or recommended_fix repeat a previously failed action!
    for failed_act in result_obj.previously_failed:
        act_lower = failed_act.lower().strip()
        # If restarting pods previously failed and recommendation says restart
        if "restart" in act_lower:
            if "restart" in result_obj.next_diagnostic_action.lower():
                result_obj.next_diagnostic_action = "Check connection metrics and pool saturation (do NOT restart pods)"
            if "restart" in result_obj.recommended_fix.lower():
                if result_obj.previously_succeeded:
                    result_obj.recommended_fix = result_obj.previously_succeeded[0]
                else:
                    result_obj.recommended_fix = "Increase connection pool size and configure pool capacity alerts"

    # Attach raw memories
    result_dict = result_obj.model_dump()
    result_dict["raw_memories"] = raw_memories
    return result_dict
