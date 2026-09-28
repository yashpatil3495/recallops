"use client";

import React, { useState } from "react";
import Header from "../components/Header";
import IncidentForm from "../components/IncidentForm";
import AnalysisPanel from "../components/AnalysisPanel";
import MemorySidebar from "../components/MemorySidebar";
import { api } from "../lib/api";
import { AnalysisData, AnalyzeRequest, RecordRequest } from "../lib/types";

export default function DashboardPage() {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [currentService, setCurrentService] = useState<string>("payment-api");
  const [currentSymptoms, setCurrentSymptoms] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState<number>(0);

  const triggerSidebarRefresh = () => {
    setSidebarRefreshTrigger((prev) => prev + 1);
  };

  const handleAnalyze = async (payload: AnalyzeRequest) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setCurrentService(payload.service);
    setCurrentSymptoms(payload.symptoms);

    try {
      const res = await api.analyzeIncident(payload);
      if (res.success && res.analysis) {
        setAnalysis(res.analysis);
      } else {
        throw new Error("Invalid response format from analysis endpoint");
      }
    } catch (err: any) {
      setAnalysisError(err.message || "Failed to analyze incident");
      setAnalysis(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRecord = async (payload: RecordRequest) => {
    setIsRecording(true);
    try {
      await api.recordIncident(payload);
      triggerSidebarRefresh();
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Intro Tagline */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-900 gap-2">
          <div>
            <h1 className="text-xl font-mono font-bold text-slate-100 tracking-tight">
              SRE Incident Intelligence Console
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Persistent memory recall prevents repeating failed remediation actions.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
              Agent Loop: Recur → Avoid Failures → Recommend Fix
            </span>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Left Pane: Input & Analysis (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <IncidentForm onAnalyze={handleAnalyze} isLoading={isAnalyzing} />

            <AnalysisPanel
              analysis={analysis}
              currentService={currentService}
              currentSymptoms={currentSymptoms}
              isLoading={isAnalyzing}
              error={analysisError}
              onRecord={handleRecord}
              onRecordSuccess={triggerSidebarRefresh}
              isRecording={isRecording}
            />
          </div>

          {/* Right Sidebar: Memory Stats & Patterns (4 cols) */}
          <div className="lg:col-span-4">
            <MemorySidebar
              refreshTrigger={sidebarRefreshTrigger}
              onSeedCompleted={triggerSidebarRefresh}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 mt-12 text-center text-xs font-mono text-slate-600">
        RecallOps &copy; 2026 &bull; Hindsight AI Memory &bull; Groq LPU Inference Engine
      </footer>
    </div>
  );
}
