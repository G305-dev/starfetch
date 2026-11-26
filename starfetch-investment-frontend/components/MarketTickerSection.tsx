import { NgxMarketTicker } from "./NgxMarketTicker";
import { loadMarketSection } from "./MarketSection";

/**
 * Server component owning the unified ticker's data.
 *
 * The ticker sits above the hero, so it is separated from the Market at a Glance
 * section: the market feed must not delay the strip, and vice versa. Each is its
 * own Suspense boundary in `app/page.tsx`.
 *
 * The ticker is equities-only. `loadMarketSection` is still the shared cached
 * loader, so this boundary and the at-a-glance section issue ONE upstream request
 * between them, not two.
 */
export async function MarketTickerSection() {
  const data = await loadMarketSection();
  return <NgxMarketTicker markets={data.markets} ngxStatus={data.ngxStatus} />;
}
