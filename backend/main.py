"""RecallOps FastAPI Application Entrypoint.

Provides REST API endpoints for incident analysis, recording outcomes,
live memory statistics, learned pattern reflections, and idempotent seeding.
Strictly adheres to docs/API_CONTRACT.md and .agents/rules/10-backend.md.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.agent import AnalysisResult, analyze_incident
from backend.memory import (
    MemoryServiceError,
    get_memory_stats,
    load_local_incidents,
    store_incident,
    summarize_learned_patterns,
)
from backend.seed_data import SEED_INCIDENTS

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("recallops.api")

app = FastAPI(
    title="RecallOps API",
    description="Incident-intelligence AI agent backend with persistent Hindsight memory and Groq LLM reasoning.",
    version="1.0.0",
)

# CORS: Allow only http://localhost:3000 per rule 10-backend.md
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handler for clean 502 errors on upstream failures
@app.exception_handler(MemoryServiceError)
async def memory_service_exception_handler(request: Request, exc: MemoryServiceError):
    logger.error("Upstream memory error: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_502_BAD_GATEWAY,
        content={"success": False, "error": f"Upstream memory service error: {exc}"},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "error": f"Internal server error: {type(exc).__name__}"},
    )


# ------------------------------------------------------------------------------
# Pydantic v2 Request / Response Models
# ------------------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "recallops-backend"
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AnalyzeRequest(BaseModel):
    service: str = Field(..., min_length=1, description="Target service name")
    environment: Optional[str] = Field("production", description="Environment (production, staging, etc.)")
    severity: Optional[str] = Field("medium", description="Incident severity level")
    symptoms: List[str] = Field(..., min_length=1, description="List of observable symptoms")
    logs: Optional[str] = Field(None, description="Relevant error logs or stack traces")
    description: Optional[str] = Field(None, description="Optional incident description")


class AnalyzeResponse(BaseModel):
    success: bool = True
    analysis: AnalysisResult


class AttemptItem(BaseModel):
    action: str = Field(..., min_length=1, description="Action taken")
    result: str = Field(..., description="Outcome: FAILED, SUCCESS, or PARTIAL")


class RecordRequest(BaseModel):
    incident_id: Optional[str] = Field(None, description="Unique incident identifier")
    service: str = Field(..., min_length=1, description="Service name")
    environment: Optional[str] = Field("production", description="Environment")
    severity: Optional[str] = Field("medium", description="Severity")
    symptoms: List[str] = Field(..., min_length=1, description="Observed symptoms")
    logs: Optional[str] = Field(None, description="Logs snippet")
    attempts: List[AttemptItem] = Field(default_factory=list, description="Historical diagnostic/remediation attempts")
    root_cause: str = Field(..., min_length=1, description="Confirmed root cause")
    resolution: str = Field(..., min_length=1, description="Confirmed resolution")
    outcome: Optional[str] = Field("RESOLVED", description="Final incident outcome")


class RecordResponse(BaseModel):
    success: bool = True
    incident_id: str
    stored: Dict[str, Any]
    hindsight_response: Optional[Dict[str, Any]] = None


class MemoryStatsResponse(BaseModel):
    success: bool = True
    stats: Dict[str, Any]


class MemoryPatternsResponse(BaseModel):
    success: bool = True
    patterns: str


class SeedResponse(BaseModel):
    success: bool = True
    seeded: int
    results: List[str]


# ------------------------------------------------------------------------------
# API Endpoints
# ------------------------------------------------------------------------------


@app.get("/", response_model=HealthResponse)
def health_check():
    """Health check endpoint."""
    return HealthResponse()


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_endpoint(payload: AnalyzeRequest):
    """Analyze an incoming incident against recalled memory with Groq reasoning."""
    try:
        analysis_data = analyze_incident(
            service=payload.service,
            symptoms=payload.symptoms,
            description=payload.description,
            logs=payload.logs,
        )
        return AnalyzeResponse(success=True, analysis=AnalysisResult(**analysis_data))
    except Exception as exc:
        logger.error("Analysis failure: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upstream reasoning failure: {type(exc).__name__}: {exc}",
        ) from exc


@app.post("/record", response_model=RecordResponse)
def record_endpoint(payload: RecordRequest):
    """Record an incident outcome into persistent Hindsight memory and local store."""
    try:
        inc_data = payload.model_dump()
        result = store_incident(inc_data)
        return RecordResponse(
            success=result["success"],
            incident_id=result["incident_id"],
            stored=result["stored"],
            hindsight_response=result.get("hindsight"),
        )
    except Exception as exc:
        logger.error("Record persistence failure: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upstream memory persistence failure: {type(exc).__name__}: {exc}",
        ) from exc


@app.get("/memory/stats", response_model=MemoryStatsResponse)
def memory_stats_endpoint():
    """Retrieve live statistics from persistent memory."""
    try:
        stats = get_memory_stats()
        return MemoryStatsResponse(success=True, stats=stats)
    except Exception as exc:
        logger.error("Memory stats failure: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to retrieve memory statistics: {type(exc).__name__}: {exc}",
        ) from exc


@app.get("/memory/patterns", response_model=MemoryPatternsResponse)
def memory_patterns_endpoint():
    """Summarize learned failure patterns across all historical incidents."""
    try:
        patterns = summarize_learned_patterns()
        return MemoryPatternsResponse(success=True, patterns=patterns)
    except Exception as exc:
        logger.error("Pattern reflection failure: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to synthesize memory patterns: {type(exc).__name__}: {exc}",
        ) from exc


@app.post("/seed", response_model=SeedResponse)
def seed_endpoint():
    """Idempotently seed the 5 standard synthetic incident history records."""
    try:
        existing = {inc.get("incident_id") for inc in load_local_incidents()}
        seeded_ids: List[str] = []
        for inc in SEED_INCIDENTS:
            if inc["incident_id"] not in existing:
                store_incident(inc)
                seeded_ids.append(inc["incident_id"])
            else:
                seeded_ids.append(f"{inc['incident_id']} (cached)")

        return SeedResponse(success=True, seeded=len(seeded_ids), results=seeded_ids)
    except Exception as exc:
        logger.error("Seed failure: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to seed memory records: {type(exc).__name__}: {exc}",
        ) from exc
