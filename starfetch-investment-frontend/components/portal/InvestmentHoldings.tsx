import { BriefcaseBusiness } from "lucide-react";
import type { PortfolioHolding } from "@/lib/api/client";
import { formatCurrencyMinor, formatDashboardDate } from "./dashboard-formatters";
import { InvestmentsEmptyState } from "./InvestmentStates";

type InvestmentHoldingsProps = {
  holdings: PortfolioHolding[];
  filtered?: boolean;
  productsHref?: string;
};

function InstrumentName({ holding }: { holding: PortfolioHolding }) {
  return <div className="min-w-0"><p className="truncate font-extrabold text-star-900">{holding.instrumentLabel ?? "Instrument not available"}</p>{holding.isDemo ? <span className="mt-1 inline-flex rounded-md bg-star-100 px-2 py-0.5 text-[0.68rem] font-extrabold text-star-700">Demo</span> : null}</div>;
}

function Quantity({ value }: { value: string | null }) {
  return <>{value ?? "Not available"}</>;
}

export function InvestmentHoldings({ holdings, filtered = false, productsHref }: InvestmentHoldingsProps) {
  if (holdings.length === 0) return <InvestmentsEmptyState filtered={filtered} productsHref={productsHref} />;

  return <>
    <div className="mt-5 hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-star-50 text-xs text-star-muted">
          <tr>
            <th scope="col" className="rounded-l-md px-5 py-4 font-bold">Instrument</th>
            <th scope="col" className="px-4 py-4 text-right font-bold">Quantity</th>
            <th scope="col" className="px-4 py-4 text-right font-bold">Holding Value</th>
            <th scope="col" className="rounded-r-md px-4 py-4 text-right font-bold">Valued As Of</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-star-100">
          {holdings.map((holding, index) => <tr key={holding.id ?? `holding-${index}`} className="transition hover:bg-star-50/60"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-star-50 text-star-700" aria-hidden="true"><BriefcaseBusiness size={21} strokeWidth={1.9} /></span><InstrumentName holding={holding} /></div></td><td className="px-4 py-4 text-right font-semibold tabular-nums text-star-700"><Quantity value={holding.quantity} /></td><td className="px-4 py-4 text-right font-semibold tabular-nums text-star-700">{formatCurrencyMinor(holding.valueMinor, holding.currency)}</td><td className="px-4 py-4 text-right text-xs font-semibold text-star-700">{formatDashboardDate(holding.asOf)}</td></tr>)}
        </tbody>
      </table>
    </div>

    <div className="mt-5 grid gap-3 lg:hidden">
      {holdings.map((holding, index) => <article key={holding.id ?? `holding-${index}`} className="rounded-xl border border-star-200 bg-star-50 p-4 sm:p-5"><div className="flex min-w-0 items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-star-700" aria-hidden="true"><BriefcaseBusiness size={21} strokeWidth={1.9} /></span><InstrumentName holding={holding} /></div><dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm"><div><dt className="text-xs text-star-muted">Quantity</dt><dd className="mt-1 font-bold tabular-nums text-star-700"><Quantity value={holding.quantity} /></dd></div><div><dt className="text-xs text-star-muted">Holding Value</dt><dd className="mt-1 font-bold tabular-nums text-star-700">{formatCurrencyMinor(holding.valueMinor, holding.currency)}</dd></div><div className="col-span-2"><dt className="text-xs text-star-muted">Valued As Of</dt><dd className="mt-1 font-bold text-star-700">{formatDashboardDate(holding.asOf)}</dd></div></dl></article>)}
    </div>
  </>;
}
