import type { CommodityQuote, FeedStatus, NgxQuote } from "./types";

/**
 * FINAL SAFETY GATE between feed data and the UI.
 *
 * The adapters already discard their quotes when a timestamp is untrustworthy
 * (V3). This is the last defence at the boundary where data becomes props: if a
 * feed is `unavailable`, no quote VALUE may reach a component, whatever a future
 * adapter change happens to return.
 *
 * It lives in `lib/` rather than beside the server component so it is testable in
 * isolation, without dragging Next's server-only fetch options into a test
 * compiler.
 *
 * Row identities are preserved — all 14 equities and all 4 commodities still
 * render, so the tables and ticker stay structurally complete. Only the prices,
 * changes and directions are stripped.
 */

export function withholdIfUnavailable(quotes: readonly NgxQuote[], status: FeedStatus): NgxQuote[];
export function withholdIfUnavailable(
  quotes: readonly CommodityQuote[],
  status: FeedStatus,
): CommodityQuote[];
export function withholdIfUnavailable(
  quotes: readonly (NgxQuote | CommodityQuote)[],
  status: FeedStatus,
): (NgxQuote | CommodityQuote)[] {
  if (status.state !== "unavailable") return [...quotes];
  return quotes.map((quote) =>
    "priceNgn" in quote
      ? { ...quote, priceNgn: null, changePercent: null, direction: "unknown" as const }
      : { ...quote, priceUsd: null, changePercent: null, direction: "unknown" as const },
  );
}
