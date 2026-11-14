"use client";
import { useMemo,useState } from "react";
import { X } from "lucide-react";
import { AdminSectionCard,AdminStatCard } from "./AdminDashboard";
import { PortfolioAllocationChart,PortfolioPerformanceChart } from "./PortfolioCharts";
import { PortfolioFilters,PortfolioTabs,type PortfolioFiltersState,type PortfolioTab } from "./PortfolioFilters";
import { AdminHoldingsTable,PortfolioInvestorTypeBreakdown,PortfolioMaturityView,PortfolioPerformanceView,PortfolioSolutionBreakdown,RecentPortfolioActivities } from "./PortfolioViews";
import { portfolioHoldings,portfolioSnapshotDate,portfolioSummaryStats } from "./admin-portfolios-data";
import { filterPortfolioHoldings } from "./admin-portfolios-utils";

const initialFilters:PortfolioFiltersState={search:"",solution:"All Solutions",status:"All Statuses",maturity:"all"};
export function PortfolioSummaryCards() { return <section aria-label="Portfolio summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{portfolioSummaryStats.map(stat=><AdminStatCard key={stat.title} stat={stat}/>)}</section>; }
export function AdminPortfoliosPage() {
  const [tab,setTab]=useState<PortfolioTab>("holdings");const [filters,setFilters]=useState<PortfolioFiltersState>(initialFilters);const [notice,setNotice]=useState("");
  const holdings=useMemo(()=>filterPortfolioHoldings(portfolioHoldings,filters,portfolioSnapshotDate),[filters]);
  const action=(name:string)=>setNotice(`${name} is a preview only. No portfolio action was performed.`);
  return <main className="mt-4"><p className="mb-1 text-[10px] font-semibold text-[#6f8073]">Development preview · Portfolio values, returns, holdings and activity are synthetic—not live financial data.</p><p className="mb-4 text-[10px] text-[#7c897e]">Aggregates and charts are illustrative fixtures, independent of sample holdings. Maturity filters use the Nov 2, 2026 mock snapshot. Holding labels are not additional investment solutions.</p><PortfolioSummaryCards/><div className="mt-5 grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]"><PortfolioPerformanceChart/><PortfolioAllocationChart/></div><div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]"><AdminSectionCard className="min-w-0 p-3 sm:p-4"><PortfolioTabs value={tab} onChange={setTab}/>{notice && <div role="status" className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#cfe3c2] bg-[#f0f8e9] px-4 py-3 text-xs text-star-900"><span>{notice}</span><button onClick={()=>setNotice("")} aria-label="Dismiss message" className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700"><X size={16}/></button></div>}{tab==="holdings" ? <div className="mt-4 space-y-4"><PortfolioFilters filters={filters} onChange={setFilters}/><AdminHoldingsTable holdings={holdings} onAction={action}/><p className="text-[10px] text-[#7a887d]">Showing {holdings.length} of {portfolioHoldings.length} sample holdings.</p></div> : tab==="solutions" ? <PortfolioSolutionBreakdown/> : tab==="investors" ? <PortfolioInvestorTypeBreakdown/> : tab==="performance" ? <PortfolioPerformanceView/> : <PortfolioMaturityView/>}</AdminSectionCard><RecentPortfolioActivities/></div></main>;
}
