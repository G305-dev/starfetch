"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, BarChart3, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CirclePlus, CircleX, Download, Eye, FileText, Landmark, MoreHorizontal, Search, TrendingUp, X, type LucideIcon } from "lucide-react";
import { signingMandate } from "./joint-dashboard-data";
import {
  jointTransactionDateRangeOptions,
  jointTransactionDateReference,
  jointTransactionPageCopy,
  jointTransactionProductOptions,
  jointTransactionStatusOptions,
  jointTransactionSummary,
  jointTransactionTabs,
  jointTransactions,
  type JointTransaction,
  type JointTransactionCategory,
  type JointTransactionDateRange,
  type JointTransactionStatus,
} from "./joint-transactions-data";

const PAGE_SIZE = 10;

const summaryIcons = {
  "total-transactions": FileText,
  "total-investments": Landmark,
  "total-returns": TrendingUp,
  "total-withdrawals": ArrowDownToLine,
};

const transactionTypeIcons: Record<JointTransaction["type"], LucideIcon> = {
  "Investment Funded": CirclePlus,
  "Returns Received": BarChart3,
  "Return Distribution": BarChart3,
  Withdrawal: ArrowDownToLine,
  Transfer: ArrowLeftRight,
};

const statusClasses: Record<JointTransactionStatus, string> = {
  Completed: "bg-[#e1f7e7] text-[#16743d]",
  Pending: "bg-[#fff3d9] text-[#9a6200]",
  Processing: "bg-[#e4f1fb] text-[#1671b6]",
  Failed: "bg-[#fde8e8] text-[#b42318]",
};

const statusIcons: Record<JointTransactionStatus, LucideIcon> = {
  Completed: CheckCircle2,
  Pending: CalendarDays,
  Processing: MoreHorizontal,
  Failed: CircleX,
};

function SummaryCards() {
  return <section aria-label="Joint account transaction summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{jointTransactionSummary.map((item) => { const Icon = summaryIcons[item.id]; return <article key={item.id} className={`rounded-xl border p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)] ${item.id === "total-transactions" ? "border-[#d9eac8] bg-[linear-gradient(135deg,#f7faed_0%,#edf6de_100%)]" : "border-star-200 bg-white"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-star-muted">{item.label}</p><p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-star-900">{item.value}</p><p className={`mt-3 text-xs font-bold ${item.tone === "positive" ? "text-[#168348]" : "text-star-muted"}`}>{item.detail}</p></div><span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/80 text-star-700"><Icon size={22} aria-hidden="true" /></span></div></article>; })}</section>;
}

function StatusBadge({ status }: { status: JointTransactionStatus }) {
  const Icon = statusIcons[status];
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold ${statusClasses[status]}`}><Icon size={14} aria-hidden="true" />{status}</span>;
}

function TransactionType({ transaction }: { transaction: JointTransaction }) {
  const Icon = transactionTypeIcons[transaction.type];
  const iconTone = transaction.type === "Withdrawal" ? "text-[#168348]" : transaction.type === "Transfer" ? "text-star-700" : "text-[#16743d]";
  return <span className="flex min-w-[150px] items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-lg bg-star-50 ${iconTone}`}><Icon size={19} aria-hidden="true" /></span><span className="font-extrabold text-star-900">{transaction.type}</span></span>;
}

function transactionFallsWithinRange(transaction: JointTransaction, range: JointTransactionDateRange, customFrom: string, customTo: string) {
  if (range === "all") return true;
  if (range === "custom") return (!customFrom || transaction.dateValue >= customFrom) && (!customTo || transaction.dateValue <= customTo);
  const reference = new Date(`${jointTransactionDateReference}T00:00:00`);
  const transactionDate = new Date(`${transaction.dateValue}T00:00:00`);
  const startDate = new Date(reference);
  if (range === "last-7-days") startDate.setDate(reference.getDate() - 7);
  if (range === "last-30-days") startDate.setDate(reference.getDate() - 30);
  if (range === "last-3-months") startDate.setMonth(reference.getMonth() - 3);
  return transactionDate >= startDate && transactionDate <= reference;
}

function downloadTransactions(transactions: ReadonlyArray<JointTransaction>) {
  const headings = ["Reference", "Date", "Transaction Type", "Investment Product", "Amount", "Status", "Approval Status"];
  const quote = (value: string) => `"${value.replaceAll("\"", "\"\"")}"`;
  const rows = transactions.map((transaction) => [transaction.reference, transaction.date, transaction.type, transaction.product, transaction.amount, transaction.status, transaction.approvalStatus].map(quote).join(","));
  const csv = [headings.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "starfetch-joint-transactions.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function TransactionDetailModal({ transaction, onClose }: { transaction: JointTransaction; onClose: () => void }) {
  const mandateNotice = signingMandate.selected === "Both Holders to Sign" ? "This transaction requires approval from both account holders." : "Either account holder may authorise this transaction.";
  const details = [
    ["Transaction Reference", transaction.reference],
    ["Date", transaction.date],
    ["Transaction Type", transaction.type],
    ["Investment Product", transaction.product],
    ["Amount", transaction.amount],
    ["Account Type", "Joint Account"],
    ["Approval Status", transaction.approvalStatus],
    ...(transaction.processingDate ? [["Processing Date", transaction.processingDate]] : []),
  ];
  return <div className="fixed inset-0 z-[80] grid place-items-center px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="transaction-detail-title"><button type="button" onClick={onClose} aria-label="Close transaction details" className="absolute inset-0 bg-star-900/55" /><section className="relative z-10 max-h-full w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.13em] text-star-700">Joint account activity</p><h2 id="transaction-detail-title" className="mt-2 text-xl font-extrabold text-star-900">Transaction Details</h2><p className="mt-1 text-sm text-star-muted">{transaction.reference}</p></div><button type="button" onClick={onClose} aria-label="Close transaction details" className="grid size-10 shrink-0 place-items-center rounded-md text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"><X size={20} aria-hidden="true" /></button></div><div className="mt-5 flex items-center justify-between gap-3 rounded-lg bg-star-50 px-4 py-3"><span className="text-sm font-extrabold text-star-900">{transaction.amount}</span><StatusBadge status={transaction.status} /></div><dl className="mt-5 grid gap-x-7 gap-y-4 border-y border-star-100 py-5 sm:grid-cols-2">{details.map(([label, value]) => <div key={label}><dt className="text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-star-muted">{label}</dt><dd className="mt-1 text-sm font-extrabold text-star-900">{value}</dd></div>)}</dl><div className="mt-5 rounded-lg border border-star-100 bg-[#f7f9f8] p-4"><p className="text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-star-700">Notes</p><p className="mt-1.5 text-sm leading-6 text-star-muted">{transaction.notes}</p></div>{transaction.requiresJointApproval ? <div className="mt-4 rounded-lg border border-[#cce7d0] bg-[#eff8f0] p-4"><p className="text-sm font-extrabold text-star-900">Joint account approval</p><p className="mt-1.5 text-sm leading-6 text-star-muted">{mandateNotice}</p></div> : null}<button type="button" onClick={onClose} className="mt-5 w-full rounded-md bg-star-700 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Close Details</button></section></div>;
}

function MobileTransactionCard({ transaction, onView }: { transaction: JointTransaction; onView: (transaction: JointTransaction) => void }) {
  return <article className="rounded-lg border border-star-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-extrabold text-star-900">{transaction.reference}</p><p className="mt-1 text-xs text-star-muted">{transaction.date}</p></div><StatusBadge status={transaction.status} /></div><div className="mt-4"><TransactionType transaction={transaction} /></div><p className="mt-2 pl-12 text-sm text-star-muted">{transaction.product}</p><div className="mt-4 grid grid-cols-2 gap-4 border-y border-star-100 py-4"><div><p className="text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-star-muted">Amount</p><p className="mt-1 text-sm font-extrabold text-star-900">{transaction.amount}</p></div><div><p className="text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-star-muted">Approval</p><p className="mt-1 text-sm font-extrabold text-star-900">{transaction.approvalStatus}</p></div></div><button type="button" onClick={() => onView(transaction)} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-star-700 px-4 text-sm font-extrabold text-star-700 transition hover:bg-star-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"><Eye size={16} aria-hidden="true" />View</button></article>;
}

function EmptyState() {
  return <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-star-300 bg-star-50/65 px-5 py-10 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-star-700 shadow-sm"><FileText size={23} aria-hidden="true" /></span><h3 className="mt-4 text-lg font-extrabold text-star-900">{jointTransactionPageCopy.emptyTitle}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-star-muted">{jointTransactionPageCopy.emptyDescription}</p></div></div>;
}

export function JointTransactionsContent() {
  const [activeTab, setActiveTab] = useState<JointTransactionCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState("All Products");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [dateRange, setDateRange] = useState<JointTransactionDateRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState<JointTransaction | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => { setPage(1); }, [activeTab, searchQuery, productFilter, statusFilter, dateRange, customFrom, customTo]);

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return jointTransactions.filter((transaction) => {
      const matchesTab = activeTab === "all" || transaction.category === activeTab;
      const matchesQuery = !query || transaction.reference.toLowerCase().includes(query) || transaction.product.toLowerCase().includes(query);
      const matchesProduct = productFilter === "All Products" || transaction.product === productFilter;
      const matchesStatus = statusFilter === "All Statuses" || transaction.status === statusFilter;
      const matchesDate = transactionFallsWithinRange(transaction, dateRange, customFrom, customTo);
      return matchesTab && matchesQuery && matchesProduct && matchesStatus && matchesDate;
    });
  }, [activeTab, searchQuery, productFilter, statusFilter, dateRange, customFrom, customTo]);

  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const activePage = Math.min(page, pageCount);
  const displayedTransactions = filteredTransactions.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);
  const showingFrom = filteredTransactions.length ? (activePage - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(activePage * PAGE_SIZE, filteredTransactions.length);

  const handleExport = () => {
    downloadTransactions(filteredTransactions);
    setNotice(`Exported ${filteredTransactions.length} local mock transaction${filteredTransactions.length === 1 ? "" : "s"} to CSV.`);
  };

  return <main><section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div className="flex items-start gap-4"><span className="mt-1 grid size-12 shrink-0 place-items-center rounded-lg bg-star-100 text-star-700"><ArrowLeftRight size={25} aria-hidden="true" /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Joint account activity</p><h1 className="mt-1 font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold tracking-[-0.045em] text-star-900">{jointTransactionPageCopy.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-star-muted sm:text-base">{jointTransactionPageCopy.description}</p></div></div><button type="button" onClick={handleExport} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-star-700 px-5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><Download size={18} aria-hidden="true" />Export Transactions</button></section><div className="mt-7"><SummaryCards /></div><section className="mt-5 overflow-hidden rounded-xl border border-star-200 bg-white shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-label="Joint account transactions"><div className="border-b border-star-100 p-4 sm:p-5"><div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Transaction type filters">{jointTransactionTabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 ${activeTab === tab.id ? "bg-star-700 text-white" : "text-star-700 hover:bg-star-50"}`}>{tab.label} <span className={activeTab === tab.id ? "text-white/75" : "text-star-muted"}>({tab.count})</span></button>)}</div><div className="mt-5 grid gap-3 lg:grid-cols-[minmax(230px,1.4fr)_minmax(170px,.75fr)_minmax(170px,.75fr)_minmax(170px,.72fr)]"><label className="relative block"><span className="sr-only">Search by reference or investment product</span><Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-star-700" aria-hidden="true" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} type="search" placeholder="Search by reference or investment product" className="h-11 w-full rounded-md border border-star-200 bg-white px-10 text-sm text-star-900 outline-none placeholder:text-star-muted focus:border-star-700 focus:ring-2 focus:ring-star-100" /></label><label className="relative block"><span className="absolute -top-2 left-2 bg-white px-1 text-[0.64rem] font-extrabold uppercase tracking-[0.08em] text-star-700">Product</span><select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="h-11 w-full appearance-none rounded-md border border-star-200 bg-white px-3 pr-9 text-sm font-semibold text-star-900 outline-none focus:border-star-700 focus:ring-2 focus:ring-star-100">{jointTransactionProductOptions.map((option) => <option key={option}>{option}</option>)}</select><ChevronRight size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-star-700" aria-hidden="true" /></label><label className="relative block"><span className="absolute -top-2 left-2 bg-white px-1 text-[0.64rem] font-extrabold uppercase tracking-[0.08em] text-star-700">Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 w-full appearance-none rounded-md border border-star-200 bg-white px-3 pr-9 text-sm font-semibold text-star-900 outline-none focus:border-star-700 focus:ring-2 focus:ring-star-100">{jointTransactionStatusOptions.map((option) => <option key={option}>{option}</option>)}</select><ChevronRight size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-star-700" aria-hidden="true" /></label><label className="relative block"><span className="absolute -top-2 left-2 bg-white px-1 text-[0.64rem] font-extrabold uppercase tracking-[0.08em] text-star-700">Date Range</span><CalendarDays size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-star-700" aria-hidden="true" /><select value={dateRange} onChange={(event) => setDateRange(event.target.value as JointTransactionDateRange)} className="h-11 w-full appearance-none rounded-md border border-star-200 bg-white pl-9 pr-9 text-sm font-semibold text-star-900 outline-none focus:border-star-700 focus:ring-2 focus:ring-star-100">{jointTransactionDateRangeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><ChevronRight size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-star-700" aria-hidden="true" /></label></div>{dateRange === "custom" ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold text-star-700">From<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="mt-1.5 h-11 w-full rounded-md border border-star-200 bg-white px-3 text-sm text-star-900 outline-none focus:border-star-700 focus:ring-2 focus:ring-star-100" /></label><label className="text-sm font-bold text-star-700">To<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="mt-1.5 h-11 w-full rounded-md border border-star-200 bg-white px-3 text-sm text-star-900 outline-none focus:border-star-700 focus:ring-2 focus:ring-star-100" /></label></div> : null}</div>{filteredTransactions.length ? <><div className="p-4 md:hidden"><div className="space-y-3">{displayedTransactions.map((transaction) => <MobileTransactionCard key={transaction.id} transaction={transaction} onView={setSelectedTransaction} />)}</div></div><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1060px] text-left"><thead className="bg-star-100 text-xs font-extrabold text-star-900"><tr>{["Date", "Reference", "Transaction Type", "Investment Product", "Amount", "Status", "Action"].map((label) => <th key={label} className="whitespace-nowrap px-5 py-3.5">{label}</th>)}</tr></thead><tbody className="divide-y divide-star-100">{displayedTransactions.map((transaction) => <tr key={transaction.id} className="text-sm"><td className="whitespace-nowrap px-5 py-4 font-semibold text-star-900">{transaction.date}</td><td className="whitespace-nowrap px-5 py-4 font-semibold text-star-700">{transaction.reference}</td><td className="px-5 py-4"><TransactionType transaction={transaction} /></td><td className="whitespace-nowrap px-5 py-4 font-semibold text-star-900">{transaction.product}</td><td className={`whitespace-nowrap px-5 py-4 font-extrabold ${transaction.type === "Withdrawal" ? "text-[#b42318]" : "text-[#168348]"}`}>{transaction.amount}</td><td className="px-5 py-4"><StatusBadge status={transaction.status} /></td><td className="px-5 py-4"><button type="button" onClick={() => setSelectedTransaction(transaction)} className="inline-flex min-h-9 items-center justify-center rounded-md border border-star-200 px-4 text-sm font-extrabold text-star-700 transition hover:border-star-700 hover:bg-star-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"><Eye size={16} className="mr-1.5" aria-hidden="true" />View</button></td></tr>)}</tbody></table></div></> : <div className="p-4 sm:p-5"><EmptyState /></div>}<div className="flex flex-col gap-4 border-t border-star-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-sm font-semibold text-star-muted">Showing {showingFrom}–{showingTo} of {filteredTransactions.length} transaction{filteredTransactions.length === 1 ? "" : "s"}</p><div className="flex flex-wrap items-center gap-2"><button type="button" disabled={activePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-star-200 px-3 text-sm font-extrabold text-star-700 transition hover:bg-star-50 disabled:cursor-not-allowed disabled:opacity-45"><ChevronLeft size={16} aria-hidden="true" />Previous</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => <button key={pageNumber} type="button" onClick={() => setPage(pageNumber)} aria-current={pageNumber === activePage ? "page" : undefined} className={`grid size-9 place-items-center rounded-md text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 ${pageNumber === activePage ? "bg-star-700 text-white" : "border border-star-200 text-star-700 hover:bg-star-50"}`}>{pageNumber}</button>)}<button type="button" disabled={activePage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-star-200 px-3 text-sm font-extrabold text-star-700 transition hover:bg-star-50 disabled:cursor-not-allowed disabled:opacity-45">Next<ChevronRight size={16} aria-hidden="true" /></button></div></div></section>{selectedTransaction ? <TransactionDetailModal transaction={selectedTransaction} onClose={() => setSelectedTransaction(null)} /> : null}{notice ? <div role="status" className="fixed bottom-5 right-5 z-[90] max-w-sm rounded-lg bg-star-900 px-4 py-3 text-sm font-semibold text-white shadow-card"><div className="flex items-start gap-3"><span className="min-w-0">{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss message" className="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded text-white/80 transition hover:bg-white/10 hover:text-white"><X size={16} aria-hidden="true" /></button></div></div> : null}</main>;
}
