"""Pytest configuration for RecallOps backend."""

import os
from pathlib import Path
from unittest.mock import patch
import pytest


@pytest.fixture(autouse=True)
def isolated_environment(tmp_path, monkeypatch):
    """Ensure tests never hit the network or production data store."""
    # Remove real API keys to prevent accidental network calls
    monkeypatch.delenv("HINDSIGHT_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)

    # Patch data directory and incidents file to use temp directory
    data_dir = tmp_path / "data"
    incidents_file = data_dir / "incidents.json"
    
    with patch("backend.memory.DATA_DIR", data_dir), \
         patch("backend.memory.INCIDENTS_FILE", incidents_file):
        yield
