"use client";

import { BarChart3, Building2, CalendarDays, Coins, Info, Layers, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getCorporateOnboarding, getMyCorporateApplications } from "@/lib/api/client";
import type { CorporateOnboardingRecord } from "@/lib/corporate/application";
import {
  formatCorporateDate,
  formatRcNumber,
  getCorporateDashboardHeading,
  isCorporateVerified,
} from "@/lib/corporate/dashboard";
import { CorporateApplicationsWorkspace } from "./CorporateApplicationsWorkspace";

const metrics = [
  { label: "Total Portfolio Value", icon: Layers },
  { label: "Total Invested", icon: Coins },
  { label: "Total Returns", icon: BarChart3 },
  { label: "Available Cash", icon: Wallet },
];

const chartRanges = ["1M", "3M", "6M", "YTD", "1Y", "All"];

function MetricCard({ label, icon: Icon }: { label: string; icon: typeof Layers }) {
  return (
    <article className="rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)]">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-star-100 text-star-700">
          <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <p className="flex items-center gap-1.5 text-sm font-bold text-star-900">
          {label}
          <Info size={14} className="text-star-muted" aria-label={`${label} is unavailable until an approved Corporate portfolio response is available`} />
        </p>
      </div>
      <p className="mt-4 text-xl font-extrabold text-star-muted">Unavailable</p>
      <p className="mt-1 text-xs leading-5 text-star-muted">Awaiting an approved Corporate portfolio response.</p>
    </article>
  );
}

function PortfolioPerformanceCard() {
  return (
    <section className="rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-6" aria-labelledby="corporate-performance-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <TrendingUp size={22} className="mt-1 shrink-0 text-star-700" aria-hidden="true" />
          <div>
            <h2 id="corporate-performance-heading" className="text-lg font-extrabold text-star-900">Portfolio Performance</h2>
            <p className="mt-0.5 text-sm text-star-muted">Total portfolio value over time</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-star-50 p-1" role="group" aria-label="Portfolio chart ranges (unavailable until portfolio data is connected)">
          {chartRanges.map((range) => (
            <button
              key={range}
              type="button"
              disabled
              title="Available when an approved Corporate portfolio feed is connected"
              aria-disabled="true"
              className={`min-h-8 rounded-md px-3 text-xs font-extrabold ${range === "1Y" ? "bg-star-700 text-white" : "text-star-muted"} cursor-not-allowed opacity-70`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 grid min-h-[220px] place-items-center rounded-xl border border-dashed border-star-200 bg-[#fbfcf8] px-6 py-10 text-center">
        <div>
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-star-100 text-star-700">
            <TrendingUp size={24} aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-base font-extrabold text-star-900">Portfolio chart unavailable</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-star-muted">
            The chart will appear when an approved Corporate portfolio feed is connected via the owner-scoped discovery API. No example values are shown.
          </p>
        </div>
      </div>
    </section>
  );
}

function AccountOverviewCard({ onboarding }: { onboarding: CorporateOnboardingRecord | null }) {
  const details = onboarding?.details;
  const rows: Array<[string, string]> = [
    ["Company Name", details?.institutionName ?? "Not available"],
    ["RC Number", formatRcNumber(details?.rcNumber)],
    ["Business Email", details?.businessEmail ?? "Not available"],
  ];
  return (
    <section className="relative overflow-hidden rounded-xl border border-star-200 bg-white shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="corporate-overview-heading">
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <Building2 size={22} className="shrink-0 text-star-700" aria-hidden="true" />
          <h2 id="corporate-overview-heading" className="text-lg font-extrabold text-star-900">Corporate Account Overview</h2>
        </div>
        <dl className="mt-5 space-y-4">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-sm text-star-muted">{label}</dt>
              <dd className="break-words text-right text-sm font-extrabold text-star-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <svg viewBox="0 0 400 90" preserveAspectRatio="none" aria-hidden="true" className="block h-[90px] w-full">
        <defs>
          <linearGradient id="corporate-overview-wave" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#B9ED1D" />
            <stop offset="55%" stopColor="#2E7253" />
            <stop offset="100%" stopColor="#003B2A" />
          </linearGradient>
        </defs>
        <path d="M0,70 C80,20 140,95 220,55 C300,15 340,60 400,35 L400,90 L0,90 Z" fill="url(#corporate-overview-wave)" opacity="0.9" />
        <path d="M0,82 C90,45 170,95 250,70 C320,48 360,75 400,60 L400,90 L0,90 Z" fill="#003B2A" opacity="0.55" />
      </svg>
    </section>
  );
}

export function CorporateDashboardContent() {
  const { status, user } = useAuth();
  const [onboarding, setOnboarding] = useState<CorporateOnboardingRecord | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [todayLabel, setTodayLabel] = useState("");
  const [now, setNow] = useState<Date | null>(null);

  // Load the first owner-scoped Corporate application for the header,
  // verified badge and account overview. The workspace below keeps its
  // own selection state for application/verification management.
  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    let cancelled = false;
    async function loadAccount() {
      try {
        const accounts = await getMyCorporateApplications();
        const first = accounts[0];
        if (cancelled || !first) return;
        setCreatedAt(first.createdAt);
        const record = await getCorporateOnboarding(first.corporateAccountId);
        if (cancelled) return;
        setOnboarding(record);
        setCreatedAt(record.createdAt);
      } catch {
        // Header/overview fall back to the authenticated user projection;
        // the workspace below reports discovery errors in full.
        if (!cancelled) {
          setOnboarding(null);
        }
      }
    }
    void loadAccount();
    return () => {
      cancelled = true;
    };
  }, [status, user?.id]);

  // Sync the date and greeting to local time after mount to avoid
  // hydration mismatch between server (UTC) and visitor (local) time.
  useEffect(() => {
    const current = new Date();
    setNow(current);
    setTodayLabel(formatCorporateDate(current));
  }, []);

  const companyName = onboarding?.details.institutionName || user?.companyName || "Corporate applicant";
  const verified = isCorporateVerified(onboarding?.status);
  // Before mount, render the deterministic first-timer heading; after
  // mount the local-time greeting applies for returning users.
  const heading = now
    ? getCorporateDashboardHeading({ companyName, createdAt, now })
    : `Welcome, ${companyName}`;

  return (
    <main className="min-w-0" aria-labelledby="corporate-dashboard-heading">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 id="corporate-dashboard-heading" className="font-display text-[clamp(1.85rem,3vw,2.55rem)] font-extrabold tracking-[-0.045em] text-star-900">
              {heading}
            </h1>
            {verified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f7d9] px-3 py-1.5 text-xs font-extrabold text-star-700">
                <ShieldCheck size={15} aria-hidden="true" />
                Verified Applicant
              </span>
            ) : null}
          </div>
        </div>
        <p className="flex shrink-0 items-center gap-2 text-sm font-semibold text-star-900">
          {todayLabel}
          <span className="grid size-9 place-items-center rounded-lg border border-star-200 bg-white text-star-700">
            <CalendarDays size={18} aria-hidden="true" />
          </span>
        </p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Corporate portfolio summary">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} icon={metric.icon} />
        ))}
      </section>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <PortfolioPerformanceCard />
        <AccountOverviewCard onboarding={onboarding} />
      </div>

      <CorporateApplicationsWorkspace />

      <svg viewBox="0 0 1440 110" preserveAspectRatio="none" aria-hidden="true" className="mt-10 block h-[70px] w-full sm:h-[90px]">
        <defs>
          <linearGradient id="corporate-dashboard-wave" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#B9ED1D" />
            <stop offset="45%" stopColor="#2E7253" />
            <stop offset="100%" stopColor="#003B2A" />
          </linearGradient>
        </defs>
        <path d="M0,75 C240,20 420,100 720,55 C1020,10 1200,80 1440,40 L1440,110 L0,110 Z" fill="url(#corporate-dashboard-wave)" opacity="0.9" />
        <path d="M0,92 C260,55 480,105 760,78 C1040,52 1240,95 1440,70 L1440,110 L0,110 Z" fill="#003B2A" opacity="0.6" />
      </svg>
    </main>
  );
}
