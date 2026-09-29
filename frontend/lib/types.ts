/**
 * RecallOps Frontend Type Definitions.
 *
 * Derived from docs/API_CONTRACT.md and component usage.
 * v1.1 and v1.2 additive fields are optional so the frontend works
 * seamlessly against both existing and upgraded backends.
 */

/* ------------------------------------------------------------------ */
/*  Shared primitives                                                  */
/* ------------------------------------------------------------------ */

export interface AttemptItem {
  action: string;
  result: string; // "FAILED" | "SUCCESS" | "PARTIAL" | "UNKNOWN"
}

export interface GuardrailEvent {
  field: string;
  blocked_action: string;
  matched_failed_action: string;
  source_incident: string;
  replaced_with: string;
  historical_outcome?: string;
  matching_incidents_count?: number;
  historical_success_rate?: string;
  known_failure_context?: string;
  suggested_next_step?: string;
}

export interface EvidenceEntry {
  incident_id: string;
  action: string;
  result: string;
}

export interface RankedEvidenceEntry {
  incident_id: string;
  action: string;
  result: string;
  relevance_score: number;
  match_factors: string[];
  tier: "STRONGEST" | "SUPPORTING" | string;
}

export interface AvoidRecommendation {
  action: string;
  reason: string;
  failure_count: number;
  historical_success_rate: string;
  known_failure_context: string;
  source_incidents: string[];
}

export interface WhatChanged {
  same: string[];
  different: string[];
}

export interface IncidentExtraction {
  service: string;
  environment?: string;
  severity?: string;
  symptoms: string[];
  error_signals: string[];
  affected_component?: string | null;
  trigger?: string | null;
  deployment_version?: string | null;
  suspected_area?: string | null;
}

export interface ConfidenceBreakdown {
  historical_similarity: number;
  service_match: number;
  symptom_match: number;
  environment_match: number;
  historical_outcome_strength: number;
  overall: number;
}

export interface RawMemory {
  incident_id: string;
  text: string;
  score?: number;
  metadata?: Record<string, unknown>;
  source?: string;           // "hindsight" | "local_store"
  service?: string;
  environment?: string;
  root_cause?: string;
  attempts?: AttemptItem[];
  matching_factors?: string[];
  service_match?: number;
  symptom_match?: number;
  environment_match?: number;
}

/* ------------------------------------------------------------------ */
/*  /analyze response                                                  */
/* ------------------------------------------------------------------ */

export interface AnalysisData {
  is_recurring: boolean;
  recurrence_confidence: number;       // 0.0 – 1.0
  similar_incidents: string[];
  identified_pattern: string;
  previously_failed: string[];
  previously_succeeded: string[];
  root_cause_hypothesis: string;
  next_diagnostic_action: string;
  recommended_fix: string;
  reasoning: string;
  raw_memories: RawMemory[];

  // v1.1 additive fields
  guardrail_events?: GuardrailEvent[];
  evidence?: EvidenceEntry[];
  memory_source?: string;              // "hindsight" | "local_store" | "none"
  degraded?: boolean;

  // v1.2 advanced intelligence fields
  classification?: string;             // "NEW" | "KNOWN_VARIANT" | "RECURRING" | "UNKNOWN"
  recurrence_status?: string;          // "NEW" | "KNOWN_VARIANT" | "RECURRING" | "UNKNOWN"
  novel_factors?: string[];
  recurrence_explanation?: string;
  what_changed?: WhatChanged | null;
  extraction?: IncidentExtraction | null;
  confidence_breakdown?: ConfidenceBreakdown | null;
  avoid_recommendation?: AvoidRecommendation | null;
  recommendation_why?: string[];
  strongest_evidence?: RankedEvidenceEntry[];
  supporting_evidence?: RankedEvidenceEntry[];
}

export interface AnalyzeResponse {
  success: boolean;
  analysis: AnalysisData;
}

/* ------------------------------------------------------------------ */
/*  /analyze request                                                   */
/* ------------------------------------------------------------------ */

export interface AnalyzeRequest {
  service: string;
  environment?: string;
  severity?: string;
  symptoms: string[];
  logs?: string;
  description?: string;
}

/* ------------------------------------------------------------------ */
/*  /record request / response                                         */
/* ------------------------------------------------------------------ */

export interface RecordRequest {
  incident_id?: string;
  service: string;
  environment?: string;
  severity?: string;
  symptoms: string[];
  logs?: string;
  attempts: AttemptItem[];
  root_cause: string;
  resolution: string;
  outcome?: string;
  ai_recommended_action?: string;
  actual_action?: string;
  failure_reason?: string;
}

export interface RecordResponse {
  success: boolean;
  incident_id: string;
  stored: Record<string, unknown>;
  hindsight_response?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  /memory/stats                                                      */
/* ------------------------------------------------------------------ */

export interface MemoryStats {
  total_incidents: number;
  resolved: number;
  root_causes_learned: number;
  failed_approaches_logged: number;
  successful_approaches: number;
  recurring_services: string[];
  hindsight_count: number | null;
  recurring_patterns_count?: number;
  failed_patterns_count?: number;
  successful_patterns_count?: number;
  latest_memory_update?: string | null;
}

export interface MemoryStatsResponse {
  success: boolean;
  stats: MemoryStats;
}

/* ------------------------------------------------------------------ */
/*  /memory/patterns                                                   */
/* ------------------------------------------------------------------ */

export interface MemoryPatternsResponse {
  success: boolean;
  patterns: string;
}

/* ------------------------------------------------------------------ */
/*  /seed                                                              */
/* ------------------------------------------------------------------ */

export interface SeedResponse {
  success: boolean;
  seeded: number;
  results: string[];
}

/* ------------------------------------------------------------------ */
/*  / health check                                                     */
/* ------------------------------------------------------------------ */

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/*  /health/deep (v1.1)                                                */
/* ------------------------------------------------------------------ */

export interface DeepHealthResponse {
  status: string;             // "ok" | "degraded"
  groq: { ok: boolean; detail?: string };
  hindsight: { ok: boolean; detail?: string };
  local_incidents: number;
}

/* ------------------------------------------------------------------ */
/*  /incidents (list)                                                   */
/* ------------------------------------------------------------------ */

export interface IncidentListResponse {
  success: boolean;
  incidents: RawIncident[];
  total: number;
}

export interface RawIncident {
  incident_id?: string;
  service?: string;
  environment?: string;
  severity?: string;
  symptoms?: string[];
  root_cause?: string;
  resolution?: string;
  outcome?: string;
  attempts?: AttemptItem[];
  timestamp?: string;
  [key: string]: unknown;
}

