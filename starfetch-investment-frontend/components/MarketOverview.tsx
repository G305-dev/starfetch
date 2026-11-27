import { BarChart3, Database } from "lucide-react";
import { SectionHeading } from "./ui";
import { NgxPriceTable } from "./NgxPriceTable";
import type { MarketPulseResult } from "@/lib/market/market-pulse";
import { MarketPulseSection } from "./MarketPulseSection";
import type { FeedStatus, NgxQuote } from "@/lib/market/types";

/** Small, unobtrusive freshness line for the quote card. */
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

const DEFAULT_PULSE: MarketPulseResult = {
  status: "unavailable",
  note: "Market Pulse indicators are not available.",
};

export function MarketOverview({
  markets = [],
  ngxStatus = DEFAULT_NGX_STATUS,
  pulse = DEFAULT_PULSE,
}: {
  markets?: readonly NgxQuote[];
  ngxStatus?: FeedStatus;
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
          description="Selected Nigerian and international equities quoted on the Nigerian Exchange, followed by the official Nigerian economic indicators that shape the investment climate."
        />

        <div className="mt-10">
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
        </div>
      </div>
    </section>
    <MarketPulseSection pulse={pulse} />
    </>
  );
}
