import { LineChart } from "lucide-react";

/** A neutral portfolio-empty panel retained for routes that need an overview placeholder. */
export function PortfolioOverviewEmpty() {
  return <section className="rounded-xl border border-star-200 bg-white p-5 sm:p-6" aria-labelledby="portfolio-overview-heading"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-lg bg-star-50 text-star-700"><LineChart size={19} aria-hidden="true" /></span><h2 id="portfolio-overview-heading" className="text-lg font-extrabold text-star-900">Portfolio Overview</h2></div><div className="flex min-h-[210px] flex-col items-center justify-center text-center"><LineChart size={28} className="text-star-300" aria-hidden="true" /><p className="mt-4 text-sm font-extrabold text-star-900">No portfolio information to show yet</p><p className="mt-2 max-w-sm text-xs leading-5 text-star-muted">Your overview will appear when portfolio data is available.</p></div></section>;
}
