"use client";
import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { AdminStatCard } from "./AdminDashboard";
import { AdminTransactionsTable } from "./AdminTransactionsTable";
import { TransactionFilters, TransactionTypeTabs, type TransactionFiltersState } from "./TransactionFilters";
import { TransactionFormDialog, ViewTransactionDialog } from "./DemoTransactionDialog";
import { adminTransactions, transactionSnapshotDate, transactionSummaryStats, type AdminTransaction, type TransactionTab } from "./fixtures/admin-transactions-data";
import { filterTransactions } from "./admin-transactions-utils";

const initialFilters: TransactionFiltersState = { search:"", type:"All Types", accountType:"All Types", status:"All Statuses", dateRange:"all", from:"", to:"" };
// Browser module memory survives client-side navigation, not reloads or a new tab.
// Mutated only by user actions in the browser: no server state, storage, or API writes.
let demoSessionRecords: AdminTransaction[] | null = null;
function initialRecords(): AdminTransaction[] {
  return typeof window !== "undefined" && demoSessionRecords ? demoSessionRecords : adminTransactions.map(item => ({...item, detail: {...item.detail}}));
}
function nextDemoId(records: AdminTransaction[]): string {
  let n = 1;
  while (records.some(record => record.id === `TXN-DEMO-${String(n).padStart(4,"0")}`)) n++;
  return `TXN-DEMO-${String(n).padStart(4,"0")}`;
}
export function TransactionSummaryCards() { return <section aria-label="Transaction summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{transactionSummaryStats.map(stat => <AdminStatCard key={stat.title} stat={stat}/>)}</section>; }
export function AdminTransactionsPage() {
  const [records,setRecords] = useState<AdminTransaction[]>(initialRecords);
  const [dialog,setDialog] = useState<{kind:"add"} | {kind:"view" | "edit"; id:string} | null>(null);
  const [tab,setTab] = useState<TransactionTab>("all");
  const [filters,setFilters] = useState<TransactionFiltersState>(initialFilters);
  const [page,setPage] = useState(1);
  const [notice,setNotice] = useState("");
  const filtered = useMemo(() => filterTransactions(records,tab,filters,transactionSnapshotDate),[records,tab,filters]);
  const pages = Math.max(1,Math.ceil(filtered.length/10));
  const currentPage = Math.min(page,pages);
  const rows = filtered.slice((currentPage-1)*10,currentPage*10);
  const item = dialog && dialog.kind !== "add" ? records.find(record => record.id === dialog.id) : undefined;
  function save(value: Omit<AdminTransaction, "id">) {
    const editing = dialog?.kind === "edit" ? records.find(record => record.id === dialog.id) : undefined;
    const saved: AdminTransaction = {...value, id: editing?.id ?? nextDemoId(records)};
    const next = editing ? records.map(record => record.id === saved.id ? saved : record) : [saved,...records];
    demoSessionRecords = next;
    setRecords(next);
    if (!editing || filterTransactions([saved],tab,filters,transactionSnapshotDate).length === 0) {
      setTab("all"); setFilters(initialFilters); setPage(editing ? Math.floor(next.findIndex(record => record.id === saved.id)/10)+1 : 1);
      setNotice(`Demo transaction ${saved.id} saved. Filters cleared to show the record. No real transaction was processed.`);
    } else setNotice(`Demo transaction ${saved.id} updated in browser memory. No real transaction was processed.`);
    setDialog(null);
  }
  return <main className="mt-4"><p className="mb-1 text-[10px] font-semibold text-[#6f8073]">Private demo · All transactions, amounts, statuses and histories are synthetic.</p><p className="mb-4 text-[10px] text-[#7c897e]">KPI and tab counts are illustrative aggregates, not the sample count. Date filters use the Nov 2, 2026 mock snapshot. No payments or approvals are processed.</p>{notice && <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#cfe3c2] bg-[#f0f8e9] px-4 py-3 text-xs text-star-900"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss message" className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700"><X size={16}/></button></div>}<TransactionSummaryCards/><div className="mt-5 min-w-0 space-y-4"><TransactionTypeTabs value={tab} onChange={value => { setTab(value); setPage(1); }}/><TransactionFilters filters={filters} onChange={value => { setFilters(value); setPage(1); }}/><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-extrabold text-star-900">Demo Transactions</h2><button type="button" onClick={() => setDialog({kind:"add"})} className="inline-flex items-center gap-1.5 rounded-md bg-star-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-star-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-700"><Plus size={15} aria-hidden="true"/>Add Transaction</button></div><AdminTransactionsTable rows={rows} onView={record => setDialog({kind:"view",id:record.id})} onEdit={record => setDialog({kind:"edit",id:record.id})} page={currentPage} pages={pages} setPage={setPage} total={filtered.length}/></div>{dialog?.kind === "view" && item && <ViewTransactionDialog item={item} onClose={() => setDialog(null)}/>}{dialog?.kind === "edit" && item && <TransactionFormDialog key={item.id} item={item} onClose={() => setDialog(null)} onSave={save}/>}{dialog?.kind === "add" && <TransactionFormDialog onClose={() => setDialog(null)} onSave={save}/>}</main>;
}
