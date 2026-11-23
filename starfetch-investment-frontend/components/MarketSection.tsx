import { cache } from "react";
import { MarketOverview } from "./MarketOverview";
import { loadCommodityFeed } from "@/lib/market/commodity-adapter";
import { loadMarketPulse } from "@/lib/market/market-pulse";
import { mergeNgxQuotes, parseNgxSnapshot, MARKET_SNAPSHOT_INTEGRATION } from "@/lib/market/market-snapshot-adapter";
import type { CommodityQuote, FeedStatus, NgxQuote } from "@/lib/market/types";
import { featuredNgxEquities } from "./ngx-market-directory";
import { withholdIfUnavailable } from "@/lib/market/withhold";

/**
 * Server component that owns the Market at a Glance data loading.
 *
 * WHY THIS EXISTS AS A SEPARATE COMPONENT:
 * V2 needs a real loading state. A `<Suspense>` boundary around `<MarketOverview>`
 * does nothing if the parent page `await`s the data BEFORE returning its tree —
 * React never gets a chance to render the fallback, because the JSX does not
 * exist yet. That was the V1 `<Suspense>` mistake: the fallback was unreachable
 * dead markup.
 *
 * Moving the `await`s into this component makes the boundary meaningful: the
 * page renders immediately, streams the shell, and this component resolves on
 * the server while the visitor already has a responsive page in front of them.
 *
 * `loadMarketSection` is exported separately so the behaviour is testable without
 * rendering React.
 */

/** Upper bound on the backend market request, mirroring the commodity feed. */
const NGX_TIMEOUT_MS = 8_000;

export type MarketSectionData = {
  markets: NgxQuote[];
  commodities: CommodityQuote[];
  ngxStatus: FeedStatus;
  commodityStatus: FeedStatus;
  pulse: Awaited<ReturnType<typeof loadMarketPulse>>;
};

/**
 * Loads NGX quotations from David's backend endpoint.
 *
 * While integration is pending the route does not exist, so this resolves to an
 * explicit `unavailable` status. Every failure mode — missing origin, non-2xx,
 * timeout, malformed body — produces the same honest unavailable state: the page
 * always renders, and no price is ever invented or read from an old hardcoded
 * value.
 */
async function loadNgxQuotes(): Promise<{ quotes: NgxQuote[]; status: FeedStatus }> {
  const unavailable = (note: string) => ({
    quotes: mergeNgxQuotes(featuredNgxEquities, new Map()),
    status: { state: "unavailable" as const, asOf: null, asOfLabel: "", source: null, note },
  });

  const base = process.env.BACKEND_API_ORIGIN?.replace(/\/+$/, "");
  if (!base) {
    return unavailable("NGX quotations are waiting for the backend market-data service to be connected.");
  }

  try {
    const response = await fetch(`${base}/api/v1${MARKET_SNAPSHOT_INTEGRATION.endpoint.replace("/api/v1", "")}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 120 },
      // Never let a slow provider hold the page open. Matches the commodity
      // feed's bound so neither feed can outlast the other by much.
      signal: AbortSignal.timeout(NGX_TIMEOUT_MS),
    });
    if (!response.ok) {
      return unavailable(`The NGX market-data service is not responding right now (HTTP ${response.status}).`);
    }
    const parsed = parseNgxSnapshot(await response.json());
    return { quotes: mergeNgxQuotes(featuredNgxEquities, parsed.quotes), status: parsed.status };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return unavailable(
      timedOut
        ? `The NGX market-data service did not respond within ${NGX_TIMEOUT_MS / 1000} seconds, so prices are not shown.`
        : "The NGX market-data service could not be reached.",
    );
  }
}

/**
 * Loads all three feeds. None can reject: each returns an explicit unavailable
 * result, so the market section can never break the homepage.
 *
 * Wrapped in React's `cache()` because the ticker and the at-a-glance section
 * are separate Suspense boundaries that each need the same data. Without this
 * the page would issue two identical NGX requests and two identical provider
 * requests per render.
 */
export const loadMarketSection = cache(async (): Promise<MarketSectionData> => {
  const [ngx, commodityFeed, pulse] = await Promise.all([
    loadNgxQuotes(),
    loadCommodityFeed(),
    loadMarketPulse(),
  ]);
  return {
    markets: ngx.quotes,
    commodities: commodityFeed.quotes,
    ngxStatus: ngx.status,
    commodityStatus: commodityFeed.status,
    pulse,
  };
});

export async function MarketSection() {
  const data = await loadMarketSection();
  return (
    <MarketOverview
      markets={data.markets}
      commodities={data.commodities}
      ngxStatus={data.ngxStatus}
      commodityStatus={data.commodityStatus}
      pulse={data.pulse}
    />
  );
}
