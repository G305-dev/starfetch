"use client";

import { useState } from "react";
import { AssetAllocation } from "./AssetAllocation";
import { EmptyInvestmentsPanel, EmptyTransactionsPanel } from "./NewInvestorEmptyPanels";
import { IndividualDashboardErrorState, IndividualDashboardLoadingState } from "./IndividualDashboardStates";
import { IndividualDashboardMetrics } from "./IndividualDashboardMetrics";
import { IndividualQuickActions } from "./IndividualQuickActions";
import { InvestmentSolutions } from "./InvestmentSolutions";
import { LatestUpdates } from "./LatestUpdates";
import { OnboardingPromptModal } from "./OnboardingPromptModal";
import { PortfolioOverviewEmpty } from "./PortfolioOverviewEmpty";
import { VerificationProgressCard } from "./VerificationProgressCard";
import { WelcomeBanner } from "./WelcomeBanner";

type DashboardViewState = "ready" | "loading" | "error";

export function IndividualDashboardContent() {
  const [viewState, setViewState] = useState<DashboardViewState>("ready");
  const [showOnboardingPrompt, setShowOnboardingPrompt] = useState(true);

  if (viewState === "loading") return <IndividualDashboardLoadingState />;
  if (viewState === "error") return <IndividualDashboardErrorState onRetry={() => setViewState("ready")} />;

  return (
    <section aria-label="Individual investor dashboard">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><WelcomeBanner /><IndividualQuickActions /></div>
      <div className="mt-5"><IndividualDashboardMetrics /></div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_350px]">
        <div className="grid gap-5"><div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(290px,0.8fr)]"><PortfolioOverviewEmpty /><AssetAllocation /></div><div className="grid gap-5 md:grid-cols-2"><EmptyInvestmentsPanel /><EmptyTransactionsPanel /></div></div>
        <aside className="grid gap-5 self-start"><VerificationProgressCard /><LatestUpdates /></aside>
      </div>

      <div className="mt-5"><InvestmentSolutions /></div>
      {showOnboardingPrompt ? <OnboardingPromptModal onDefer={() => setShowOnboardingPrompt(false)} /> : null}
    </section>
  );
}
