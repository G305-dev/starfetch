import { ChevronDown, LineChart } from "lucide-react";
import { portfolioOverview } from "./individual-dashboard-data";

const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const yAxis = ["₦1,000,000", "₦750,000", "₦500,000", "₦250,000", "₦0"];

export function PortfolioOverviewEmpty() {
  return (
    <section className="rounded-xl border border-star-200 bg-white p-5 sm:p-6" aria-labelledby="portfolio-overview-heading">
      <div className="flex items-center justify-between gap-4"><h2 id="portfolio-overview-heading" className="text-lg font-extrabold text-star-900">Portfolio Overview</h2><button type="button" className="inline-flex min-h-9 items-center gap-2 rounded-md border border-star-200 bg-white px-3 text-xs font-bold text-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">{portfolioOverview.range}<ChevronDown size={15} aria-hidden="true" /></button></div>
      <div className="relative mt-6 h-[210px] overflow-hidden rounded-lg bg-star-50 px-8 pb-8 pt-4">
        <div className="absolute bottom-8 left-8 right-4 top-4 grid grid-rows-5">
          {yAxis.map((label) => <div key={label} className="relative border-t border-star-200/80"><span className="absolute -left-8 -top-2 text-[0.58rem] text-star-muted">{label}</span></div>)}
        </div>
        <div className="absolute bottom-2 left-8 right-4 flex justify-between text-[0.62rem] text-star-muted">{months.map((month) => <span key={month}>{month}</span>)}</div>
        <div className="absolute inset-0 grid place-items-center"><div className="max-w-[15rem] rounded-xl bg-white/90 px-4 py-3 text-center shadow-[0_3px_12px_rgba(0,59,42,0.06)]"><LineChart size={22} className="mx-auto text-star-700" aria-hidden="true" /><p className="mt-2 text-sm font-extrabold text-star-900">{portfolioOverview.emptyMessage}</p><p className="mt-1 text-xs leading-5 text-star-muted">{portfolioOverview.emptyDescription}</p></div></div>
      </div>
      <p className="mt-4 text-xs text-star-muted">Portfolio value: <span className="font-bold text-star-700">{portfolioOverview.totalValue}</span> · New investor empty state</p>
    </section>
  );
}
