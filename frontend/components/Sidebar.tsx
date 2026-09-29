"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import type { DeepHealthResponse } from "@/lib/types";

export default function Sidebar() {
  const pathname = usePathname();
  const [health, setHealth] = useState<DeepHealthResponse | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await api.checkDeepHealth();
      setHealth(res);
      setHealthError(false);
    } catch {
      setHealthError(true);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navItems = [
    {
      href: "/",
      label: "Dashboard",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      ),
    },
    {
      href: "/incidents",
      label: "Analyze Incident",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      ),
    },
    {
      href: "/history",
      label: "History",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      href: "/memory",
      label: "Memory",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      ),
    },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname?.startsWith(href + "/");
  };

  const statusColor = healthError
    ? "text-danger"
    : !health
    ? "text-warning"
    : health.status === "ok"
    ? "text-accent"
    : "text-warning";

  const statusDotBg = healthError
    ? "bg-danger"
    : !health
    ? "bg-warning"
    : health.status === "ok"
    ? "bg-accent"
    : "bg-warning";

  const statusLabel = healthError
    ? "Backend unreachable"
    : !health
    ? "Connecting..."
    : health.status === "ok"
    ? "All systems operational"
    : "Degraded mode";

  const groqOk = health?.groq?.ok ?? false;
  const hindsightOk = health?.hindsight?.ok ?? false;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <Link href="/" className="flex items-center gap-3 no-underline group">
          <div className="relative">
            {/* Logo mark with gradient + glow */}
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg transition-shadow"
              style={{
                background: 'linear-gradient(135deg, #00D4AA, #00B894)',
                boxShadow: '0 4px 16px rgba(0, 212, 170, 0.25)',
              }}
            >
              <span className="text-[#060A13] font-mono font-extrabold text-[11px] leading-none tracking-tighter">RO</span>
            </div>
            {/* Status dot */}
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg-secondary flex items-center justify-center">
              <div className={`w-full h-full rounded-full ${statusDotBg} ${!healthError && health?.status === 'ok' ? 'breathe' : ''}`} />
            </div>
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-text-primary leading-tight tracking-tight">
              Recall<span className="text-accent">Ops</span>
            </h1>
            <p className="text-[9px] text-text-muted leading-tight font-semibold uppercase tracking-[0.2em] mt-0.5">
              Incident Intelligence
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-2">
        <p className="text-[9px] font-bold text-text-muted uppercase tracking-[0.15em] px-3 mb-2">
          Navigate
        </p>
        <ul className="list-none p-0 m-0 space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 no-underline relative ${
                    active
                      ? "text-accent"
                      : "text-text-muted hover:text-text-primary hover:bg-bg-tertiary/50"
                  }`}
                  style={active ? {
                    background: 'linear-gradient(135deg, rgba(0, 212, 170, 0.1), rgba(0, 212, 170, 0.04))',
                    boxShadow: 'inset 0 0 20px rgba(0, 212, 170, 0.05)',
                  } : {}}
                  aria-current={active ? "page" : undefined}
                >
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                      style={{ background: 'linear-gradient(180deg, #00D4AA, #00B894)', boxShadow: '0 0 8px rgba(0, 212, 170, 0.5)' }}
                    />
                  )}
                  <span className={`flex-shrink-0 transition-colors ${active ? "text-accent" : ""}`}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* System Status Footer */}
      <div className="px-3 pb-4">
        <div className="p-4 rounded-xl border border-border"
          style={{ background: 'linear-gradient(165deg, var(--color-bg-tertiary), var(--color-bg-secondary))' }}
        >
          <button
            onClick={fetchHealth}
            className="flex items-center gap-2 w-full text-left text-[11px] text-text-muted hover:text-text-secondary transition-colors cursor-pointer bg-transparent border-none p-0 font-medium"
            title="Click to refresh system status"
            aria-label={`System status: ${statusLabel}`}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotBg} ${
              !healthError && health?.status === "ok" ? "breathe" : ""
            }`}
              aria-hidden="true"
            />
            <span className={statusColor}>{statusLabel}</span>
          </button>

          {health && (
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-text-muted font-medium flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-ai inline-block" />
                  LLM (Groq)
                </span>
                <span className={`font-semibold ${groqOk ? "text-accent" : "text-danger"}`}>
                  {groqOk ? "Connected" : "Offline"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-text-muted font-medium flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-accent inline-block" />
                  Hindsight
                </span>
                <span className={`font-semibold ${hindsightOk ? "text-accent" : "text-warning"}`}>
                  {hindsightOk ? "Connected" : "Local fallback"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex md:flex-col md:w-[244px] md:flex-shrink-0 border-r border-border h-screen sticky top-0"
        style={{ background: 'linear-gradient(180deg, var(--color-bg-secondary), var(--color-bg-primary))' }}
        role="navigation"
        aria-label="Main navigation"
      >
        {sidebarContent}
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 border-b border-border"
        style={{ background: 'rgba(6, 10, 19, 0.92)', backdropFilter: 'blur(16px)' }}
      >
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #00D4AA, #00B894)' }}
            >
              <span className="text-[#060A13] font-mono font-extrabold text-[10px] leading-none">RO</span>
            </div>
            <span className="text-sm font-bold text-text-primary">
              Recall<span className="text-accent">Ops</span>
            </span>
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors cursor-pointer bg-transparent border-none text-text-secondary"
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {mobileOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
        {mobileOpen && (
          <nav className="px-4 py-3 border-t border-border" style={{ background: 'var(--color-bg-secondary)' }} aria-label="Mobile navigation">
            <ul className="space-y-1 list-none p-0 m-0">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium no-underline ${
                        active ? "text-accent bg-accent-muted" : "text-text-muted"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className={active ? "text-accent" : ""}>{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-[11px] text-text-muted">
              <span className={`w-2 h-2 rounded-full ${statusDotBg}`} aria-hidden="true" />
              <span>{statusLabel}</span>
            </div>
          </nav>
        )}
      </div>
    </>
  );
}
