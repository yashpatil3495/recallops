"""RecallOps Hindsight Memory Management Module.

Handles storing incident lifecycles, recalling similar past incidents with
multi-dimensional contextual ranking, synthesizing outcome-aware patterns,
and computing memory metrics with local file-backed store for resilience.

Thread-safe via RLock; atomic writes via tempfile + os.replace.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from dotenv import load_dotenv

from backend.textmatch import symptom_tokens

# Ensure environment is loaded from backend/.env
ENV_PATH = Path(__file__).resolve().parent / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
else:
    load_dotenv()

DATA_DIR = Path(__file__).resolve().parent / "data"
INCIDENTS_FILE = DATA_DIR / "incidents.json"

_lock = threading.RLock()


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


# ---------------------------------------------------------------------------
# Local JSON persistence (thread-safe, atomic writes)
# ---------------------------------------------------------------------------


def _ensure_data_store() -> None:
    """Ensure local incidents data directory and JSON file exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not INCIDENTS_FILE.exists():
        with open(INCIDENTS_FILE, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)


def load_local_incidents() -> List[Dict[str, Any]]:
    """Load structured incidents from local JSON fallback store."""
    with _lock:
        _ensure_data_store()
        try:
            with open(INCIDENTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []


def save_local_incidents(incidents: List[Dict[str, Any]]) -> None:
    """Save structured incidents to local JSON fallback store (atomic)."""
    with _lock:
        _ensure_data_store()
        dir_path = INCIDENTS_FILE.parent
        fd, tmp_path = tempfile.mkstemp(dir=str(dir_path), suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(incidents, f, indent=2)
            os.replace(tmp_path, str(INCIDENTS_FILE))
        except BaseException:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise


# ---------------------------------------------------------------------------
# Incident ID generation
# ---------------------------------------------------------------------------


def _generate_incident_id(existing_ids: Set[str]) -> str:
    """Generate INC-XXXXXX (6 uppercase hex) unique vs existing_ids."""
    for _ in range(100):
        candidate = "INC-" + uuid.uuid4().hex[:6].upper()
        if candidate not in existing_ids:
            return candidate
    return "INC-" + uuid.uuid4().hex[:6].upper()


# ---------------------------------------------------------------------------
# Text formatting
# ---------------------------------------------------------------------------


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
        result = str(att.get("result", "UNKNOWN")).upper()
        attempts_lines.append(f"- [{result}] {action}")
    attempts_str = "\n".join(attempts_lines) if attempts_lines else "None recorded"

    root_cause = incident.get("root_cause", "Pending investigation")
    resolution = incident.get("resolution", "Pending resolution")
    outcome = incident.get("outcome", "RESOLVED")
    ai_rec = incident.get("ai_recommended_action") or ""
    ai_rec_str = f"AI Recommended Action: {ai_rec}\n" if ai_rec else ""

    return (
        f"Incident ID: {inc_id}\n"
        f"Service: {service} | Environment: {env} | Severity: {severity}\n"
        f"Timestamp: {ts}\n"
        f"Symptoms: {symptoms_str}\n"
        f"Logs: {logs}\n"
        f"{ai_rec_str}"
        f"Attempts:\n{attempts_str}\n"
        f"Root Cause: {root_cause}\n"
        f"Resolution: {resolution}\n"
        f"Outcome: {outcome}\n"
    )


# ---------------------------------------------------------------------------
# Parse attempts from lifecycle text
# ---------------------------------------------------------------------------

_ATTEMPT_LINE_RE = re.compile(
    r"-\s*\[(FAILED|SUCCESS|PARTIAL|UNKNOWN)\]\s*(.+)",
    re.IGNORECASE,
)


def parse_attempts_from_text(text: str) -> List[Dict[str, str]]:
    """Recover [{action, result}] from lines like '- [FAILED] Restart pods'."""
    attempts = []
    for m in _ATTEMPT_LINE_RE.finditer(text):
        result = m.group(1).upper()
        action = m.group(2).strip()
        if action:
            attempts.append({"action": action, "result": result})
    return attempts


# ---------------------------------------------------------------------------
# Store incident
# ---------------------------------------------------------------------------


def store_incident(incident: Dict[str, Any]) -> Dict[str, Any]:
    """Store incident in Hindsight long-term memory and local JSON store."""
    with _lock:
        local_incidents = load_local_incidents()
        existing_ids = {inc.get("incident_id") for inc in local_incidents}

        if not incident.get("incident_id"):
            incident["incident_id"] = _generate_incident_id(existing_ids)
        if not incident.get("timestamp"):
            incident["timestamp"] = datetime.now(timezone.utc).isoformat()

        # Normalize attempts
        raw_attempts = incident.get("attempts", [])
        normalized_attempts = []
        for att in raw_attempts:
            action = str(att.get("action", "")).strip()
            if not action:
                continue
            result = str(att.get("result", "")).strip().upper()
            if result not in ("FAILED", "SUCCESS", "PARTIAL", "UNKNOWN"):
                result = "PARTIAL"
            normalized_attempts.append({"action": action, "result": result})
        incident["attempts"] = normalized_attempts

        # Calculate failed attempts count from structured attempts
        failed_count = sum(1 for a in normalized_attempts if a["result"] == "FAILED")
        incident["failed_attempts"] = failed_count

        lifecycle_text = format_lifecycle_text(incident)
        bank_id = get_bank_id()

        # Append to local store (idempotent by incident_id)
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

    # Retain to Hindsight memory (outside lock - async/external)
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
            if incident.get("ai_recommended_action"):
                metadata["ai_recommended_action"] = str(incident.get("ai_recommended_action"))
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
        # If external service fails, local store has secured the record
        hindsight_result = {"error": f"{type(exc).__name__}"}

    return {
        "success": True,
        "incident_id": incident["incident_id"],
        "stored": incident,
        "hindsight": hindsight_result,
    }


# ---------------------------------------------------------------------------
# Signal Extraction Helper for Multi-Dimensional Matching
# ---------------------------------------------------------------------------

_ERROR_CODE_RE = re.compile(r"\b([45]\d{2})\b")
_EXCEPTION_RE = re.compile(
    r"\b([A-Z][a-zA-Z0-9]+(?:Error|Exception|Timeout|Exceeded|Disconnected|Out of memory|OOMKilled))\b"
)


def _extract_error_signals(text: str) -> Set[str]:
    """Extract error codes and exception identifiers from log or symptom text."""
    signals: Set[str] = set()
    for code in _ERROR_CODE_RE.findall(text):
        signals.add(code)
    for exc in _EXCEPTION_RE.findall(text):
        signals.add(exc.lower())
    return signals


# ---------------------------------------------------------------------------
# Recall similar (Multi-Dimensional Contextual Ranking)
# ---------------------------------------------------------------------------


def recall_similar(
    symptoms: List[str] | str,
    service: Optional[str] = None,
    environment: Optional[str] = None,
    logs: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Recall similar past incidents from Hindsight merged with local matches.

    Applies multi-dimensional contextual ranking:
    1. Service match (weight: 0.35)
    2. Symptom semantic/stem overlap (weight: 0.35)
    3. Error signal / exception match (weight: 0.15)
    4. Environment match (weight: 0.10)
    5. Outcome confirmation (weight: 0.05)

    Computes explainable matching_factors for transparent verification.
    Results carry ``source`` = "hindsight" | "local_store". Capped at 8.
    """
    if isinstance(symptoms, list):
        symptoms_str = " ".join(symptoms)
        symptoms_items = symptoms
    else:
        symptoms_str = str(symptoms)
        symptoms_items = [s.strip() for s in symptoms.split(";") if s.strip()] or [symptoms_str]

    combined_query_text = f"{symptoms_str} {logs or ''}"
    query_toks = symptom_tokens(symptoms_str)
    query_signals = _extract_error_signals(combined_query_text)
    target_env = (environment or "production").lower()
    target_svc = (service or "").lower()

    if service:
        query = f"Service: {service}. Symptoms: {symptoms_str}"
    else:
        query = f"Symptoms: {symptoms_str}"

    bank_id = get_bank_id()
    hindsight_memories: List[Dict[str, Any]] = []
    seen_ids: Set[str] = set()

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
                        m = re.search(r"Incident ID:\s*(INC-[\w-]+)", text)
                        if m:
                            inc_id = m.group(1)

                    scores = getattr(r, "scores", None)
                    base_score = 0.85
                    if scores and hasattr(scores, "final_score"):
                        base_score = float(scores.final_score)

                    mem = {
                        "incident_id": inc_id or "INC-RECALLED",
                        "text": text,
                        "metadata": metadata,
                        "score": base_score,
                        "source": "hindsight",
                        "service": metadata.get("service"),
                        "environment": metadata.get("environment"),
                        "root_cause": metadata.get("root_cause"),
                    }
                    hindsight_memories.append(mem)
                    if inc_id:
                        seen_ids.add(inc_id)
        finally:
            client.close()
    except Exception:
        pass

    # 2. Local scoring & multi-dimensional evaluation
    local_incidents = load_local_incidents()
    local_by_id = {inc.get("incident_id"): inc for inc in local_incidents}

    local_matches: List[Dict[str, Any]] = []

    for inc in local_incidents:
        inc_id = inc.get("incident_id")
        inc_service = (inc.get("service") or "").lower()
        inc_env = (inc.get("environment") or "production").lower()

        # Build incident text for token and signal matching
        inc_symptoms_list = inc.get("symptoms", [])
        inc_symptoms_str = " ".join(inc_symptoms_list)
        inc_cause = inc.get("root_cause") or ""
        inc_logs = inc.get("logs") or ""
        combined_inc_text = f"{inc_symptoms_str} {inc_cause} {inc_logs}"
        inc_toks = symptom_tokens(combined_inc_text)
        inc_signals = _extract_error_signals(combined_inc_text)

        same_service = bool(target_svc and target_svc == inc_service)

        if not query_toks:
            continue
        overlap = len(query_toks & inc_toks)
        ratio = overlap / len(query_toks) if query_toks else 0.0

        # Basic eligibility gate
        if same_service and overlap >= 1:
            base_score = 0.3 + 0.7 * ratio
        elif not same_service and overlap >= 2:
            base_score = 0.7 * ratio
        else:
            continue

        if base_score < 0.35:
            continue

        mem = {
            "incident_id": inc_id,
            "text": format_lifecycle_text(inc),
            "metadata": {
                "incident_id": inc_id,
                "service": inc.get("service"),
                "environment": inc.get("environment"),
                "root_cause": inc.get("root_cause"),
                "failed_attempts": str(inc.get("failed_attempts", 0)),
            },
            "score": round(base_score, 3),
            "source": "local_store",
            "attempts": inc.get("attempts", []),
            "service": inc.get("service"),
            "environment": inc.get("environment"),
            "root_cause": inc.get("root_cause"),
        }
        local_matches.append(mem)

    # 3. Merge: Hindsight first, then local matches not already present
    all_candidates = list(hindsight_memories)
    for lm in local_matches:
        lid = lm.get("incident_id")
        if lid and lid not in seen_ids:
            all_candidates.append(lm)
            seen_ids.add(lid)

    # 4. Multi-dimensional contextual rescoring & explanation generation
    ranked_memories: List[Dict[str, Any]] = []

    for mem in all_candidates:
        mid = mem.get("incident_id")
        local_rec = local_by_id.get(mid)

        # Hydrate fields
        if local_rec:
            if not mem.get("attempts"):
                mem["attempts"] = local_rec.get("attempts", [])
            if not mem.get("service"):
                mem["service"] = local_rec.get("service")
            if not mem.get("environment"):
                mem["environment"] = local_rec.get("environment")
            if not mem.get("root_cause"):
                mem["root_cause"] = local_rec.get("root_cause")
        else:
            if not mem.get("attempts"):
                mem["attempts"] = parse_attempts_from_text(mem.get("text", ""))

        mem_text = mem.get("text", "")
        mem_svc = (mem.get("service") or mem.get("metadata", {}).get("service") or "").lower()
        mem_env = (mem.get("environment") or mem.get("metadata", {}).get("environment") or "production").lower()
        mem_toks = symptom_tokens(mem_text)
        mem_signals = _extract_error_signals(mem_text)

        matching_factors: List[str] = []

        # Factor 1: Service match
        service_score = 0.0
        if target_svc and mem_svc:
            if target_svc == mem_svc:
                service_score = 1.0
                matching_factors.append(f"Same service ({mem_svc})")
            elif target_svc.split("-")[0] == mem_svc.split("-")[0]:
                service_score = 0.5
                matching_factors.append("Related service domain")
            else:
                service_score = 0.0
        else:
            service_score = 0.4

        # Factor 2: Symptom match
        symptom_overlap = len(query_toks & mem_toks)
        symptom_score = (symptom_overlap / len(query_toks)) if query_toks else 0.5
        symptom_score = min(1.0, max(0.0, symptom_score))
        if symptom_score >= 0.70:
            matching_factors.append("Identical symptoms")
        elif symptom_score >= 0.35:
            matching_factors.append("Similar symptoms")

        # Factor 3: Error signal match
        signal_overlap = query_signals & mem_signals
        if signal_overlap:
            error_signal_score = 1.0
            matching_factors.append(f"Matching error signal ({', '.join(sorted(signal_overlap))})")
        else:
            error_signal_score = 0.3 if not query_signals else 0.0

        # Factor 4: Environment match
        if target_env == mem_env:
            env_score = 1.0
            matching_factors.append(f"Same environment ({mem_env})")
        else:
            env_score = 0.4
            matching_factors.append(f"Different environment ({target_env} vs {mem_env})")

        # Factor 5: Historical outcome clarity
        has_failed = any(str(a.get("result", "")).upper() == "FAILED" for a in mem.get("attempts", []))
        has_success = any(str(a.get("result", "")).upper() == "SUCCESS" for a in mem.get("attempts", []))
        if has_failed and has_success:
            outcome_score = 1.0
            matching_factors.append("Contains verified failed & successful fixes")
        elif has_failed:
            outcome_score = 0.8
            matching_factors.append("Contains known failed action history")
        elif has_success:
            outcome_score = 0.8
            matching_factors.append("Contains confirmed resolution fix")
        else:
            outcome_score = 0.5

        # Composite multi-dimensional score
        computed_score = (
            0.35 * service_score
            + 0.30 * symptom_score
            + 0.15 * error_signal_score
            + 0.10 * env_score
            + 0.10 * outcome_score
        )

        # Blend with initial score
        orig_score = float(mem.get("score", 0.7))
        final_score = round(0.70 * computed_score + 0.30 * orig_score, 2)
        final_score = min(0.99, max(0.20, final_score))

        mem["score"] = final_score
        mem["matching_factors"] = matching_factors
        mem["service_match"] = round(service_score, 2)
        mem["symptom_match"] = round(symptom_score, 2)
        mem["environment_match"] = round(env_score, 2)

        ranked_memories.append(mem)

    # Sort descending by calculated multi-dimensional score
    ranked_memories.sort(key=lambda m: m.get("score", 0.0), reverse=True)
    return ranked_memories[:8]


# ---------------------------------------------------------------------------
# Outcome-Aware Patterns & Stats
# ---------------------------------------------------------------------------


def summarize_learned_patterns() -> str:
    """Synthesize outcome-aware failure patterns and proven resolutions across memory."""
    local_incidents = load_local_incidents()
    if not local_incidents:
        return "No historical incidents recorded in memory yet."

    # Group incidents by (service, root_cause)
    pattern_groups: Dict[str, Dict[str, Any]] = {}

    for inc in local_incidents:
        svc = inc.get("service", "unknown-service")
        rc = inc.get("root_cause") or "Unclassified root cause"
        key = f"{svc}:::{rc}"

        if key not in pattern_groups:
            pattern_groups[key] = {
                "service": svc,
                "root_cause": rc,
                "occurrences": 0,
                "failed_actions": {},
                "success_actions": {},
                "symptoms": set(),
            }

        group = pattern_groups[key]
        group["occurrences"] += 1
        for s in inc.get("symptoms", []):
            group["symptoms"].add(s)

        for a in inc.get("attempts", []):
            act = a.get("action", "")
            res = str(a.get("result", "")).upper()
            if res == "FAILED":
                group["failed_actions"][act] = group["failed_actions"].get(act, 0) + 1
            elif res == "SUCCESS":
                group["success_actions"][act] = group["success_actions"].get(act, 0) + 1

    # Format synthesized patterns
    lines: List[str] = [
        f"Memory synthesized across {len(local_incidents)} historical incidents:",
        "",
    ]

    for key, p in sorted(pattern_groups.items(), key=lambda item: item[1]["occurrences"], reverse=True):
        svc = p["service"]
        rc = p["root_cause"]
        occ = p["occurrences"]

        lines.append(f"RECURRING PATTERN: {svc}")
        lines.append(f"  • Root Cause: {rc}")
        lines.append(f"  • Total Occurrences: {occ}")

        if p["failed_actions"]:
            failed_str = ", ".join(f"{act} ({count}x failed)" for act, count in p["failed_actions"].items())
            lines.append(f"  • Common FAILED remediations: {failed_str}")
        else:
            lines.append("  • Common FAILED remediations: None recorded")

        if p["success_actions"]:
            success_str = ", ".join(f"{act} ({count}x verified)" for act, count in p["success_actions"].items())
            lines.append(f"  • Proven SUCCESSFUL fixes: {success_str}")
        else:
            lines.append("  • Proven SUCCESSFUL fixes: None confirmed yet")

        lines.append("")

    return "\n".join(lines).strip()


def get_memory_stats() -> Dict[str, Any]:
    """Compute aggregate memory statistics from structured records."""
    local_incidents = load_local_incidents()
    total = len(local_incidents)
    resolved = sum(1 for i in local_incidents if str(i.get("outcome", "")).upper() == "RESOLVED")

    failed_count = 0
    success_count = 0
    root_causes: set[str] = set()
    service_counts: Dict[str, int] = {}
    failed_patterns: set[str] = set()
    success_patterns: set[str] = set()
    latest_ts: Optional[str] = None

    for inc in local_incidents:
        svc = inc.get("service")
        if svc:
            service_counts[svc] = service_counts.get(svc, 0) + 1
        rc = inc.get("root_cause")
        if rc and rc.strip():
            root_causes.add(rc.strip())

        ts = inc.get("timestamp")
        if ts:
            if latest_ts is None or ts > latest_ts:
                latest_ts = ts

        for a in inc.get("attempts", []):
            res = str(a.get("result", "")).upper()
            act = a.get("action", "")
            if res == "FAILED":
                failed_count += 1
                failed_patterns.add(act)
            elif res == "SUCCESS":
                success_count += 1
                success_patterns.add(act)

    recurring_services = [s for s, count in service_counts.items() if count > 1]
    recurring_patterns_count = len([s for s, count in service_counts.items() if count > 1])

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
        "recurring_patterns_count": recurring_patterns_count,
        "failed_patterns_count": len(failed_patterns),
        "successful_patterns_count": len(success_patterns),
        "latest_memory_update": latest_ts,
    }


# ---------------------------------------------------------------------------
# Hindsight health check
# ---------------------------------------------------------------------------


def check_hindsight() -> Dict[str, Any]:
    """Check Hindsight connectivity -> {ok: bool, detail?: str}."""
    try:
        client = _get_hindsight_client()
        try:
            client.list_memories(bank_id=get_bank_id(), limit=1)
        finally:
            client.close()
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "detail": type(exc).__name__}
