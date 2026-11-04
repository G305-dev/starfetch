"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMyPortfolio, type InvestorPortfolio } from "@/lib/api/client";
import { InvestmentFilters } from "./InvestmentFilters";
import { InvestmentHoldings } from "./InvestmentHoldings";
import { InvestmentsErrorState, InvestmentsLoadingState } from "./InvestmentStates";
import { InvestmentSummaryCards } from "./InvestmentSummaryCards";

type InvestmentsRequestState = "loading" | "success" | "error";

export function MyInvestmentsContent() {
  const [requestState, setRequestState] = useState<InvestmentsRequestState>("loading");
  const [portfolio, setPortfolio] = useState<InvestorPortfolio | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const requestVersion = useRef(0);

  const loadInvestments = useCallback(async () => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setRequestState("loading");
    try {
      const nextPortfolio = await getMyPortfolio();
      if (version !== requestVersion.current) return;
      setPortfolio(nextPortfolio);
      setRequestState("success");
    } catch {
      if (version !== requestVersion.current) return;
      setPortfolio(null);
      setRequestState("error");
    }
  }, []);

  useEffect(() => {
    void loadInvestments();
    return () => {
      requestVersion.current += 1;
    };
  }, [loadInvestments]);

  const filteredHoldings = useMemo(() => {
    if (!portfolio) return [];
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
    if (!normalizedSearch) return portfolio.holdings;
    return portfolio.holdings.filter((holding) => holding.instrumentLabel?.toLocaleLowerCase().includes(normalizedSearch));
  }, [portfolio, searchTerm]);

  return <section aria-labelledby="my-investments-page-heading"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 id="my-investments-page-heading" className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.045em] text-star-900">My Investments</h1><p className="mt-2 text-sm leading-6 text-star-muted sm:text-[0.96rem]">Track your investment holdings across Starfetch products.</p></div><Link href="/products" className="inline-flex w-fit items-center gap-1.5 text-sm font-extrabold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Explore Products <ArrowRight size={17} aria-hidden="true" /></Link></div>{requestState === "loading" ? <section className="mt-7 rounded-xl border border-star-200 bg-white p-4 sm:p-6"><InvestmentsLoadingState /></section> : null}{requestState === "error" ? <section className="mt-7 rounded-xl border border-star-200 bg-white p-4 sm:p-6" aria-label="Investment holdings"><InvestmentsErrorState onRetry={() => void loadInvestments()} /></section> : null}{requestState === "success" && portfolio ? <><div className="mt-7"><InvestmentSummaryCards portfolio={portfolio} /></div><InvestmentFilters searchTerm={searchTerm} onSearchTermChange={setSearchTerm} /><section className="mt-5 rounded-xl border border-star-200 bg-white p-4 sm:p-6" aria-label="Investment holdings"><InvestmentHoldings holdings={filteredHoldings} filtered={Boolean(searchTerm.trim())} /></section></> : null}</section>;
}
