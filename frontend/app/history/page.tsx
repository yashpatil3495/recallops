"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { RawIncident } from "@/lib/types";

export default function HistoryPage() {
  const [incidents, setIncidents] = useState<RawIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterService, setFilterService] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await api.listIncidents();
        setIncidents(res.incidents || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load incidents");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const formatDate = (ts?: string) => {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  const services = Array.from(new Set(incidents.map((i) => i.service).filter(Boolean)));

  const filtered = incidents.filter((inc) => {
    if (filterService && inc.service !== filterService) return false;
    if (filterSeverity && inc.severity !== filterSeverity) return false;
    return true;
  });

  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const sorted = [...filtered].sort((a, b) => {
    const sa = severityOrder[a.severity || "medium"] ?? 2;
    const sb = severityOrder[b.severity || "medium"] ?? 2;
    return sa - sb;
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 md:max-h-screen md:overflow-y-auto">
        <div className="pt-14 md:pt-0">
          <div className="p-6 md:p-8 max-w-6xl mx-auto page-enter">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
              <div>
                <h1 className="text-2xl font-bold text-text-primary tracking-tight">
                  Incident History
                </h1>
                <p className="text-sm text-text-muted mt-1">
                  Browse resolved incidents and their outcomes.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <select
                  value={filterService}
                  onChange={(e) => setFilterService(e.target.value)}
                  className="input-base text-xs py-2 w-auto min-w-[140px]"
                >
                  <option value="">All services</option>
                  {services.map((s) => (
                    <option key={s} value={s!}>{s}</option>
                  ))}
                </select>
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className="input-base text-xs py-2 w-auto min-w-[120px]"
                >
                  <option value="">All severity</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skeleton h-20 rounded-xl" />
                ))}
              </div>
            ) : error ? (
              <div className="card bg-danger-muted border-danger/20 p-6">
                <div className="flex items-center gap-2 text-danger">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            ) : sorted.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-bg-tertiary border border-border flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">No incidents found</h3>
                <p className="text-xs text-text-muted max-w-sm">
                  {filterService || filterSeverity
                    ? "No incidents match your current filters."
                    : "Record a resolved incident to build your operational memory."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Count badge */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-text-muted font-medium">
                    {sorted.length} incident{sorted.length !== 1 ? "s" : ""}
                    {(filterService || filterSeverity) ? " (filtered)" : ""}
                  </span>
                </div>

                {/* Timeline */}
                {sorted.map((inc, idx) => {
                  const isExpanded = expandedId === (inc.incident_id || `${idx}`);
                  const sevColor =
                    inc.severity === "critical" ? "bg-danger" :
                    inc.severity === "high" ? "bg-warning" :
                    inc.severity === "medium" ? "bg-info" :
                    "bg-text-muted";

                  return (
                    <div key={inc.incident_id || idx} className="fade-in-up" style={{ animationDelay: `${Math.min(idx * 50, 300)}ms`, opacity: 0 }}>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : (inc.incident_id || `${idx}`))}
                        className="w-full text-left card card-interactive p-0 cursor-pointer bg-transparent border border-border rounded-xl hover:border-text-muted/20"
                      >
                        <div className="flex items-stretch">
                          {/* Severity bar */}
                          <div className={`w-1 rounded-l-xl flex-shrink-0 ${sevColor}`} />

                          {/* Content */}
                          <div className="flex-1 flex items-center justify-between p-4 gap-4 min-w-0">
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                              {/* ID */}
                              <span className="font-mono text-xs font-bold text-accent flex-shrink-0 w-20 truncate">
                                {inc.incident_id || "—"}
                              </span>

                              {/* Service + Root cause */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-sm font-semibold text-text-primary truncate">
                                    {inc.service || "Unknown"}
                                  </span>
                                  {inc.environment && (
                                    <span className="badge text-[8px] bg-bg-elevated text-text-muted py-0 flex-shrink-0">
                                      {inc.environment}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-text-muted truncate">
                                  {inc.root_cause || "No root cause documented"}
                                </p>
                              </div>
                            </div>

                            {/* Right side */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className={`badge text-[9px] py-0.5 ${
                                inc.severity === "critical" ? "bg-danger-muted text-danger" :
                                inc.severity === "high" ? "bg-warning-muted text-warning" :
                                inc.severity === "medium" ? "bg-info-muted text-info" :
                                "bg-bg-elevated text-text-muted"
                              }`}>
                                {inc.severity || "—"}
                              </span>
                              <span className={`badge text-[9px] py-0.5 ${
                                inc.outcome === "RESOLVED" ? "bg-success-muted text-success" :
                                "bg-bg-elevated text-text-muted"
                              }`}>
                                {inc.outcome || "—"}
                              </span>
                              <span className="text-[10px] text-text-muted font-mono hidden sm:block">
                                {formatDate(inc.timestamp)}
                              </span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                className={`text-text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="ml-1 mt-0 border-l-2 border-border pl-5 pb-4 pt-3 scale-in space-y-3">
                          {/* Symptoms */}
                          {inc.symptoms && inc.symptoms.length > 0 && (
                            <div>
                              <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Symptoms</h4>
                              <div className="flex flex-wrap gap-1.5">
                                {inc.symptoms.map((s, i) => (
                                  <span key={i} className="badge text-[10px] bg-bg-tertiary text-text-secondary border border-border font-normal normal-case tracking-normal">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Attempts */}
                          {inc.attempts && inc.attempts.length > 0 && (
                            <div>
                              <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Remediation Attempts</h4>
                              <div className="space-y-1.5">
                                {inc.attempts.map((att, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <span className={`badge text-[8px] py-0 w-16 justify-center ${
                                      att.result === "FAILED" ? "bg-danger-muted text-danger" :
                                      att.result === "SUCCESS" ? "bg-success-muted text-success" :
                                      att.result === "PARTIAL" ? "bg-warning-muted text-warning" :
                                      "bg-bg-elevated text-text-muted"
                                    }`}>
                                      {att.result}
                                    </span>
                                    <span className="text-text-secondary">{att.action}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Resolution */}
                          {inc.resolution && (
                            <div>
                              <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Resolution</h4>
                              <p className="text-xs text-text-secondary">{inc.resolution}</p>
                            </div>
                          )}

                          {/* Root Cause */}
                          {inc.root_cause && (
                            <div>
                              <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Root Cause</h4>
                              <p className="text-xs text-text-secondary">{inc.root_cause}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
