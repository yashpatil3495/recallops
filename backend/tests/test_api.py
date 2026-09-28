"""Unit tests for FastAPI endpoints in backend/main.py."""

from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health_endpoint():
    """Test health check returns status ok."""
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["service"] == "recallops-backend"


@patch("backend.main.analyze_incident")
def test_analyze_endpoint(mock_analyze):
    """Test analyze incident endpoint maps Groq analysis response."""
    mock_analyze.return_value = {
        "is_recurring": True,
        "recurrence_confidence": 0.88,
        "similar_incidents": ["INC-001"],
        "identified_pattern": "DB connection pool exhaustion",
        "previously_failed": ["Restart pods"],
        "previously_succeeded": ["Scale pool to 150"],
        "root_cause_hypothesis": "Pool exhausted",
        "next_diagnostic_action": "Check connection metrics",
        "recommended_fix": "Scale pool",
        "reasoning": "Matches INC-001.",
        "raw_memories": [],
    }

    payload = {
        "service": "payment-api",
        "symptoms": ["HTTP 500 errors", "DB timeout"],
        "environment": "production",
    }
    res = client.post("/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["analysis"]["is_recurring"] is True
    assert data["analysis"]["recurrence_confidence"] == 0.88


@patch("backend.main.store_incident")
def test_record_endpoint(mock_store):
    """Test record endpoint persists incident outcome."""
    mock_store.return_value = {
        "success": True,
        "incident_id": "INC-RECORD-TEST",
        "stored": {"incident_id": "INC-RECORD-TEST"},
        "hindsight": {"items_count": 1},
    }

    payload = {
        "incident_id": "INC-RECORD-TEST",
        "service": "auth-service",
        "symptoms": ["Login errors"],
        "attempts": [{"action": "Restart pods", "result": "FAILED"}],
        "root_cause": "Key mismatch",
        "resolution": "Rollback key",
        "outcome": "RESOLVED",
    }
    res = client.post("/record", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["incident_id"] == "INC-RECORD-TEST"


@patch("backend.main.get_memory_stats")
def test_memory_stats_endpoint(mock_stats):
    """Test memory stats endpoint returns structured counts."""
    mock_stats.return_value = {
        "total_incidents": 5,
        "resolved": 5,
        "root_causes_learned": 5,
        "failed_approaches_logged": 6,
        "successful_approaches": 5,
        "recurring_services": ["payment-api"],
    }
    res = client.get("/memory/stats")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["stats"]["total_incidents"] == 5


@patch("backend.main.summarize_learned_patterns")
def test_memory_patterns_endpoint(mock_patterns):
    """Test memory patterns endpoint returns reflection summary."""
    mock_patterns.return_value = "Top recurring pattern: DB connection pool exhaustion."
    res = client.get("/memory/patterns")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "DB connection pool" in data["patterns"]


def test_seed_endpoint():
    """Test seed endpoint loads 5 synthetic incidents."""
    res = client.post("/seed")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["seeded"] == 5
