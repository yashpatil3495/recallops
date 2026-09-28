"use client";

import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Header() {
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    let mounted = true;
    api
      .checkHealth()
      .then(() => {
        if (mounted) setBackendStatus("online");
      })
      .catch(() => {
        if (mounted) setBackendStatus("offline");
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-mono font-bold text-white shadow-lg shadow-cyan-500/20">
            RO
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-wider text-slate-100 font-mono">
                RECALL<span className="text-cyan-400">OPS</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 uppercase">
                Persistent Memory Agent
              </span>
            </div>
            <p className="text-xs text-slate-400">Incident intelligence powered by Hindsight & Groq</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 text-xs font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-md">
            <span className="text-slate-400">Memory:</span>
            <span className="text-cyan-400 font-medium">Hindsight Cloud</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">LLM:</span>
            <span className="text-emerald-400 font-medium">Groq (120B)</span>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono">
            {backendStatus === "online" ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                API CONNECTED
              </span>
            ) : backendStatus === "offline" ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-rose-950/80 text-rose-400 border border-rose-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5"></span>
                API DISCONNECTED
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/80 text-amber-400 border border-amber-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 animate-ping"></span>
                CONNECTING...
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
