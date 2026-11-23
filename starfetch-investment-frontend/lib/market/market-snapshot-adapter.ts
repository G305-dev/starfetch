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
 * IMPORTANT — INTEGRATION IS PENDING. As of this delivery that route does not
 * exist in the backend (`grep -r "market-snapshot"` over
 * `starfetch-investment-backend/src` returns nothing), so this adapter is
 * defined against the *shape the brief specifies* and is deliberately tolerant:
 * it validates rather than trusts, and it degrades to an explicit unavailable
 * state instead of guessing.
 *
 * The payload type below is the frontend's mirror of the agreed contract. It is
 * isolated in this one file so that when David publishes the final schema, only
 * this file changes — no component, no page, no test outside this module.
 *
 * When David confirms the contract, the checklist is:
 *   1. Replace `NgxSnapshotPayload` with the delivered type.
 *   2. Adjust `readQuotations` field names if they differ.
 *   3. Set `MARKET_SNAPSHOT_INTEGRATION.status` to "live" and delete the
 *      `INTEGRATION PENDING` note from both market panels.
 */

export const MARKET_SNAPSHOT_PATH = "/public/market-snapshot";

export const MARKET_SNAPSHOT_INTEGRATION = {
  status: "pending" as "pending" | "live",
  endpoint: `/api/v1${MARKET_SNAPSHOT_PATH}`,
  owner: "David (backend)",
  contract: "Not yet delivered — see MARKET_DATA_INTEGRATION.md",
} as const;

/**
 * The assumed wire shape. Every field is optional in the parser because the real
 * contract is unconfirmed; a payload that does not match produces an explicit
 * unavailable status rather than fabricated quotes.
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
