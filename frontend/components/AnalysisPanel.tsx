"use client";

import React, { useState } from "react";
import { AnalysisData, AttemptItem, RecordRequest } from "../lib/types";

interface Props {
  analysis: AnalysisData | null;
  currentService: string;
  currentSymptoms: string[];
  isLoading: boolean;
  error: string | null;
  onRecordSuccess: () => void;
  onRecord: (payload: RecordRequest) => Promise<void>;
  isRecording: boolean;
}

export default function AnalysisPanel({
  analysis,
  currentService,
  currentSymptoms,
  isLoading,
  error,
  onRecord,
  isRecording,
}: Props) {
  const [showRawMemories, setShowRawMemories] = useState<boolean>(false);
  const [customRootCause, setCustomRootCause] = useState<string>("");
  const [customResolution, setCustomResolution] = useState<string>("");
  const [recordSuccessNotice, setRecordSuccessNotice] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);

  // Sync inputs when analysis updates
  React.useEffect(() => {
    if (analysis) {
      setCustomRootCause(analysis.root_cause_hypothesis || "");
      setCustomResolution(analysis.recommended_fix || "");
      setRecordSuccessNotice(null);
    }
  }, [analysis]);

  if (isLoading) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-8 shadow-xl text-center space-y-4">
        <div className="flex justify-center">
          <div className="relative w-12 h-12">
            <div className="w-12 h-12 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-cyan-400">
              RO
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-wider">
            Agent Reasoning Active
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Recalling historical incident lifecycles from Hindsight memory bank and synthesizing diagnostic path with Groq...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-950/30 border border-rose-800/60 rounded-xl p-6 shadow-xl">
        <div className="flex items-center space-x-2 text-rose-400 font-mono text-sm font-bold uppercase mb-2">
          <span>⚠</span>
          <span>Analysis Error</span>
        </div>
        <p className="text-xs text-rose-300 font-mono leading-relaxed">{error}</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-slate-900/40 border border-slate-800/60 border-dashed rounded-xl p-12 text-center">
        <div className="text-3xl mb-2">🧠</div>
        <h3 className="text-sm font-mono font-medium text-slate-400 uppercase tracking-wider">
          Awaiting Incident Analysis
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Submit incident symptoms above or select a preset to trigger persistent memory recall and diagnostic intelligence.
        </p>
      </div>
    );
  }

  const confidencePercent = Math.round(analysis.recurrence_confidence * 100);

  const handleConfirmOutcome = async () => {
    // Build attempts array reflecting failed and succeeded actions
    const attempts: AttemptItem[] = [];
    analysis.previously_failed.forEach((f) => attempts.push({ action: f, result: "FAILED" }));
    analysis.previously_succeeded.forEach((s) => attempts.push({ action: s, result: "SUCCESS" }));

    const payload: RecordRequest = {
      service: currentService,
      symptoms: currentSymptoms,
      attempts,
      root_cause: customRootCause || analysis.root_cause_hypothesis,
      resolution: customResolution || analysis.recommended_fix,
      outcome: "RESOLVED",
    };

    try {
      setRecordError(null);
      await onRecord(payload);
      setRecordSuccessNotice("Outcome successfully committed to Hindsight long-term memory! Memory stats updated.");
      setTimeout(() => setRecordSuccessNotice(null), 5000);
    } catch (err: any) {
      setRecordError(`Failed to record outcome: ${err.message}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Recurrence Banner */}
      <div
        className={`border rounded-xl p-4 shadow-xl ${
          analysis.is_recurring
            ? "bg-gradient-to-r from-amber-950/40 via-slate-900 to-rose-950/30 border-amber-600/50"
            : "bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/30 border-emerald-600/50"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{analysis.is_recurring ? "🚨" : "✨"}</span>
            <div>
              <div className="flex items-center space-x-2">
                <span
                  className={`text-xs font-mono font-bold uppercase px-2 py-0.5 rounded ${
                    analysis.is_recurring
                      ? "bg-amber-900/80 text-amber-300 border border-amber-700/60"
                      : "bg-emerald-900/80 text-emerald-300 border border-emerald-700/60"
                  }`}
                >
                  {analysis.is_recurring ? "RECURRING INCIDENT DETECTED" : "NEW INCIDENT PATTERN"}
                </span>
                <span className="text-xs font-mono font-semibold text-slate-300">
                  {confidencePercent}% Confidence
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-1">
                {analysis.identified_pattern || "Operational pattern identified"}
              </p>
            </div>
          </div>

          {analysis.similar_incidents && analysis.similar_incidents.length > 0 && (
            <div className="flex items-center space-x-1.5 font-mono text-xs">
              <span className="text-slate-400 text-[11px]">MATCHED MEMORIES:</span>
              {analysis.similar_incidents.map((id) => (
                <span
                  key={id}
                  className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold"
                >
                  {id}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Confidence Meter Bar */}
        <div className="mt-3 w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              analysis.is_recurring ? "bg-amber-400" : "bg-emerald-400"
            }`}
            style={{ width: `${confidencePercent}%` }}
          ></div>
        </div>
      </div>

      {/* 2. Hero Action Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Next Diagnostic Action */}
        <div className="bg-slate-900/95 border-2 border-cyan-500/60 rounded-xl p-4 shadow-lg shadow-cyan-950/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 px-2 py-0.5 bg-cyan-500/20 text-cyan-300 text-[10px] font-mono rounded-bl">
            STEP 1
          </div>
          <div className="flex items-center space-x-2 text-cyan-400 font-mono text-xs font-bold uppercase mb-2">
            <span>🎯</span>
            <span>Recommended Next Diagnostic Action</span>
          </div>
          <p className="text-xs font-mono font-semibold text-cyan-100 bg-cyan-950/50 p-2.5 rounded-lg border border-cyan-800/60 leading-relaxed">
            {analysis.next_diagnostic_action}
          </p>
        </div>

        {/* Recommended Fix */}
        <div className="bg-slate-900/95 border-2 border-emerald-500/60 rounded-xl p-4 shadow-lg shadow-emerald-950/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-mono rounded-bl">
            STEP 2
          </div>
          <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-bold uppercase mb-2">
            <span>✅</span>
            <span>Proven Remediation / Fix</span>
          </div>
          <p className="text-xs font-mono font-semibold text-emerald-100 bg-emerald-950/50 p-2.5 rounded-lg border border-emerald-800/60 leading-relaxed">
            {analysis.recommended_fix}
          </p>
        </div>
      </div>

      {/* 3. Fix History (Red X vs Green Check) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Previously Failed (Strictly Avoid) */}
        <div className="bg-slate-900/90 border border-rose-900/60 rounded-xl p-4">
          <div className="flex items-center space-x-2 text-rose-400 font-mono text-xs font-bold uppercase mb-2.5">
            <span>❌</span>
            <span>Previously Failed Approaches (Do Not Repeat)</span>
          </div>
          {analysis.previously_failed && analysis.previously_failed.length > 0 ? (
            <ul className="space-y-1.5">
              {analysis.previously_failed.map((act, idx) => (
                <li
                  key={idx}
                  className="flex items-center space-x-2 text-xs font-mono text-rose-300 bg-rose-950/40 px-2.5 py-1.5 rounded border border-rose-900/50"
                >
                  <span className="text-rose-400 font-bold">✕</span>
                  <span>{act}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-mono text-slate-500 italic">No failed attempts recorded for this pattern.</p>
          )}
        </div>

        {/* Previously Succeeded */}
        <div className="bg-slate-900/90 border border-emerald-900/60 rounded-xl p-4">
          <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-bold uppercase mb-2.5">
            <span>✓</span>
            <span>Previously Succeeded Fixes</span>
          </div>
          {analysis.previously_succeeded && analysis.previously_succeeded.length > 0 ? (
            <ul className="space-y-1.5">
              {analysis.previously_succeeded.map((act, idx) => (
                <li
                  key={idx}
                  className="flex items-center space-x-2 text-xs font-mono text-emerald-300 bg-emerald-950/40 px-2.5 py-1.5 rounded border border-emerald-900/50"
                >
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>{act}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-mono text-slate-500 italic">No prior successful fixes recorded.</p>
          )}
        </div>
      </div>

      {/* 4. Root Cause Hypothesis & Reasoning */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
        <div>
          <span className="text-[11px] font-mono text-slate-400 uppercase block mb-1">
            Root Cause Hypothesis:
          </span>
          <p className="text-xs font-medium text-slate-200 bg-slate-950 p-2 rounded border border-slate-800">
            {analysis.root_cause_hypothesis}
          </p>
        </div>

        <div>
          <span className="text-[11px] font-mono text-slate-400 uppercase block mb-1">
            Agent Reasoning & Memory Trace:
          </span>
          <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800 leading-relaxed font-sans">
            {analysis.reasoning}
          </p>
        </div>
      </div>

      {/* 5. Collapsible Recalled Raw Memories */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowRawMemories(!showRawMemories)}
          className="w-full flex items-center justify-between p-3.5 text-xs font-mono text-slate-300 hover:text-white transition cursor-pointer"
        >
          <span className="flex items-center space-x-2">
            <span>📚</span>
            <span>Recalled Hindsight Memories ({analysis.raw_memories?.length || 0} Records)</span>
          </span>
          <span>{showRawMemories ? "▲ COLLAPSE" : "▼ EXPAND"}</span>
        </button>

        {showRawMemories && (
          <div className="p-4 pt-0 space-y-3 border-t border-slate-800/80">
            {analysis.raw_memories && analysis.raw_memories.length > 0 ? (
              analysis.raw_memories.map((mem, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-cyan-400 font-bold">
                      {mem.incident_id || `Record #${idx + 1}`}
                    </span>
                    <span className="text-slate-500 text-[10px]">
                      Score: {mem.score ? mem.score.toFixed(2) : "0.85"} | Source: {mem.source || "hindsight"}
                    </span>
                  </div>
                  <pre className="text-[11px] text-slate-400 whitespace-pre-wrap leading-tight overflow-x-auto">
                    {mem.text || JSON.stringify(mem.metadata, null, 2)}
                  </pre>
                </div>
              ))
            ) : (
              <p className="text-xs font-mono text-slate-500 py-2">No raw memories available.</p>
            )}
          </div>
        )}
      </div>

      {/* 6. Confirm Outcome & Commit to Memory Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-cyan-800/60 rounded-xl p-5 shadow-xl space-y-3">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
          <span className="text-cyan-400">💾</span>
          <h3 className="font-mono text-xs font-bold text-slate-200 uppercase tracking-wider">
            Confirm Outcome & Commit to Long-Term Memory (POST /record)
          </h3>
        </div>

        <p className="text-xs text-slate-400">
          Once the incident is mitigated, confirm the findings to store the lifecycle and lessons learned into Hindsight memory. This closes the feedback loop.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
              Confirmed Root Cause
            </label>
            <input
              type="text"
              value={customRootCause}
              onChange={(e) => setCustomRootCause(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
              Confirmed Resolution Action
            </label>
            <input
              type="text"
              value={customResolution}
              onChange={(e) => setCustomResolution(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleConfirmOutcome}
          disabled={isRecording}
          className="w-full py-2.5 px-4 rounded-lg font-mono text-xs font-bold uppercase tracking-wider transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center space-x-2"
        >
          {isRecording ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>Committing to Hindsight Memory Bank...</span>
            </>
          ) : (
            <>
              <span>💾</span>
              <span>Confirm & Record Incident Outcome</span>
            </>
          )}
        </button>

        {recordSuccessNotice && (
          <div className="p-2.5 rounded bg-emerald-950/60 border border-emerald-800 text-xs font-mono text-emerald-300">
            ✓ {recordSuccessNotice}
          </div>
        )}

        {recordError && (
          <div className="p-2.5 rounded bg-rose-950/60 border border-rose-800 text-xs font-mono text-rose-300">
            ⚠ {recordError}
          </div>
        )}
      </div>
    </div>
  );
}
