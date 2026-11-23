import { NgxMarketTicker } from "./NgxMarketTicker";
import { loadMarketSection } from "./MarketSection";

/**
 * Server component owning the unified ticker's data.
 *
 * The ticker sits above the hero, so it is separated from the Market at a Glance
 * section: a slow commodity provider must not delay the strip, and vice versa.
 * Each is its own Suspense boundary in `app/page.tsx`.
 */
export async function MarketTickerSection() {
  const data = await loadMarketSection();
  return (
    <NgxMarketTicker
      markets={data.markets}
      commodities={data.commodities}
      ngxStatus={data.ngxStatus}
      commodityStatus={data.commodityStatus}
    />
  );
}
