"use client";

import { AlertCircle, ArrowRight, ReceiptText } from "lucide-react";

export function TransactionsLoadingState() {
  return (
    <section className="rounded-xl border border-star-200 bg-white p-5 sm:p-6" aria-label="Loading transactions" aria-busy="true">
      <div className="h-6 w-44 animate-pulse rounded bg-star-100" />
      <div className="mt-5 grid gap-3">{[0, 1, 2, 3].map((row) => <div key={row} className="h-16 animate-pulse rounded-lg bg-star-50" />)}</div>
      <span className="sr-only">Loading transactions</span>
    </section>
  );
}

export function TransactionsEmptyState({ filtered = false }: { filtered?: boolean }) {
  return (
    <section className="rounded-xl border border-dashed border-star-200 bg-star-50 px-5 py-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white text-star-700" aria-hidden="true"><ReceiptText size={23} /></span>
      <h3 className="mt-4 text-lg font-extrabold text-star-900">{filtered ? "No matching transactions" : "No transactions yet"}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-star-muted">{filtered ? "Try changing your filters or search term to see your transactions." : "Your account activity will appear here once you start funding or investing."}</p>
      {!filtered ? <a href="/services" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-star-900 px-4 text-sm font-bold text-white no-underline transition hover:bg-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Explore Investments <ArrowRight size={16} aria-hidden="true" /></a> : null}
    </section>
  );
}

export function TransactionsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-xl border border-star-200 bg-star-50 px-5 py-12 text-center" role="alert">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white text-star-700" aria-hidden="true"><AlertCircle size={23} /></span>
      <h3 className="mt-4 text-lg font-extrabold text-star-900">We couldn&apos;t load your transactions.</h3>
      <p className="mt-2 text-sm text-star-muted">Please try again.</p>
      <button type="button" onClick={onRetry} className="mt-5 inline-flex min-h-10 rounded-md bg-star-900 px-4 text-sm font-bold text-white transition hover:bg-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Retry</button>
    </section>
  );
}
