"use client";
import { useMemo,useState } from "react";
import { X } from "lucide-react";
import { AdminSectionCard } from "@/components/admin/AdminDataStates";
import { PortfolioFilters,PortfolioTabs,type PortfolioFiltersState,type PortfolioTab } from "./PortfolioFilters";
import { AdminHoldingsTable,PortfolioInvestorTypeBreakdown,PortfolioMaturityView,PortfolioPerformanceView,PortfolioSolutionBreakdown,RecentPortfolioActivities } from "./PortfolioViews";
import { portfolioHoldings,portfolioSnapshotDate } from "./fixtures/admin-portfolios-data";
import { filterPortfolioHoldings } from "./admin-portfolios-utils";

const initialFilters:PortfolioFiltersState={search:"",solution:"All Solutions",status:"All Statuses",maturity:"all"};
export function AdminPortfoliosPage() {
  const [tab,setTab]=useState<PortfolioTab>("holdings");const [filters,setFilters]=useState<PortfolioFiltersState>(initialFilters);const [notice,setNotice]=useState("");
  const holdings=useMemo(()=>filterPortfolioHoldings(portfolioHoldings,filters,portfolioSnapshotDate),[filters]);
  const action=(name:string)=>setNotice(`${name} is a preview only. No portfolio action was performed.`);
  return <main className="mt-4"><div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]"><AdminSectionCard className="min-w-0 p-3 sm:p-4"><PortfolioTabs value={tab} onChange={setTab}/>{notice && <div role="status" className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#cfe3c2] bg-[#f0f8e9] px-4 py-3 text-xs text-star-900"><span>{notice}</span><button onClick={()=>setNotice("")} aria-label="Dismiss message" className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700"><X size={16}/></button></div>}{tab==="holdings" ? <div className="mt-4 space-y-4"><PortfolioFilters filters={filters} onChange={setFilters}/><AdminHoldingsTable holdings={holdings} onAction={action}/><p className="text-[10px] text-[#7a887d]">Showing {holdings.length} of {portfolioHoldings.length} sample holdings.</p></div> : tab==="solutions" ? <PortfolioSolutionBreakdown/> : tab==="investors" ? <PortfolioInvestorTypeBreakdown/> : tab==="performance" ? <PortfolioPerformanceView/> : <PortfolioMaturityView/>}</AdminSectionCard><RecentPortfolioActivities/></div></main>;
}
