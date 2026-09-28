"""RecallOps Hindsight Memory Management Module.

Handles storing incident lifecycles, recalling similar past incidents,
reflecting on learned patterns, and computing memory stats with a local
file-backed store for resilience.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

# Ensure environment is loaded from backend/.env
ENV_PATH = Path(__file__).resolve().parent / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
else:
    load_dotenv()

DATA_DIR = Path(__file__).resolve().parent / "data"
INCIDENTS_FILE = DATA_DIR / "incidents.json"


class MemoryServiceError(Exception):
    """Raised when external memory operations fail."""


def _get_hindsight_client():
    """Instantiate and return Hindsight client with configured settings."""
    from hindsight_client import Hindsight

    api_key = os.getenv("HINDSIGHT_API_KEY")
    base_url = os.getenv("HINDSIGHT_API_URL", "https://api.hindsight.vectorize.io")
    if not api_key:
        raise MemoryServiceError("HINDSIGHT_API_KEY is not configured in backend/.env")

    return Hindsight(base_url=base_url, api_key=api_key, timeout=20.0)


def get_bank_id() -> str:
    """Return the memory bank ID."""
    return os.getenv("HINDSIGHT_BANK_ID") or os.getenv("HINDSIGHT_PROJECT_ID") or "recallops-demo"


def _ensure_data_store() -> None:
    """Ensure local incidents data directory and JSON file exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not INCIDENTS_FILE.exists():
        with open(INCIDENTS_FILE, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)


def load_local_incidents() -> List[Dict[str, Any]]:
    """Load structured incidents from local JSON fallback store."""
    _ensure_data_store()
    try:
        with open(INCIDENTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_local_incidents(incidents: List[Dict[str, Any]]) -> None:
    """Save structured incidents to local JSON fallback store."""
    _ensure_data_store()
    with open(INCIDENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(incidents, f, indent=2)


def format_lifecycle_text(incident: Dict[str, Any]) -> str:
    """Format an incident lifecycle into structured text for Hindsight retain."""
    inc_id = incident.get("incident_id", "INC-UNKNOWN")
    service = incident.get("service", "unknown-service")
    env = incident.get("environment", "production")
    severity = incident.get("severity", "medium")
    ts = incident.get("timestamp") or datetime.now(timezone.utc).isoformat()

    symptoms = incident.get("symptoms", [])
    if isinstance(symptoms, list):
        symptoms_str = "; ".join(symptoms)
    else:
        symptoms_str = str(symptoms)

    logs = incident.get("logs", "")
    attempts = incident.get("attempts", [])
    attempts_lines = []
    for att in attempts:
        action = att.get("action", "")
        result = att.get("result", "UNKNOWN").upper()
        attempts_lines.append(f"- [{result}] {action}")
    attempts_str = "\n".join(attempts_lines) if attempts_lines else "None recorded"

    root_cause = incident.get("root_cause", "Pending investigation")
    resolution = incident.get("resolution", "Pending resolution")
    outcome = incident.get("outcome", "RESOLVED")

    return (
        f"Incident ID: {inc_id}\n"
        f"Service: {service} | Environment: {env} | Severity: {severity}\n"
        f"Timestamp: {ts}\n"
        f"Symptoms: {symptoms_str}\n"
        f"Logs: {logs}\n"
        f"Attempts:\n{attempts_str}\n"
        f"Root Cause: {root_cause}\n"
        f"Resolution: {resolution}\n"
        f"Outcome: {outcome}\n"
    )


def store_incident(incident: Dict[str, Any]) -> Dict[str, Any]:
    """Store incident in Hindsight long-term memory and local JSON store."""
    if not incident.get("incident_id"):
        incident["incident_id"] = f"INC-{int(datetime.now(timezone.utc).timestamp())}"
    if not incident.get("timestamp"):
        incident["timestamp"] = datetime.now(timezone.utc).isoformat()

    # Calculate failed attempts count from structured attempts
    attempts = incident.get("attempts", [])
    failed_count = sum(1 for a in attempts if str(a.get("result", "")).upper() == "FAILED")
    incident["failed_attempts"] = failed_count

    lifecycle_text = format_lifecycle_text(incident)
    bank_id = get_bank_id()

    # 1. Append to local store (ensuring idempotency by incident_id)
    local_incidents = load_local_incidents()
    existing_idx = next(
        (
            i
            for i, inc in enumerate(local_incidents)
            if inc.get("incident_id") == incident["incident_id"]
        ),
        None,
    )
    if existing_idx is not None:
        local_incidents[existing_idx] = incident
    else:
        local_incidents.append(incident)
    save_local_incidents(local_incidents)

    # 2. Retain to Hindsight memory
    hindsight_result = None
    try:
        client = _get_hindsight_client()
        try:
            metadata = {
                "incident_id": str(incident.get("incident_id")),
                "service": str(incident.get("service")),
                "severity": str(incident.get("severity")),
                "environment": str(incident.get("environment")),
                "root_cause": str(incident.get("root_cause")),
                "outcome": str(incident.get("outcome")),
                "failed_attempts": str(failed_count),
            }
            res = client.retain(
                bank_id=bank_id,
                content=lifecycle_text,
                metadata=metadata,
            )
            hindsight_result = {
                "items_count": getattr(res, "items_count", 1),
                "operation_id": getattr(res, "operation_id", None),
            }
        finally:
            client.close()
    except Exception as exc:
        # If external service fails, log error but local store has secured the record
        hindsight_result = {"error": f"{type(exc).__name__}: {exc}"}

    return {
        "success": True,
        "incident_id": incident["incident_id"],
        "stored": incident,
        "hindsight": hindsight_result,
    }


def recall_similar(
    symptoms: List[str] | str,
    service: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Recall similar past incidents from Hindsight, with local fallback."""
    if isinstance(symptoms, list):
        symptoms_str = " ".join(symptoms)
    else:
        symptoms_str = str(symptoms)

    if service:
        query = f"Service: {service}. Symptoms: {symptoms_str}"
    else:
        query = f"Symptoms: {symptoms_str}"

    bank_id = get_bank_id()
    memories: List[Dict[str, Any]] = []

    # 1. Try Hindsight Recall
    try:
        client = _get_hindsight_client()
        try:
            resp = client.recall(bank_id=bank_id, query=query)
            if resp and hasattr(resp, "results") and resp.results:
                for r in resp.results:
                    text = getattr(r, "text", "") or str(r)
                    metadata = getattr(r, "metadata", {}) or {}
                    inc_id = metadata.get("incident_id")
                    if not inc_id:
                        # Extract INC-XXX from text
                        m = re.search(r"Incident ID:\s*(INC-[\w-]+)", text)
                        if m:
                            inc_id = m.group(1)

                    scores = getattr(r, "scores", None)
                    score = 0.85
                    if scores and hasattr(scores, "final_score"):
                        score = float(scores.final_score)

                    memories.append({
                        "incident_id": inc_id or "INC-RECALLED",
                        "text": text,
                        "metadata": metadata,
                        "score": score,
                        "source": "hindsight",
                    })
        finally:
            client.close()
    except Exception:
        # Fall through to local fallback
        pass

    # 2. Local fallback if Hindsight returned nothing (e.g. async delay or network issue)
    if not memories:
        local_incidents = load_local_incidents()
        query_words = set(re.findall(r"\w+", symptoms_str.lower()))
        for inc in local_incidents:
            match_score = 0.0
            inc_service = (inc.get("service") or "").lower()
            if service and service.lower() in inc_service:
                match_score += 0.4

            inc_symptoms = " ".join(inc.get("symptoms", [])).lower()
            inc_cause = (inc.get("root_cause") or "").lower()
            combined_text = f"{inc_symptoms} {inc_cause}"

            matched_words = sum(1 for w in query_words if len(w) > 2 and w in combined_text)
            if matched_words > 0:
                match_score += min(0.5, matched_words * 0.15)

            if match_score > 0.3:
                memories.append({
                    "incident_id": inc.get("incident_id"),
                    "text": format_lifecycle_text(inc),
                    "metadata": {
                        "incident_id": inc.get("incident_id"),
                        "service": inc.get("service"),
                        "root_cause": inc.get("root_cause"),
                        "failed_attempts": str(inc.get("failed_attempts", 0)),
                    },
                    "score": round(match_score, 2),
                    "source": "local_store",
                })

        # Sort by relevance score descending
        memories.sort(key=lambda m: m.get("score", 0.0), reverse=True)

    return memories


def summarize_learned_patterns() -> str:
    """Reflect on historical failure patterns and what fixed them."""
    bank_id = get_bank_id()
    query = (
        "Summarize top recurring failure patterns, root causes, what actions failed, "
        "and what fixes succeeded."
    )

    try:
        client = _get_hindsight_client()
        try:
            resp = client.reflect(bank_id=bank_id, query=query, budget="low")
            if resp and hasattr(resp, "text") and resp.text:
                return resp.text.strip()
        finally:
            client.close()
    except Exception:
        pass

    # Fallback pattern summary computed from local store
    local_incidents = load_local_incidents()
    if not local_incidents:
        return "No historical incidents recorded in memory yet."

    services: Dict[str, int] = {}
    failed_actions: List[str] = []
    success_fixes: List[str] = []

    for inc in local_incidents:
        svc = inc.get("service", "unknown")
        services[svc] = services.get(svc, 0) + 1
        for a in inc.get("attempts", []):
            if a.get("result", "").upper() == "FAILED":
                failed_actions.append(f"{a.get('action')} ({svc})")
            elif a.get("result", "").upper() == "SUCCESS":
                success_fixes.append(f"{a.get('action')} ({svc})")

    most_affected = max(services.items(), key=lambda x: x[1])[0] if services else "None"
    failed_summary = ", ".join(failed_actions[:3]) if failed_actions else "None"
    success_summary = ", ".join(success_fixes[:3]) if success_fixes else "None"
    return (
        f"Memory contains {len(local_incidents)} incidents. "
        f"Most frequent incident service: {most_affected}. "
        f"Common failed actions: {failed_summary}. "
        f"Proven successful fixes: {success_summary}."
    )


def get_memory_stats() -> Dict[str, Any]:
    """Compute aggregate memory statistics from structured records."""
    local_incidents = load_local_incidents()
    total = len(local_incidents)
    resolved = sum(1 for i in local_incidents if str(i.get("outcome", "")).upper() == "RESOLVED")

    failed_count = 0
    success_count = 0
    root_causes: set[str] = set()
    service_counts: Dict[str, int] = {}

    for inc in local_incidents:
        svc = inc.get("service")
        if svc:
            service_counts[svc] = service_counts.get(svc, 0) + 1
        rc = inc.get("root_cause")
        if rc and rc.strip():
            root_causes.add(rc.strip())
        for a in inc.get("attempts", []):
            res = str(a.get("result", "")).upper()
            if res == "FAILED":
                failed_count += 1
            elif res == "SUCCESS":
                success_count += 1

    recurring_services = [s for s, count in service_counts.items() if count > 1]

    # Check Hindsight memory units count if possible
    hindsight_units: Optional[int] = None
    try:
        client = _get_hindsight_client()
        try:
            h_resp = client.list_memories(bank_id=get_bank_id(), limit=1)
            if h_resp and hasattr(h_resp, "total"):
                hindsight_units = h_resp.total
        finally:
            client.close()
    except Exception:
        hindsight_units = None

    return {
        "total_incidents": total,
        "resolved": resolved,
        "root_causes_learned": len(root_causes),
        "failed_approaches_logged": failed_count,
        "successful_approaches": success_count,
        "recurring_services": recurring_services,
        "hindsight_count": hindsight_units,
    }
