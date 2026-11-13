"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getMyPortfolio, getMyProfile, getMyTransactions, type IndividualAccountProfile, type InvestorPortfolio, type InvestorTransactionsPage } from "@/lib/api/client";
import { AssetAllocation } from "./AssetAllocation";
import { IndividualDashboardMetrics } from "./IndividualDashboardMetrics";
import { IndividualQuickActions } from "./IndividualQuickActions";
import { InvestmentSolutions } from "./InvestmentSolutions";
import { LatestUpdates } from "./LatestUpdates";
import { PortfolioHoldingsPanel } from "./PortfolioHoldingsPanel";
import { RecentTransactions } from "./RecentTransactions";
import { VerificationProgressCard } from "./VerificationProgressCard";
import { WelcomeBanner } from "./WelcomeBanner";

type DashboardVariant = "individual" | "business";
type RequestState = "loading" | "success" | "error";
type DashboardData = {
  profile: IndividualAccountProfile;
  portfolio: InvestorPortfolio;
  transactions: InvestorTransactionsPage;
};

function DashboardLoading() {
  return <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-9 lg:py-8" aria-busy="true" aria-label="Loading your dashboard"><div className="animate-pulse space-y-5"><div className="h-52 rounded-xl bg-star-100" /><div className="grid gap-4 sm:grid-cols-3"><div className="h-36 rounded-xl bg-star-100" /><div className="h-36 rounded-xl bg-star-100" /><div className="h-36 rounded-xl bg-star-100" /></div><div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_320px]"><div className="h-80 rounded-xl bg-star-100" /><div className="h-80 rounded-xl bg-star-100" /></div></div><p className="sr-only">Loading your account information.</p></div>;
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return <div className="mx-auto flex min-h-[55vh] max-w-[1440px] items-center justify-center px-5 py-7 sm:px-8 lg:px-9"><section className="max-w-md rounded-xl border border-star-200 bg-white p-6 text-center shadow-card" aria-labelledby="dashboard-load-error-heading"><span className="mx-auto grid size-12 place-items-center rounded-full bg-red-50 text-red-700"><AlertCircle size={24} aria-hidden="true" /></span><h1 id="dashboard-load-error-heading" className="mt-4 text-xl font-extrabold text-star-900">We couldn&apos;t load your dashboard</h1><p className="mt-2 text-sm leading-6 text-star-muted">Please check your connection and try again. No account information is shown until the latest details are available.</p><button type="button" onClick={onRetry} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-star-700 px-4 text-sm font-bold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><RefreshCw size={17} aria-hidden="true" />Try again</button></section></div>;
}

function IndividualInvestorDashboard() {
  const [requestState, setRequestState] = useState<RequestState>("loading");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  const loadDashboard = useCallback(async () => {
    setRequestState("loading");
    try {
      const [profile, portfolio, transactions] = await Promise.all([
        getMyProfile(),
        getMyPortfolio(),
        getMyTransactions(1, 5),
      ]);
      setDashboard({ profile, portfolio, transactions });
      setRequestState("success");
    } catch {
      setDashboard(null);
      setRequestState("error");
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (requestState === "loading") return <DashboardLoading />;
  if (requestState === "error" || !dashboard) return <DashboardError onRetry={() => void loadDashboard()} />;

  const { profile, portfolio, transactions } = dashboard;
  return <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-9 lg:py-8"><WelcomeBanner firstName={profile.firstName} /><div className="mt-6"><IndividualDashboardMetrics portfolio={portfolio} /></div><div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_320px]"><PortfolioHoldingsPanel holdings={portfolio.holdings} /><div className="space-y-5"><IndividualQuickActions /><AssetAllocation hasHoldings={portfolio.holdings.length > 0} /></div></div><div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_320px]"><RecentTransactions transactions={transactions.transactions} /><VerificationProgressCard /></div><div className="mt-5 grid min-w-0 items-start gap-5 min-[1800px]:grid-cols-[minmax(0,1fr)_20rem]"><div className="min-w-0"><InvestmentSolutions /></div><div className="min-w-0"><LatestUpdates /></div></div><div id="statements" className="scroll-mt-24" /><div id="documents" className="scroll-mt-24" /></div>;
}

function BusinessDashboardPlaceholder() {
  return <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-9 lg:py-8"><section className="rounded-xl border border-star-200 bg-white p-6 sm:p-8"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Business account</p><h1 className="mt-2 font-display text-[clamp(1.8rem,3vw,2.45rem)] font-extrabold tracking-[-0.045em] text-star-900">Business Dashboard</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-star-muted">Use the links below to manage your business account. Portfolio data is shown only when a supported business account source is available.</p></section><div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_320px]"><InvestmentSolutions productsHref="/business/products" /><IndividualQuickActions variant="business" /></div></div>;
}

export function IndividualDashboardContent({ dashboardVariant = "individual" }: { dashboardVariant?: DashboardVariant }) {
  return dashboardVariant === "business" ? <BusinessDashboardPlaceholder /> : <IndividualInvestorDashboard />;
}
