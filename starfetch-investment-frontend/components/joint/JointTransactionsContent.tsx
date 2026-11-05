"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, CircleAlert, LoaderCircle, RefreshCw } from "lucide-react";
import { getJointTransactions, type InvestorTransactionsPage } from "@/lib/api/client";
import { TransactionHistory } from "@/components/portal/TransactionHistory";
import { TransactionPagination } from "@/components/portal/TransactionPagination";
import { TransactionsLoadingState } from "@/components/portal/TransactionStates";
import { getJointActionErrorMessage } from "./joint-api-messages";
import { useJointAccounts } from "./JointAccountProvider";

type RequestState = "idle" | "loading" | "ready" | "error";
const transactionPageSize = 10;

function SelectedAccountRequired() {
  return <section className="mt-7 grid min-h-[300px] place-items-center rounded-xl border border-dashed border-star-300 bg-star-50/65 px-5 py-10 text-center"><div className="max-w-lg"><span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-star-700 shadow-sm"><ArrowLeftRight size={23} aria-hidden="true" /></span><h2 className="mt-4 text-xl font-extrabold text-star-900">Select a Joint Account</h2><p className="mt-2 text-sm leading-6 text-star-muted">Choose an authorized Joint Account before its recorded transactions can be loaded.</p><Link href="/joint/dashboard" className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md bg-star-700 px-4 text-sm font-extrabold text-white no-underline transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">Go to Joint Accounts</Link></div></section>;
}

export function JointTransactionsContent() {
  const { accountsStatus, accountsError, selectedAccount, refresh } = useJointAccounts();
  const accountId = selectedAccount?.jointAccountId ?? null;
  const [pagination, setPagination] = useState({ accountId: null as string | null, page: 1 });
  const currentPage = pagination.accountId === accountId ? pagination.page : 1;
  const [state, setState] = useState<RequestState>("idle");
  const [transactionPage, setTransactionPage] = useState<InvestorTransactionsPage | null>(null);
  const [resultKey, setResultKey] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const requestVersion = useRef(0);
  const queryKey = accountId ? `${accountId}:${currentPage}` : null;

  const loadTransactions = useCallback(async () => {
    if (!accountId || !queryKey) {
      requestVersion.current += 1;
      setTransactionPage(null);
      setResultKey(null);
      setError(null);
      setState("idle");
      return;
    }
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setTransactionPage(null);
    setResultKey(null);
    setError(null);
    setState("loading");
    try {
      const nextPage = await getJointTransactions(accountId, currentPage, transactionPageSize);
      if (version !== requestVersion.current) return;
      setTransactionPage(nextPage);
      setResultKey(queryKey);
      setState("ready");
    } catch (requestError) {
      if (version !== requestVersion.current) return;
      setError(requestError);
      setResultKey(queryKey);
      setState("error");
    }
  }, [accountId, currentPage, queryKey]);

  useEffect(() => {
    void loadTransactions();
    return () => { requestVersion.current += 1; };
  }, [loadTransactions]);

  const resultMatchesCurrentRequest = resultKey === queryKey;
  const serverPage = transactionPage?.page;
  const serverPageSize = transactionPage?.pageSize;
  const total = transactionPage?.total;
  const canPaginate = serverPage !== null && serverPage !== undefined && serverPageSize !== null && serverPageSize !== undefined && serverPageSize > 0 && total !== null && total !== undefined && total > serverPageSize;

  function changePage(nextPage: number) {
    if (!accountId || state === "loading" || nextPage < 1 || nextPage === currentPage) return;
    setPagination({ accountId, page: nextPage });
  }

  return <main><section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Joint account activity</p><h1 className="mt-2 font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold tracking-[-0.045em] text-star-900">Transactions</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-star-muted sm:text-base">Read-only recorded transactions for the selected authorized Joint Account.</p></div>{accountId ? <button type="button" onClick={() => { void loadTransactions(); }} disabled={state === "loading"} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md border border-star-200 bg-white px-4 text-sm font-extrabold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw size={16} className={state === "loading" ? "animate-spin" : ""} aria-hidden="true" />Refresh</button> : null}</section>{accountsStatus === "loading" ? <section className="mt-7"><TransactionsLoadingState /></section> : null}{accountsStatus === "error" ? <section className="mt-7 grid min-h-[300px] place-items-center rounded-xl border border-red-200 bg-white px-5 py-10 text-center"><div className="max-w-md"><CircleAlert size={25} className="mx-auto text-red-700" aria-hidden="true" /><h2 className="mt-4 text-xl font-extrabold text-star-900">Joint Accounts are unavailable</h2><p className="mt-2 text-sm leading-6 text-star-muted">{getJointActionErrorMessage(accountsError)}</p><button type="button" onClick={() => { void refresh(); }} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-star-700 px-4 text-sm font-extrabold text-white"><RefreshCw size={16} aria-hidden="true" />Try again</button></div></section> : null}{accountsStatus === "ready" && !accountId ? <SelectedAccountRequired /> : null}{accountsStatus === "ready" && accountId && (state === "loading" || !resultMatchesCurrentRequest) ? <section className="mt-7"><TransactionsLoadingState /></section> : null}{accountsStatus === "ready" && accountId && resultMatchesCurrentRequest && state === "error" ? <section className="mt-7 grid min-h-[300px] place-items-center rounded-xl border border-red-200 bg-white px-5 py-10 text-center"><div className="max-w-md"><CircleAlert size={25} className="mx-auto text-red-700" aria-hidden="true" /><h2 className="mt-4 text-xl font-extrabold text-star-900">Transactions are unavailable</h2><p className="mt-2 text-sm leading-6 text-star-muted">{getJointActionErrorMessage(error)}</p><button type="button" onClick={() => { void loadTransactions(); }} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-star-700 px-4 text-sm font-extrabold text-white"><RefreshCw size={16} aria-hidden="true" />Try again</button></div></section> : null}{accountsStatus === "ready" && accountId && resultMatchesCurrentRequest && state === "ready" && transactionPage ? <section id="joint-transaction-history" className="mt-7"><TransactionHistory transactions={transactionPage.transactions} productsHref="/joint/products" />{canPaginate ? <div className="rounded-b-xl border-x border-b border-star-200 bg-white px-4 pb-5 sm:px-6"><TransactionPagination page={serverPage} pageSize={serverPageSize} total={total} onPageChange={changePage} /></div> : null}</section> : null}<p className="mt-5 text-xs leading-5 text-star-muted">Transaction filters, exports, references, processing dates, approval statuses, and signing workflows are not available because the Joint API does not provide them.</p></main>;
}
