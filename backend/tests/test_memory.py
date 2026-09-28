"""Unit tests for backend/memory.py with Hindsight mocked."""

from unittest.mock import MagicMock, patch
import pytest

from backend.memory import (
    format_lifecycle_text,
    get_memory_stats,
    recall_similar,
    store_incident,
)


@pytest.fixture(name="sample_incident")
def fixture_sample_incident():
    """Sample incident fixture for tests."""
    return {
        "incident_id": "INC-TEST-01",
        "service": "payment-api",
        "environment": "production",
        "severity": "critical",
        "symptoms": ["HTTP 500 errors", "DB connection timeout"],
        "logs": "Connection pool timeout after 30000ms",
        "attempts": [
            {"action": "Restart pods", "result": "FAILED"},
            {"action": "Increase DB connection pool", "result": "SUCCESS"},
        ],
        "root_cause": "Database connection pool exhaustion under load",
        "resolution": "Increased pool size to 150",
        "outcome": "RESOLVED",
    }


def test_format_lifecycle_text(sample_incident):
    """Test incident lifecycle text formatting for retain."""
    text = format_lifecycle_text(sample_incident)
    assert "Incident ID: INC-TEST-01" in text
    assert "Service: payment-api" in text
    assert "- [FAILED] Restart pods" in text
    assert "- [SUCCESS] Increase DB connection pool" in text
    assert "Root Cause: Database connection pool exhaustion" in text


@patch("backend.memory._get_hindsight_client")
def test_store_and_recall_incident(mock_get_client, sample_incident):
    """Test incident storage and symptom-based recall."""
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client

    mock_retain_res = MagicMock()
    mock_retain_res.items_count = 1
    mock_client.retain.return_value = mock_retain_res

    mock_recall_res = MagicMock()
    mock_item = MagicMock()
    mock_item.text = format_lifecycle_text(sample_incident)
    mock_item.metadata = {"incident_id": "INC-TEST-01", "service": "payment-api"}
    mock_item.scores.final_score = 0.92
    mock_recall_res.results = [mock_item]
    mock_client.recall.return_value = mock_recall_res

    store_res = store_incident(sample_incident)
    assert store_res["success"] is True
    assert store_res["incident_id"] == "INC-TEST-01"
    assert store_res["stored"]["failed_attempts"] == 1

    recalled = recall_similar(
        symptoms=["HTTP 500 errors", "DB connection timeout"],
        service="payment-api",
    )
    assert len(recalled) >= 1
    assert recalled[0]["incident_id"] == "INC-TEST-01"


@patch("backend.memory._get_hindsight_client")
def test_recall_fallback_to_local_store(mock_get_client, sample_incident):
    """Test recall falls back to local incident cache when Hindsight returns empty."""
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client

    mock_recall_res = MagicMock()
    mock_recall_res.results = []
    mock_client.recall.return_value = mock_recall_res

    store_incident(sample_incident)
    recalled = recall_similar(symptoms="database connection timeout", service="payment-api")
    assert len(recalled) >= 1
    assert any(r["incident_id"] == "INC-TEST-01" for r in recalled)


@patch("backend.memory._get_hindsight_client")
def test_get_memory_stats(mock_get_client, sample_incident):
    """Test stats aggregation counts failed and succeeded attempts correctly."""
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client

    mock_list_res = MagicMock()
    mock_list_res.total = 10
    mock_client.list_memories.return_value = mock_list_res

    store_incident(sample_incident)
    stats = get_memory_stats()
    assert stats["total_incidents"] >= 1
    assert stats["failed_approaches_logged"] >= 1
    assert stats["successful_approaches"] >= 1
    assert stats["root_causes_learned"] >= 1
