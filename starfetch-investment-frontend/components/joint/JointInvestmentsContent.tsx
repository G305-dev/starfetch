"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BriefcaseBusiness, CircleAlert, LoaderCircle, RefreshCw } from "lucide-react";
import { getJointPortfolio, type InvestorPortfolio } from "@/lib/api/client";
import { InvestmentHoldings } from "@/components/portal/InvestmentHoldings";
import { InvestmentSummaryCards } from "@/components/portal/InvestmentSummaryCards";
import { getJointActionErrorMessage } from "./joint-api-messages";
import { useJointAccounts } from "./JointAccountProvider";

type RequestState = "idle" | "loading" | "ready" | "error";

function SelectedAccountRequired() {
  return <section className="mt-7 grid min-h-[300px] place-items-center rounded-xl border border-dashed border-star-300 bg-star-50/65 px-5 py-10 text-center"><div className="max-w-lg"><span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-star-700 shadow-sm"><BriefcaseBusiness size={23} aria-hidden="true" /></span><h2 className="mt-4 text-xl font-extrabold text-star-900">Select a Joint Account</h2><p className="mt-2 text-sm leading-6 text-star-muted">Choose an authorized Joint Account before its investment holdings can be loaded.</p><Link href="/joint/dashboard" className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md bg-star-700 px-4 text-sm font-extrabold text-white no-underline transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">Go to Joint Accounts</Link></div></section>;
}

function LoadingState() {
  return <section className="mt-7 rounded-xl border border-star-200 bg-white p-5 sm:p-6" aria-label="Loading Joint Account investments" aria-busy="true"><div className="h-7 w-48 animate-pulse rounded bg-star-100" /><div className="mt-5 grid gap-3">{[0, 1, 2].map((row) => <div key={row} className="h-20 animate-pulse rounded-lg bg-star-50" />)}</div><span className="sr-only">Loading Joint Account investments</span></section>;
}

export function JointInvestmentsContent() {
  const { accountsStatus, accountsError, selectedAccount, refresh } = useJointAccounts();
  const accountId = selectedAccount?.jointAccountId ?? null;
  const [state, setState] = useState<RequestState>("idle");
  const [portfolio, setPortfolio] = useState<InvestorPortfolio | null>(null);
  const [resultAccountId, setResultAccountId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const requestVersion = useRef(0);

  const loadPortfolio = useCallback(async () => {
    if (!accountId) {
      requestVersion.current += 1;
      setPortfolio(null);
      setResultAccountId(null);
      setError(null);
      setState("idle");
      return;
    }
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setPortfolio(null);
    setResultAccountId(null);
    setError(null);
    setState("loading");
    try {
      const nextPortfolio = await getJointPortfolio(accountId);
      if (version !== requestVersion.current) return;
      setPortfolio(nextPortfolio);
      setResultAccountId(accountId);
      setState("ready");
    } catch (requestError) {
      if (version !== requestVersion.current) return;
      setError(requestError);
      setResultAccountId(accountId);
      setState("error");
    }
  }, [accountId]);

  useEffect(() => {
    void loadPortfolio();
    return () => { requestVersion.current += 1; };
  }, [loadPortfolio]);

  const resultMatchesSelectedAccount = resultAccountId === accountId;

  return <main><section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Joint account investments</p><h1 className="mt-2 font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold tracking-[-0.045em] text-star-900">My Investments</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-star-muted sm:text-base">Read-only portfolio holdings and stored values from the selected authorized Joint Account.</p></div>{accountId ? <button type="button" onClick={() => { void loadPortfolio(); }} disabled={state === "loading"} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md border border-star-200 bg-white px-4 text-sm font-extrabold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw size={16} className={state === "loading" ? "animate-spin" : ""} aria-hidden="true" />Refresh</button> : null}</section>{accountsStatus === "loading" ? <LoadingState /> : null}{accountsStatus === "error" ? <section className="mt-7 grid min-h-[300px] place-items-center rounded-xl border border-red-200 bg-white px-5 py-10 text-center"><div className="max-w-md"><CircleAlert size={25} className="mx-auto text-red-700" aria-hidden="true" /><h2 className="mt-4 text-xl font-extrabold text-star-900">Joint Accounts are unavailable</h2><p className="mt-2 text-sm leading-6 text-star-muted">{getJointActionErrorMessage(accountsError)}</p><button type="button" onClick={() => { void refresh(); }} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-star-700 px-4 text-sm font-extrabold text-white"><RefreshCw size={16} aria-hidden="true" />Try again</button></div></section> : null}{accountsStatus === "ready" && !accountId ? <SelectedAccountRequired /> : null}{accountsStatus === "ready" && accountId && (state === "loading" || !resultMatchesSelectedAccount) ? <LoadingState /> : null}{accountsStatus === "ready" && accountId && resultMatchesSelectedAccount && state === "error" ? <section className="mt-7 grid min-h-[300px] place-items-center rounded-xl border border-red-200 bg-white px-5 py-10 text-center"><div className="max-w-md"><CircleAlert size={25} className="mx-auto text-red-700" aria-hidden="true" /><h2 className="mt-4 text-xl font-extrabold text-star-900">Portfolio data is unavailable</h2><p className="mt-2 text-sm leading-6 text-star-muted">{getJointActionErrorMessage(error)}</p><button type="button" onClick={() => { void loadPortfolio(); }} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-star-700 px-4 text-sm font-extrabold text-white"><RefreshCw size={16} aria-hidden="true" />Try again</button></div></section> : null}{accountsStatus === "ready" && accountId && resultMatchesSelectedAccount && state === "ready" && portfolio ? <><div className="mt-7"><InvestmentSummaryCards portfolio={portfolio} /></div><section className="mt-5 rounded-xl border border-star-200 bg-white p-4 shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-6" aria-labelledby="joint-holdings-heading"><h2 id="joint-holdings-heading" className="text-xl font-extrabold text-star-900">Portfolio holdings</h2><p className="mt-1 text-sm leading-6 text-star-muted">Only recorded instruments, quantities, stored values, currencies, and as-of dates are shown.</p><InvestmentHoldings holdings={portfolio.holdings} productsHref="/joint/products" /></section><p className="mt-5 text-xs leading-5 text-star-muted">Investment booking, funding, withdrawals, statements, performance calculations, and status filters are not available in this portal.</p></> : null}</main>;
}
