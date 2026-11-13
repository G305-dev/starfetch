"use client";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { AdminStatCard } from "./AdminDashboard";
import { AdminTransactionsTable } from "./AdminTransactionsTable";
import { TransactionFilters, TransactionTypeTabs, type TransactionFiltersState } from "./TransactionFilters";
import { TransactionDetailPanel } from "./TransactionDetailPanel";
import { adminTransactions, transactionSnapshotDate, transactionSummaryStats, type TransactionTab } from "./admin-transactions-data";
import { filterTransactions } from "./admin-transactions-utils";

const initialFilters: TransactionFiltersState = { search:"", type:"All Types", accountType:"All Types", status:"All Statuses", dateRange:"all", from:"", to:"" };
export function TransactionSummaryCards() { return <section aria-label="Transaction summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{transactionSummaryStats.map(stat => <AdminStatCard key={stat.title} stat={stat}/>)}</section>; }
export function AdminTransactionsPage() {
  const [tab,setTab] = useState<TransactionTab>("all");
  const [filters,setFilters] = useState<TransactionFiltersState>(initialFilters);
  const [selected,setSelected] = useState<string | null>("TXN-00984732");
  const [panelOpen,setPanelOpen] = useState(true);
  const [checked,setChecked] = useState<string[]>([]);
  const [page,setPage] = useState(1);
  const [notice,setNotice] = useState("");
  const filtered = useMemo(() => filterTransactions(adminTransactions,tab,filters,transactionSnapshotDate),[tab,filters]);
  const pages = Math.max(1,Math.ceil(filtered.length/10));
  const currentPage = Math.min(page,pages);
  const rows = filtered.slice((currentPage-1)*10,currentPage*10);
  const item = filtered.find(transaction => transaction.id === selected) ?? null;
  const toggle = (id: string) => setChecked(current => current.includes(id) ? current.filter(value => value !== id) : [...current,id]);
  const togglePage = () => setChecked(current => rows.every(row => current.includes(row.id)) ? current.filter(id => !rows.some(row => row.id === id)) : Array.from(new Set([...current,...rows.map(row => row.id)])));
  const action = (name: string) => setNotice(`${name} is a preview only. No transaction was changed or workflow started.`);
  return <main className="mt-4"><p className="mb-1 text-[10px] font-semibold text-[#6f8073]">Development preview · All transactions, amounts, statuses and histories are synthetic.</p><p className="mb-4 text-[10px] text-[#7c897e]">KPI and tab counts are illustrative aggregates, not the sample count. Date filters use the Nov 2, 2026 mock snapshot. No payments or approvals are processed.</p>{notice && <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#cfe3c2] bg-[#f0f8e9] px-4 py-3 text-xs text-star-900"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss message" className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700"><X size={16}/></button></div>}<TransactionSummaryCards/><div className={`mt-5 grid items-start gap-4 ${panelOpen ? "xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]" : "grid-cols-1"}`}><div className="min-w-0 space-y-4"><TransactionTypeTabs value={tab} onChange={value => { setTab(value); setPage(1); }}/><TransactionFilters filters={filters} onChange={value => { setFilters(value); setPage(1); }}/><AdminTransactionsTable rows={rows} selected={panelOpen ? item?.id ?? null : null} onSelect={transaction => { setSelected(transaction.id); setPanelOpen(true); }} checked={checked} toggle={toggle} togglePage={togglePage} page={currentPage} pages={pages} setPage={setPage} total={filtered.length} onAction={action}/></div>{panelOpen && (item ? <TransactionDetailPanel key={item.id} item={item} onClose={() => { setPanelOpen(false); document.getElementById(`transaction-view-${item.id}`)?.focus(); }}/> : <div className="rounded-xl border border-[#e7ece7] bg-white p-5 text-xs text-[#758379]">Select a matching transaction to view its details.</div>)}</div></main>;
}
