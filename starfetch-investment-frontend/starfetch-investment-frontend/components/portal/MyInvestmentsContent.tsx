"use client";

import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { InvestmentFilters } from "./InvestmentFilters";
import { InvestmentHoldings } from "./InvestmentHoldings";
import { InvestmentPagination } from "./InvestmentPagination";
import { InvestmentsErrorState, InvestmentsLoadingState } from "./InvestmentStates";
import { InvestmentSummaryCards } from "./InvestmentSummaryCards";
import { investmentHoldings } from "./investments-data";

type InvestmentsViewState = "ready" | "loading" | "error";

export function MyInvestmentsContent() {
  const [investmentType, setInvestmentType] = useState("All Investments");
  const [status, setStatus] = useState("All Status");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewState, setViewState] = useState<InvestmentsViewState>("ready");

  const filteredInvestments = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return investmentHoldings.filter((investment) => {
      const matchesInvestmentType = investmentType === "All Investments" || investment.investmentType === investmentType;
      const matchesStatus = status === "All Status" || investment.status === status;
      const matchesSearch = !normalizedSearch || [investment.product, investment.investmentType, investment.description]
        .some((value) => value.toLowerCase().includes(normalizedSearch));

      return matchesInvestmentType && matchesStatus && matchesSearch;
    });
  }, [investmentType, searchTerm, status]);

  function resetToFirstPage() {
    setCurrentPage(1);
  }

  function retry() {
    // UI-only retry preparation: replace with an API refetch when a backend contract exists.
    setViewState("ready");
  }

  return (
    <section aria-labelledby="my-investments-page-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 id="my-investments-page-heading" className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.045em] text-star-900">My Investments</h1>
          <p className="mt-2 text-sm leading-6 text-star-muted sm:text-[0.96rem]">Track and manage your investment holdings across all products.</p>
        </div>
        <a href="/services" className="inline-flex w-fit items-center gap-1.5 text-sm font-extrabold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">
          Explore Products <ArrowRight size={17} aria-hidden="true" />
        </a>
      </div>

      <div className="mt-7"><InvestmentSummaryCards /></div>
      <InvestmentFilters
        investmentType={investmentType}
        status={status}
        searchTerm={searchTerm}
        onInvestmentTypeChange={(value) => { setInvestmentType(value); resetToFirstPage(); }}
        onStatusChange={(value) => { setStatus(value); resetToFirstPage(); }}
        onSearchTermChange={(value) => { setSearchTerm(value); resetToFirstPage(); }}
      />

      <section className="mt-5 rounded-xl border border-star-200 bg-white p-4 sm:p-6" aria-label="Investment holdings">
        {viewState === "loading" ? <InvestmentsLoadingState /> : null}
        {viewState === "error" ? <InvestmentsErrorState onRetry={retry} /> : null}
        {viewState === "ready" ? <InvestmentHoldings investments={filteredInvestments} filtered={Boolean(searchTerm || investmentType !== "All Investments" || status !== "All Status")} /> : null}
        {viewState === "ready" && filteredInvestments.length > 0 ? <InvestmentPagination currentPage={currentPage} totalItems={filteredInvestments.length} onPageChange={setCurrentPage} /> : null}
      </section>
    </section>
  );
}
