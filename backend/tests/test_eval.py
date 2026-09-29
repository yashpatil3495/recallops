"""New unit tests for backend logic including violates(), agent safety, and memory."""

import pytest
from unittest.mock import patch, MagicMock
from backend.textmatch import violates
from backend.agent import analyze_incident
from backend.memory import store_incident, recall_similar, load_local_incidents

# ---------------------------------------------------------------------------
# textmatch.violates tests
# ---------------------------------------------------------------------------

def test_violates_paraphrased():
    """Paraphrased blocked action should match."""
    blocked = "Restart the pods"
    assert violates("Restart application pods", blocked)
    assert violates("restarting pods", blocked)

def test_violates_negation():
    """Negation is stripped, so it should not match."""
    blocked = "Restart pods"
    assert not violates("Check pool (do NOT restart pods)", blocked)
    assert not violates("never restart pods", blocked)
    assert not violates("Do not restart the pods", blocked)

def test_violates_different_action():
    """Different action should not match."""
    blocked = "Increase request timeout to 30s"
    assert not violates("Check request timeout settings", blocked)

# ---------------------------------------------------------------------------
# agent.analyze_incident tests
# ---------------------------------------------------------------------------

@patch("backend.agent.recall_similar")
@patch("backend.agent._call_groq_completion")
def test_history_comes_from_structured_memory(mock_groq, mock_recall):
    """History should come from structured memory; LLM-invented history is ignored."""
    mock_recall.return_value = [
        {
            "incident_id": "INC-001",
            "text": "Incident ID: INC-001\n",
            "attempts": [
                {"action": "Restart pods", "result": "FAILED"},
                {"action": "Scale pool", "result": "SUCCESS"}
            ],
            "score": 0.9
        }
    ]

    mock_groq.return_value = (
        "{\n"
        '  "is_recurring": true,\n'
        '  "recurrence_confidence": 0.9,\n'
        '  "similar_incidents": ["INC-001"],\n'
        '  "identified_pattern": "Pattern",\n'
        '  "previously_failed": ["Made up action"],\n'
        '  "previously_succeeded": ["Invented fix"],\n'
        '  "root_cause_hypothesis": "Hypothesis",\n'
        '  "next_diagnostic_action": "Check logs",\n'
        '  "recommended_fix": "Fix it",\n'
        '  "reasoning": "Reasoning"\n'
        "}"
    )

    res = analyze_incident("payment-api", ["symptom"])
    assert "Made up action" not in res["previously_failed"]
    assert "Restart pods" in res["previously_failed"]
    assert "Scale pool" in res["previously_succeeded"]

@patch("backend.agent.recall_similar")
@patch("backend.agent._call_groq_completion")
def test_non_restart_failed_action_blocked(mock_groq, mock_recall):
    """Non-restart failed action should be blocked and regenerated."""
    mock_recall.return_value = [
        {
            "incident_id": "INC-001",
            "text": "",
            "attempts": [{"action": "Increase request timeout to 30s", "result": "FAILED"}],
            "score": 0.9
        }
    ]

    # First call returns violation, second call returns good fix
    mock_groq.side_effect = [
        '{"is_recurring": true, "similar_incidents": ["INC-001"], "next_diagnostic_action": "Increase request timeout to 30s", "recommended_fix": "Do something else"}',
        "Check DB connection pool"
    ]

    res = analyze_incident("payment-api", ["symptom"])
    assert res["next_diagnostic_action"] == "Check DB connection pool"
    assert len(res["guardrail_events"]) == 1
    assert res["guardrail_events"][0]["source_incident"] == "INC-001"

@patch("backend.agent.recall_similar")
@patch("backend.agent._call_groq_completion")
def test_persistent_violation_fallback(mock_groq, mock_recall):
    """Persistent violation falls back deterministically."""
    mock_recall.return_value = [
        {
            "incident_id": "INC-001",
            "text": "",
            "attempts": [{"action": "Restart pods", "result": "FAILED"}],
            "score": 0.9
        }
    ]
    mock_groq.side_effect = [
        '{"is_recurring": true, "similar_incidents": ["INC-001"], "next_diagnostic_action": "Restart the pods", "recommended_fix": "Restart pods"}',
        "Restart the pods",  # Regenerated also violates
        "Restart pods"       # Regenerated also violates
    ]

    res = analyze_incident("payment-api", ["symptom"])
    assert "restart" not in res["next_diagnostic_action"].lower()
    assert "restart" not in res["recommended_fix"].lower()
    assert len(res["guardrail_events"]) == 2

@patch("backend.agent.recall_similar")
@patch("backend.agent._call_groq_completion")
def test_hallucinated_id(mock_groq, mock_recall):
    """Hallucinated ID results in is_recurring False and confidence <= 0.2."""
    mock_recall.return_value = [
        {
            "incident_id": "INC-001",
            "text": "",
            "score": 0.9
        }
    ]
    mock_groq.return_value = (
        '{"is_recurring": true, "recurrence_confidence": 0.9, "similar_incidents": ["INC-999"]}'
    )

    res = analyze_incident("payment-api", ["symptom"])
    assert res["is_recurring"] is False
    assert res["recurrence_confidence"] <= 0.2
    assert res["previously_failed"] == []

@patch("backend.agent.recall_similar")
@patch("backend.agent._call_groq_completion")
def test_llm_outage_degraded(mock_groq, mock_recall):
    """LLM outage returns degraded mode with real history."""
    mock_recall.return_value = [
        {
            "incident_id": "INC-002",
            "service": "auth-service",
            "text": "",
            "attempts": [{"action": "Restart auth service instances", "result": "FAILED"}],
            "score": 0.9
        }
    ]
    mock_groq.side_effect = RuntimeError("API Down")

    res = analyze_incident("auth-service", ["login failures"])
    assert res["degraded"] is True
    assert res["is_recurring"] is False
    assert "Restart auth service instances" in res["previously_failed"]

# ---------------------------------------------------------------------------
# memory.recall_similar tests
# ---------------------------------------------------------------------------

@patch("backend.memory._get_hindsight_client")
def test_recall_and_learning_loop(mock_get_client):
    """Test recall logic and the learning loop (store then immediately recall)."""
    # Disable Hindsight to test local recall
    mock_get_client.side_effect = Exception("Hindsight offline")

    # Store first
    inc = {
        "incident_id": "INC-001",
        "service": "payment-api",
        "symptoms": ["HTTP 500 errors", "DB connection timeout"],
        "attempts": [{"action": "Restart pods", "result": "FAILED"}],
        "root_cause": "Pool exhausted"
    }
    store_incident(inc)

    # 1. Related incident matches with structured attempts and source local_store
    matches = recall_similar(symptoms=["HTTP 500", "timeout"], service="payment-api")
    assert len(matches) > 0
    assert matches[0]["source"] == "local_store"
    assert "Restart pods" in [a["action"] for a in matches[0]["attempts"]]

    # 2. Same service with unrelated symptoms returns []
    matches_unrelated = recall_similar(symptoms=["Latency spike in image processing"], service="payment-api")
    assert len(matches_unrelated) == 0

    # 3. Unrelated service returns no match due to low overlap
    matches_other_svc = recall_similar(symptoms=["Latency"], service="other-api")
    assert len(matches_other_svc) == 0

    # 4. Learning loop: store new failed action
    inc2 = {
        "incident_id": "INC-002",
        "service": "payment-api",
        "symptoms": ["HTTP 500 errors", "DB connection timeout"],
        "attempts": [{"action": "Flush DNS", "result": "FAILED"}],
        "root_cause": "Unknown"
    }
    store_incident(inc2)

    matches_after = recall_similar(symptoms=["HTTP 500", "timeout"], service="payment-api")
    assert any(m["incident_id"] == "INC-002" for m in matches_after)
    inc2_match = next(m for m in matches_after if m["incident_id"] == "INC-002")
    assert any(a["action"] == "Flush DNS" for a in inc2_match["attempts"])

def test_generated_ids_unique():
    """Generated IDs are unique and match INC-[0-9A-F]{6}."""
    from backend.memory import _generate_incident_id
    import re
    ids = set()
    for _ in range(30):
        new_id = _generate_incident_id(ids)
        assert re.match(r"^INC-[0-9A-F]{6}$", new_id)
        ids.add(new_id)
    assert len(ids) == 30
