import { ArrowRight, BriefcaseBusiness } from "lucide-react";
import type { PortfolioHolding } from "@/lib/api/client";
import { formatNairaMinor } from "./dashboard-formatters";
import { EmptyInvestmentsPanel } from "./NewInvestorEmptyPanels";

function HoldingRow({ holding }: { holding: PortfolioHolding }) {
  return <li className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0 sm:flex-nowrap"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-star-50 text-star-700"><BriefcaseBusiness size={19} aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-star-900">{holding.productName ?? "Portfolio holding"}</p><p className="mt-0.5 text-xs text-star-muted">{holding.status ?? "Status not available"}</p></div><dl className="grid min-w-[15rem] grid-cols-2 gap-3 text-right text-xs sm:min-w-[17rem]"><div><dt className="text-star-muted">Invested</dt><dd className="mt-1 font-extrabold text-star-900">{formatNairaMinor(holding.investedMinor)}</dd></div><div><dt className="text-star-muted">Current value</dt><dd className="mt-1 font-extrabold text-star-900">{formatNairaMinor(holding.currentValueMinor)}</dd></div></dl></li>;
}

export function PortfolioHoldingsPanel({ holdings }: { holdings: PortfolioHolding[] }) {
  if (holdings.length === 0) return <EmptyInvestmentsPanel investmentsHref="/investments" productsHref="/products" />;
  return <section className="rounded-xl border border-star-200 bg-white p-5 sm:p-6" aria-labelledby="portfolio-holdings-heading"><div className="flex items-center justify-between gap-4"><div><h2 id="portfolio-holdings-heading" className="text-lg font-extrabold text-star-900">My Investments</h2><p className="mt-1 text-sm text-star-muted">Your current Starfetch portfolio holdings.</p></div><a href="/investments" className="inline-flex items-center gap-1 text-sm font-bold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">View all <ArrowRight size={16} aria-hidden="true" /></a></div><ul className="mt-5 divide-y divide-star-100" aria-label="Portfolio holdings">{holdings.map((holding, index) => <HoldingRow key={holding.id ?? `holding-${index}`} holding={holding} />)}</ul></section>;
}
