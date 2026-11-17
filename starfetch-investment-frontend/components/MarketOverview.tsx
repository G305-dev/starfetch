"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, Database, Search } from "lucide-react";
import { SectionHeading } from "./ui";
import { featuredNgxEquities, ngxListedEquitiesUrl, type NgxEquityListing } from "./ngx-market-directory";

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

/** Landing-page NGX directory; backend market rows can be passed in without changing the presentation. */
export function MarketOverview({ markets = featuredNgxEquities }: { markets?: readonly NgxEquityListing[] }) {
  const [query, setQuery] = useState("");
  const filteredMarkets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return markets;
    return markets.filter(({ companyName, symbol }) => `${companyName} ${symbol}`.toLowerCase().includes(normalizedQuery));
  }, [markets, query]);
  const hasQuoteData = markets.some((market) => market.lastPriceNgn !== null || market.dailyChangePercent !== null);

  return (
    <section id="ngx-markets" className="bg-white py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            eyebrow="Nigerian Exchange (NGX)"
            title="NGX markets at a glance"
            description="Browse selected Nigerian Exchange-listed equities. Live prices and daily movements will appear when the backend market-data feed is connected."
          />
          <a
            href={ngxListedEquitiesUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
          >
            Official NGX listings <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </div>

        <div className="mt-10 grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.7fr)]">
          <article className="min-w-0 overflow-hidden rounded-2xl border border-star-200 bg-white shadow-[0_4px_18px_rgba(0,59,42,0.04)]">
            <div className="flex flex-col gap-4 border-b border-star-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-star-100 text-star-700"><BarChart3 size={19} aria-hidden="true" /></span>
                <div>
                  <h3 className="font-display text-lg font-bold text-star-900">Selected NGX-listed equities</h3>
                  <p className="text-xs leading-5 text-star-muted">{filteredMarkets.length} of {markets.length} listings</p>
                </div>
              </div>
              <label className="relative block w-full sm:max-w-[260px]">
                <span className="sr-only">Search NGX equities</span>
                <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-star-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search company or ticker"
                  className="min-h-10 w-full rounded-lg border border-star-200 bg-white pl-9 pr-3 text-sm text-star-900 outline-none transition placeholder:font-normal placeholder:text-star-muted focus:border-star-700 focus:ring-2 focus:ring-star-100"
                />
              </label>
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
                  {filteredMarkets.map((market) => (
                    <tr key={market.symbol} className="transition hover:bg-star-50/70">
                      <th scope="row" className="px-5 py-3.5 text-sm font-bold text-star-900 sm:px-6">{market.companyName}</th>
                      <td className="px-4 py-3.5"><span className="rounded-md bg-star-50 px-2 py-1 text-[0.68rem] font-extrabold tracking-wide text-star-700">{market.symbol}</span></td>
                      <td className="px-4 py-3.5 text-right text-sm font-semibold tabular-nums text-star-900">{formatPrice(market.lastPriceNgn)}</td>
                      <td className={`px-5 py-3.5 text-right text-sm font-bold tabular-nums sm:px-6 ${market.dailyChangePercent === null ? "text-star-muted" : market.dailyChangePercent > 0 ? "text-emerald-700" : market.dailyChangePercent < 0 ? "text-red-700" : "text-star-muted"}`}>{formatChange(market.dailyChangePercent)}</td>
                    </tr>
                  ))}
                  {filteredMarkets.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-star-muted">No NGX listings match “{query.trim()}”.</td></tr>
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

          <aside className="rounded-2xl bg-star-900 p-5 text-white sm:p-6">
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-star-lime">NGX market data</p>
            <h3 className="mt-2 font-display text-xl font-bold text-white">Ready for backend quotes</h3>
            <p className="mt-2 text-sm leading-6 text-star-100">The frontend list can display NGX-supplied prices and daily movement when the backend feed is connected. No global-market prices or invented quotes are shown as Nigerian data.</p>
            <dl className="mt-5 divide-y divide-white/15 rounded-xl border border-white/15 bg-white/5">
              <div className="flex items-center justify-between gap-3 p-3.5"><dt className="text-xs font-semibold text-star-100">Directory entries</dt><dd className="text-sm font-extrabold text-star-lime">{markets.length}</dd></div>
              <div className="flex items-center justify-between gap-3 p-3.5"><dt className="text-xs font-semibold text-star-100">Live quote feed</dt><dd className="text-xs font-extrabold text-star-lime">{hasQuoteData ? "Connected" : "Pending"}</dd></div>
              <div className="flex items-center justify-between gap-3 p-3.5"><dt className="text-xs font-semibold text-star-100">Currency</dt><dd className="text-sm font-extrabold text-star-lime">NGN</dd></div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-star-100">Market data display is separate from investment advice, recommendations, or trade instructions.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
