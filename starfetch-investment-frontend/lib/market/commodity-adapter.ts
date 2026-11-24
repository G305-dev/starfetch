import {
  acceptedSymbols,
  approvedProviderIds,
  commodityDirectory,
  rejectedSymbols,
  type CommodityDefinition,
} from "./commodity-directory";
import { formatAsOf } from "./format";
import { STALE_AFTER_MS } from "./market-snapshot-adapter";
import { directionFromChange, type CommodityQuote, type FeedStatus, type QuoteValue } from "./types";
import { instantProblemNote, readChangePercent, readPrice, readQuoteInstant } from "./validation";

/**
 * Commodity prices — NO PROVIDER IS CONFIGURED.
 *
 * The brief forbids extracting values from TradingView widgets (and that would
 * breach their terms), and requires a permitted pricing API or an authorised
 * feed. No such feed has been approved or paid for, and this delivery must not
 * add a paid service unilaterally. So:
 *
 *   - the adapter below is the integration point;
 *   - with no provider configured it returns an explicit `unavailable` status;
 *   - every commodity renders with an honest "unavailable" cell;
 *   - NO PRICE IS EVER INVENTED, and the mockup's design values are not used as
 *     data.
 *
 * To go live, set the two environment variables below and (if the response shape
 * differs) extend `readProviderQuotes`. Nothing else in the app changes.
 */

/** Server-only. Never exposed to the browser (no NEXT_PUBLIC_ prefix). */
export const COMMODITY_FEED_URL_ENV = "COMMODITY_FEED_URL";
/** Server-only. Sent as a bearer token; never leaves the server. */
export const COMMODITY_FEED_TOKEN_ENV = "COMMODITY_FEED_TOKEN";

export type CommodityFeedConfig = {
  url: string;
  token: string;
};

/**
 * Upper bound on the provider request.
 *
 * A marketing homepage must never be held open by a third-party feed. Eight
 * seconds is generous for a JSON quote endpoint and still short enough that a
 * hung provider degrades to the unavailable state rather than stalling the page.
 * Override only if a specific provider is measured to need longer.
 */
export const COMMODITY_FEED_TIMEOUT_MS = 8_000;

/** Reads provider configuration from the server environment only. */
export function readCommodityFeedConfig(env: NodeJS.ProcessEnv = process.env): CommodityFeedConfig | null {
  const url = env[COMMODITY_FEED_URL_ENV];
  const token = env[COMMODITY_FEED_TOKEN_ENV];
  if (!url || !token) return null;
  // Only https endpoints are accepted so a credential is never sent in clear.
  if (!/^https:\/\//i.test(url)) return null;
  return { url, token };
}

export const COMMODITIES_UNAVAILABLE_NOTE =
  "Commodity prices are not shown because no authorised commodity pricing provider is connected yet. Values are never estimated or copied from third-party widgets.";

export function unavailableCommodityStatus(note: string = COMMODITIES_UNAVAILABLE_NOTE): FeedStatus {
  return { state: "unavailable", asOf: null, asOfLabel: "", source: null, note };
}

/** Commodities with no price; used whenever no authorised feed is available. */
export function unquotedCommodities(): CommodityQuote[] {
  return commodityDirectory.map((commodity) => ({
    id: commodity.id,
    name: commodity.name,
    symbol: commodity.symbol,
    exchange: commodity.exchange,
    priceUsd: null,
    changePercent: null,
    direction: "unknown" as const,
    currency: commodity.currency,
    unitLabel: commodity.unitLabel,
    unitLongLabel: commodity.unitLongLabel,
  }));
}

export type CommodityFeedResult = {
  quotes: CommodityQuote[];
  status: FeedStatus;
  /**
   * Provider rows that were recognised but DELIBERATELY refused, because the
   * symbol denotes a different contract (e.g. NYMEX `BZ` for the ICE Brent row).
   * Surfaced so an integrator can see why a price is missing instead of assuming
   * the provider sent nothing.
   */
  refused?: Array<{ symbol: string; commodityId: string; reason: string }>;
};

type CommodityRefusal = { symbol: string; commodityId: string; reason: string };

type RowResolution = { row?: ProviderQuoteRow; refusal?: CommodityRefusal };

/**
 * Whether a symbol is approved for a DIFFERENT commodity row. Such a quotation
 * is a legitimate quote for another instrument, not a misidentification, so it is
 * skipped without being reported as a refusal.
 */
function approvedSymbolElsewhere(symbol: string, exceptId: string): boolean {
  return commodityDirectory.some(
    (other) => other.id !== exceptId && acceptedSymbols(other).includes(symbol),
  );
}

/**
 * Whether a symbol is a RECOGNISED but refused mapping for a different row.
 * `BZ` is a known NYMEX Brent contract, so it must be reported once, against the
 * Brent row it was offered for — not repeated as "unrecognised" against gold,
 * silver and cocoa, where it was never a candidate.
 */
function rejectedElsewhere(symbol: string, exceptId: string): boolean {
  return commodityDirectory.some(
    (other) =>
      other.id !== exceptId &&
      rejectedSymbols(other).some((mapping) => mapping.symbol.toUpperCase() === symbol),
  );
}

/** Normalises a provider field to a trimmed upper-case token, or null. */
function token(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

/**
 * Resolves ONE provider quotation onto ONE commodity row.
 *
 * V3.1 — why this is not a simple key lookup.
 *
 * V3 indexed every quotation under both its `id` and its `symbol`, then looked
 * the commodity's accepted symbols up in that index. That was wrong: `id` is a
 * GENERIC label ("brent", "gold"), not a ticker. A quotation with
 * `id: "brent", symbol: "BZ"` matched on the generic id and populated the ICE
 * Brent row with a NYMEX price; `id: "brent", symbol: "UNKNOWN"` was accepted for
 * the same reason. A generic identifier must never override a conflicting,
 * unapproved or unknown instrument symbol.
 *
 * The rules below are deliberately conservative — when identification is
 * ambiguous the row is left unpriced and the refusal is reported:
 *
 *  1. `symbol`, when supplied, is authoritative. It must be an APPROVED symbol
 *     for this commodity. Anything else — a different contract, an unconfirmed
 *     spelling, an unknown token — rejects the quotation. This holds even when
 *     `id` matches, because a generic label cannot vouch for a bad ticker.
 *  2. `id`, when supplied, must AGREE with `symbol` when both are present.
 *  3. An `id`-only quotation is accepted ONLY when that exact identifier is
 *     approved for the configured provider (`approvedProviderIds`). No provider
 *     is approved for id-only identification today, so id-only quotations are
 *     refused and reported rather than guessed at.
 *  4. Neither field supplied — nothing identifies the instrument. Ignored.
 *
 * Exactly one quotation may populate a row. Two quotations that both claim it
 * (e.g. a valid ICE `B` and a conflicting NYMEX `BZ`, or two different prices
 * under the same approved symbol) is an ambiguous feed, so the row is withheld
 * rather than resolved by picking a winner arbitrarily.
 */
function resolveCommodityRow(
  commodity: CommodityDefinition,
  rows: readonly ProviderQuoteRow[],
  report: (refusal: CommodityRefusal) => void,
): RowResolution {
  const approved = new Set(acceptedSymbols(commodity));
  const approvedIds = new Set(approvedProviderIds(commodity));
  const rejected = new Map(
    rejectedSymbols(commodity).map((mapping) => [mapping.symbol.toUpperCase(), mapping]),
  );

  const claimants: ProviderQuoteRow[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const symbol = token(row.symbol);
    const id = token(row.id);
    if (!symbol && !id) continue;

    // Rule 1: a supplied symbol must be approved for this row, in full.
    if (symbol && !approved.has(symbol)) {
      const mapping = rejected.get(symbol);
      if (mapping) {
        // Recognised and deliberately different — report why.
        report({ symbol: mapping.symbol, commodityId: commodity.id, reason: mapping.note });
      } else if (approvedSymbolElsewhere(symbol, commodity.id) || rejectedElsewhere(symbol, commodity.id)) {
        // A symbol belonging to another row — either a legitimate quote for
        // another instrument, or a contract already refused on its own row.
        // Reported there, not here, so one bad quotation produces one refusal.
        continue;
      } else {
        report({
          symbol,
          commodityId: commodity.id,
          reason: `Unrecognised instrument symbol "${symbol}". It cannot identify this row; identification must come from an approved exchange symbol or a provider mapping confirmed against the provider's own documentation.`,
        });
      }
      continue;
    }

    if (symbol) {
      // Rule 2: when both are supplied, the generic id must agree with the ticker.
      // Agreement means the id is either this commodity's own id or one of the
      // symbols approved for it.
      if (id && !(id === commodity.id.toUpperCase() || approved.has(id))) {
        report({
          symbol,
          commodityId: commodity.id,
          reason: `Conflicting identification: symbol "${symbol}" is approved for this row but id "${id}" is not. A quotation whose identifying fields disagree cannot be trusted.`,
        });
        continue;
      }
      claimants.push(row);
      continue;
    }

    // Rules 3 & 4: id-only. Accepted solely when the provider is approved to
    // publish generic labels for this row.
    if (id && approvedIds.has(id)) {
      claimants.push(row);
      continue;
    }
    report({
      symbol: id as string,
      commodityId: commodity.id,
      reason: `Quotation identified only by id "${id}". A generic id cannot identify an instrument — the same label covers NYMEX and ICE contracts — and no provider is approved for id-only identification.`,
    });
  }

  if (claimants.length === 1) return { row: claimants[0] };
  if (claimants.length === 0) return {};
  return {
    refusal: {
      symbol: acceptedSymbols(commodity).join("/"),
      commodityId: commodity.id,
      reason: `${claimants.length} quotations claim this commodity with conflicting identification. An ambiguous feed is withheld rather than resolved by picking one.`,
    },
  };
}

type ProviderQuoteRow = {
  id?: unknown;
  symbol?: unknown;
  price?: unknown;
  changePercent?: unknown;
};

/**
 * Normalises a provider payload onto the four configured commodities.
 * Exported for testing so malformed payloads can be exercised without a network.
 *
 * Accepted shape (the documented expectation for any provider we integrate):
 *   { asOf: ISO-8601, source?: string, quotations: [{ id|symbol, price, changePercent }] }
 */
export function parseCommodityFeed(payload: unknown, now: number = Date.now()): CommodityFeedResult {
  if (payload === null || typeof payload !== "object") {
    return { quotes: unquotedCommodities(), status: unavailableCommodityStatus("The commodity provider returned an unreadable response.") };
  }
  const record = payload as { asOf?: unknown; source?: unknown; quotations?: unknown; data?: unknown };
  const body = (record.data !== null && typeof record.data === "object" ? record.data : record) as typeof record;
  const rows = Array.isArray(body.quotations) ? (body.quotations as ProviderQuoteRow[]) : null;
  if (!rows) {
    return { quotes: unquotedCommodities(), status: unavailableCommodityStatus("The commodity provider response did not contain quotations.") };
  }

  // Symbols that must never reach a row, with the row they were offered for.
  // Deduped so repeated rows do not duplicate a refusal.
  const refused: CommodityRefusal[] = [];
  const reported = new Set<string>();
  const report = (refusal: CommodityRefusal): void => {
    const key = `${refusal.commodityId}:${refusal.symbol.toUpperCase()}`;
    if (reported.has(key)) return;
    reported.add(key);
    refused.push(refusal);
  };

  let quotedCount = 0;
  const quotes = commodityDirectory.map((commodity) => {
    const resolution = resolveCommodityRow(commodity, rows, report);
    if (resolution.refusal) report(resolution.refusal);
    const row = resolution.row;
    // readPrice rejects zero, negative and non-finite values, so a provider
    // sentinel can never be rendered as a real benchmark price.
    const priceUsd: QuoteValue = row ? readPrice(row.price) : null;
    /**
     * V3.2 INTEGRITY RULE: a change is DERIVED from a price, so it cannot exist
     * without one.
     *
     * The change was previously read independently, so a quotation with a zero,
     * negative, missing or unreadable price still carried its percentage and an
     * arrow — "—   ▲ 5.5%" against a commodity with no price at all. That asserts
     * a movement in a figure the feed never supplied, and a reader has no way to
     * tell it apart from a real one. If the price is unusable the change goes with
     * it, whatever the provider sent.
     *
     * Applied per row and unconditionally: a valid price elsewhere in the same
     * payload must not license a change on an unpriced row.
     */
    const changePercent: QuoteValue =
      priceUsd === null ? null : row ? readChangePercent(row.changePercent) : null;
    if (priceUsd !== null) quotedCount += 1;
    return {
      id: commodity.id,
      name: commodity.name,
      symbol: commodity.symbol,
      exchange: commodity.exchange,
      priceUsd,
      changePercent,
      direction: directionFromChange(changePercent),
      currency: commodity.currency,
      unitLabel: commodity.unitLabel,
      unitLongLabel: commodity.unitLongLabel,
    };
  });

  if (quotedCount === 0) {
    // Distinguish "the provider sent nothing" from "the provider sent quotations
    // we deliberately refused". The second is not a quiet empty feed — it means
    // the instrument identification was wrong, and saying so is the difference
    // between a visitor thinking the feed is merely empty and an operator knowing
    // the vendor is quoting the wrong contract.
    return {
      quotes,
      status: unavailableCommodityStatus(
        refused.length > 0
          ? `The commodity provider sent quotations for instruments that cannot be verified as these benchmarks (${refused
              .map((entry) => entry.symbol)
              .join(", ")}), so no prices are shown.`
          : "The commodity provider returned no usable prices.",
      ),
      refused,
    };
  }

  const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : "Authorised commodity feed";

  // Same rule as the NGX adapter: no valid, non-future timestamp means the
  // quotes cannot honestly be labelled live.
  const instant = readQuoteInstant(body.asOf, now);
  /**
   * V3 INTEGRITY RULE: same as the NGX adapter — an untrustworthy timestamp
   * invalidates the prices themselves. Returning a populated quote list beside an
   * `unavailable` status let a caller render numbers that had no reliable
   * timestamp. The values are discarded and every commodity falls back to its
   * explicit unavailable cell.
   */
  if (!instant.ok || instant.iso === null || instant.ageMs === null) {
    return {
      quotes: unquotedCommodities(),
      status: {
        state: "unavailable",
        asOf: null,
        asOfLabel: "",
        source,
        note: instantProblemNote(instant.reason ?? "invalid", "The commodity provider"),
        withheld: true,
      },
    };
  }

  const isStale = instant.ageMs > STALE_AFTER_MS;
  const state: FeedStatus["state"] = isStale ? "stale" : "live";
  return {
    quotes,
    status: {
      state,
      asOf: instant.iso,
      asOfLabel: formatAsOf(instant.iso),
      source,
      ...(state === "stale" ? { note: "Showing the last quotation the provider returned; newer prices are not available yet." } : {}),
    },
    refused,
  };
}

/**
 * Fetches commodity prices from the configured provider.
 *
 * Server-side only (called from a server component). Every failure mode —
 * missing config, network error, non-2xx, TIMEOUT, malformed body — returns an
 * unavailable result, so the homepage can never be broken or stalled by this
 * feed.
 *
 * The timeout is enforced with an AbortSignal, and the caller-supplied `signal`
 * is linked to it so an outer request cancellation also aborts the fetch.
 */
export async function loadCommodityFeed(
  config: CommodityFeedConfig | null = readCommodityFeedConfig(),
  now: number = Date.now(),
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<CommodityFeedResult> {
  if (!config) {
    return { quotes: unquotedCommodities(), status: unavailableCommodityStatus() };
  }

  const timeoutMs = options.timeoutMs ?? COMMODITY_FEED_TIMEOUT_MS;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;

  try {
    // `next` is a Next.js extension of RequestInit. Declaring it explicitly
    // keeps this module compilable outside the Next type environment (the
    // check runner compiles files standalone).
    const init: RequestInit & { next?: { revalidate: number } } = {
      headers: { Authorization: `Bearer ${config.token}`, Accept: "application/json" },
      // Cached briefly on the server; commodity quotes are not second-sensitive
      // for a marketing homepage.
      next: { revalidate: 300 },
      signal,
    };
    const response = await fetch(config.url, init);
    if (!response.ok) {
      return {
        quotes: unquotedCommodities(),
        status: unavailableCommodityStatus(`The commodity provider is not responding right now (HTTP ${response.status}).`),
      };
    }
    return parseCommodityFeed(await response.json(), now);
  } catch (error) {
    // A timeout is reported distinctly from a network failure so the note the
    // visitor sees is accurate rather than generic.
    const timedOut = timeoutSignal.aborted;
    return {
      quotes: unquotedCommodities(),
      status: unavailableCommodityStatus(
        timedOut
          ? `The commodity provider did not respond within ${Math.round(timeoutMs / 1000)} seconds, so prices are not shown.`
          : "The commodity provider could not be reached.",
      ),
    };
  }
}
