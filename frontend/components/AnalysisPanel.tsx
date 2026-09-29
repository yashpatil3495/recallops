"use client";

import React, { useState, useEffect } from "react";
import { AnalysisData, AttemptItem, RecordRequest } from "../lib/types";

interface Props {
  analysis: AnalysisData | null;
  currentService: string;
  currentSymptoms: string[];
  currentContext: {
    environment?: string;
    severity?: string;
    logs?: string;
  };
  isLoading: boolean;
  error: string | null;
  onRecordSuccess: () => void;
  onRecord: (payload: RecordRequest) => Promise<void>;
  onRerunAnalysis: () => void;
  isRecording: boolean;
}

interface ChecklistItem {
  id: string;
  action: string;
  result: "NOT_TRIED" | "FAILED" | "PARTIAL" | "SUCCESS" | "UNKNOWN";
}

/* ── Confidence Gauge ── */
function ConfidenceGauge({ value, status }: { value: number; status: string }) {
  const percent = Math.round(value * 100);
  const circumference = 2 * Math.PI * 40;
  const filled = (percent / 100) * circumference;
  const color =
    status === "RECURRING" ? "var(--color-danger)" :
    status === "KNOWN_VARIANT" ? "var(--color-accent)" :
    status === "UNKNOWN" ? "var(--color-warning)" :
    "var(--color-success)";

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-border)" strokeWidth="6" />
        <circle
          cx="50" cy="50" r="40" fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-text-primary tabular-nums">{percent}%</span>
        <span className="text-[8px] font-semibold text-text-muted uppercase tracking-wider">conf.</span>
      </div>
    </div>
  );
}

export default function AnalysisPanel({
  analysis,
  currentService,
  currentSymptoms,
  currentContext,
  isLoading,
  error,
  onRecord,
  onRecordSuccess,
  onRerunAnalysis,
  isRecording,
}: Props) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [customRootCause, setCustomRootCause] = useState("");
  const [customResolution, setCustomResolution] = useState("");
  const [recordSuccessNotice, setRecordSuccessNotice] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [showOutcome, setShowOutcome] = useState(false);

  useEffect(() => {
    if (analysis) {
      setCustomRootCause(analysis.root_cause_hypothesis || "");
      setCustomResolution(analysis.recommended_fix || "");
      setRecordSuccessNotice(null);
      setRecordError(null);
      setShowOutcome(false);
      setShowReasoning(false);

      const initialActions = new Set<string>();
      if (analysis.next_diagnostic_action) initialActions.add(analysis.next_diagnostic_action);
      if (analysis.recommended_fix) initialActions.add(analysis.recommended_fix);

      const newChecklist = Array.from(initialActions).map((act, i) => ({
        id: `initial-${i}`,
        action: act,
        result: "NOT_TRIED" as const,
      }));
      if (newChecklist.length === 0) {
        newChecklist.push({ id: "empty-0", action: "", result: "NOT_TRIED" });
      }
      setChecklist(newChecklist);
    }
  }, [analysis]);

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="card flex flex-col items-center justify-center min-h-[500px] p-12 text-center">
        <div className="relative w-20 h-20 mb-8">
          <div className="absolute inset-0 rounded-full border-[3px] border-border border-t-accent animate-spin" />
          <div className="absolute inset-3 rounded-full border-[3px] border-border border-b-accent-hover animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.2s" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-sm font-bold text-accent">RO</span>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">Agent Reasoning Active</h3>
        <div className="space-y-2 mt-4 text-left max-w-sm">
          {["Recalling historical incidents from Hindsight memory...", "Matching symptom patterns across service history...", "Applying safety guardrails to recommendations..."].map((step, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-text-muted slide-in-right" style={{ animationDelay: `${i * 600}ms`, opacity: 0 }}>
              <div className="w-5 h-5 rounded-full bg-accent-muted flex items-center justify-center flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-accent breathe" style={{ animationDelay: `${i * 400}ms` }} />
              </div>
              {step}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="card bg-danger-muted border-danger/20 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-danger/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-danger">Analysis Error</h3>
            <p className="text-xs text-danger/70 mt-0.5">{error}</p>
          </div>
        </div>
        <button onClick={onRerunAnalysis} className="btn-secondary text-xs mt-2">
          Try Again
        </button>
      </div>
    );
  }

  /* ── Empty State ── */
  if (!analysis) {
    return (
      <div className="card border-dashed flex flex-col items-center justify-center min-h-[500px] p-12 text-center">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-bg-tertiary border border-border flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent-muted border-2 border-bg-secondary flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3V6a4 4 0 0 1 4-4z" />
            </svg>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          Ready to Analyze
        </h3>
        <p className="text-sm text-text-muted max-w-md leading-relaxed">
          Submit incident symptoms using the form or select a preset scenario to trigger persistent memory recall and diagnostic intelligence.
        </p>
      </div>
    );
  }

  /* ── Analysis Results ── */
  const recurrenceStatus = analysis.recurrence_status || (analysis.is_recurring ? "RECURRING" : "NEW");

  const statusConfig = {
    RECURRING: { label: "Recurring Incident Detected", color: "danger", icon: "🔁" },
    KNOWN_VARIANT: { label: "Known Incident Variant", color: "accent", icon: "🔄" },
    UNKNOWN: { label: "Status Unknown (Degraded)", color: "warning", icon: "❓" },
    NEW: { label: "New Incident Scenario", color: "success", icon: "🆕" },
  };
  const statusCfg = statusConfig[recurrenceStatus as keyof typeof statusConfig] || statusConfig.NEW;

  const updateChecklist = (id: string, field: "action" | "result", value: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addChecklistItem = () => {
    setChecklist((prev) => [
      ...prev,
      { id: `added-${Date.now()}`, action: "", result: "NOT_TRIED" },
    ]);
  };

  const removeChecklistItem = (id: string) => {
    setChecklist((prev) => prev.filter((item) => item.id !== id));
  };

  const handleConfirmOutcome = async () => {
    setRecordError(null);
    const activeAttempts = checklist
      .filter((item) => item.action.trim() !== "" && item.result !== "NOT_TRIED")
      .map((item) => ({
        action: item.action.trim(),
        result: item.result as AttemptItem["result"],
      }));

    if (!customRootCause.trim()) { setRecordError("Please provide a confirmed root cause."); return; }
    if (!customResolution.trim()) { setRecordError("Please provide a confirmed resolution."); return; }
    if (activeAttempts.length === 0) { setRecordError("Mark at least one action with a result."); return; }

    const payload: RecordRequest = {
      service: currentService,
      symptoms: currentSymptoms,
      environment: currentContext.environment,
      severity: currentContext.severity,
      logs: currentContext.logs,
      attempts: activeAttempts,
      root_cause: customRootCause.trim(),
      resolution: customResolution.trim(),
      outcome: "RESOLVED",
      ai_recommended_action: analysis.recommended_fix || undefined,
    };

    try {
      await onRecord(payload);
      setRecordSuccessNotice("Outcome committed to persistent memory.");
      onRecordSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setRecordError(`Failed: ${message}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Degraded Banner ── */}
      {analysis.degraded && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-warning-muted border border-warning/20 fade-in-up">
          <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-warning">Degraded Analysis Mode</p>
            <p className="text-[11px] text-warning/70 mt-0.5">
              {analysis.recurrence_explanation || "Using local memory fallback."}
            </p>
          </div>
        </div>
      )}

      {/* ── 1. Classification Banner ── */}
      <div className={`card p-5 border-l-[3px] fade-in-up stagger-1 ${
        recurrenceStatus === "RECURRING" ? "border-l-danger bg-danger-muted/30" :
        recurrenceStatus === "KNOWN_VARIANT" ? "border-l-accent bg-accent-muted/30" :
        recurrenceStatus === "UNKNOWN" ? "border-l-warning bg-warning-muted/30" :
        "border-l-success bg-success-muted/30"
      }`} style={{opacity: 0}}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <ConfidenceGauge value={analysis.recurrence_confidence || 0} status={recurrenceStatus} />
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-lg">{statusCfg.icon}</span>
                <h3 className={`text-base font-bold ${
                  recurrenceStatus === "RECURRING" ? "text-danger" :
                  recurrenceStatus === "KNOWN_VARIANT" ? "text-accent-hover" :
                  recurrenceStatus === "UNKNOWN" ? "text-warning" :
                  "text-success"
                }`}>
                  {statusCfg.label}
                </h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed max-w-lg">
                {analysis.recurrence_explanation || analysis.identified_pattern || "Pattern analyzed."}
              </p>
              {analysis.similar_incidents.length > 0 && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] text-text-muted font-medium">Related:</span>
                  {analysis.similar_incidents.map((id) => (
                    <span key={id} className="font-mono text-[10px] font-semibold text-accent bg-accent-muted px-1.5 py-0.5 rounded">
                      {id}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. What Changed? ── */}
      {analysis.what_changed && (analysis.what_changed.same.length > 0 || analysis.what_changed.different.length > 0) && (
        <div className="card p-5 fade-in-up stagger-2" style={{opacity: 0}}>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h5l3 8 4-16 3 8h5" />
            </svg>
            Historical Comparison
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-lg bg-bg-tertiary border border-border">
              <h4 className="text-[10px] font-bold text-success uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Same Signals
              </h4>
              {analysis.what_changed.same.length > 0 ? (
                <ul className="space-y-1.5">
                  {analysis.what_changed.same.map((s, idx) => (
                    <li key={idx} className="text-xs text-text-secondary flex items-start gap-2">
                      <span className="text-success mt-0.5 flex-shrink-0">•</span>{s}
                    </li>
                  ))}
                </ul>
              ) : <span className="text-xs text-text-muted italic">None identified</span>}
            </div>
            <div className="p-4 rounded-lg bg-bg-tertiary border border-border">
              <h4 className="text-[10px] font-bold text-warning uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                Divergent Factors
              </h4>
              {analysis.what_changed.different.length > 0 ? (
                <ul className="space-y-1.5">
                  {analysis.what_changed.different.map((d, idx) => (
                    <li key={idx} className="text-xs text-text-secondary flex items-start gap-2">
                      <span className="text-warning mt-0.5 flex-shrink-0">•</span>{d}
                    </li>
                  ))}
                </ul>
              ) : <span className="text-xs text-text-muted italic">Exact recurrence</span>}
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Action Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 fade-in-up stagger-3" style={{opacity: 0}}>
        {/* DO: Diagnostic */}
        <div className="card p-5 border-t-2 border-t-accent">
          <div className="flex items-center justify-between mb-3">
            <span className="badge bg-accent-muted text-accent text-[9px]">STEP 1</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <h4 className="text-[10px] font-bold text-accent uppercase tracking-wider mb-2">Diagnostic Action</h4>
          <p className="text-sm text-text-primary font-medium leading-relaxed">
            {analysis.next_diagnostic_action}
          </p>
        </div>

        {/* DO: Fix */}
        <div className="card p-5 border-t-2 border-t-success">
          <div className="flex items-center justify-between mb-3">
            <span className="badge bg-success-muted text-success text-[9px]">STEP 2</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h4 className="text-[10px] font-bold text-success uppercase tracking-wider mb-2">Proven Fix</h4>
          <p className="text-sm text-text-primary font-medium leading-relaxed">
            {analysis.recommended_fix}
          </p>
        </div>

        {/* DON'T: Avoid */}
        <div className="card p-5 border-t-2 border-t-danger">
          <div className="flex items-center justify-between mb-3">
            <span className="badge bg-danger-muted text-danger text-[9px]">GUARDRAIL</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h4 className="text-[10px] font-bold text-danger uppercase tracking-wider mb-2">Avoid This</h4>
          {analysis.avoid_recommendation ? (
            <div>
              <p className="text-sm text-text-primary font-medium line-through opacity-60 mb-1.5">
                {analysis.avoid_recommendation.action}
              </p>
              <p className="text-xs text-text-muted leading-relaxed">
                {analysis.avoid_recommendation.reason}
              </p>
            </div>
          ) : analysis.previously_failed && analysis.previously_failed.length > 0 ? (
            <div>
              <p className="text-sm text-text-primary font-medium line-through opacity-60 mb-1">
                {analysis.previously_failed[0]}
              </p>
              <p className="text-xs text-danger/70">Previously failed.</p>
            </div>
          ) : (
            <p className="text-sm text-text-muted italic">No known failed approaches.</p>
          )}
        </div>
      </div>

      {/* ── 4. Root Cause ── */}
      <div className="card p-5 fade-in-up stagger-4" style={{opacity: 0}}>
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Root Cause Hypothesis
        </h3>
        <p className="text-sm text-text-primary font-medium p-4 rounded-lg bg-bg-tertiary border border-border leading-relaxed">
          {analysis.root_cause_hypothesis}
        </p>
      </div>

      {/* ── 5. Guardrail Interventions ── */}
      {analysis.guardrail_events && analysis.guardrail_events.length > 0 && (
        <div className="card p-5 border-l-[3px] border-l-danger fade-in-up stagger-5" style={{opacity: 0}}>
          <h3 className="text-xs font-semibold text-danger uppercase tracking-wider mb-4 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Safety Guardrail Intervention
          </h3>
          <div className="space-y-3">
            {analysis.guardrail_events.map((ge, idx) => (
              <div key={idx} className="rounded-lg bg-bg-tertiary border border-border p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-3">
                  <span className="text-xs text-text-secondary">
                    Blocked for <span className="font-semibold text-text-primary">{ge.field}</span>
                  </span>
                  <span className="badge bg-danger-muted text-danger text-[9px]">
                    Matched {ge.source_incident}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="text-xs">
                    <span className="text-text-muted">Blocked: </span>
                    <span className="line-through text-danger font-medium">{ge.blocked_action}</span>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-md bg-success-muted/30 border border-success/10">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success mt-0.5 flex-shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <div>
                      <span className="text-[9px] text-success font-bold uppercase tracking-wider block mb-0.5">Replaced with</span>
                      <span className="text-xs font-medium text-text-primary">{ge.replaced_with}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 6. Outcome Capture ── */}
      <div className="card overflow-hidden mt-2">
        <button
          type="button"
          onClick={() => setShowOutcome(!showOutcome)}
          className="w-full flex items-center justify-between p-5 text-sm font-semibold text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer bg-transparent border-none text-left"
        >
          <span className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-success-muted flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
              </svg>
            </div>
            Record Outcome — Train the Memory
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-text-muted transition-transform ${showOutcome ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showOutcome && (
          <div className="p-5 pt-0 border-t border-border space-y-5">
            {/* Checklist */}
            <div className="pt-5">
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">
                Actions & Results
              </label>
              <div className="space-y-2">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.action}
                      onChange={(e) => updateChecklist(item.id, "action", e.target.value)}
                      placeholder="Action attempted..."
                      className="input-base flex-1 py-2 text-xs"
                    />
                    <select
                      value={item.result}
                      onChange={(e) => updateChecklist(item.id, "result", e.target.value)}
                      className={`input-base w-[110px] flex-shrink-0 py-2 text-xs font-semibold ${
                        item.result === "FAILED" ? "!border-danger/40 !text-danger !bg-danger-muted" :
                        item.result === "SUCCESS" ? "!border-success/40 !text-success !bg-success-muted" :
                        item.result === "PARTIAL" ? "!border-warning/40 !text-warning !bg-warning-muted" :
                        ""
                      }`}
                    >
                      <option value="NOT_TRIED">Not Tried</option>
                      <option value="FAILED">Failed</option>
                      <option value="PARTIAL">Partial</option>
                      <option value="SUCCESS">Success</option>
                      <option value="UNKNOWN">Unknown</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(item.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-danger-muted hover:text-danger transition-colors flex-shrink-0 cursor-pointer bg-transparent border-none"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addChecklistItem} className="btn-ghost text-accent text-xs mt-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add action
              </button>
            </div>

            {/* Root Cause + Resolution */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-border">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Root Cause <span className="text-danger">*</span>
                </label>
                <input type="text" value={customRootCause} onChange={(e) => setCustomRootCause(e.target.value)}
                  className="input-base text-xs" placeholder="Confirmed root cause" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Resolution <span className="text-danger">*</span>
                </label>
                <input type="text" value={customResolution} onChange={(e) => setCustomResolution(e.target.value)}
                  className="input-base text-xs" placeholder="What fixed it" />
              </div>
            </div>

            {recordError && (
              <div className="p-3 rounded-lg bg-danger-muted border border-danger/20 text-xs text-danger flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {recordError}
              </div>
            )}

            {recordSuccessNotice ? (
              <div className="p-4 rounded-lg bg-success-muted border border-success/20 text-sm font-medium text-success flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {recordSuccessNotice}
                </span>
                <button onClick={onRerunAnalysis} className="btn-ghost text-success text-[11px]">
                  Re-run analysis →
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConfirmOutcome}
                disabled={isRecording}
                className="w-full py-3 px-4 rounded-lg text-sm font-semibold transition-all bg-success hover:bg-success-hover text-white shadow-lg shadow-success/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer border-none"
              >
                {isRecording ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Committing to memory...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                    </svg>
                    Confirm & Record Outcome
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── 7. Reasoning Trace (Collapsible) ── */}
      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowReasoning(!showReasoning)}
          className="w-full flex items-center justify-between p-5 text-sm font-semibold text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer bg-transparent border-none text-left"
        >
          <span className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent-muted flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            Agent Reasoning & Memory Trace
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-text-muted transition-transform ${showReasoning ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showReasoning && (
          <div className="p-5 pt-0 border-t border-border space-y-5">
            <div className="pt-4">
              <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Agent Reasoning</h4>
              <div className="p-4 rounded-lg bg-bg-tertiary border border-border text-xs text-text-secondary leading-relaxed whitespace-pre-wrap font-mono">
                {analysis.reasoning}
              </div>
            </div>
            {analysis.raw_memories && analysis.raw_memories.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">
                  Recalled Memories ({analysis.raw_memories.length})
                </h4>
                <div className="space-y-3">
                  {analysis.raw_memories.map((mem, idx) => (
                    <div key={idx} className="rounded-lg bg-bg-tertiary border border-border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-xs font-bold text-accent">
                          {mem.incident_id || `Record #${idx + 1}`}
                        </span>
                        <span className="badge text-[8px] bg-bg-elevated text-text-muted">
                          {mem.source === "hindsight" ? "HINDSIGHT" : "LOCAL"}
                        </span>
                      </div>
                      <pre className="text-[11px] font-mono text-text-muted whitespace-pre-wrap leading-relaxed overflow-x-auto p-3 bg-bg-primary rounded-md border border-border">
                        {mem.text || JSON.stringify(mem.metadata, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
