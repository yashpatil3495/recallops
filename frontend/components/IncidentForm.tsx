"use client";

import React, { useState } from "react";
import { AnalyzeRequest } from "../lib/types";

interface Props {
  onAnalyze: (payload: AnalyzeRequest) => void;
  isLoading: boolean;
}

export default function IncidentForm({ onAnalyze, isLoading }: Props) {
  const [service, setService] = useState<string>("payment-api");
  const [environment, setEnvironment] = useState<string>("production");
  const [severity, setSeverity] = useState<string>("critical");
  const [symptomsText, setSymptomsText] = useState<string>(
    "HTTP 500 errors spike\ndatabase connection timeout\np99 latency > 8000ms"
  );
  const [logs, setLogs] = useState<string>(
    "TimeoutError: connection pool exhausted after 30000ms. Active: 50, Max: 50, Pending: 142"
  );
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const symptoms = symptomsText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (symptoms.length === 0) {
      setFormError("Please provide at least one symptom.");
      return;
    }

    onAnalyze({
      service: service.trim(),
      environment,
      severity,
      symptoms,
      logs: logs.trim() || undefined,
    });
  };

  const loadPreset = (preset: "payment" | "auth" | "new") => {
    setFormError(null);
    if (preset === "payment") {
      setService("payment-api");
      setEnvironment("production");
      setSeverity("critical");
      setSymptomsText("HTTP 500 errors spike\ndatabase connection timeout\np99 latency > 8000ms");
      setLogs("TimeoutError: connection pool exhausted after 30000ms. Active: 50, Max: 50, Pending: 142");
    } else if (preset === "auth") {
      setService("auth-service");
      setEnvironment("production");
      setSeverity("high");
      setSymptomsText("User login failures\nJWT token validation errors\nHTTP 401 Unauthorized spike");
      setLogs("InvalidTokenError: Signature verification failed. Key ID 'auth-2026-b' not found in cache");
    } else {
      setService("video-transcoder");
      setEnvironment("production");
      setSeverity("low");
      setSymptomsText("Audio pitch distortion on FLAC files\nSubtitles misaligned by 2 seconds");
      setLogs("DecoderInfo: Subtitle stream track 2 PTS timestamp mismatch by +2040ms");
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800/80 mb-4 gap-2">
        <div className="flex items-center space-x-2">
          <span className="text-cyan-400 font-mono text-sm">▶</span>
          <h2 className="font-mono text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Incident Diagnosis Input
          </h2>
        </div>

        {/* Demo Quick Presets */}
        <div className="flex items-center space-x-1.5 text-xs font-mono">
          <span className="text-slate-400 text-[11px]">PRESETS:</span>
          <button
            type="button"
            onClick={() => loadPreset("payment")}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition cursor-pointer"
          >
            Payment Outage
          </button>
          <button
            type="button"
            onClick={() => loadPreset("auth")}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition cursor-pointer"
          >
            Auth Token
          </button>
          <button
            type="button"
            onClick={() => loadPreset("new")}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-purple-400 border border-slate-700 transition cursor-pointer"
          >
            New Scenario
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-2.5 rounded bg-rose-950/80 border border-rose-800 text-xs font-mono text-rose-300">
            ⚠ {formError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
              Service <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              placeholder="e.g. payment-api"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="production">production</option>
              <option value="staging">staging</option>
              <option value="development">development</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="critical">CRITICAL (P0)</option>
              <option value="high">HIGH (P1)</option>
              <option value="medium">MEDIUM (P2)</option>
              <option value="low">LOW (P3)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
            Observed Symptoms (one per line) <span className="text-rose-400">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={symptomsText}
            onChange={(e) => setSymptomsText(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
            placeholder="HTTP 500 errors&#10;Database connection timeout&#10;Latency spike"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
            Logs / Error Stacktrace (Optional)
          </label>
          <textarea
            rows={2}
            value={logs}
            onChange={(e) => setLogs(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
            placeholder="Paste stack traces or log lines here..."
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-mono text-xs font-bold uppercase tracking-wider transition-all bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-950/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>Recalling Hindsight Memory & Reasoning with Groq...</span>
            </>
          ) : (
            <>
              <span>🔍</span>
              <span>Analyze Incident & Recommend Next Action</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
