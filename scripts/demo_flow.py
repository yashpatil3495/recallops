"""RecallOps Hackathon Demonstration Scenario.

Demonstrates the core memory feedback loop:
INCIDENT 1:
  1. Service experiences novel failure.
  2. Action attempted fails ("Restart worker pods").
  3. Proven fix discovered ("Scale async queue workers and drain dead letter queue").
  4. Outcome recorded in persistent memory.

INCIDENT 2:
  1. Similar incident occurs.
  2. Persistent memory retrieves Incident 1.
  3. Agent/candidate attempts to repeat "Restart worker pods".
  4. Guardrail blocks repetition with explainable historical evidence.
  5. Proven alternative remediation is recommended.
  6. Transparent evidence trail displayed.

Usage:
    python scripts/demo_flow.py
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

# Ensure repo root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(REPO_ROOT))

# Ensure utf-8 encoding on Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from backend.agent import analyze_incident
from backend.memory import store_incident, recall_similar


def run_demo():
    print("=" * 75)
    print("RECALLOPS DETERMINISTIC HACKATHON DEMO SCENARIO")
    print("Autonomous Incident Intelligence with Persistent Operational Memory")
    print("=" * 75)

    svc = "order-fulfillment"
    symptoms = ["Order status sync timeout", "HTTP 504 Gateway Timeout", "Deadlock on task worker"]

    # -------------------------------------------------------------------
    # PHASE 1: INCIDENT 1 (First Occurrence)
    # -------------------------------------------------------------------
    print("\n--- PHASE 1: INCIDENT 1 (FIRST OCCURRENCE) ---")
    print(f"Incoming Incident: Service = '{svc}'")
    print(f"Symptoms: {', '.join(symptoms)}")

    # Step 1: Initial analysis without prior memory
    with patch("backend.agent._call_groq_completion") as mock_groq:
        mock_groq.return_value = (
            '{"is_recurring": false, "recurrence_confidence": 0.15, '
            '"similar_incidents": [], '
            '"identified_pattern": "Unseen worker deadlock", '
            '"root_cause_hypothesis": "Worker process stalled", '
            '"next_diagnostic_action": "Check worker logs", '
            '"recommended_fix": "Restart worker pods"}'
        )
        res_1 = analyze_incident(service=svc, symptoms=symptoms)

    print("\nAgent Analysis for Incident 1:")
    print(f"  • Recurrence Status: {res_1['recurrence_status']}")
    print(f"  • Recalled Memories: {len(res_1['similar_incidents'])}")
    print(f"  • Candidate Fix:     {res_1['recommended_fix']}")

    # Step 2: SRE executes candidate fix -> IT FAILS!
    failed_action = "Restart worker pods"
    proven_fix = "Scale async queue workers and drain dead letter queue"
    print(f"\nSRE Action Executed: '{failed_action}' -> FAILED! (Deadlock persisted)")
    print(f"SRE Remediation Discovered: '{proven_fix}' -> SUCCESS!")

    # Step 3: Record outcome into persistent memory
    print("\nRecording Incident 1 Outcome into Persistent Memory Bank...")
    inc1_id = "INC-DEMO-001"
    store_result = store_incident({
        "incident_id": inc1_id,
        "service": svc,
        "environment": "production",
        "severity": "critical",
        "symptoms": symptoms,
        "logs": "GatewayTimeout: worker pool stalled on lock acquisition",
        "attempts": [
            {"action": failed_action, "result": "FAILED"},
            {"action": proven_fix, "result": "SUCCESS"},
        ],
        "root_cause": "Async task queue deadlock under unhandled payload serialization",
        "resolution": "Scaled queue workers and flushed dead letter queue",
        "outcome": "RESOLVED",
        "ai_recommended_action": failed_action,
    })
    print(f"  ✓ Successfully committed {store_result['incident_id']} to memory bank.")

    # -------------------------------------------------------------------
    # PHASE 2: INCIDENT 2 (Similar Outage Occurs Later)
    # -------------------------------------------------------------------
    print("\n" + "=" * 75)
    print("--- PHASE 2: INCIDENT 2 (SIMILAR OUTAGE OCCURS LATER) ---")
    print(f"Incoming Incident: Service = '{svc}'")
    print(f"Symptoms: {', '.join(symptoms)}")

    # Groq proposes the generic restart action again
    with patch("backend.agent._call_groq_completion") as mock_groq:
        mock_groq.return_value = (
            '{"is_recurring": true, "recurrence_confidence": 0.95, '
            f'"similar_incidents": ["{inc1_id}"], '
            '"identified_pattern": "Worker deadlock recurrence", '
            '"root_cause_hypothesis": "Async task queue deadlock", '
            f'"next_diagnostic_action": "{failed_action}", '
            f'"recommended_fix": "{failed_action}"}}'
        )
        res_2 = analyze_incident(service=svc, symptoms=symptoms)

    print("\nAgent Analysis for Incident 2 (With Operational Experience):")
    print(f"  • Recurrence Status: {res_2['recurrence_status']}")
    print(f"  • Confidence:        {int(res_2['recurrence_confidence'] * 100)}%")
    print(f"  • Matched Memories:  {', '.join(res_2['similar_incidents'])}")
    print(f"  • Explanation:       {res_2['recurrence_explanation']}")

    print("\n🛡️ Safety Guardrail Enforcement:")
    guardrail_events = res_2.get("guardrail_events", [])
    if guardrail_events:
        for ge in guardrail_events:
            print(f"  🚨 BLOCKED UNSAFE ACTION: '{ge['blocked_action']}'")
            print(f"     ↳ Matched historical failure: '{ge['matched_failed_action']}' from {ge['source_incident']}")
            print(f"     ↳ Historical success rate:   {ge.get('historical_success_rate')}")
            print(f"     ↳ Known failure context:     {ge.get('known_failure_context')}")
            print(f"     ↳ REPLACED WITH PROVEN FIX:  '{ge['replaced_with']}'")
    else:
        print("  ❌ ERROR: Guardrail failed to trigger!")
        sys.exit(1)

    print("\nAvoid Recommendation:")
    avoid = res_2.get("avoid_recommendation")
    if avoid:
        print(f"  • Action to Avoid: {avoid['action']}")
        print(f"  • Reason:          {avoid['reason']}")

    print("\nWhy This Recommendation:")
    for why in res_2.get("recommendation_why", []):
        print(f"  • {why}")

    print("\n" + "=" * 75)
    print("DEMO VERIFICATION RESULT:")
    print("Decision 2 is demonstrably smarter than Decision 1 because RecallOps")
    print("remembered the failed attempt, prevented repeating it, and provided")
    print("an evidence-backed alternative path.")
    print("=" * 75)


if __name__ == "__main__":
    run_demo()
