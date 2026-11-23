import type { CommodityQuote, FeedStatus, NgxQuote } from "@/lib/market/types";
import { CommodityTickerCell, NgxTickerCell } from "./MarketTickerItem";

/**
 * The homepage's ONE unified market strip: NGX equities and global commodities
 * in a single continuous scrolling track.
 *
 * Reuses the existing `.ngx-market-*` slider CSS (continuous loop, pause on
 * hover, reduced-motion stop) rather than adding a second animation mechanism.
 *
 * The track renders the item sequence TWICE. The keyframes translate by -50%,
 * so the duplicate pass must be exactly half the track — which holds because both
 * passes render the identical cell sequence.
 */

function TrackPass({
  markets,
  commodities,
  duplicate,
}: {
  markets: readonly NgxQuote[];
  commodities: readonly CommodityQuote[];
  duplicate?: boolean;
}) {
  return (
    <ul className="ngx-market-slider-group" aria-hidden={duplicate || undefined}>
      {markets.map((market) => (
        <NgxTickerCell key={`${duplicate ? "copy-" : ""}${market.symbol}`} quote={market} duplicate={duplicate} />
      ))}
      {commodities.map((commodity) => (
        <CommodityTickerCell
          key={`${duplicate ? "copy-" : ""}commodity-${commodity.id}`}
          quote={commodity}
          duplicate={duplicate}
        />
      ))}
    </ul>
  );
}

type StatusBadge = {
  /** Very short label that fits the 132px mobile marker column. */
  short: string;
  /** Longer wording for the desktop column and the screen-reader summary. */
  long: string;
  /** Drives the dot colour so the two feeds are distinguishable at a glance. */
  tone: "live" | "delayed" | "stale" | "unavailable";
};

/**
 * Describes ONE feed's availability on its own terms.
 *
 * V1 computed a single strip label from the NGX status alone, so an unavailable
 * commodity feed was invisible whenever NGX happened to be up — the strip said
 * "Live · NGN Market" while half its cells showed "Unavailable". Each feed now
 * reports itself, and both reports are always rendered.
 */
function describeFeed(status: FeedStatus, source: string | null): StatusBadge {
  switch (status.state) {
    case "live":
      return { short: "Live", long: source ? `Live · ${source}` : "Live quotes", tone: "live" };
    case "delayed":
      return { short: "Delayed", long: "Delayed quotes", tone: "delayed" };
    case "stale":
      return {
        short: "Stale",
        long: `${source ?? "Provider"} · last reported ${status.asOfLabel || "time unknown"}`,
        tone: "stale",
      };
    default:
      // Distinguish "the provider sent figures we refused to show" from "we never
      // received any". Both render no prices; the wording is what differs.
      return status.withheld
        ? { short: "Held", long: "Prices withheld — untrustworthy timestamp", tone: "unavailable" }
        : { short: "N/A", long: "Unavailable", tone: "unavailable" };
  }
}

const DOT_TONE: Record<StatusBadge["tone"], string> = {
  live: "bg-star-lime",
  delayed: "bg-amber-300",
  stale: "bg-amber-400",
  unavailable: "bg-white/35",
};

function FeedLine({ label, badge }: { label: string; badge: StatusBadge }) {
  return (
    <span className="flex items-center gap-1.5 leading-tight">
      <span className={`inline-block size-1.5 shrink-0 rounded-full ${DOT_TONE[badge.tone]}`} aria-hidden="true" />
      <span className="text-[0.53rem] font-extrabold uppercase tracking-[0.1em] text-star-lime">{label}</span>
      <span className="truncate text-[0.56rem] font-semibold text-star-100" title={badge.long}>
        {badge.short}
      </span>
    </span>
  );
}

export function NgxMarketTicker({
  markets,
  commodities,
  ngxStatus,
  commodityStatus,
}: {
  markets: readonly NgxQuote[];
  commodities: readonly CommodityQuote[];
  ngxStatus: FeedStatus;
  commodityStatus: FeedStatus;
}) {
  const hasAnyCell = markets.length > 0 || commodities.length > 0;
  const ngxBadge = describeFeed(ngxStatus, ngxStatus.source);
  const commodityBadge = describeFeed(commodityStatus, commodityStatus.source);

  /**
   * The strip is only "fully live" when BOTH feeds are. This is the single
   * coarse signal for anyone scanning the page; the per-feed lines below carry
   * the detail.
   */
  const allLive = ngxStatus.state === "live" && commodityStatus.state === "live";

  return (
    <section
      aria-label="Nigerian Exchange and global commodity market ticker"
      className="ngx-market-strip relative z-0 w-full overflow-hidden border-b border-star-200 bg-white"
      data-ngx-state={ngxStatus.state}
      data-commodity-state={commodityStatus.state}
    >
      <div className="flex min-h-[58px] w-full">
        {/* Category marker: dark-green block listing BOTH feeds' availability. */}
        <div className="z-10 flex w-[150px] shrink-0 flex-col justify-center gap-1 bg-star-900 px-3 py-1.5 text-white shadow-[5px_0_12px_rgba(0,59,42,0.18)] sm:w-[230px] sm:px-5">
          <span className="text-[0.55rem] font-extrabold uppercase tracking-[0.13em] text-star-lime">
            NGX · Commodities
          </span>
          <FeedLine label="NGX" badge={ngxBadge} />
          <FeedLine label="Cmdty" badge={commodityBadge} />
        </div>

        <div className="ngx-market-slider-viewport min-w-0 flex-1 bg-star-900" aria-live="off">
          {hasAnyCell ? (
            <div className="ngx-market-slider-track">
              <TrackPass markets={markets} commodities={commodities} />
              <TrackPass markets={markets} commodities={commodities} duplicate />
            </div>
          ) : (
            <div className="flex h-[58px] items-center px-5 text-sm font-semibold text-star-100">
              Market listings will appear here when the data feed is connected.
            </div>
          )}
        </div>
      </div>

      <p className="sr-only">
        A single moving list of {markets.length} Nigerian Exchange equities and {commodities.length} global commodities.
        {" "}NGX data: {ngxBadge.long}
        {ngxStatus.state === "unavailable" && ngxStatus.note ? ` — ${ngxStatus.note}` : ""}.
        {" "}Commodity data: {commodityBadge.long}
        {commodityStatus.state === "unavailable" && commodityStatus.note ? ` — ${commodityStatus.note}` : ""}.
        {" "}Overall: {allLive ? "both feeds are current" : "one or both feeds are not current"}.
        This strip is not a live trading feed.
      </p>
    </section>
  );
}
