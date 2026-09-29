/**
 * RecallOps Typed API Client.
 *
 * All backend communication goes through this module.
 * Base URL comes from NEXT_PUBLIC_API_URL (default http://localhost:8000).
 */

import type {
  AnalyzeRequest,
  AnalyzeResponse,
  DeepHealthResponse,
  HealthResponse,
  IncidentListResponse,
  MemoryPatternsResponse,
  MemoryStatsResponse,
  RecordRequest,
  RecordResponse,
  SeedResponse,
} from "./types";

const BASE_URL: string =
  (typeof process !== "undefined" &&
    process.env?.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8000";

/**
 * Wrapper around fetch that surfaces backend `detail` / `error` text
 * and catches network failures with a human-readable message.
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...options.headers as Record<string, string> },
      ...options,
    });
  } catch {
    throw new Error(`Cannot reach backend at ${BASE_URL}`);
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || body.error || detail;
    } catch {
      // response body was not JSON – use status text
      detail = `${detail}: ${res.statusText}`;
    }
    throw new Error(detail);
  }

  return res.json() as Promise<T>;
}

export const api = {
  /** GET / */
  checkHealth(): Promise<HealthResponse> {
    return request<HealthResponse>("/");
  },

  /** GET /health/deep (v1.1) */
  checkDeepHealth(): Promise<DeepHealthResponse> {
    return request<DeepHealthResponse>("/health/deep");
  },

  /** POST /analyze */
  analyzeIncident(payload: AnalyzeRequest): Promise<AnalyzeResponse> {
    return request<AnalyzeResponse>("/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /** POST /record */
  recordIncident(payload: RecordRequest): Promise<RecordResponse> {
    return request<RecordResponse>("/record", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /** GET /memory/stats */
  getMemoryStats(): Promise<MemoryStatsResponse> {
    return request<MemoryStatsResponse>("/memory/stats");
  },

  /** GET /memory/patterns */
  getMemoryPatterns(): Promise<MemoryPatternsResponse> {
    return request<MemoryPatternsResponse>("/memory/patterns");
  },

  /** POST /seed */
  seedMemory(): Promise<SeedResponse> {
    return request<SeedResponse>("/seed", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  /** GET /incidents */
  listIncidents(): Promise<IncidentListResponse> {
    return request<IncidentListResponse>("/incidents");
  },
};
