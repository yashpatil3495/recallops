"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import IncidentForm from "@/components/IncidentForm";
import AnalysisPanel from "@/components/AnalysisPanel";
import { api } from "@/lib/api";
import { AnalyzeRequest, AnalysisData, RecordRequest } from "@/lib/types";

export default function NewIncidentPage() {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentService, setCurrentService] = useState("");
  const [currentSymptoms, setCurrentSymptoms] = useState<string[]>([]);
  const [currentContext, setCurrentContext] = useState({});

  const [isRecording, setIsRecording] = useState(false);

  const handleAnalyze = async (payload: AnalyzeRequest) => {
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    setCurrentService(payload.service);
    setCurrentSymptoms(payload.symptoms);
    setCurrentContext({
      environment: payload.environment,
      severity: payload.severity,
      logs: payload.logs,
    });

    try {
      const res = await api.analyzeIncident(payload);
      setAnalysis(res.analysis);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecord = async (payload: RecordRequest) => {
    setIsRecording(true);
    try {
      await api.recordIncident(payload);
    } finally {
      setIsRecording(false);
    }
  };

  const handleRerun = () => {
    setAnalysis(null);
    setError(null);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 md:max-h-screen md:overflow-y-auto">
        <div className="pt-14 md:pt-0">
          <div className="p-6 md:p-8 max-w-7xl mx-auto page-enter">
            {/* Page Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">
                Analyze Incident
              </h1>
              <p className="text-sm text-text-muted mt-1">
                Submit symptoms to recall memory and get diagnostic intelligence.
              </p>
            </div>

            {/* Two-Panel Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Form */}
              <div className="lg:col-span-4">
                <div className="card p-5 lg:sticky lg:top-8">
                  <div className="flex items-center gap-2 pb-4 mb-4 border-b border-border">
                    <div className="w-7 h-7 rounded-lg bg-accent-muted flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-text-primary">Incident Input</h2>
                      <p className="text-[10px] text-text-muted">Describe the incident to analyze.</p>
                    </div>
                  </div>
                  <IncidentForm onAnalyze={handleAnalyze} isLoading={isLoading} />
                </div>
              </div>

              {/* Right: Results */}
              <div className="lg:col-span-8">
                <AnalysisPanel
                  analysis={analysis}
                  currentService={currentService}
                  currentSymptoms={currentSymptoms}
                  currentContext={currentContext}
                  isLoading={isLoading}
                  error={error}
                  onRecord={handleRecord}
                  onRecordSuccess={() => {}}
                  onRerunAnalysis={handleRerun}
                  isRecording={isRecording}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
