"use client";

import { AlertCircle, ArrowRight, BriefcaseBusiness } from "lucide-react";

export function InvestmentsLoadingState() {
  return (
    <div className="mt-5 grid gap-3" aria-label="Loading investments" aria-busy="true">
      {[0, 1, 2].map((row) => <div key={row} className="h-20 animate-pulse rounded-lg bg-star-50" />)}
      <span className="sr-only">Loading investments</span>
    </div>
  );
}

export function InvestmentsEmptyState({ filtered = false }: { filtered?: boolean }) {
  return (
    <section className="mt-5 rounded-xl border border-dashed border-star-200 bg-star-50 px-5 py-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white text-star-700" aria-hidden="true"><BriefcaseBusiness size={23} /></span>
      <h3 className="mt-4 text-lg font-extrabold text-star-900">{filtered ? "No matching investments" : "No investments yet"}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-star-muted">
        {filtered ? "Try changing your filters or search term to see your investments." : "You haven&apos;t made an investment yet. Explore Starfetch investment solutions to get started."}
      </p>
      {!filtered ? <a href="/services" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-star-900 px-4 text-sm font-bold text-white no-underline transition hover:bg-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Explore Investments <ArrowRight size={16} aria-hidden="true" /></a> : null}
    </section>
  );
}

export function InvestmentsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="mt-5 rounded-xl border border-star-200 bg-star-50 px-5 py-12 text-center" role="alert">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white text-star-700" aria-hidden="true"><AlertCircle size={23} /></span>
      <h3 className="mt-4 text-lg font-extrabold text-star-900">We couldn&apos;t load your investments.</h3>
      <p className="mt-2 text-sm text-star-muted">Please try again.</p>
      <button type="button" onClick={onRetry} className="mt-5 inline-flex min-h-10 rounded-md bg-star-900 px-4 text-sm font-bold text-white transition hover:bg-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Retry</button>
    </section>
  );
}
