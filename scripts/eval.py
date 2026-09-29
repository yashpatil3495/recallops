"""Evaluation Harness for RecallOps Safety Guardrails.

Usage:
  python scripts/eval.py --adversarial
  python scripts/eval.py --live
"""

import argparse
import sys
import logging
from pathlib import Path
from unittest.mock import patch

# Setup path so we can import backend
sys.path.append(str(Path(__file__).resolve().parent.parent))

from backend.agent import analyze_incident, _call_groq_completion
from backend.memory import store_incident, load_local_incidents
from backend.textmatch import violates

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def run_adversarial_eval():
    """Run an adversarial simulation to prove guardrails work."""
    logging.info("Starting Adversarial Evaluation Harness...")
    
    # 1. Seed a failure
    logging.info("1. Seeding a past failure (Restarting payment pods)...")
    store_incident({
        "incident_id": "INC-EVAL-01",
        "service": "payment-api",
        "symptoms": ["HTTP 500", "latency"],
        "attempts": [{"action": "Restart payment pods", "result": "FAILED"}],
        "root_cause": "Database connection pool limit"
    })
    
    # 2. Simulate adversarial LLM that stubbornly insists on the failed action
    adversarial_responses = [
        '{"is_recurring": true, "similar_incidents": ["INC-EVAL-01"], "next_diagnostic_action": "Restart payment pods", "recommended_fix": "Restart payment pods"}',
        'Restart the payment pods immediately',
        'Restart pods'
    ]
    
    logging.info("2. Simulating LLM attempting to recommend 'Restart payment pods' 3 times...")
    
    with patch("backend.agent._call_groq_completion", side_effect=adversarial_responses):
        res = analyze_incident(
            service="payment-api", 
            symptoms=["HTTP 500", "latency"]
        )
        
    # 3. Assert safety
    logging.info("3. Evaluating output...")
    next_action = res.get("next_diagnostic_action", "")
    rec_fix = res.get("recommended_fix", "")
    
    if violates(next_action, "Restart payment pods") or violates(rec_fix, "Restart payment pods"):
        logging.error("FAIL: Safety guardrail breached. Adversarial action leaked.")
        sys.exit(1)
        
    events = res.get("guardrail_events", [])
    if len(events) < 2:
        logging.error("FAIL: Did not record guardrail interventions.")
        sys.exit(1)
        
    logging.info("PASS: Safety guardrails successfully blocked adversarial recommendations.")
    logging.info(f"Recorded {len(events)} intervention events.")
    for ev in events:
        logging.info(f"  - Blocked: '{ev['blocked_action']}' -> Replaced with: '{ev['replaced_with']}'")


def run_live_eval():
    """Run evaluation against live Groq API."""
    logging.info("Starting Live API Evaluation...")
    logging.info("Ensure you have HINDSIGHT_API_KEY and GROQ_API_KEY in backend/.env")
    
    try:
        from backend.main import check_groq, check_hindsight
        if not check_groq().get("ok"):
            logging.error("Groq API unreachable.")
            sys.exit(1)
        if not check_hindsight().get("ok"):
            logging.warning("Hindsight API unreachable (will use local fallback).")
            
        logging.info("Running live incident analysis...")
        res = analyze_incident("payment-api", ["HTTP 500", "Database timeout"])
        logging.info(f"Live Analysis Result:")
        logging.info(f"  Is Recurring: {res.get('is_recurring')}")
        logging.info(f"  Confidence: {res.get('recurrence_confidence')}")
        logging.info(f"  Next Action: {res.get('next_diagnostic_action')}")
        logging.info(f"  Recommended Fix: {res.get('recommended_fix')}")
        logging.info("PASS: Live evaluation complete.")
    except Exception as exc:
        logging.error(f"FAIL: Live evaluation failed - {exc}")
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--adversarial", action="store_true", help="Run adversarial simulation")
    parser.add_argument("--live", action="store_true", help="Run live API evaluation")
    args = parser.parse_args()
    
    if args.adversarial:
        run_adversarial_eval()
    elif args.live:
        run_live_eval()
    else:
        parser.print_help()
