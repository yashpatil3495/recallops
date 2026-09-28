"""Unit tests for backend/agent.py with Groq and recall mocked."""

from unittest.mock import patch
from backend.agent import analyze_incident, extract_json_payload


def test_extract_json_with_think_and_markdown():
    """Test extracting JSON when wrapped in <think> tags and markdown code blocks."""
    raw = (
        "<think>The incident matches INC-001. We should avoid restarting.</think>\n"
        "```json\n"
        "{\n"
        '  "is_recurring": true,\n'
        '  "recurrence_confidence": 0.95,\n'
        '  "similar_incidents": ["INC-001", "INC-003"],\n'
        '  "identified_pattern": "DB connection pool exhaustion",\n'
        '  "previously_failed": ["Restart application pods"],\n'
        '  "previously_succeeded": ["Increase DB connection pool from 50 to 150"],\n'
        '  "root_cause_hypothesis": "Connection pool exhausted",\n'
        '  "next_diagnostic_action": "Check active DB connections",\n'
        '  "recommended_fix": "Increase DB connection pool",\n'
        '  "reasoning": "Matches prior incidents INC-001 and INC-003."\n'
        "}\n"
        "```"
    )
    parsed = extract_json_payload(raw)
    assert parsed is not None
    assert parsed["is_recurring"] is True
    assert parsed["recurrence_confidence"] == 0.95
    assert "INC-001" in parsed["similar_incidents"]


@patch("backend.agent.recall_similar")
@patch("backend.agent._call_groq_completion")
def test_analyze_incident_enforces_safety_rule(mock_groq, mock_recall):
    """Test that failed actions in history are never recommended by the agent."""
    mock_recall.return_value = [
        {
            "incident_id": "INC-001",
            "text": "Incident ID: INC-001\nAttempts:\n- [FAILED] Restart pods\n- [SUCCESS] Pool to 150",
            "score": 0.9,
            "metadata": {"incident_id": "INC-001"},
        }
    ]

    mock_groq.return_value = (
        "{\n"
        '  "is_recurring": true,\n'
        '  "recurrence_confidence": 0.9,\n'
        '  "similar_incidents": ["INC-001"],\n'
        '  "identified_pattern": "DB connection pool exhaustion",\n'
        '  "previously_failed": ["Restart pods"],\n'
        '  "previously_succeeded": ["Increase pool to 150"],\n'
        '  "root_cause_hypothesis": "Pool exhausted",\n'
        '  "next_diagnostic_action": "Restart the pods",\n'
        '  "recommended_fix": "Restart the pods",\n'
        '  "reasoning": "Testing safety enforcement."\n'
        "}"
    )

    res = analyze_incident(service="payment-api", symptoms=["HTTP 500", "DB timeout"])
    assert res["is_recurring"] is True
    assert "restart the pods" not in res["next_diagnostic_action"].lower()
    assert "restart the pods" not in res["recommended_fix"].lower()
    assert len(res["raw_memories"]) == 1


@patch("backend.agent.recall_similar")
def test_analyze_incident_no_memories(mock_recall):
    """Test incident analysis fallback when memory bank returns no matches."""
    mock_recall.return_value = []
    res = analyze_incident(service="new-service", symptoms=["Unseen error"])
    assert res["is_recurring"] is False
    assert res["recurrence_confidence"] <= 0.3
    assert res["similar_incidents"] == []
