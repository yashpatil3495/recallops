"use client";

import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { MemoryStats } from "../lib/types";

interface Props {
  refreshTrigger: number;
  onSeedCompleted: () => void;
}

export default function MemorySidebar({ refreshTrigger, onSeedCompleted }: Props) {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [patterns, setPatterns] = useState<string | null>(null);
  const [loadingPatterns, setLoadingPatterns] = useState<boolean>(true);
  const [patternsError, setPatternsError] = useState<string | null>(null);

  const [seeding, setSeeding] = useState<boolean>(false);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const res = await api.getMemoryStats();
      setStats(res.stats);
    } catch (err: any) {
      setStatsError(err.message || "Failed to load memory statistics");
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
    } catch (err: any) {
      setPatternsError(err.message || "Failed to load memory patterns");
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
      setSeedNotice(`Seeded ${res.seeded} historical incident records.`);
      await fetchStats();
      await fetchPatterns();
      onSeedCompleted();
      setTimeout(() => setSeedNotice(null), 4000);
    } catch (err: any) {
      setSeedNotice(`Seed failed: ${err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <aside className="space-y-6">
      {/* Seed Button Banner */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg">⚡</span>
            <h2 className="font-mono text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Demo Seed Controls
            </h2>
          </div>
          <span className="text-[10px] font-mono bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800/50">
            IDEMPOTENT
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Preload 5 canonical production outages (payment connection pool, JWT token invalidation, memory leaks, SMTP outages).
        </p>

        <button
          onClick={handleSeed}
          disabled={seeding}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg font-mono text-xs font-semibold uppercase tracking-wider transition-all bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-900/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {seeding ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>Seeding Hindsight Memory...</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>Seed Synthetic Incidents</span>
            </>
          )}
        </button>

        {seedNotice && (
          <div className="mt-2.5 text-[11px] font-mono px-2.5 py-1.5 rounded bg-slate-800/80 border border-slate-700 text-cyan-300">
            {seedNotice}
          </div>
        )}
      </div>

      {/* Memory Stats Panel */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-cyan-400 font-mono text-sm">●</span>
            <h2 className="font-mono text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Live Memory Stats
            </h2>
          </div>
          <button
            onClick={fetchStats}
            title="Refresh memory statistics"
            className="text-xs text-slate-400 hover:text-cyan-400 transition-colors font-mono cursor-pointer"
          >
            ↻ REFRESH
          </button>
        </div>

        {loadingStats ? (
          <div className="py-8 text-center text-xs font-mono text-slate-500 flex flex-col items-center space-y-2">
            <svg className="animate-spin h-5 w-5 text-cyan-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>Querying memory metrics...</span>
          </div>
        ) : statsError ? (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-xs text-rose-300 font-mono">
            {statsError}
          </div>
        ) : stats ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3">
                <span className="text-[11px] font-mono text-slate-400 block mb-1">TOTAL INCIDENTS</span>
                <span className="text-2xl font-mono font-bold text-slate-100">{stats.total_incidents}</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3">
                <span className="text-[11px] font-mono text-slate-400 block mb-1">RESOLVED</span>
                <span className="text-2xl font-mono font-bold text-emerald-400">{stats.resolved}</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3">
                <span className="text-[11px] font-mono text-slate-400 block mb-1">ROOT CAUSES LEARNED</span>
                <span className="text-2xl font-mono font-bold text-cyan-400">{stats.root_causes_learned}</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3">
                <span className="text-[11px] font-mono text-slate-400 block mb-1">FAILED FIXES AVOIDED</span>
                <span className="text-2xl font-mono font-bold text-rose-400">{stats.failed_approaches_logged}</span>
              </div>
            </div>

            {stats.recurring_services && stats.recurring_services.length > 0 && (
              <div className="pt-2">
                <span className="text-[11px] font-mono text-slate-400 block mb-1.5 uppercase">
                  Recurring Incident Services:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {stats.recurring_services.map((svc) => (
                    <span
                      key={svc}
                      className="px-2 py-0.5 rounded text-xs font-mono bg-amber-950/60 text-amber-300 border border-amber-800/40"
                    >
                      {svc}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-500 font-mono">No incident stats available.</div>
        )}
      </div>

      {/* Learned Failure Patterns Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-emerald-400 font-mono text-sm">◆</span>
            <h2 className="font-mono text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Learned Failure Patterns
            </h2>
          </div>
          <button
            onClick={fetchPatterns}
            title="Refresh learned patterns"
            className="text-xs text-slate-400 hover:text-emerald-400 transition-colors font-mono cursor-pointer"
          >
            ↻ REFRESH
          </button>
        </div>

        {loadingPatterns ? (
          <div className="py-6 text-center text-xs font-mono text-slate-500 flex flex-col items-center space-y-2">
            <svg className="animate-spin h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>Synthesizing failure memory reflections...</span>
          </div>
        ) : patternsError ? (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-xs text-rose-300 font-mono">
            {patternsError}
          </div>
        ) : patterns ? (
          <div className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-950/60 p-3 rounded-lg border border-slate-800/60 whitespace-pre-line">
            {patterns}
          </div>
        ) : (
          <div className="py-4 text-center text-xs text-slate-500 font-mono">No pattern reflections synthesized yet.</div>
        )}
      </div>
    </aside>
  );
}
