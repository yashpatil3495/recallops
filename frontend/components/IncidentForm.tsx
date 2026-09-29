"use client";

import React, { useState } from "react";
import { AnalyzeRequest } from "../lib/types";

interface Props {
  onAnalyze: (payload: AnalyzeRequest) => void;
  isLoading: boolean;
}

const PRESETS = [
  {
    id: "payment",
    label: "Payment Outage",
    icon: "💳",
    description: "DB connection pool exhaustion",
    data: {
      service: "payment-api",
      environment: "production",
      severity: "critical",
      symptoms: "HTTP 500 errors spike\ndatabase connection timeout\np99 latency > 8000ms",
      logs: "TimeoutError: connection pool exhausted after 30000ms. Active: 50, Max: 50, Pending: 142",
    },
  },
  {
    id: "auth",
    label: "Auth Token",
    icon: "🔐",
    description: "JWT validation failures",
    data: {
      service: "auth-service",
      environment: "production",
      severity: "high",
      symptoms: "User login failures\nJWT token validation errors\nHTTP 401 Unauthorized spike",
      logs: "InvalidTokenError: Signature verification failed. Key ID 'auth-2026-b' not found in cache",
    },
  },
  {
    id: "new",
    label: "New Scenario",
    icon: "🎬",
    description: "Novel incident type",
    data: {
      service: "video-transcoder",
      environment: "production",
      severity: "low",
      symptoms: "Audio pitch distortion on FLAC files\nSubtitles misaligned by 2 seconds",
      logs: "DecoderInfo: Subtitle stream track 2 PTS timestamp mismatch by +2040ms",
    },
  },
];

export default function IncidentForm({ onAnalyze, isLoading }: Props) {
  const [service, setService] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [severity, setSeverity] = useState("critical");
  const [symptomsText, setSymptomsText] = useState("");
  const [logs, setLogs] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const symptoms = symptomsText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (!service.trim()) {
      setFormError("Service name is required.");
      return;
    }
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

  const loadPreset = (preset: typeof PRESETS[number]) => {
    setFormError(null);
    setActivePreset(preset.id);
    setService(preset.data.service);
    setEnvironment(preset.data.environment);
    setSeverity(preset.data.severity);
    setSymptomsText(preset.data.symptoms);
    setLogs(preset.data.logs);
  };

  const clearForm = () => {
    setService("");
    setEnvironment("production");
    setSeverity("critical");
    setSymptomsText("");
    setLogs("");
    setFormError(null);
    setActivePreset(null);
  };

  return (
    <div className="space-y-5">
      {/* Quick Presets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Quick Presets
          </h3>
          {activePreset && (
            <button
              type="button"
              onClick={clearForm}
              className="btn-ghost text-[10px] text-text-muted"
            >
              Clear form
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => loadPreset(preset)}
              className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all cursor-pointer border ${
                activePreset === preset.id
                  ? "bg-accent-muted border-accent/30 ring-1 ring-accent/20"
                  : "bg-bg-tertiary border-border hover:border-text-muted/30 hover:bg-bg-hover"
              }`}
            >
              <span className="text-lg flex-shrink-0">{preset.icon}</span>
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${activePreset === preset.id ? "text-accent-hover" : "text-text-primary"}`}>
                  {preset.label}
                </p>
                <p className="text-[10px] text-text-muted truncate">
                  {preset.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider">
          Incident Details
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 rounded-lg bg-danger-muted border border-danger/20 text-sm text-danger flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {formError}
          </div>
        )}

        {/* Service */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Service <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            required
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="input-base"
            placeholder="e.g. payment-api"
          />
        </div>

        {/* Environment + Severity */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Environment
            </label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="input-base"
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Severity
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="input-base"
            >
              <option value="critical">🔴 Critical (P0)</option>
              <option value="high">🟠 High (P1)</option>
              <option value="medium">🟡 Medium (P2)</option>
              <option value="low">🟢 Low (P3)</option>
            </select>
          </div>
        </div>

        {/* Symptoms */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Observed Symptoms <span className="text-danger">*</span>
            <span className="text-text-muted font-normal ml-1">(one per line)</span>
          </label>
          <textarea
            required
            rows={4}
            value={symptomsText}
            onChange={(e) => setSymptomsText(e.target.value)}
            className="input-base resize-y min-h-[100px] font-mono text-[13px]"
            placeholder="HTTP 500 errors&#10;Database timeout&#10;Latency spike"
          />
        </div>

        {/* Logs */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Logs / Stacktrace
            <span className="text-text-muted font-normal ml-1">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={logs}
            onChange={(e) => setLogs(e.target.value)}
            className="input-base resize-y min-h-[72px] font-mono text-[12px] leading-relaxed"
            placeholder="Paste stack traces or log lines..."
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full py-3"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Recalling memory & reasoning...</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>Analyze Incident</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
