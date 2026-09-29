"""Robustness and regression tests for failed-action guardrail matching."""

import pytest
from backend.textmatch import violates, are_actions_equivalent, parse_action


def test_vulnerability_shortened_action_detected():
    """Known audit vulnerability: 'Restart payment pods' vs 'Restart pods' MUST be detected."""
    failed = "Restart payment pods"
    candidate = "Restart pods"
    assert violates(candidate, failed) is True
    assert are_actions_equivalent(candidate, failed) is True


def test_exact_historical_failure():
    """Exact failure match must be detected."""
    failed = "Restart payment pods"
    assert violates("Restart payment pods", failed) is True


def test_expanded_action():
    """More specific candidate than failed generic action must be detected."""
    failed = "Restart pods"
    assert violates("Restart payment pods", failed) is True


def test_rephrased_actions_detected():
    """Operational synonyms, deployment phrases, and casing/punctuation variations must be detected."""
    failed = "Restart payment pods"

    variations = [
        "Restart the payment pods",
        "Restart payment deployment",
        "Reboot payment containers",
        "rebooting payment containers",
        "RESTART PAYMENT PODS!",
        "restart payment pods.",
        "Restart payment pod",  # Singular
        "Bounce payment pods",
    ]

    for cand in variations:
        assert violates(cand, failed) is True, f"Failed to detect violation for: '{cand}'"


def test_unrelated_actions_protected_from_false_positives():
    """Unrelated diagnostic and distinct operational actions must NOT be blocked."""
    failed = "Restart payment pods"

    unrelated = [
        "Inspect payment pods",
        "Scale payment pods",
        "Check database connections",
        "Inspect service logs and telemetry metrics",
        "Increase DB connection pool size from 50 to 150",
        "Monitor container CPU and memory metrics",
        "Check connection timeout settings",
    ]

    for cand in unrelated:
        assert violates(cand, failed) is False, f"False positive detected for safe action: '{cand}'"


def test_target_differentiation():
    """Action targeted at a different service must NOT be blocked."""
    failed = "Restart payment pods"
    candidate = "Restart auth pods"
    assert violates(candidate, failed) is False


def test_non_restart_equivalence():
    """Test equivalence for other operational actions (flush, rollback, scale)."""
    assert violates("Flush cache", "Flush Redis session cache") is True
    assert violates("Flush Redis cache", "Flush Redis session cache") is True
    assert violates("Rollback keys", "Rollback JWT secret rotation and re-sync keys") is True
    assert violates("Scale up pods", "Scale payment pods") is True
