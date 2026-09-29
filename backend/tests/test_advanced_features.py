"""Tests for advanced features: structured extraction, recurrence classification,
explainable guardrails, multi-dimensional retrieval, and degraded mode.
"""

from unittest.mock import patch
import pytest

from backend.agent import (
    analyze_incident,
    extract_incident_structure,
)
from backend.memory import (
    recall_similar,
    store_incident,
    summarize_learned_patterns,
    get_memory_stats,
)


def test_structured_incident_extraction():
    """Test context-aware structured incident extraction without hallucination."""
    ext = extract_incident_structure(
        service="payment-api",
        symptoms=["HTTP 503 Service Unavailable", "database connection timeout", "p99 latency > 8000ms"],
        logs="TimeoutError: connection pool exhausted after 30000ms during recent deployment of v2.4.1",
        description="Payment API is returning 503 errors after the latest deployment.",
        environment="production",
        severity="critical",
    )

    assert ext.service == "payment-api"
    assert ext.environment == "production"
    assert "HTTP 503" in ext.error_signals
    assert "TimeoutError" in ext.error_signals
    assert "p99 latency > 8000ms" in ext.error_signals
    assert ext.affected_component == "database connection pool"
    assert ext.trigger == "recent deployment"
    assert ext.deployment_version == "v2.4.1"
    assert ext.suspected_area == "database/dependency"


def test_structured_incident_extraction_unspecified_fields_are_none():
    """Missing signals in text should remain None or empty rather than hallucinated."""
    ext = extract_incident_structure(
        service="custom-service",
        symptoms=["Intermittent error"],
        logs=None,
        description=None,
    )
    assert ext.service == "custom-service"
    assert ext.trigger is None
    assert ext.deployment_version is None
    assert ext.affected_component is None


@patch("backend.agent.recall_similar")
@patch("backend.agent._call_groq_completion")
def test_recurrence_classification_recurring(mock_groq, mock_recall):
    """Test RECURRING classification when service, symptoms, and environment align."""
    mock_recall.return_value = [
        {
            "incident_id": "INC-001",
            "service": "payment-api",
            "environment": "production",
            "root_cause": "DB pool exhaustion",
            "text": "Incident ID: INC-001\nService: payment-api | Environment: production\n",
            "score": 0.95,
            "matching_factors": ["Same service (payment-api)", "Same environment (production)"],
            "attempts": [
                {"action": "Restart pods", "result": "FAILED"},
                {"action": "Scale pool to 150", "result": "SUCCESS"},
            ],
        }
    ]

    mock_groq.return_value = (
        '{"is_recurring": true, "recurrence_confidence": 0.94, '
        '"similar_incidents": ["INC-001"], "identified_pattern": "DB pool exhaustion", '
        '"next_diagnostic_action": "Check active connections", "recommended_fix": "Scale pool to 150"}'
    )

    res = analyze_incident(
        service="payment-api",
        symptoms=["HTTP 500 errors spike", "database connection timeout"],
        environment="production",
    )

    assert res["classification"] == "RECURRING"
    assert res["recurrence_status"] == "RECURRING"
    assert res["is_recurring"] is True
    assert "INC-001" in res["recurrence_explanation"]
    assert res["what_changed"] is not None
    assert any("Service: payment-api" in s for s in res["what_changed"]["same"])


@patch("backend.agent.recall_similar")
@patch("backend.agent._call_groq_completion")
def test_recurrence_classification_known_variant(mock_groq, mock_recall):
    """Test KNOWN_VARIANT classification when environment or trigger differs."""
    mock_recall.return_value = [
        {
            "incident_id": "INC-001",
            "service": "payment-api",
            "environment": "production",
            "root_cause": "DB pool exhaustion",
            "text": "Incident ID: INC-001\nService: payment-api | Environment: production\n",
            "score": 0.82,
            "matching_factors": ["Same service (payment-api)", "Different environment (staging vs production)"],
            "attempts": [
                {"action": "Restart pods", "result": "FAILED"},
                {"action": "Scale pool to 150", "result": "SUCCESS"},
            ],
        }
    ]

    mock_groq.return_value = (
        '{"is_recurring": true, "recurrence_confidence": 0.85, '
        '"similar_incidents": ["INC-001"], "identified_pattern": "DB pool exhaustion in staging", '
        '"next_diagnostic_action": "Check staging connections", "recommended_fix": "Scale pool"}'
    )

    # Current incident is in staging
    res = analyze_incident(
        service="payment-api",
        symptoms=["HTTP 500 errors spike", "database connection timeout"],
        environment="staging",
    )

    assert res["classification"] == "KNOWN_VARIANT"
    assert res["recurrence_status"] == "KNOWN_VARIANT"
    assert res["is_recurring"] is True
    assert len(res["novel_factors"]) > 0
    assert any("staging" in f.lower() for f in res["novel_factors"])


@patch("backend.agent.recall_similar")
@patch("backend.agent._call_groq_completion")
def test_explainable_guardrail_details(mock_groq, mock_recall):
    """Guardrail intervention must return explainable statistics and suggested next step."""
    mock_recall.return_value = [
        {
            "incident_id": "INC-001",
            "service": "payment-api",
            "root_cause": "DB connection pool exhaustion",
            "text": "",
            "score": 0.92,
            "attempts": [
                {"action": "Restart application pods", "result": "FAILED"},
                {"action": "Increase DB connection pool", "result": "SUCCESS"},
            ],
        },
        {
            "incident_id": "INC-003",
            "service": "payment-api",
            "root_cause": "DB connection pool exhaustion",
            "text": "",
            "score": 0.90,
            "attempts": [
                {"action": "Restart application pods", "result": "FAILED"},
            ],
        },
    ]

    # Groq proposes repeating the failed restart
    mock_groq.return_value = (
        '{"is_recurring": true, "recurrence_confidence": 0.9, '
        '"similar_incidents": ["INC-001", "INC-003"], '
        '"next_diagnostic_action": "Restart pods", '
        '"recommended_fix": "Restart application pods"}'
    )

    res = analyze_incident(service="payment-api", symptoms=["HTTP 500 errors", "DB timeout"])

    assert len(res["guardrail_events"]) >= 1
    event = res["guardrail_events"][0]
    assert event["historical_outcome"] == "FAILED"
    assert event["matching_incidents_count"] == 2
    assert "0 / 2" in event["historical_success_rate"]
    assert "DB connection pool exhaustion" in event["known_failure_context"]
    assert len(event["suggested_next_step"]) > 0

    # Ensure "avoid_recommendation" is populated
    assert res["avoid_recommendation"] is not None
    assert "Restart" in res["avoid_recommendation"]["action"]
    assert res["avoid_recommendation"]["failure_count"] == 2

    # Ensure recommendation why contains evidence
    assert len(res["recommendation_why"]) >= 2
    assert any("avoid" in w.lower() for w in res["recommendation_why"])


@patch("backend.agent.recall_similar")
@patch("backend.agent._call_groq_completion")
def test_degraded_mode_unknown_recurrence(mock_groq, mock_recall):
    """Degraded mode due to LLM failure must return UNKNOWN recurrence status."""
    mock_recall.return_value = [
        {
            "incident_id": "INC-001",
            "service": "payment-api",
            "text": "",
            "score": 0.85,
            "attempts": [{"action": "Restart pods", "result": "FAILED"}],
        }
    ]
    mock_groq.side_effect = RuntimeError("Groq rate limit exceeded")

    res = analyze_incident("payment-api", ["HTTP 500"])
    assert res["degraded"] is True
    assert res["recurrence_status"] == "UNKNOWN"
    assert res["classification"] == "UNKNOWN"
    assert "degraded" in res["recurrence_explanation"].lower()


def test_outcome_aware_patterns_synthesis():
    """Patterns synthesis must reflect occurrences, failures, and confirmed resolutions."""
    inc1 = {
        "incident_id": "INC-T1",
        "service": "test-service",
        "root_cause": "Connection starvation",
        "symptoms": ["Connection reset"],
        "attempts": [
            {"action": "Restart pods", "result": "FAILED"},
            {"action": "Scale connections", "result": "SUCCESS"},
        ],
    }
    inc2 = {
        "incident_id": "INC-T2",
        "service": "test-service",
        "root_cause": "Connection starvation",
        "symptoms": ["Connection reset"],
        "attempts": [
            {"action": "Restart pods", "result": "FAILED"},
            {"action": "Scale connections", "result": "SUCCESS"},
        ],
    }

    store_incident(inc1)
    store_incident(inc2)

    patterns = summarize_learned_patterns()
    assert "RECURRING PATTERN: test-service" in patterns
    assert "Connection starvation" in patterns
    assert "Restart pods (2x failed)" in patterns
    assert "Scale connections (2x verified)" in patterns

    stats = get_memory_stats()
    assert stats["total_incidents"] >= 2
    assert stats["recurring_patterns_count"] >= 1
