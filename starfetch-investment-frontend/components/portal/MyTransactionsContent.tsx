"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMyTransactions, type InvestorTransactionsPage } from "@/lib/api/client";
import { TransactionFilters } from "./TransactionFilters";
import { TransactionHistory } from "./TransactionHistory";
import { TransactionPagination } from "./TransactionPagination";
import { TransactionsErrorState, TransactionsLoadingState } from "./TransactionStates";

type TransactionsRequestState = "loading" | "success" | "error";
const transactionPageSize = 10;

export function MyTransactionsContent() {
  const [requestState, setRequestState] = useState<TransactionsRequestState>("loading");
  const [transactionPage, setTransactionPage] = useState<InvestorTransactionsPage | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const requestVersion = useRef(0);

  const loadTransactions = useCallback(async (page: number) => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setRequestState("loading");
    try {
      const nextPage = await getMyTransactions(page, transactionPageSize);
      if (version !== requestVersion.current) return;
      setTransactionPage(nextPage);
      setRequestState("success");
    } catch {
      if (version !== requestVersion.current) return;
      setTransactionPage(null);
      setRequestState("error");
    }
  }, []);

  useEffect(() => {
    void loadTransactions(currentPage);
    return () => {
      requestVersion.current += 1;
    };
  }, [currentPage, loadTransactions]);

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
    if (!transactionPage || !normalizedSearch) return transactionPage?.transactions ?? [];
    return transactionPage.transactions.filter((transaction) => [transaction.id, transaction.type, transaction.status, transaction.description].some((value) => value?.toLocaleLowerCase().includes(normalizedSearch)));
  }, [searchTerm, transactionPage]);

  const serverPage = transactionPage?.page ?? currentPage;
  const serverPageSize = transactionPage?.pageSize ?? null;
  const totalTransactions = transactionPage?.total ?? null;
  const showPagination = totalTransactions !== null && serverPageSize !== null && totalTransactions > serverPageSize;

  return <section aria-labelledby="transactions-page-heading"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 id="transactions-page-heading" className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.045em] text-star-900">Transactions</h1><p className="mt-2 text-sm leading-6 text-star-muted sm:text-[0.96rem]">Review transaction activity recorded on your Starfetch account.</p></div><button type="button" onClick={() => void loadTransactions(currentPage)} disabled={requestState === "loading"} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-star-200 bg-white px-4 text-sm font-bold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw size={17} className={requestState === "loading" ? "animate-spin" : ""} aria-hidden="true" />Refresh</button></div>{requestState === "success" && transactionPage ? <TransactionFilters searchTerm={searchTerm} onSearchTermChange={setSearchTerm} /> : null}<div id="transaction-history" className="mt-5 scroll-mt-24">{requestState === "loading" ? <TransactionsLoadingState /> : null}{requestState === "error" ? <TransactionsErrorState onRetry={() => void loadTransactions(currentPage)} /> : null}{requestState === "success" && transactionPage ? <><TransactionHistory transactions={filteredTransactions} filtered={Boolean(searchTerm.trim())} />{showPagination ? <div className="rounded-b-xl border-x border-b border-star-200 bg-white px-4 pb-5 sm:px-6"><TransactionPagination page={serverPage} pageSize={serverPageSize} total={totalTransactions} onPageChange={setCurrentPage} /></div> : null}</> : null}</div></section>;
}
