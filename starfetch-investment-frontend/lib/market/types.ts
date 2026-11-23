/**
 * Market-data types shared by the homepage adapter and both market panels.
 *
 * These are the FRONTEND's display types. `NgxSnapshotPayload` in
 * `market-snapshot-adapter.ts` is the separately-versioned mirror of David's
 * backend contract; nothing here assumes a wire format.
 */

/** A price cell that is either a real value or an explicit unavailable state. */
export type QuoteValue = number | null;

export type MarketDirection = "up" | "down" | "flat" | "unknown";

/**
 * Freshness of the data actually being displayed.
 *
 * - `live`        data from the provider within its declared tolerance
 * - `delayed`     provider flagged the quote as delayed
 * - `stale`       a genuine earlier quote is being shown; timestamp is accurate
 * - `unavailable` no authoritative value exists — never filled with a guess
 */
export type FreshnessState = "live" | "delayed" | "stale" | "unavailable";

export type NgxQuote = {
  symbol: string;
  companyName: string;
  priceNgn: QuoteValue;
  changePercent: QuoteValue;
  direction: MarketDirection;
};

export type CommodityQuote = {
  /** Stable frontend id, e.g. `gold`. */
  id: string;
  name: string;
  /** Verified exchange symbol, e.g. `GC`. */
  symbol: string;
  exchange: string;
  priceUsd: QuoteValue;
  changePercent: QuoteValue;
  direction: MarketDirection;
  /** ISO 4217 code of the quoted price, e.g. `USD`. */
  currency: string;
  /** Short unit shown next to the price, e.g. `per troy oz`. */
  unitLabel: string;
  /** Full unit worded for the table/legend, e.g. `USD per troy ounce`. */
  unitLongLabel: string;
};

/** A single figure on the shared freshness banner. */
export type FeedStatus = {
  state: FreshnessState;
  /** ISO instant of the provider's own timestamp, when one exists. */
  asOf: string | null;
  /** Human label for that timestamp, pre-formatted for stable hydration. */
  asOfLabel: string;
  /** Provider/source name for attribution. */
  source: string | null;
  /** Present only for `unavailable`/`stale`; user-facing explanation. */
  note?: string;
  /**
   * True when the feed DID supply figures but they were withheld because their
   * timestamp could not be trusted. Lets the UI say "prices withheld" rather than
   * the vaguer "unavailable", without ever exposing the values.
   */
  withheld?: boolean;
};

export type MarketSnapshot = {
  ngx: NgxQuote[];
  ngxStatus: FeedStatus;
  commodities: CommodityQuote[];
  commodityStatus: FeedStatus;
};

export function directionFromChange(change: QuoteValue): MarketDirection {
  if (change === null || !Number.isFinite(change)) return "unknown";
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}
