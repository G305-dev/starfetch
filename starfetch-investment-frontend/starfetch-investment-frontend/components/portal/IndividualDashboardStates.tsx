"use client";

import { AlertCircle } from "lucide-react";

export function IndividualDashboardLoadingState() {
  return (
    <div className="grid gap-5" aria-label="Loading dashboard information" aria-busy="true">
      <div className="h-52 animate-pulse rounded-xl bg-star-100" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((card) => <div key={card} className="h-32 animate-pulse rounded-xl bg-star-100" />)}</div>
      <div className="grid gap-5 xl:grid-cols-2"><div className="h-72 animate-pulse rounded-xl bg-star-100" /><div className="h-72 animate-pulse rounded-xl bg-star-100" /></div>
      <span className="sr-only">Loading dashboard information</span>
    </div>
  );
}

export function IndividualDashboardErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-xl border border-star-200 bg-star-50 px-5 py-16 text-center" role="alert"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white text-star-700" aria-hidden="true"><AlertCircle size={23} /></span><h1 className="mt-4 text-xl font-extrabold text-star-900">We couldn&apos;t load your dashboard information.</h1><p className="mt-2 text-sm text-star-muted">Please try again.</p><button type="button" onClick={onRetry} className="mt-5 inline-flex min-h-10 rounded-md bg-star-900 px-4 text-sm font-bold text-white transition hover:bg-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Retry</button></section>
  );
}
