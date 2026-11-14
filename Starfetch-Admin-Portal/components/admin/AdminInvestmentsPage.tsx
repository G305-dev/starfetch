"use client";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { AdminStatCard } from "./AdminDashboard";
import { AdminInvestmentsTable } from "./AdminInvestmentsTable";
import { InvestmentFilters, InvestmentTabs, type InvestmentFiltersState } from "./InvestmentFilters";
import { InvestmentDetailPanel } from "./InvestmentDetailPanel";
import { adminInvestments, investmentSnapshotDate, investmentSummaryStats, type InvestmentTab } from "./admin-investments-data";
import { filterInvestments } from "./admin-investments-utils";

const initialFilters: InvestmentFiltersState = { search:"", accountType:"All Types", status:"All Statuses", dateRange:"all", from:"", to:"" };
export function InvestmentSummaryCards() { return <section aria-label="Investment summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{investmentSummaryStats.map(stat => <AdminStatCard key={stat.title} stat={stat}/>)}</section>; }
export function AdminInvestmentsPage() {
  const [tab,setTab] = useState<InvestmentTab>("all");
  const [filters,setFilters] = useState<InvestmentFiltersState>(initialFilters);
  const [selected,setSelected] = useState<string | null>("INV-008473");
  const [panelOpen,setPanelOpen] = useState(true);
  const [checked,setChecked] = useState<string[]>([]);
  const [page,setPage] = useState(1);
  const [notice,setNotice] = useState("");
  const filtered = useMemo(() => filterInvestments(adminInvestments, tab, filters, investmentSnapshotDate),[tab,filters]);
  const pages = Math.max(1,Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page,pages);
  const rows = filtered.slice((currentPage-1)*10,currentPage*10);
  const item = filtered.find(investment => investment.reference === selected) ?? null;
  const toggle = (reference: string) => setChecked(current => current.includes(reference) ? current.filter(id => id !== reference) : [...current,reference]);
  const togglePage = () => setChecked(current => rows.every(row => current.includes(row.reference)) ? current.filter(id => !rows.some(row => row.reference === id)) : Array.from(new Set([...current,...rows.map(row => row.reference)])));
  const action = (name: string) => setNotice(`${name} is coming soon. No real action was performed.`);
  return <main className="mt-4"><p className="mb-1 text-[10px] font-semibold text-[#6f8073]">Development preview · All investment records, financial values and activity are synthetic.</p><p className="mb-4 text-[10px] text-[#7c897e]">KPI and tab totals are illustrative aggregates, not the sample count. Start-date filters use the Nov 2, 2026 mock snapshot.</p>{notice && <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#cfe3c2] bg-[#f0f8e9] px-4 py-3 text-xs text-star-900"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss message" className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700"><X size={16}/></button></div>}<InvestmentSummaryCards/><div className={`mt-5 grid items-start gap-4 ${panelOpen ? "xl:grid-cols-[minmax(0,1fr)_minmax(320px,390px)]" : "grid-cols-1"}`}><div className="min-w-0 space-y-4"><InvestmentTabs value={tab} onChange={value => { setTab(value); setPage(1); }}/><InvestmentFilters filters={filters} onChange={value => { setFilters(value); setPage(1); }}/><AdminInvestmentsTable rows={rows} selected={panelOpen ? item?.reference ?? null : null} onSelect={investment => { setSelected(investment.reference); setPanelOpen(true); }} checked={checked} toggle={toggle} togglePage={togglePage} page={currentPage} pages={pages} setPage={setPage} total={filtered.length} onAction={action}/></div>{panelOpen && (item ? <InvestmentDetailPanel key={item.reference} item={item} onClose={() => { setPanelOpen(false); document.getElementById(`investment-view-${item.reference}`)?.focus(); }} onAction={action}/> : <div className="rounded-xl border border-[#e7ece7] bg-white p-5 text-xs text-[#758379]">Select a matching investment to view its details.</div>)}</div></main>;
}
