import { FEATURED_NGX_EQUITIES, LAGOS_UTC_OFFSET_MINUTES, MAX_QUOTE_AGE_MS, MAX_RESET_AT_HORIZON_MS } from './market-data.constants';
import { EquityUnavailableReason, MarketSummary, NormalizedEquityQuote, ProviderQuotaMeta } from './market-data.types';

/**
 * Hand-written validation/normalization of NGN Market responses (no schema
 * dependency exists in this service). Rules:
 *  - The documented envelope (`success: true`, `data`) is mandatory.
 *  - Values are passed through as supplied; nothing is computed, estimated or
 *    defaulted. A field that fails validation becomes null / unavailable.
 *  - Only the configured featured symbols are retained (no symbol guessing).
 *  - Timestamps must be strict ISO-8601 instants (explicit `Z` or `±HH:MM`
 *    offset, real calendar date) and never later than the validation clock —
 *    not even by 1 ms. Nothing is clamped or substituted: an equity whose own
 *    quote timestamp is missing, invalid, in the future or older than 7 days is
 *    unavailable, and every other equity is unaffected.
 */

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_COMPANY_ITEMS = 2_000;
const MAX_PRICE_NGN = 10_000_000;
const MAX_ABS_DAILY_PERCENT = 100;

export function parseCompaniesResponse(
  body: unknown,
  now: Date,
  featured: ReadonlyArray<{ symbol: string; companyName: string }> = FEATURED_NGX_EQUITIES,
): ParseResult<NormalizedEquityQuote[]> {
  if (!isRecord(body) || body.success !== true || !isRecord(body.data) || !Array.isArray(body.data.data)) {
    return { ok: false, error: 'MALFORMED_ENVELOPE' };
  }
  const items = body.data.data;
  if (items.length > MAX_COMPANY_ITEMS) return { ok: false, error: 'MALFORMED_ENVELOPE' };

  const bySymbol = new Map<string, unknown[]>();
  for (const item of items) {
    if (!isRecord(item) || typeof item.symbol !== 'string') continue;
    const symbol = item.symbol.trim().toUpperCase();
    const list = bySymbol.get(symbol) ?? [];
    list.push(item);
    bySymbol.set(symbol, list);
  }

  const quotes = featured.map(({ symbol, companyName }): NormalizedEquityQuote => {
    const matches = bySymbol.get(symbol) ?? [];
    if (matches.length === 0) return unavailableQuote(symbol, companyName, 'NOT_IN_PROVIDER_RESPONSE');
    if (matches.length > 1) return unavailableQuote(symbol, companyName, 'DUPLICATE_IN_PROVIDER_RESPONSE');
    return normalizeQuote(matches[0] as Record<string, unknown>, symbol, companyName, now);
  });

  // A syntactically valid response with no usable featured quote must not
  // overwrite previously cached good data.
  if (!quotes.some((quote) => quote.available)) return { ok: false, error: 'NO_USABLE_QUOTES' };
  return { ok: true, value: quotes };
}

export function parseSnapshotResponse(body: unknown, now: Date): ParseResult<MarketSummary> {
  if (!isRecord(body) || body.success !== true || !isRecord(body.data)) {
    return { ok: false, error: 'MALFORMED_ENVELOPE' };
  }
  const data = body.data;
  const tradingDate = parseTradingDate(data.date);
  if (!tradingDate) return { ok: false, error: 'MALFORMED_SUMMARY' };

  const marketCap = isRecord(data.market_cap) ? data.market_cap : {};
  const summary: MarketSummary = {
    tradingDate,
    allShareIndex: positiveNumber(data.asi),
    allShareIndexChange: finiteNumber(data.asi_change),
    allShareIndexChangePercent: boundedPercent(data.asi_change_percent),
    equityMarketCapitalisation: positiveNumber(marketCap.equity),
    totalMarketCapitalisation: positiveNumber(marketCap.total),
    providerUpdatedAt: pastInstant(data.updated_at, now.getTime()),
  };
  if (summary.allShareIndex === null) return { ok: false, error: 'NO_USABLE_SUMMARY' };
  if (!isSummaryCurrent(summary, now.getTime())) return { ok: false, error: 'SUMMARY_NOT_CURRENT' };
  return { ok: true, value: summary };
}

/** Quota metadata from success or error envelopes; tolerant of absence. */
export function parseQuotaMeta(body: unknown): ProviderQuotaMeta {
  const meta = isRecord(body) && isRecord(body.meta) ? body.meta : undefined;
  const remaining = meta ? finiteNumber(meta.calls_remaining) : null;
  const reset = meta ? parseStrictInstant(meta.reset_at) : null;
  const resetAt = reset ? new Date(reset.ms).toISOString() : null;
  return {
    callsRemaining: remaining !== null && remaining >= 0 && Number.isInteger(remaining) ? remaining : null,
    resetAt,
  };
}

/** Safe machine code from an error envelope (never the message). */
export function parseProviderErrorCode(body: unknown): string | undefined {
  if (!isRecord(body) || !isRecord(body.error)) return undefined;
  const code = body.error.code;
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : undefined;
}

function normalizeQuote(
  raw: Record<string, unknown>,
  symbol: string,
  companyName: string,
  now: Date,
): NormalizedEquityQuote {
  const instant = checkQuoteInstant(raw.last_updated, now.getTime());
  if (!instant.ok) return unavailableQuote(symbol, companyName, instant.reason);
  const price = positiveNumber(raw.price);
  if (price === null || price > MAX_PRICE_NGN) return unavailableQuote(symbol, companyName, 'INVALID_PRICE');
  return {
    symbol,
    companyName,
    lastPriceNgn: price,
    dailyChangePercent: boundedPercent(raw.price_change_percent),
    quoteTimestamp: instant.iso,
    available: true,
    unavailableReason: null,
  };
}

export type QuoteInstantCheck =
  | { ok: true; iso: string; ms: number }
  | { ok: false; reason: Extract<EquityUnavailableReason, 'MISSING_QUOTE_TIMESTAMP' | 'INVALID_QUOTE_TIMESTAMP' | 'FUTURE_QUOTE_TIMESTAMP' | 'QUOTE_EXPIRED'> };

/**
 * Validates one equity's own quote timestamp against the validation clock:
 * present, strict ISO-8601 instant, not later than `nowMs` (zero tolerance)
 * and not older than the 7-day maximum (an age of exactly 7 days is allowed).
 * Used both when normalising a provider response and when serving the cache.
 */
export function checkQuoteInstant(value: unknown, nowMs: number): QuoteInstantCheck {
  if (value === undefined || value === null || value === '') return { ok: false, reason: 'MISSING_QUOTE_TIMESTAMP' };
  const parsed = parseStrictInstant(value);
  if (!parsed) return { ok: false, reason: 'INVALID_QUOTE_TIMESTAMP' };
  if (isAfter(parsed, nowMs)) return { ok: false, reason: 'FUTURE_QUOTE_TIMESTAMP' };
  if (nowMs - parsed.ms > MAX_QUOTE_AGE_MS) return { ok: false, reason: 'QUOTE_EXPIRED' };
  return { ok: true, iso: new Date(parsed.ms).toISOString(), ms: parsed.ms };
}

export interface StrictInstant {
  /** Epoch milliseconds (sub-millisecond digits truncated). */
  ms: number;
  /** True when non-zero digits beyond milliseconds were truncated (instant is strictly after `ms`). */
  subMillisecond: boolean;
}

const STRICT_INSTANT_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Strict ISO-8601 / RFC 3339 instant parser. Requires a full date, the `T`
 * separator, seconds, and an explicit `Z` or `±HH:MM` offset, so the value
 * denotes exactly one instant. Rejects local times without an offset,
 * date-only values, space separators, epoch numbers, leap seconds and
 * calendar dates that `Date.parse` would silently roll over (e.g. 31 April).
 */
export function parseStrictInstant(value: unknown): StrictInstant | null {
  if (typeof value !== 'string' || value.length > 40) return null;
  const match = STRICT_INSTANT_RE.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi, se, fraction = '', zone] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(se);
  if (year < 1970 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  let offsetMinutes = 0;
  if (zone !== 'Z') {
    const offsetHours = Number(zone.slice(1, 3));
    const offsetMins = Number(zone.slice(4, 6));
    if (offsetHours > 14 || offsetMins > 59) return null;
    offsetMinutes = (zone.startsWith('-') ? -1 : 1) * (offsetHours * 60 + offsetMins);
  }
  const millis = Number(fraction.padEnd(3, '0').slice(0, 3));
  const subMillisecond = /[1-9]/.test(fraction.slice(3));
  const ms = Date.UTC(year, month - 1, day, hour, minute, second, millis) - offsetMinutes * 60_000;
  return Number.isFinite(ms) ? { ms, subMillisecond } : null;
}

function isAfter(instant: StrictInstant, nowMs: number): boolean {
  return instant.ms > nowMs || (instant.ms === nowMs && instant.subMillisecond);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Lagos calendar date (YYYY-MM-DD) of an instant. */
function lagosDate(epochMs: number): string {
  return new Date(epochMs + LAGOS_UTC_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

/**
 * Whether a provider market summary is still within the 7-day limit at
 * `nowMs`: its trading date must not be later than the Lagos date of the
 * clock nor more than 7 calendar days earlier, and a supplied provider
 * `updated_at` must not be older than 7 days. Used at normalisation and serve time.
 */
export function isSummaryCurrent(summary: Pick<MarketSummary, 'tradingDate' | 'providerUpdatedAt'>, nowMs: number): boolean {
  const today = lagosDate(nowMs);
  if (summary.tradingDate > today) return false;
  const tradingDayMs = Date.parse(`${summary.tradingDate}T00:00:00.000Z`);
  const todayMs = Date.parse(`${today}T00:00:00.000Z`);
  if (todayMs - tradingDayMs > MAX_QUOTE_AGE_MS) return false;
  if (summary.providerUpdatedAt !== null) {
    const updatedMs = Date.parse(summary.providerUpdatedAt);
    if (updatedMs > nowMs || nowMs - updatedMs > MAX_QUOTE_AGE_MS) return false;
  }
  return true;
}

export function unavailableQuote(
  symbol: string,
  companyName: string,
  reason: NonNullable<NormalizedEquityQuote['unavailableReason']>,
): NormalizedEquityQuote {
  return {
    symbol,
    companyName,
    lastPriceNgn: null,
    dailyChangePercent: null,
    quoteTimestamp: null,
    available: false,
    unavailableReason: reason,
  };
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && /^-?\d{1,15}(\.\d{1,10})?$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function positiveNumber(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function boundedPercent(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && Math.abs(parsed) <= MAX_ABS_DAILY_PERCENT ? parsed : null;
}

/** Strict instant not later than the clock, else null (never clamped or substituted). */
function pastInstant(value: unknown, nowMs: number): string | null {
  const parsed = parseStrictInstant(value);
  if (!parsed || isAfter(parsed, nowMs)) return null;
  return new Date(parsed.ms).toISOString();
}

/**
 * Validates a provider quota `reset_at` for budgeting: a strict instant that is
 * in the future and no further ahead than one provider period (+1 day). Any
 * other value is ignored (callers fall back to conservative defaults).
 */
export function validResetAtMs(resetAt: string | null, nowMs: number): number | null {
  const parsed = parseStrictInstant(resetAt);
  if (!parsed || parsed.ms <= nowMs || parsed.ms - nowMs > MAX_RESET_AT_HORIZON_MS) return null;
  return parsed.ms;
}

const TRADING_DATE_RE = /^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.000)?Z)?$/;

/**
 * Provider trading date (`/v1/market/snapshot` `data.date`) normalised to
 * `YYYY-MM-DD`. Two forms are accepted:
 *  - a plain calendar date, `2026-11-24`;
 *  - the form the live provider was observed to return, UTC midnight of that
 *    calendar date: `2026-11-24T00:00:00.000Z` (or without the `.000`).
 * The date part must be a real calendar date and the time part must be exactly
 * midnight with a `Z` designator. The calendar date is taken from the validated
 * components as written (no timezone conversion), so the trading day is never
 * shifted. Anything else — non-midnight times, offsets (`+01:00`, `+00:00`),
 * missing `Z`, space separators, other fractions, epoch numbers — is rejected
 * rather than truncated. Future and 7-day checks are applied by `isSummaryCurrent`.
 */
export function parseTradingDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = TRADING_DATE_RE.exec(value);
  if (!match) return null;
  const date = match[1];
  return isValidDate(date) && Number(date.slice(0, 4)) >= 1970 ? date : null;
}

function isValidDate(value: string): boolean {
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
