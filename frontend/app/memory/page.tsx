"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import MemoryPanel from "@/components/MemoryPanel";

export default function MemoryPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 md:max-h-screen md:overflow-y-auto">
        <div className="pt-14 md:pt-0">
          <div className="p-6 md:p-8 max-w-5xl mx-auto page-enter">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">
                Memory Intelligence
              </h1>
              <p className="text-sm text-text-muted mt-1">
                Global view of Hindsight memory, learned patterns, and operational knowledge.
              </p>
            </div>

            <MemoryPanel
              refreshTrigger={refreshTrigger}
              onSeedCompleted={() => setRefreshTrigger((prev) => prev + 1)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
