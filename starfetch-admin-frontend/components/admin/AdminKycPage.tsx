"use client";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { AdminStatCard } from "./AdminDashboard";
import { AdminKycTable } from "./AdminKycTable";
import { KycFilters, KycStatusTabs, type KycFiltersState } from "./KycFilters";
import { KycDetailPanel } from "./KycDetailPanel";
import { kycInvestors, kycSnapshotDate, kycSummaryStats, type KycTab } from "./admin-kyc-data";
import { filterKycInvestors } from "./admin-kyc-utils";

const initialFilters: KycFiltersState = { search:"", accountType:"All Types", status:"All Statuses", dateRange:"all", from:"", to:"" };
export function KycSummaryCards() { return <section aria-label="KYC summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{kycSummaryStats.map(stat => <AdminStatCard key={stat.title} stat={stat}/>)}</section>; }
export function AdminKycPage() {
  const [tab,setTab] = useState<KycTab>("all");
  const [filters,setFilters] = useState<KycFiltersState>(initialFilters);
  const [selected,setSelected] = useState<string | null>("INV-000789");
  const [panelOpen,setPanelOpen] = useState(true);
  const [checked,setChecked] = useState<string[]>([]);
  const [page,setPage] = useState(1);
  const [notice,setNotice] = useState("");
  const filtered = useMemo(() => filterKycInvestors(kycInvestors,tab,filters,kycSnapshotDate),[tab,filters]);
  const pages = Math.max(1,Math.ceil(filtered.length/8));
  const currentPage = Math.min(page,pages);
  const rows = filtered.slice((currentPage-1)*8,currentPage*8);
  const investor = filtered.find(item => item.reference === selected) ?? null;
  const toggle = (reference: string) => setChecked(current => current.includes(reference) ? current.filter(id => id !== reference) : [...current,reference]);
  const togglePage = () => setChecked(current => rows.every(row => current.includes(row.reference)) ? current.filter(id => !rows.some(row => row.reference === id)) : Array.from(new Set([...current,...rows.map(row => row.reference)])));
  const action = (name: string) => setNotice(`${name} is a preview only. No verification decision was made, saved, or sent.`);
  return <main className="mt-4"><p className="mb-1 text-[10px] font-semibold text-[#6f8073]">Development preview · All accounts, documents, statuses and activity are synthetic.</p><p className="mb-4 text-[10px] text-[#7c897e]">KPI and tab counts are illustrative aggregates, not the sample count. Date filters use the Nov 2, 2026 mock snapshot. No regulatory screening is performed.</p>{notice && <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#cfe3c2] bg-[#f0f8e9] px-4 py-3 text-xs text-star-900"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss message" className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700"><X size={16}/></button></div>}<KycSummaryCards/><div className={`mt-5 grid items-start gap-4 ${panelOpen ? "xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]" : "grid-cols-1"}`}><div className="min-w-0 space-y-4"><KycStatusTabs value={tab} onChange={value => { setTab(value); setPage(1); }}/><KycFilters filters={filters} onChange={value => { setFilters(value); setPage(1); }}/><AdminKycTable rows={rows} selected={panelOpen ? investor?.reference ?? null : null} onSelect={item => { setSelected(item.reference); setPanelOpen(true); }} checked={checked} toggle={toggle} togglePage={togglePage} page={currentPage} pages={pages} setPage={setPage} total={filtered.length} onAction={action}/></div>{panelOpen && (investor ? <KycDetailPanel key={investor.reference} investor={investor} onClose={() => { setPanelOpen(false); document.getElementById(`kyc-view-${investor.reference}`)?.focus(); }}/> : <div className="rounded-xl border border-[#e7ece7] bg-white p-5 text-xs text-[#758379]">Select a matching investor to view their KYC details.</div>)}</div></main>;
}
