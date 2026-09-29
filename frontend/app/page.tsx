"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import type { MemoryStats, RawIncident, DeepHealthResponse } from "@/lib/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [incidents, setIncidents] = useState<RawIncident[]>([]);
  const [health, setHealth] = useState<DeepHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, incidentsRes, healthRes] = await Promise.allSettled([
        api.getMemoryStats(),
        api.listIncidents(),
        api.checkDeepHealth(),
      ]);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.stats);
      if (incidentsRes.status === "fulfilled") setIncidents(incidentsRes.value.incidents || []);
      if (healthRes.status === "fulfilled") setHealth(healthRes.value);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const recentIncidents = incidents.slice(0, 5);
  const resolutionRate = stats && stats.total_incidents > 0
    ? Math.round((stats.resolved / stats.total_incidents) * 100) : 0;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 md:max-h-screen md:overflow-y-auto">
        <div className="pt-14 md:pt-0">
          <div className="p-6 md:p-8 max-w-6xl mx-auto page-enter">

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
              <div>
                <p className="text-[10px] font-bold text-accent uppercase tracking-[0.2em] mb-1">
                  Overview
                </p>
                <h1 className="text-2xl font-bold text-text-primary tracking-tight">
                  Intelligence Dashboard
                </h1>
                <p className="text-sm text-text-muted mt-1.5">
                  Operational memory at a glance. Your AI co-pilot is always learning.
                </p>
              </div>
              <Link href="/incidents" className="btn-primary w-full sm:w-auto">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Analyze New Incident
              </Link>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="stat-card stat-card-accent fade-in-up stagger-1" style={{opacity: 0}}>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
                  Total Incidents
                </p>
                <p className="text-3xl font-extrabold text-text-primary tabular-nums">
                  {loading ? <span className="skeleton inline-block w-10 h-8" /> : stats?.total_incidents ?? 0}
                </p>
                <p className="text-[10px] text-text-muted mt-1.5 font-medium">
                  in memory bank
                </p>
              </div>

              <div className="stat-card stat-card-success fade-in-up stagger-2" style={{opacity: 0}}>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
                  Resolution Rate
                </p>
                <p className="text-3xl font-extrabold text-success tabular-nums">
                  {loading ? <span className="skeleton inline-block w-14 h-8" /> : `${resolutionRate}%`}
                </p>
                <p className="text-[10px] text-text-muted mt-1.5 font-medium">
                  {stats?.resolved ?? 0} resolved
                </p>
              </div>

              <div className="stat-card stat-card-danger fade-in-up stagger-3" style={{opacity: 0}}>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
                  Blocked Actions
                </p>
                <p className="text-3xl font-extrabold text-danger tabular-nums">
                  {loading ? <span className="skeleton inline-block w-8 h-8" /> : stats?.failed_approaches_logged ?? 0}
                </p>
                <p className="text-[10px] text-text-muted mt-1.5 font-medium">
                  guardrail interventions
                </p>
              </div>

              <div className="stat-card stat-card-ai fade-in-up stagger-4" style={{opacity: 0}}>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
                  Root Causes Learned
                </p>
                <p className="text-3xl font-extrabold tabular-nums" style={{ color: 'var(--color-ai)' }}>
                  {loading ? <span className="skeleton inline-block w-8 h-8" /> : stats?.root_causes_learned ?? 0}
                </p>
                <p className="text-[10px] text-text-muted mt-1.5 font-medium">
                  knowledge patterns
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* System Health */}
              <div className="card p-5 fade-in-up stagger-3" style={{opacity: 0}}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-semibold text-text-primary">System Health</h2>
                  <span className={`badge ${
                    !health ? "bg-bg-tertiary text-text-muted" :
                    health.status === "ok" ? "bg-accent-muted text-accent" :
                    "bg-warning-muted text-warning"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      !health ? "bg-text-muted" :
                      health.status === "ok" ? "bg-accent breathe" : "bg-warning"
                    }`} />
                    {!health ? "Checking" : health.status === "ok" ? "Healthy" : "Degraded"}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {/* Groq */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border"
                    style={{ background: 'linear-gradient(135deg, var(--color-bg-tertiary), var(--color-bg-secondary))' }}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${health?.groq?.ok ? "bg-ai-muted" : "bg-danger-muted"}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className={health?.groq?.ok ? "text-ai" : "text-danger"} style={health?.groq?.ok ? { color: 'var(--color-ai)' } : {}}>
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-text-primary">Groq LPU</p>
                        <p className="text-[10px] text-text-muted">AI reasoning engine</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold ${health?.groq?.ok ? "text-accent" : "text-danger"}`}>
                      {health?.groq?.ok ? "● Online" : "○ Offline"}
                    </span>
                  </div>

                  {/* Hindsight */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border"
                    style={{ background: 'linear-gradient(135deg, var(--color-bg-tertiary), var(--color-bg-secondary))' }}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${health?.hindsight?.ok ? "bg-accent-muted" : "bg-warning-muted"}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className={health?.hindsight?.ok ? "text-accent" : "text-warning"}>
                          <ellipse cx="12" cy="5" rx="9" ry="3" />
                          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-text-primary">Hindsight Memory</p>
                        <p className="text-[10px] text-text-muted">Persistent store</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold ${health?.hindsight?.ok ? "text-accent" : "text-warning"}`}>
                      {health?.hindsight?.ok ? "● Online" : "◐ Local"}
                    </span>
                  </div>

                  {/* Local incidents */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border"
                    style={{ background: 'linear-gradient(135deg, var(--color-bg-tertiary), var(--color-bg-secondary))' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-info-muted flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-info">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-text-primary">Local Cache</p>
                        <p className="text-[10px] text-text-muted">JSON incident store</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-info">
                      {health?.local_incidents ?? 0} records
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Incidents */}
              <div className="lg:col-span-2 card p-5 fade-in-up stagger-4" style={{opacity: 0}}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-semibold text-text-primary">Recent Incidents</h2>
                  <Link href="/history" className="btn-ghost text-[10px] text-accent">
                    View all →
                  </Link>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
                  </div>
                ) : recentIncidents.length === 0 ? (
                  <div className="text-center py-14">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border"
                      style={{ background: 'linear-gradient(135deg, var(--color-bg-tertiary), var(--color-bg-secondary))' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-text-secondary mb-1">No incidents yet</h3>
                    <p className="text-xs text-text-muted mb-5">Seed demo data or analyze your first incident.</p>
                    <Link href="/incidents" className="btn-primary text-xs py-2 px-5">Get started</Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentIncidents.map((inc, idx) => (
                      <div key={inc.incident_id || idx}
                        className="flex items-center gap-4 p-3 rounded-xl border border-border hover:border-accent/20 transition-all group"
                        style={{ background: 'linear-gradient(135deg, var(--color-bg-tertiary), var(--color-bg-secondary))' }}>
                        <div className={`w-1 h-10 rounded-full flex-shrink-0 ${
                          inc.severity === "critical" ? "bg-danger" :
                          inc.severity === "high" ? "bg-warning" :
                          inc.severity === "medium" ? "bg-info" : "bg-text-muted"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-[11px] font-bold text-accent">{inc.incident_id || "—"}</span>
                            <span className={`badge text-[8px] py-0 ${
                              inc.severity === "critical" ? "bg-danger-muted text-danger" :
                              inc.severity === "high" ? "bg-warning-muted text-warning" :
                              "bg-bg-elevated text-text-muted"
                            }`}>{inc.severity || "—"}</span>
                          </div>
                          <p className="text-xs text-text-secondary truncate">
                            <span className="font-medium text-text-primary">{inc.service}</span>
                            {inc.root_cause && <span className="text-text-muted"> — {inc.root_cause}</span>}
                          </p>
                        </div>
                        <span className={`badge text-[9px] py-0.5 flex-shrink-0 ${
                          inc.outcome === "RESOLVED" ? "bg-success-muted text-success" : "bg-bg-elevated text-text-muted"
                        }`}>{inc.outcome || "—"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recurring Services */}
            {stats?.recurring_services && stats.recurring_services.length > 0 && (
              <div className="card p-5 mt-6 fade-in-up stagger-5" style={{opacity: 0}}>
                <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  </svg>
                  Recurring Services
                </h2>
                <div className="flex flex-wrap gap-2">
                  {stats.recurring_services.map((svc) => (
                    <span key={svc} className="badge bg-warning-muted text-warning border border-warning/20 text-xs">
                      {svc}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
