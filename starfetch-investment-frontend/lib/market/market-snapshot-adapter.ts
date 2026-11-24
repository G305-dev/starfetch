import type { FeedStatus, NgxQuote } from "./types";
import { directionFromChange } from "./types";
import { formatAsOf } from "./format";
import {
  instantProblemNote,
  readChangePercent,
  readNumber,
  readPrice,
  readQuoteInstant,
} from "./validation";

// Re-exported so existing imports from this module keep working.
export { readNumber, formatAsOf };

/**
 * Adapter for David's backend endpoint:
 *
 *   GET /api/v1/public/market-snapshot
 *
 * Backend contract received from David (NGN Market adapter, b7a4720 baseline).
 * `parseStarfetchMarketSnapshot` implements the actual backend `data.equities[]`
 * envelope with per-equity quote timestamps and delayed-only semantics.
 * `parseNgxSnapshot` remains as a compatibility helper for the original V3.2
 * regression fixtures, but it is not used to parse backend responses.
 *
 * This is CONTRACT-INTEGRATED, not publicly active. The backend feature remains
 * disabled pending redistribution permission and live provider verification.
 */

export const MARKET_SNAPSHOT_PATH = "/public/market-snapshot";

export const MARKET_SNAPSHOT_INTEGRATION = {
  status: "contract-aligned" as "contract-aligned" | "enabled",
  endpoint: `/api/v1${MARKET_SNAPSHOT_PATH}`,
  owner: "David (backend)",
  contract: "David NGN Market backend v1: data.equities[]; delayed only; individual quoteTimestamp",
} as const;

/**
 * Original V3.2 assumed wire shape, retained only to keep historic fixture
 * coverage. Production market loading uses `parseStarfetchMarketSnapshot`.
 */
export type NgxSnapshotPayload = {
  /** ISO instant the provider sampled the quotes. */
  asOf?: string | null;
  /** Provider name for attribution, e.g. "NGN Market". */
  source?: string | null;
  /** True when the provider itself marked the data delayed. */
  delayed?: boolean;
  quotations?: Array<{
    symbol?: string;
    companyName?: string;
    lastPrice?: number | string | null;
    changePercent?: number | string | null;
  }>;
};

export type NgxSnapshotResult = {
  /** Quotes keyed by upper-case symbol; absent symbols are simply not quoted. */
  quotes: Map<string, NgxQuote>;
  status: FeedStatus;
};

const UNAVAILABLE: FeedStatus = {
  state: "unavailable",
  asOf: null,
  asOfLabel: "",
  source: null,
};

/**
 * Age (ms) after which a quote the provider still serves is labelled stale.
 * Chosen to sit outside a single NGX session so an intraday feed is never
 * mislabelled, while a genuinely old cached value is never shown as current.
 */
export const STALE_AFTER_MS = 30 * 60 * 1000;

/**
 * Parses a raw backend payload. Never throws: malformed input yields an
 * unavailable status with a reason, so a provider outage cannot crash the page.
 */
export function parseNgxSnapshot(payload: unknown, now: number = Date.now()): NgxSnapshotResult {
  if (payload === null || typeof payload !== "object") {
    return { quotes: new Map(), status: { ...UNAVAILABLE, note: "The market service returned an unreadable response." } };
  }
  const record = payload as NgxSnapshotPayload & { data?: unknown };
  // Tolerate both a top-level object and a `{ data: ... }` envelope, because the
  // delivered contract is unconfirmed.
  const body = (record.data !== null && typeof record.data === "object" ? record.data : record) as NgxSnapshotPayload;
  const rows = Array.isArray(body.quotations) ? body.quotations : null;

  if (!rows) {
    return { quotes: new Map(), status: { ...UNAVAILABLE, note: "The market service response did not contain quotations." } };
  }

  const quotes = new Map<string, NgxQuote>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const symbol = typeof row.symbol === "string" ? row.symbol.trim().toUpperCase() : "";
    if (!symbol) continue;

    // A quote REQUIRES a real price. A change percentage with no price is not a
    // quote, and neither is a zero or negative price.
    const priceNgn = readPrice(row.lastPrice);
    if (priceNgn === null) continue;
    const changePercent = readChangePercent(row.changePercent);

    quotes.set(symbol, {
      symbol,
      companyName: typeof row.companyName === "string" && row.companyName.trim() ? row.companyName.trim() : symbol,
      priceNgn,
      changePercent,
      direction: directionFromChange(changePercent),
    });
  }

  if (quotes.size === 0) {
    return { quotes, status: { ...UNAVAILABLE, note: "The market service returned no usable quotations." } };
  }

  const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : null;

  /**
   * A `live` status is only ever granted when the provider supplied a timestamp
   * that is present, readable and not in the future. Before this, a payload with
   * no `asOf` at all, or one dated next year, was reported as live — the worst
   * possible failure for a figure a visitor treats as a current price.
   */
  const instant = readQuoteInstant(body.asOf, now);
  /**
   * V3 INTEGRITY RULE: an untrustworthy timestamp invalidates the PRICES, not
   * just the label.
   *
   * V2 returned `unavailable` status while still handing back a populated quote
   * map. Any caller that rendered `result.quotes` directly — and
   * `MarketSection` did exactly that — showed real numbers under an unavailable
   * banner. A price is only meaningful relative to when it was struck; if we
   * cannot establish that, we must not display the price at all.
   *
   * The quotes are therefore DISCARDED here, at the single place every consumer
   * passes through, so no downstream component can accidentally render them.
   */
  if (!instant.ok || instant.iso === null || instant.ageMs === null) {
    return {
      quotes: new Map<string, NgxQuote>(),
      status: {
        state: "unavailable",
        asOf: null,
        asOfLabel: "",
        source,
        note: instantProblemNote(instant.reason ?? "invalid", "The NGX market service"),
        /** Signals to the UI that the feed had figures we deliberately withheld. */
        withheld: true,
      },
    };
  }

  const isStale = instant.ageMs > STALE_AFTER_MS;
  const state: FeedStatus["state"] = isStale ? "stale" : body.delayed ? "delayed" : "live";

  return {
    quotes,
    status: {
      state,
      asOf: instant.iso,
      asOfLabel: formatAsOf(instant.iso),
      source,
      ...(state === "stale" ? { note: "Showing the last quotation the provider returned; newer prices are not available yet." } : {}),
      ...(state === "delayed" ? { note: "The provider marks these quotes as delayed." } : {}),
    },
  };
}

/**
 * Merges the feed onto the project's canonical listing order.
 *
 * The 14 configured equities are ALWAYS the display list, in the existing order,
 * whether or not the feed quotes them. A symbol the feed does not quote renders
 * as an explicit "unavailable" cell — the frontend never substitutes a hardcoded
 * or remembered price.
 */
export function mergeNgxQuotes(
  directory: ReadonlyArray<{ symbol: string; companyName: string }>,
  quotes: Map<string, NgxQuote>,
): NgxQuote[] {
  return directory.map((listing) => {
    const quoted = quotes.get(listing.symbol.toUpperCase());
    return quoted ?? {
      symbol: listing.symbol,
      companyName: listing.companyName,
      priceNgn: null,
      changePercent: null,
      direction: "unknown" as const,
    };
  });
}


/**
 * David's delivered Starfetch backend contract (not the raw NGN Market API).
 * It is served inside the standard `{data, meta}` response envelope.
 * In particular, `cache.refreshedAt` and `generatedAt` are NOT quotation dates.
 */
type StarfetchEquityRow = {
  symbol?: unknown;
  companyName?: unknown;
  lastPriceNgn?: unknown;
  dailyChangePercent?: unknown;
  quoteTimestamp?: unknown;
  available?: unknown;
  unavailableReason?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Never display stock prices older than one week, even if the backend cache is new. */
export const MAX_NGX_QUOTE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Strict parser for `GET /api/v1/public/market-snapshot` from David's backend.
 * - Requires its actual enveloped, delayed-only contract.
 * - Only `available:true` with a positive price and provider quotation time
 *   can contribute a quote; an invalid row never poisons another valid row.
 * - Rejects per-row future or unreadable timestamps, or values over 7 days old.
 * - Duplicate symbols are withheld rather than choosing the first price.
 * - The shared 'As of' is the OLDEST displayed quote time, never the more-recent
 *   Starfetch cache refresh time (individual rows may have later timestamps).
 * - If the backend marks the cache stale, the frontend cannot call it current.
 * - The NGN Market attribution is required and forwarded to the UI.
 */
export function parseStarfetchMarketSnapshot(payload: unknown, now: number = Date.now()): NgxSnapshotResult {
  const unavailable = (note: string, withheld = false): NgxSnapshotResult => ({
    quotes: new Map<string, NgxQuote>(),
    status: { ...UNAVAILABLE, note, ...(withheld ? { withheld: true } : {}) },
  });

  if (!isRecord(payload) || !isRecord(payload.data)) {
    return unavailable("The NGX market service returned an unexpected response envelope.");
  }
  const body = payload.data;
  if ((body.status !== "ok" && body.status !== "stale") || body.dataType !== "delayed" ||
      !Array.isArray(body.equities) || body.equities.length > 200 ||
      !isRecord(body.provider) || !isRecord(body.cache) ||
      typeof body.cache.isStale !== "boolean") {
    return unavailable("The NGX market service response does not match its published contract.");
  }

  const attribution = body.provider.attribution;
  if (typeof attribution !== "string" || !attribution.trim() || !/NGN Market/i.test(attribution)) {
    return unavailable("NGX data attribution is unavailable; prices cannot be published.");
  }
  const source = attribution.trim();
  const quotes = new Map<string, NgxQuote>();
  const quoteTimes = new Map<string, number>();
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  let invalidTimes = 0;

  for (const candidate of body.equities) {
    if (!isRecord(candidate) || typeof candidate.symbol !== "string") continue;
    const row = candidate as StarfetchEquityRow;
    const symbol = candidate.symbol.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,24}$/.test(symbol)) continue;
    if (seen.has(symbol)) {
      duplicates.add(symbol);
      quotes.delete(symbol);
      quoteTimes.delete(symbol);
      continue;
    }
    seen.add(symbol);
    if (row.available !== true || row.unavailableReason !== null) continue;
    // The backend wire contract specifies numeric prices and changes, not
    // arbitrarily formatted strings or display-ready currency values.
    const priceNgn = typeof row.lastPriceNgn === "number" ? readPrice(row.lastPriceNgn) : null;
    if (priceNgn === null) continue;

    const instant = readQuoteInstant(row.quoteTimestamp, now);
    if (!instant.ok || instant.ageMs === null || instant.iso === null || instant.ageMs > MAX_NGX_QUOTE_AGE_MS) {
      invalidTimes++;
      continue;
    }
    const changePercent = row.dailyChangePercent === null
      ? null
      : typeof row.dailyChangePercent === "number" ? readChangePercent(row.dailyChangePercent) : null;
    quotes.set(symbol, {
      symbol,
      companyName: typeof row.companyName === "string" && row.companyName.trim() ? row.companyName.trim() : symbol,
      priceNgn,
      changePercent,
      direction: directionFromChange(changePercent),
    });
    quoteTimes.set(symbol, now - instant.ageMs);
  }

  if (quotes.size === 0) {
    return {
      quotes,
      status: {
        ...UNAVAILABLE,
        source,
        note: invalidTimes > 0
          ? "NGX quotations were withheld because their provider timestamps were invalid, in the future, or too old."
          : duplicates.size > 0
            ? "NGX market data contained duplicate symbols; prices were withheld."
            : "The NGX market service returned no usable quotations.",
        ...(invalidTimes > 0 || duplicates.size > 0 ? { withheld: true } : {}),
      },
    };
  }

  // Global banner must never use `generatedAt` or `cache.refreshedAt` as
  // quotation time; they record backend processing, not trading.
  const oldestQuoteMs = Math.min(...quoteTimes.values());
  const asOf = new Date(oldestQuoteMs).toISOString();
  const cacheStale = body.status === "stale" || body.cache.isStale === true;
  const isStale = cacheStale || now - oldestQuoteMs > STALE_AFTER_MS;
  const state: FeedStatus["state"] = isStale ? "stale" : "delayed";

  return {
    quotes,
    status: {
      state,
      asOf,
      asOfLabel: formatAsOf(asOf),
      source,
      note: isStale
        ? "Delayed NGX data: at least one displayed quotation is old, or the backend cache is stale. The 'As of' time is the oldest displayed quote."
        : "Delayed NGX data. The 'As of' time is the oldest displayed quote; individual quotations may be newer.",
      ...(invalidTimes > 0 || duplicates.size > 0 ? { withheld: true } : {}),
    },
  };
}
