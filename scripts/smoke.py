"""Smoke test for RecallOps.

Validates connectivity to Groq LLM API and Hindsight Memory API
using credentials stored in backend/.env.

Prints 'GROQ OK' and 'HINDSIGHT OK' on success, or the exact error.
Never logs or prints secrets.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from dotenv import load_dotenv

# Step 1: Load .env with a path built from __file__ (backend/.env)
ENV_PATH = Path(__file__).resolve().parent.parent / "backend" / ".env"

if not ENV_PATH.exists():
    print(f"FAIL: Environment file not found at {ENV_PATH}", file=sys.stderr, flush=True)
    sys.exit(1)

load_dotenv(dotenv_path=ENV_PATH)


def validate_env_keys() -> bool:
    """Verify required keys exist and are not placeholders."""
    required_keys = ["GROQ_API_KEY", "HINDSIGHT_API_KEY"]
    for key in required_keys:
        val = os.getenv(key)
        if not val or "your_" in val or "here" in val:
            print(
                f"FAIL: Environment variable {key} is missing or placeholder in {ENV_PATH}",
                file=sys.stderr,
                flush=True,
            )
            return False
    return True


def check_groq() -> bool:
    """Validate Groq API connectivity with model fallback."""
    api_key = os.getenv("GROQ_API_KEY")
    try:
        from groq import Groq  # pylint: disable=import-outside-toplevel

        client = Groq(api_key=api_key, timeout=15.0)

        # Primary model from env, fallback to available current models
        configured_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        candidate_models = [configured_model]
        for fallback in ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]:
            if fallback not in candidate_models:
                candidate_models.append(fallback)

        last_error = None
        for model in candidate_models:
            try:
                client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": "ping"}],
                    max_tokens=5,
                    temperature=0.0,
                )
                print("GROQ OK", flush=True)
                return True
            except Exception as exc:
                last_error = exc
                err_msg = str(exc).lower()
                if "model" in err_msg or "decommissioned" in err_msg or "not found" in err_msg:
                    print(
                        f"GROQ NOTICE: Model {model} unavailable ({type(exc).__name__}: {exc}), trying fallback...",
                        flush=True,
                    )
                    continue
                raise

        raise last_error or RuntimeError("No candidate models succeeded")
    except Exception as exc:
        print(f"GROQ FAIL: {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
        return False


def check_hindsight() -> bool:
    """Validate Hindsight Memory API connectivity with polling recall."""
    api_key = os.getenv("HINDSIGHT_API_KEY")
    base_url = os.getenv("HINDSIGHT_API_URL", "https://api.hindsight.vectorize.io")
    bank_id = os.getenv("HINDSIGHT_BANK_ID") or os.getenv("HINDSIGHT_PROJECT_ID") or "recallops-demo"

    try:
        from hindsight_client import Hindsight  # pylint: disable=import-outside-toplevel

        client = Hindsight(base_url=base_url, api_key=api_key, timeout=30.0)
        try:
            # Step 4: retain is asynchronous
            test_content = (
                f"Smoke test memory entry at timestamp {time.time()} "
                f"for RecallOps connectivity check."
            )
            client.retain(bank_id=bank_id, content=test_content)

            # Poll recall every 3 seconds for up to 60 seconds
            recalled = False
            start_time = time.time()
            max_seconds = 60.0

            while time.time() - start_time < max_seconds:
                rec_resp = client.recall(bank_id=bank_id, query="RecallOps connectivity check")
                if rec_resp and hasattr(rec_resp, "results") and rec_resp.results:
                    recalled = True
                    break
                time.sleep(3.0)

            if not recalled:
                print(
                    f"HINDSIGHT FAIL: Timeout after 60s waiting for recalled results in bank '{bank_id}'",
                    file=sys.stderr,
                    flush=True,
                )
                return False

            print("HINDSIGHT OK", flush=True)
            return True
        finally:
            client.close()
    except Exception as exc:
        print(f"HINDSIGHT FAIL: {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
        return False


def main() -> None:
    """Entry point for connectivity verification smoke test."""
    if not validate_env_keys():
        sys.exit(1)

    groq_ok = check_groq()
    hindsight_ok = check_hindsight()

    if groq_ok and hindsight_ok:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
