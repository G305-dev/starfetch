import { BarChart3, Coins, Database } from "lucide-react";
import { SectionHeading } from "./ui";
import { commodityDirectory } from "@/lib/market/commodity-directory";
import { unquotedCommodities } from "@/lib/market/commodity-adapter";
import { NgxPriceTable } from "./NgxPriceTable";
import type { MarketPulseResult } from "@/lib/market/market-pulse";
import { MarketPulseSection } from "./MarketPulseSection";
import type { CommodityQuote, FeedStatus, NgxQuote, QuoteValue } from "@/lib/market/types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatUsd(value: QuoteValue) {
  return value === null ? "—" : usd.format(value);
}

function formatChange(value: QuoteValue) {
  if (value === null) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function changeTone(value: QuoteValue) {
  if (value === null) return "text-star-muted";
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-red-700";
  return "text-star-muted";
}

/** Small, unobtrusive freshness line shared by both quote cards. */
function FeedFootnote({ status, fallback }: { status: FeedStatus; fallback: string }) {
  const tone =
    status.state === "unavailable"
      ? "border-[#f2d89d] bg-[#fff9e8] text-star-900"
      : status.state === "stale"
        ? "border-[#f2d89d] bg-[#fff9e8] text-star-900"
        : "border-star-100 bg-[#fbfcf8] text-star-muted";
  return (
    <div className={`flex items-start gap-2.5 border-t px-5 py-3.5 sm:px-6 ${tone}`}>
      <Database size={16} className="mt-0.5 shrink-0 text-star-700" aria-hidden="true" />
      <p className="text-xs leading-5" data-feed-state={status.state}>
        {status.state === "unavailable" ? status.note ?? fallback : (
          <>
            {status.note ? `${status.note} ` : null}
            {status.asOfLabel ? <span className="font-semibold">As of {status.asOfLabel}. </span> : null}
            {status.source ? `Source: ${status.source}. ` : null}
            {status.state === "live" ? "Quotes update from the market data service; they are not a live trading feed." : null}
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Props are optional on purpose. The default for every feed is the explicit
 * "unavailable" state, never a fabricated value, so a caller that forgets to
 * pass data fails closed rather than showing something untrue. This also keeps
 * the historical `Starfetch_Corporate_O2_O3_O4_O11_v0.6_Frontend_Integration`
 * documentation snapshot type-checking, which is tsconfig-included but is not
 * routed — it must not be edited just to track a component's props.
 */
const DEFAULT_NGX_STATUS: FeedStatus = {
  state: "unavailable",
  asOf: null,
  asOfLabel: "",
  source: null,
  note: "NGX quotations are not available.",
};

const DEFAULT_COMMODITY_STATUS: FeedStatus = {
  state: "unavailable",
  asOf: null,
  asOfLabel: "",
  source: null,
  note: "Commodity prices are not available.",
};

const DEFAULT_PULSE: MarketPulseResult = {
  status: "unavailable",
  note: "Market Pulse indicators are not available.",
};

export function MarketOverview({
  markets = [],
  commodities = unquotedCommodities(),
  ngxStatus = DEFAULT_NGX_STATUS,
  commodityStatus = DEFAULT_COMMODITY_STATUS,
  pulse = DEFAULT_PULSE,
}: {
  markets?: readonly NgxQuote[];
  commodities?: readonly CommodityQuote[];
  ngxStatus?: FeedStatus;
  commodityStatus?: FeedStatus;
  pulse?: MarketPulseResult;
} = {}) {
  // Ordering and the collapsed/expanded behaviour live in NgxPriceTable, which
  // also owns the "View All NGX Stocks" control.
  const quotedCount = markets.filter((market) => market.priceNgn !== null).length;

  return (
    <>
    <section id="ngx-markets" className="bg-white py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Markets"
          title="Market at a glance"
          description="Selected Nigerian Exchange equities and global commodity benchmarks, followed by the official Nigerian economic indicators that shape the investment climate."
        />

        <div className="mt-10 grid items-start gap-5 lg:grid-cols-2">
          {/* ---------------------------- Card 1: NGX Stocks ---------------- */}
          <article className="min-w-0 overflow-hidden rounded-2xl border border-star-200 bg-white shadow-[0_4px_18px_rgba(0,59,42,0.04)]">
            <div className="flex items-center gap-3 border-b border-star-200 px-5 py-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-star-100 text-star-700"><BarChart3 size={19} aria-hidden="true" /></span>
              <div className="min-w-0">
                <h3 className="font-display text-lg font-bold text-star-900">NGX Stocks</h3>
                <p className="text-xs leading-5 text-star-muted">
                  {quotedCount > 0 ? `${quotedCount} of ${markets.length} quoted` : `${markets.length} listings`}
                </p>
              </div>
            </div>

            <NgxPriceTable markets={markets} />

            <FeedFootnote
              status={ngxStatus}
              fallback="NGX quotations are waiting for the backend market-data service. No prices are shown rather than showing remembered ones."
            />
          </article>

          {/* ---------------------------- Card 2: Commodities -------------- */}
          <article className="min-w-0 overflow-hidden rounded-2xl border border-star-200 bg-white shadow-[0_4px_18px_rgba(0,59,42,0.04)]">
            <div className="flex items-center gap-3 border-b border-star-200 px-5 py-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fdf4dd] text-[#9a6b00]"><Coins size={19} aria-hidden="true" /></span>
              <div className="min-w-0">
                <h3 className="font-display text-lg font-bold text-star-900">Commodities</h3>
                <p className="text-xs leading-5 text-star-muted">Global benchmarks</p>
              </div>
            </div>

            <div className="min-w-0 overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-left">
                <thead>
                  <tr className="bg-[#f8faf5] text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-star-muted">
                    <th scope="col" className="px-2 py-3 sm:px-3">Commodity</th>
                    <th scope="col" className="w-[24%] px-2 py-3 text-right sm:px-3">Price</th>
                    <th scope="col" className="w-[19%] px-2 py-3 text-right sm:px-3">Daily</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-star-100">
                  {commodities.map((commodity) => (
                    <tr key={commodity.id} className="transition hover:bg-star-50/70">
                      <th scope="row" className="px-2 py-3 text-left sm:px-3">
                        <span className="block text-sm font-bold text-star-900">{commodity.name}</span>
                        <span className="mt-0.5 block text-[0.62rem] font-medium text-star-muted">
                          {commodity.symbol} · {commodity.unitLongLabel}
                        </span>
                      </th>
                      <td className="whitespace-nowrap px-2 py-3 text-right text-[0.8rem] font-semibold tabular-nums text-star-900 sm:px-3 sm:text-sm">
                        {formatUsd(commodity.priceUsd)}
                        <span className="ml-1 block text-[0.6rem] font-medium text-star-muted sm:inline sm:ml-1">{commodity.priceUsd === null ? "" : commodity.currency}</span>
                      </td>
                      <td className={`whitespace-nowrap px-2 py-3 text-right text-[0.8rem] font-bold tabular-nums sm:px-3 sm:text-sm ${changeTone(commodity.changePercent)}`}>{formatChange(commodity.changePercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Verification/provenance for the symbols and units, kept unobtrusive. */}
            <details className="border-t border-star-100 px-5 py-3">
              <summary className="cursor-pointer text-[0.7rem] font-extrabold text-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">
                Symbols and pricing units
              </summary>
              <ul className="mt-2 space-y-1.5">
                {commodityDirectory.map((commodity) => (
                  <li key={commodity.id} className="text-[0.68rem] leading-5 text-star-muted">
                    <span className="font-bold text-star-900">{commodity.name} ({commodity.symbol}, {commodity.exchange})</span> — {commodity.verification}
                  </li>
                ))}
              </ul>
            </details>

            <FeedFootnote
              status={commodityStatus}
              fallback="Commodity prices are not available because no authorised pricing provider is connected."
            />
          </article>

        </div>
      </div>
    </section>
    <MarketPulseSection pulse={pulse} />
    </>
  );
}
