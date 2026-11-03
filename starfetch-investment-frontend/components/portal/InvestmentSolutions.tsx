import { ChevronRight } from "lucide-react";
import { individualInvestmentSolutions } from "./individual-dashboard-data";

const toneStyles = {
  gold: "border-[#f3e7bd] bg-[#fff9e9] text-[#9b781d]",
  green: "border-star-200 bg-star-50 text-star-700",
  sage: "border-star-200 bg-[#f2f7ea] text-star-700",
};

export function InvestmentSolutions({ productsHref = "/products" }: { productsHref?: string }) {
  return (
    <section className="min-w-0 rounded-xl border border-star-200 bg-white p-5 sm:p-6" aria-labelledby="investment-solutions-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id="investment-solutions-heading" className="text-lg font-extrabold text-star-900">Explore Investment Solutions</h2>
          <p className="mt-1 text-sm text-star-muted">Choose from our carefully designed investment solutions.</p>
        </div>
        <a href={productsHref} className="inline-flex w-fit shrink-0 items-center gap-1 text-sm font-bold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">View all products <ChevronRight size={16} aria-hidden="true" /></a>
      </div>

      <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-2 min-[1800px]:grid-cols-3">
        {individualInvestmentSolutions.map(({ title, description, icon: Icon, tone }) => (
          <a key={title} href={productsHref} className={`group flex min-w-0 items-start gap-3 rounded-lg border p-4 no-underline transition hover:-translate-y-px hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 sm:p-5 ${toneStyles[tone]}`}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/70" aria-hidden="true"><Icon size={22} strokeWidth={1.9} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold leading-5 text-star-900">{title}</span>
              <span className="mt-1 block text-xs leading-5 text-star-muted">{description}</span>
            </span>
            <ChevronRight size={18} className="mt-1 shrink-0 text-star-700 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}
