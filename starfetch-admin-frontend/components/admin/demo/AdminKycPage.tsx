"use client";
import { useMemo, useState } from "react";
import { AdminStatCard } from "./AdminDashboard";
import { AdminKycTable } from "./AdminKycTable";
import { KycFilters, KycStatusTabs, type KycFiltersState } from "./KycFilters";
import { KycDemoDialog } from "./KycDemoDialog";
import { kycInvestors, kycSnapshotDate, kycSummaryStats, type KycChecklistKey, type KycInvestor, type KycTab } from "./fixtures/admin-kyc-data";
import { filterKycInvestors } from "./admin-kyc-utils";

const initialFilters: KycFiltersState = { search:"", accountType:"All Types", status:"All Statuses", dateRange:"all", from:"", to:"" };
let sessionKyc: KycInvestor[] | null = null;
export function KycSummaryCards() { return <section aria-label="KYC summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{kycSummaryStats.map(stat => <AdminStatCard key={stat.title} stat={stat}/>)}</section>; }
export function AdminKycPage() {
  const [records,setRecords] = useState<KycInvestor[]>(() => typeof window !== "undefined" && sessionKyc ? sessionKyc : kycInvestors);
  const [tab,setTab] = useState<KycTab>("all"); const [filters,setFilters] = useState<KycFiltersState>(initialFilters);
  const [selected,setSelected] = useState<string | null>(null); const [trigger,setTrigger] = useState<HTMLElement | null>(null);
  const [checked,setChecked] = useState<string[]>([]); const [page,setPage] = useState(1); const [notice,setNotice] = useState("");
  const filtered = useMemo(() => filterKycInvestors(records,tab,filters,kycSnapshotDate),[records,tab,filters]);
  const pages = Math.max(1,Math.ceil(filtered.length/8)), currentPage = Math.min(page,pages), rows = filtered.slice((currentPage-1)*8,currentPage*8);
  const investor = records.find(item => item.reference === selected);
  const toggle = (reference: string) => setChecked(current => current.includes(reference) ? current.filter(id => id !== reference) : [...current,reference]);
  const togglePage = () => setChecked(current => rows.every(row => current.includes(row.reference)) ? current.filter(id => !rows.some(row => row.reference === id)) : Array.from(new Set([...current,...rows.map(row => row.reference)])));
  function decide(status: "Verified" | "Rejected", sections?: KycChecklistKey[], reason?: string) {
    if (!investor) return;
    const changed: KycInvestor = {...investor, status, ...(sections ? {demoRejection:{sections,reason:reason ?? ""}} : {})};
    const next = records.map(item => item.reference === changed.reference ? changed : item);
    sessionKyc = next; setRecords(next);
    if (!filterKycInvestors([changed],tab,filters,kycSnapshotDate).length) { setTab("all"); setFilters(initialFilters); setPage(Math.floor(next.findIndex(item => item.reference === changed.reference)/8)+1); }
    setSelected(null); setNotice(`Demo ${status === "Verified" ? "approval" : "rejection"} saved for ${changed.name}. No actual compliance decision or notification was made.`);
  }
  function reset() { sessionKyc = null; setRecords(kycInvestors); setTab("all"); setFilters(initialFilters); setPage(1); setChecked([]); setNotice("KYC demo changes reset to synthetic fixtures."); }
  return <main className="mt-4"><p className="mb-1 text-[10px] font-semibold text-[#6f8073]">Private demo · All accounts, documents, statuses and activity are synthetic. No regulatory screening is performed.</p><p className="mb-4 text-[10px] text-[#7c897e]">KPI and tab counts are illustrative, not the sample count. Changes are browser-memory only and reset on reload.</p>{notice && <p role="status" className="mb-4 rounded-lg border border-[#cfe3c2] bg-[#f0f8e9] px-4 py-3 text-xs text-star-900">{notice}</p>}<KycSummaryCards/><div className="mt-5 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><KycStatusTabs value={tab} onChange={value => { setTab(value); setPage(1); }}/><button type="button" onClick={reset} className="rounded-md border border-star-200 px-3 py-2 text-xs font-bold text-star-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700">Reset KYC demo changes</button></div><KycFilters filters={filters} onChange={value => { setFilters(value); setPage(1); }}/><AdminKycTable rows={rows} selected={selected} onSelect={(item,control) => { setTrigger(control); setSelected(item.reference); }} checked={checked} toggle={toggle} togglePage={togglePage} page={currentPage} pages={pages} setPage={setPage} total={filtered.length}/></div>{investor && <KycDemoDialog key={investor.reference} investor={investor} trigger={trigger} close={() => setSelected(null)} approve={() => decide("Verified")} reject={(sections,reason) => decide("Rejected",sections,reason)}/>}</main>;
}
