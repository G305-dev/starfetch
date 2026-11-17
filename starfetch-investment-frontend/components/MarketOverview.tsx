import { BarChart3, Database, Landmark, Percent, WalletCards } from "lucide-react";
import { SectionHeading } from "./ui";
import { featuredNgxEquities, type NgxEquityListing } from "./ngx-market-directory";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPrice(value: number | null) {
  return value === null ? "—" : naira.format(value);
}

function formatChange(value: number | null) {
  if (value === null) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

const pulse = [
  { icon: Percent, label: "Inflation (Headline)", detail: "Official source integration pending", value: "Pending" },
  { icon: Landmark, label: "Monetary Policy Rate", detail: "Official CBN source integration pending", value: "Pending" },
  { icon: WalletCards, label: "Cash Reserve Ratio", detail: "Official CBN source integration pending", value: "Pending" },
];

/** Number of rows shown in the at-a-glance table (the full directory has 14). */
const AT_A_GLANCE_LIMIT = 5;

/** Landing-page NGX at-a-glance subset; backend market rows can be passed in without changing the presentation. */
export function MarketOverview({ markets = featuredNgxEquities }: { markets?: readonly NgxEquityListing[] }) {
  const visibleMarkets = markets.slice(0, AT_A_GLANCE_LIMIT);
  const hasQuoteData = visibleMarkets.some((market) => market.lastPriceNgn !== null || market.dailyChangePercent !== null);

  return (
    <section id="ngx-markets" className="bg-white py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Nigerian Exchange (NGX)"
          title="NGX markets at a glance"
          description="A selected snapshot of Nigerian Exchange-listed equities. Live prices and daily movements will appear when the backend market-data feed is connected."
        />

        <div className="mt-10 grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.7fr)]">
          <article className="min-w-0 overflow-hidden rounded-2xl border border-star-200 bg-white shadow-[0_4px_18px_rgba(0,59,42,0.04)]">
            <div className="flex items-center gap-3 border-b border-star-200 px-5 py-4 sm:px-6">
              <span className="grid size-10 place-items-center rounded-full bg-star-100 text-star-700"><BarChart3 size={19} aria-hidden="true" /></span>
              <div>
                <h3 className="font-display text-lg font-bold text-star-900">Selected NGX-listed equities</h3>
                <p className="text-xs leading-5 text-star-muted">Showing {visibleMarkets.length} of {markets.length} listings</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[590px] border-collapse text-left">
                <thead>
                  <tr className="bg-[#f8faf5] text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-star-muted">
                    <th scope="col" className="px-5 py-3 sm:px-6">Company</th>
                    <th scope="col" className="px-4 py-3">Ticker</th>
                    <th scope="col" className="px-4 py-3 text-right">Last price</th>
                    <th scope="col" className="px-5 py-3 text-right sm:px-6">Daily change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-star-100">
                  {visibleMarkets.map((market) => (
                    <tr key={market.symbol} className="transition hover:bg-star-50/70">
                      <th scope="row" className="px-5 py-3.5 text-sm font-bold text-star-900 sm:px-6">{market.companyName}</th>
                      <td className="px-4 py-3.5"><span className="rounded-md bg-star-50 px-2 py-1 text-[0.68rem] font-extrabold tracking-wide text-star-700">{market.symbol}</span></td>
                      <td className="px-4 py-3.5 text-right text-sm font-semibold tabular-nums text-star-900">{formatPrice(market.lastPriceNgn)}</td>
                      <td className={`px-5 py-3.5 text-right text-sm font-bold tabular-nums sm:px-6 ${market.dailyChangePercent === null ? "text-star-muted" : market.dailyChangePercent > 0 ? "text-emerald-700" : market.dailyChangePercent < 0 ? "text-red-700" : "text-star-muted"}`}>{formatChange(market.dailyChangePercent)}</td>
                    </tr>
                  ))}
                  {visibleMarkets.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-star-muted">No NGX listings available.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex items-start gap-2.5 border-t border-star-100 bg-[#fbfcf8] px-5 py-3.5 sm:px-6">
              <Database size={16} className="mt-0.5 shrink-0 text-star-700" aria-hidden="true" />
              <p className="text-xs leading-5 text-star-muted">
                {hasQuoteData
                  ? "Prices and daily changes are shown as supplied by the connected backend market-data feed."
                  : "This is a starter directory, not live market data. Quote values are intentionally blank until the backend connects an authorized NGX data source."}
              </p>
            </div>
          </article>

          <article className="rounded-2xl bg-star-900 p-5 text-white sm:p-6">
            <h3 className="font-display text-xl font-bold text-white">Market Pulse</h3>
            <p className="mt-1 text-sm text-star-100">Policy and statistical indicators remain pending until an approved official source is integrated.</p>
            <div className="mt-5 divide-y divide-white/15 rounded-xl border border-white/15 bg-white/5">
              {pulse.map(({ icon: Icon, label, detail, value }) => (
                <div key={label} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <Icon size={18} className="shrink-0 text-star-lime" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-white">{label}</p>
                      <p className="mt-0.5 text-xs text-star-200">{detail}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-star-lime">{value}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
