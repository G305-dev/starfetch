"use client";

import { Download, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { RecentActivity } from "./RecentActivity";
import { TransactionFilters } from "./TransactionFilters";
import { TransactionHistory } from "./TransactionHistory";
import { TransactionInsights } from "./TransactionInsights";
import { TransactionPagination } from "./TransactionPagination";
import { TransactionsErrorState, TransactionsLoadingState } from "./TransactionStates";
import { TransactionSummaryCards } from "./TransactionSummaryCards";
import { portalTransactions, transactionMetadata } from "./transactions-data";

type TransactionsViewState = "ready" | "loading" | "error";

const dateRangeCutoffs: Record<string, string> = {
  "Last 30 Days": "2026-09-26",
  "Last 3 Months": "2026-07-26",
  "Last 6 Months": "2026-04-26",
  "Last 12 Months": "2025-10-26",
};

export function MyTransactionsContent() {
  const [transactionType, setTransactionType] = useState("All Transactions");
  const [status, setStatus] = useState("All Statuses");
  const [dateRange, setDateRange] = useState("Last 6 Months");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewState, setViewState] = useState<TransactionsViewState>("ready");
  const [exportNotice, setExportNotice] = useState("");

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const cutoff = dateRangeCutoffs[dateRange] ?? dateRangeCutoffs["Last 6 Months"];

    return portalTransactions.filter((transaction) => {
      const matchesType = transactionType === "All Transactions" || transaction.type === transactionType;
      const matchesStatus = status === "All Statuses" || transaction.status === status;
      const matchesDate = transaction.dateValue >= cutoff;
      const matchesSearch = !normalizedSearch || [transaction.id, transaction.product, transaction.reference, transaction.type]
        .some((value) => value.toLowerCase().includes(normalizedSearch));
      return matchesType && matchesStatus && matchesDate && matchesSearch;
    });
  }, [dateRange, searchTerm, status, transactionType]);

  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / transactionMetadata.pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pageStart = (safeCurrentPage - 1) * transactionMetadata.pageSize;
  const paginatedTransactions = filteredTransactions.slice(pageStart, pageStart + transactionMetadata.pageSize);

  function resetPagination() {
    setCurrentPage(1);
  }

  function exportTransactions() {
    const headings = ["Transaction ID", "Type", "Product", "Date", "Amount", "Status", "Reference"];
    const lines = filteredTransactions.map((transaction) => [transaction.id, transaction.type, transaction.product, transaction.date, transaction.amount, transaction.status, transaction.reference]
      .map((value) => `"${value.replaceAll('"', '""')}"`).join(","));
    const csv = [headings.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "starfetch-sample-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
    setExportNotice("Sample transaction CSV downloaded.");
  }

  function retry() {
    // UI-only retry preparation: replace with David's approved transaction refetch later.
    setViewState("ready");
  }

  const hasFilters = Boolean(searchTerm || transactionType !== "All Transactions" || status !== "All Statuses" || dateRange !== "Last 6 Months");

  return (
    <section aria-labelledby="transactions-page-heading">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 id="transactions-page-heading" className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.045em] text-star-900">Transactions</h1>
          <p className="mt-2 text-sm leading-6 text-star-muted sm:text-[0.96rem]">Track all funding, returns, withdrawals and other account activity.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:justify-end">
          <span className="inline-flex items-center gap-2 text-xs text-star-muted">Last updated: {transactionMetadata.lastUpdated}<RefreshCw size={15} aria-hidden="true" /></span>
          <button type="button" onClick={exportTransactions} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-star-900 px-4 text-sm font-bold text-white transition hover:-translate-y-px hover:bg-star-700 hover:shadow-[0_5px_14px_rgba(0,59,42,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><Download size={17} aria-hidden="true" />Export Transactions</button>
        </div>
      </div>
      {exportNotice ? <p role="status" className="mt-3 text-sm font-semibold text-star-700">{exportNotice}</p> : null}

      <div className="mt-7">
        {viewState === "loading" ? <SummaryLoadingState /> : <TransactionSummaryCards />}
      </div>
      <TransactionFilters
        transactionType={transactionType}
        status={status}
        dateRange={dateRange}
        searchTerm={searchTerm}
        onTransactionTypeChange={(value) => { setTransactionType(value); resetPagination(); }}
        onStatusChange={(value) => { setStatus(value); resetPagination(); }}
        onDateRangeChange={(value) => { setDateRange(value); resetPagination(); }}
        onSearchTermChange={(value) => { setSearchTerm(value); resetPagination(); }}
      />

      <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
        <div id="transaction-history" className="scroll-mt-24 min-w-0">
          {viewState === "loading" ? <TransactionsLoadingState /> : null}
          {viewState === "error" ? <TransactionsErrorState onRetry={retry} /> : null}
          {viewState === "ready" ? <TransactionHistory transactions={paginatedTransactions} filtered={hasFilters} /> : null}
          {viewState === "ready" && filteredTransactions.length > 0 ? <div className="rounded-b-xl border-x border-b border-star-200 bg-white px-4 pb-5 sm:px-6"><TransactionPagination currentPage={safeCurrentPage} totalItems={filteredTransactions.length} pageSize={transactionMetadata.pageSize} onPageChange={setCurrentPage} /></div> : null}
        </div>
        <aside className="grid gap-5 self-start"><TransactionInsights /><RecentActivity /></aside>
      </div>
    </section>
  );
}

function SummaryLoadingState() {
  return <div className="grid gap-4 lg:grid-cols-3" aria-label="Loading transaction summary" aria-busy="true">{[0, 1, 2].map((card) => <div key={card} className="h-36 animate-pulse rounded-xl bg-star-100" />)}<span className="sr-only">Loading transaction summary</span></div>;
}
