"use client";

import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { MemoryStats } from "../lib/types";

interface Props {
  refreshTrigger: number;
  onSeedCompleted: () => void;
}

export default function MemoryPanel({ refreshTrigger, onSeedCompleted }: Props) {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [patterns, setPatterns] = useState<string | null>(null);
  const [loadingPatterns, setLoadingPatterns] = useState(true);
  const [patternsError, setPatternsError] = useState<string | null>(null);

  const [seeding, setSeeding] = useState(false);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const res = await api.getMemoryStats();
      setStats(res.stats);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load stats";
      setStatsError(message);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchPatterns = async () => {
    setLoadingPatterns(true);
    setPatternsError(null);
    try {
      const res = await api.getMemoryPatterns();
      setPatterns(res.patterns);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load patterns";
      setPatternsError(message);
    } finally {
      setLoadingPatterns(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchPatterns();
  }, [refreshTrigger]);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedNotice(null);
    try {
      const res = await api.seedMemory();
      setSeedNotice(`Seeded ${res.seeded} historical incidents.`);
      await fetchStats();
      await fetchPatterns();
      onSeedCompleted();
      setTimeout(() => setSeedNotice(null), 5000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Seed failed";
      setSeedNotice(`Failed: ${message}`);
    } finally {
      setSeeding(false);
    }
  };

  const formatTs = (ts?: string | null) => {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return ts;
    }
  };

  const resolutionRate = stats && stats.total_incidents > 0
    ? Math.round((stats.resolved / stats.total_incidents) * 100)
    : 0;

  return (
    <div className="space-y-6">

      {/* ── Stats Grid ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            Memory Intelligence
          </h2>
          <button
            onClick={() => { fetchStats(); fetchPatterns(); }}
            className="btn-ghost text-[10px]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
        </div>

        {loadingStats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-xl" />
            ))}
          </div>
        ) : statsError ? (
          <div className="card bg-danger-muted border-danger/20 p-4">
            <p className="text-xs text-danger">{statsError}</p>
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="stat-card stat-card-accent fade-in-up stagger-1" style={{opacity: 0}}>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Total Incidents</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums">{stats.total_incidents}</p>
              </div>
              <div className="stat-card stat-card-success fade-in-up stagger-2" style={{opacity: 0}}>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Resolution Rate</p>
                <p className="text-2xl font-bold text-success tabular-nums">{resolutionRate}%</p>
                <p className="text-[10px] text-text-muted">{stats.resolved} resolved</p>
              </div>
              <div className="stat-card stat-card-danger fade-in-up stagger-3" style={{opacity: 0}}>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Failed Fixes</p>
                <p className="text-2xl font-bold text-danger tabular-nums">{stats.failed_approaches_logged}</p>
                <p className="text-[10px] text-text-muted">blocked by guardrails</p>
              </div>
              <div className="stat-card stat-card-warning fade-in-up stagger-4" style={{opacity: 0}}>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Proven Fixes</p>
                <p className="text-2xl font-bold text-accent tabular-nums">{stats.successful_approaches}</p>
                <p className="text-[10px] text-text-muted">{stats.root_causes_learned} root causes</p>
              </div>
            </div>

            {/* Additional stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="card p-4">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Recurring Patterns</p>
                <p className="text-lg font-bold text-warning tabular-nums">
                  {stats.recurring_patterns_count ?? stats.recurring_services.length}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Hindsight Store</p>
                <p className="text-lg font-bold text-accent tabular-nums">
                  {stats.hindsight_count !== null ? `${stats.hindsight_count} units` : "Local mode"}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Last Updated</p>
                <p className="text-lg font-bold text-text-primary font-mono">
                  {formatTs(stats.latest_memory_update)}
                </p>
              </div>
            </div>

            {/* Recurring services */}
            {stats.recurring_services.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Frequently Recurring Services
                </p>
                <div className="flex flex-wrap gap-2">
                  {stats.recurring_services.map((svc) => (
                    <span key={svc} className="badge bg-warning-muted text-warning border border-warning/20 text-[10px]">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      </svg>
                      {svc}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="card p-8 text-center text-sm text-text-muted">No stats available.</div>
        )}
      </div>

      {/* ── Learned Patterns ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
              <path d="M2 12h5l3 8 4-16 3 8h5" />
            </svg>
            Outcome-Aware Patterns
          </h2>
          <button onClick={fetchPatterns} className="btn-ghost text-[10px]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
        </div>

        {loadingPatterns ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-4 rounded" />
            ))}
          </div>
        ) : patternsError ? (
          <div className="p-3 rounded-lg bg-danger-muted border border-danger/20 text-xs text-danger">
            {patternsError}
          </div>
        ) : patterns ? (
          <div className="p-4 rounded-lg bg-bg-tertiary border border-border text-xs text-text-secondary leading-relaxed font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto">
            {patterns}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-text-muted">No patterns synthesized yet.</div>
        )}
      </div>

      {/* ── Seed Controls ── */}
      <div className="card p-5 border-dashed">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Demo Seed Controls</h3>
              <p className="text-[11px] text-text-muted">
                Preload 5 canonical production outages into memory.
              </p>
            </div>
          </div>
          <span className="badge text-[9px] bg-bg-tertiary text-text-muted border border-border self-start sm:self-auto font-mono">
            IDEMPOTENT
          </span>
        </div>

        <button
          onClick={handleSeed}
          disabled={seeding}
          className="btn-secondary w-full sm:w-auto"
        >
          {seeding ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Seeding memory...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Seed Synthetic Incidents
            </>
          )}
        </button>

        {seedNotice && (
          <div className={`mt-3 p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
            seedNotice.startsWith("Failed")
              ? "bg-danger-muted border border-danger/20 text-danger"
              : "bg-success-muted border border-success/20 text-success"
          }`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {seedNotice.startsWith("Failed") ? (
                <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>
              ) : (
                <polyline points="20 6 9 17 4 12" />
              )}
            </svg>
            {seedNotice}
          </div>
        )}
      </div>
    </div>
  );
}
