import type { Metadata } from "next";
import { DashboardGreeting } from "@/components/portal/DashboardGreeting";
import { DashboardSummaryCards } from "@/components/portal/DashboardSummaryCards";
import { InvestmentOpportunityCard } from "@/components/portal/InvestmentOpportunityCard";
import { InvestmentTable } from "@/components/portal/InvestmentTable";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { PortfolioPerformance } from "@/components/portal/PortfolioPerformance";
import { QuickActions } from "@/components/portal/QuickActions";
import { RecentTransactions } from "@/components/portal/RecentTransactions";

export const metadata: Metadata = {
  title: "Investor Dashboard | Starfetch Investor Portal",
  description: "Starfetch Investor Portal dashboard frontend mockup.",
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#fffef9] text-star-900 lg:flex">
      <PortalSidebar />
      <div className="min-w-0 flex-1">
        <PortalHeader />
        <main className="mx-auto max-w-[1600px] px-5 py-7 sm:px-8 sm:py-8 lg:px-8 xl:px-10">
          <DashboardGreeting />
          <div className="mt-7">
            <DashboardSummaryCards />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
            <PortfolioPerformance />
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
              <InvestmentOpportunityCard />
              <QuickActions />
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
            <InvestmentTable />
            <RecentTransactions />
          </div>
        </main>
      </div>
    </div>
  );
}
