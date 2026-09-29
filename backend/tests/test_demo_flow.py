"""Automated verification of the end-to-end hackathon demonstration flow."""

from unittest.mock import patch
from backend.agent import analyze_incident
from backend.memory import store_incident


def test_demo_flow_incident_1_to_incident_2():
    """Verify that Incident 1's failure is learned and prevents repeat in Incident 2."""
    svc = "checkout-payment-v2"
    symptoms = ["HTTP 500 error cascade", "DB pool exhaustion"]

    # Phase 1: Incident 1 occurs, fails with restart, resolves with pool scaling
    inc_id = "INC-DEMO-TEST"
    store_incident({
        "incident_id": inc_id,
        "service": svc,
        "environment": "production",
        "symptoms": symptoms,
        "attempts": [
            {"action": "Restart payment pods", "result": "FAILED"},
            {"action": "Scale connection pool to 250", "result": "SUCCESS"},
        ],
        "root_cause": "Database connection pool exhaustion under load",
        "resolution": "Scaled connection pool to 250",
        "outcome": "RESOLVED",
    })

    # Phase 2: Incident 2 occurs later with identical symptoms
    with patch("backend.agent._call_groq_completion") as mock_groq:
        # LLM proposes repeating the failed restart action
        mock_groq.return_value = (
            '{"is_recurring": true, "recurrence_confidence": 0.95, '
            f'"similar_incidents": ["{inc_id}"], '
            '"next_diagnostic_action": "Restart payment pods", '
            '"recommended_fix": "Restart payment pods"}'
        )

        res_2 = analyze_incident(service=svc, symptoms=symptoms)

    # Assertions on Incident 2
    assert res_2["is_recurring"] is True
    assert res_2["classification"] == "RECURRING"
    assert inc_id in res_2["similar_incidents"]

    # Guardrail must have blocked "Restart payment pods"
    assert "restart payment pods" not in res_2["next_diagnostic_action"].lower()
    assert "restart payment pods" not in res_2["recommended_fix"].lower()
    assert len(res_2["guardrail_events"]) >= 1

    event = res_2["guardrail_events"][0]
    assert event["source_incident"] == inc_id
    assert event["historical_outcome"] == "FAILED"

    # Avoid recommendation must be populated
    assert res_2["avoid_recommendation"] is not None
    assert "Restart" in res_2["avoid_recommendation"]["action"]

    # Recommended fix should fall back to proven succeeded action
    assert "scale" in res_2["recommended_fix"].lower() or "pool" in res_2["recommended_fix"].lower()
