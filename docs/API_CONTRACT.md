# RecallOps - Frozen API Contract

> **Specification Status:** FROZEN. The frontend and backend must strictly conform to these shapes.

Base URL: `http://localhost:8000` (or `NEXT_PUBLIC_API_URL`)

---

## 1. Health Check
`GET /`

### Response `200 OK`
```json
{
  "status": "ok",
  "service": "recallops-backend",
  "timestamp": "2026-09-28T13:30:00.000000+00:00"
}
```

---

## 2. Analyze Incident
`POST /analyze`

Analyzes incoming symptoms against persistent memory and Groq LLM reasoning.

### Request Body
```json
{
  "service": "payment-api",
  "environment": "production",
  "severity": "critical",
  "symptoms": [
    "HTTP 500 errors",
    "database connection timeout"
  ],
  "logs": "TimeoutError: connection pool exhausted after 30000ms. Active: 50, Max: 50",
  "description": "Payment checkout service failing for European customers"
}
```

### Response `200 OK`
```json
{
  "success": true,
  "analysis": {
    "is_recurring": true,
    "recurrence_confidence": 0.96,
    "similar_incidents": [
      "INC-001",
      "INC-003"
    ],
    "identified_pattern": "Database connection pool exhaustion during traffic spikes",
    "previously_failed": [
      "Restart application pods",
      "Increase request timeout to 30s"
    ],
    "previously_succeeded": [
      "Increase DB connection pool size from 50 to 150",
      "Scale database connection pool to 250"
    ],
    "root_cause_hypothesis": "Payment API database connection pool saturated by surge in concurrent checkout transactions",
    "next_diagnostic_action": "Check active vs max connection metrics in PostgreSQL connection pool dashboard",
    "recommended_fix": "Increase connection pool size to 250 and enable connection pool proxy (PgBouncer)",
    "reasoning": "Symptoms match INC-001 and INC-003 where connection limits were breached under peak traffic. Restarting pods previously failed, whereas scaling connection pool capacity resolved the outage.",
    "raw_memories": [
      {
        "incident_id": "INC-001",
        "text": "Incident ID: INC-001\nService: payment-api\nSymptoms: HTTP 500 errors spike; database connection timeout...",
        "score": 0.92,
        "metadata": {
          "service": "payment-api",
          "root_cause": "DB connection pool exhaustion under peak traffic"
        }
      }
    ]
  }
}
```

### Error `502 Bad Gateway`
```json
{
  "detail": "Upstream reasoning failure: Groq service timeout"
}
```

---

## 3. Record Incident Outcome
`POST /record`

Records the final outcome, diagnostic attempts, root cause, and resolution of an incident into Hindsight long-term memory.

### Request Body
```json
{
  "incident_id": "INC-001",
  "service": "payment-api",
  "environment": "production",
  "severity": "critical",
  "symptoms": [
    "HTTP 500 errors",
    "database connection timeout"
  ],
  "logs": "OperationalError: PoolMaxConnectionsExceeded",
  "attempts": [
    {
      "action": "Restart application pods",
      "result": "FAILED"
    },
    {
      "action": "Increase DB connection pool size from 50 to 150",
      "result": "SUCCESS"
    }
  ],
  "root_cause": "DB connection pool exhaustion under peak traffic",
  "resolution": "Increased connection pool from 50 to 150",
  "outcome": "RESOLVED"
}
```

### Response `200 OK`
```json
{
  "success": true,
  "incident_id": "INC-001",
  "stored": {
    "incident_id": "INC-001",
    "service": "payment-api",
    "failed_attempts": 1,
    "outcome": "RESOLVED"
  },
  "hindsight_response": {
    "items_count": 1,
    "operation_id": "op_983214"
  }
}
```

---

## 4. Live Memory Stats
`GET /memory/stats`

Returns aggregated metrics from persistent incident memory.

### Response `200 OK`
```json
{
  "success": true,
  "stats": {
    "total_incidents": 5,
    "resolved": 5,
    "root_causes_learned": 4,
    "failed_approaches_logged": 7,
    "successful_approaches": 5,
    "recurring_services": [
      "payment-api"
    ],
    "hindsight_count": 5
  }
}
```

---

## 5. Learned Memory Patterns
`GET /memory/patterns`

Reflects across stored memories to synthesize learned failure patterns.

### Response `200 OK`
```json
{
  "success": true,
  "patterns": "Historical incidents show recurring database connection pool bottlenecks in payment-api under peak traffic loads. Pod restarts consistently fail to remediate this condition, while increasing pool sizing and configuring PgBouncer proxying effectively resolve it."
}
```

---

## 6. Seed Synthetic Incidents
`POST /seed`

Idempotently injects the 5 standard synthetic incident history records (INC-001 to INC-005) into memory.

### Request Body
```json
{}
```

### Response `200 OK`
```json
{
  "success": true,
  "seeded": 5,
  "results": [
    "INC-001",
    "INC-002",
    "INC-003",
    "INC-004",
    "INC-005"
  ]
}
```
