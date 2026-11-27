import type { FeedStatus, NgxQuote } from "@/lib/market/types";
import { NgxTickerCell } from "./MarketTickerItem";

/**
 * The homepage's scrolling market strip: Nigerian and international equities
 * quoted on the NGX, in one continuous track.
 *
 * DESIGN (V4): pure white background, Starfetch dark green for symbol and price,
 * green/red reserved for the daily change. The old strip was a dark-green band;
 * the redesign keeps the same motion and geometry so nothing below it moves.
 *
 * Reuses the existing `.ngx-market-*` slider CSS (continuous loop, pause on
 * hover, reduced-motion stop) rather than adding a second animation mechanism —
 * the animation, its 52s duration and the `-50%` keyframe are untouched.
 *
 * The track renders the item sequence TWICE. The keyframes translate by -50%,
 * so the duplicate pass must be exactly half the track — which holds because both
 * passes render the identical cell sequence.
 */

function TrackPass({
  markets,
  duplicate,
}: {
  markets: readonly NgxQuote[];
  duplicate?: boolean;
}) {
  return (
    <ul className="ngx-market-slider-group" aria-hidden={duplicate || undefined}>
      {markets.map((market) => (
        <NgxTickerCell key={`${duplicate ? "copy-" : ""}${market.symbol}`} quote={market} duplicate={duplicate} />
      ))}
    </ul>
  );
}

/**
 * The feed's state as words only.
 *
 * The V4 marker showed a coloured dot and a short word ("Live", "N/A", "Held") in
 * the dark block. V5 removed the block, so the visual badge has no home — but the
 * information must not vanish with it, because "are these prices current?" is the
 * first thing anyone reading a quote strip needs to know. The wording now goes
 * into the screen-reader summary, and the visible state lives in the data
 * attribute plus the per-card footnote further down the page.
 *
 * `short` is kept as the honest one-word verdict, since "Held" (we received prices
 * and refused them) and "N/A" (we never received any) are materially different.
 */
function describeFeed(status: FeedStatus, source: string | null): { short: string; long: string } {
  switch (status.state) {
    case "live":
      return { short: "Live", long: source ? `Live · ${source}` : "Live quotes" };
    case "delayed":
      return { short: "Delayed", long: "Delayed quotes" };
    case "stale":
      return {
        short: "Stale",
        long: `${source ?? "Provider"} · last reported ${status.asOfLabel || "time unknown"}`,
      };
    default:
      // Distinguish "the provider sent figures we refused to show" from "we never
      // received any". Both render no prices; the wording is what differs.
      return status.withheld
        ? { short: "Held", long: "Prices withheld — untrustworthy timestamp" }
        : { short: "N/A", long: "Unavailable" };
  }
}

export function NgxMarketTicker({
  markets,
  ngxStatus,
}: {
  markets: readonly NgxQuote[];
  ngxStatus: FeedStatus;
}) {
  const hasAnyCell = markets.length > 0;
  const ngxBadge = describeFeed(ngxStatus, ngxStatus.source);

  return (
    <section
      aria-label="Nigerian and international stock market ticker"
      className="ngx-market-strip relative z-0 w-full overflow-hidden border-b border-star-200 bg-white"
      data-ngx-state={ngxStatus.state}
    >
      {/*
        FULL-WIDTH TRACK (V5). The fixed dark-green marker block that used to sit
        here — the "NGX · STOCKS" label and its per-feed status word — has been
        removed outright, not merely recoloured. It also took its shadow, its
        fixed 124px/190px width, its z-10 stacking and its inner padding with it,
        so nothing is left offsetting the track.

        The viewport now starts at the left edge of the screen and the cells run
        the entire width. The strip's own bottom border stays: it separates the
        ticker from the hero rather than belonging to the removed block.
      */}
      <div className="ngx-market-slider-viewport min-h-[58px] w-full bg-white" aria-live="off">
        {hasAnyCell ? (
          <div className="ngx-market-slider-track">
            <TrackPass markets={markets} />
            <TrackPass markets={markets} duplicate />
          </div>
        ) : (
          <div className="flex h-[58px] items-center justify-center px-5 text-sm font-semibold text-star-muted">
            Market listings will appear here when the data feed is connected.
          </div>
        )}
      </div>

      {/*
        The visible badge is gone, so the state has to be stated here in words.
        `short` is the one-word verdict — "Live", "Delayed", "Stale", "N/A", "Held"
        — and it is genuinely load-bearing rather than decorative: without it a
        screen-reader user gets "NGX data: NGN Market · last reported 10:00 WAT"
        with no indication that those prices are stale, and "Held" (we received
        prices and refused them) would be indistinguishable from having none.
      */}
      <p className="sr-only">
        A single moving list of {markets.length} Nigerian and international equities quoted on the Nigerian Exchange.
        {" "}NGX data: {ngxBadge.short} — {ngxBadge.long}
        {ngxStatus.state === "unavailable" && ngxStatus.note ? ` — ${ngxStatus.note}` : ""}.
        This strip is not a live trading feed.
      </p>
    </section>
  );
}
