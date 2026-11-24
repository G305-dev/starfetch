/**
 * Shared validation rules for market-data feeds.
 *
 * Both the NGX adapter and the commodity adapter previously duplicated loose
 * number/timestamp handling, and both had the same defects:
 *
 *   - a missing timestamp still produced a `live` status;
 *   - a FUTURE timestamp produced a `live` status (negative age was treated as
 *     "fresh", so a clock-skewed or plainly wrong provider won "most current");
 *   - a NEGATIVE price was accepted as a real quote;
 *   - a row with a change but no price was treated as a usable quote.
 *
 * The rules live here once so the two adapters cannot drift apart again, and so
 * every rejection is testable without a network.
 */

import type { QuoteValue } from "./types";

/**
 * Upper sanity bound for a quoted price. Not a market view — a guard against a
 * provider sending a sentinel (e.g. 1e12) that would render as a nonsense figure.
 */
const MAX_PRICE = 1_000_000_000;

/**
 * Plausible bounds for a DAILY percentage change. Outside this the value is
 * garbage rather than extreme: no NGX equity or benchmark commodity moves 100%
 * down-and-beyond or 1,000% up in one session, and NaN/Infinity have already
 * been excluded by the finite check.
 */
const MIN_CHANGE = -100;
const MAX_CHANGE = 1_000;

/**
 * CLOCK-SKEW POLICY (final, V3.1).
 *
 * A quotation timestamp must NEVER be in the future. V3 allowed 30 seconds of
 * future-dating and still labelled those quotes `live`, which is the same class of
 * error as V2's ten minutes — just smaller. Any quote stamped ahead of our clock
 * says the price describes a moment that has not happened, whether it is nine
 * minutes ahead or nine milliseconds. So future-dated quotations are now
 * REJECTED outright, and their prices are withheld like any other untrustworthy
 * timestamp.
 *
 * Why zero tolerance is correct here, not merely strict:
 * `asOf` is struck by the provider BEFORE the response reaches us. Network
 * latency therefore only ever makes a quotation look OLDER, never newer. A
 * future `asOf` cannot be explained by latency or by jitter on our side — it can
 * only mean the provider's clock is ahead of ours, or that the value is wrong.
 * A tolerance would not absorb jitter; it would only excuse a drifting provider
 * clock, and would do so while still printing `live` next to a future timestamp.
 *
 * Handling a provider with a drifting clock: the feed fails closed with a note
 * naming the fault, so the operator sees "provider clock is ahead" and fixes the
 * clock rather than reading a mislabelled price. Correct behaviour is to require
 * NTP synchronisation from any provider we integrate.
 *
 * ONE-SIDED: only future timestamps are rejected. A quote 4 hours OLD is not
 * invalid data — it is valid data that is out of date, so it becomes `stale` with
 * its real timestamp shown. Rejecting old data outright would hide a working feed
 * during a market holiday.
 */
export const FUTURE_TOLERANCE_MS = 0;

/** Coerces a numeric-ish wire value. Returns null for anything unusable. */
export function readNumber(value: unknown): QuoteValue {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.trim().replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * A price must be a finite number strictly greater than zero.
 *
 * Zero is rejected deliberately: a quoted equity or benchmark does not trade at
 * zero, so a zero almost always means "no data" encoded as a number. Rendering
 * it as ₦0.00 would be a fabricated price.
 */
export function readPrice(value: unknown): QuoteValue {
  const parsed = readNumber(value);
  if (parsed === null) return null;
  if (parsed <= 0) return null;
  if (parsed > MAX_PRICE) return null;
  return parsed;
}

/** A daily percentage change may legitimately be negative, but not absurd. */
export function readChangePercent(value: unknown): QuoteValue {
  const parsed = readNumber(value);
  if (parsed === null) return null;
  if (parsed < MIN_CHANGE || parsed > MAX_CHANGE) return null;
  return parsed;
}

/**
 * Normalises a provider timestamp to an ISO string.
 *
 * Returns a discriminated result rather than `string | null` so the caller can
 * tell "absent" from "invalid" from "future-dated" — the three cases have
 * different honest messages, and all three must block a `live` status.
 */
export type InstantProblem = "missing" | "invalid" | "future";

/**
 * Always carries every field so the caller can read `.reason` after an `ok`
 * check without relying on discriminated-union narrowing — this module is also
 * compiled by the test runners in non-strict mode, where a boolean-literal
 * discriminant is widened and `!result.ok` does not narrow.
 */
export type InstantResult = {
  ok: boolean;
  /** ISO instant; null when unusable. */
  iso: string | null;
  /** Milliseconds since the instant; null when unusable. */
  ageMs: number | null;
  /** Why the instant was rejected; null when usable. */
  reason: InstantProblem | null;
};

export function readQuoteInstant(value: unknown, now: number): InstantResult {
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
    return { ok: false, iso: null, ageMs: null, reason: "missing" };
  }
  if (typeof value !== "string") return { ok: false, iso: null, ageMs: null, reason: "invalid" };
  const parsed = new Date(value);
  const time = parsed.getTime();
  if (Number.isNaN(time)) return { ok: false, iso: null, ageMs: null, reason: "invalid" };

  const ageMs = now - time;
  // A quote "from the future" is not more fresh than one from now; it means the
  // timestamp cannot be trusted, so it is rejected rather than clamped. The
  // tolerance is zero: `asOf` is struck before we receive it, so latency can only
  // make a quote look older — a future value is a provider clock fault, never
  // jitter we should absorb. See the policy note at FUTURE_TOLERANCE_MS.
  if (ageMs < -FUTURE_TOLERANCE_MS) return { ok: false, iso: null, ageMs: null, reason: "future" };

  return { ok: true, iso: parsed.toISOString(), ageMs, reason: null };
}

/** User-facing explanation for a rejected timestamp. */
export function instantProblemNote(reason: InstantProblem, subject: string): string {
  if (reason === "missing") {
    return `${subject} did not report a quotation timestamp, so the prices cannot be shown as current.`;
  }
  if (reason === "future") {
    return `${subject} reported a quotation timestamp in the future, so the prices cannot be trusted. The provider's clock is ahead of ours; it must be synchronised before its prices can be published.`;
  }
  return `${subject} reported an unreadable quotation timestamp, so the prices cannot be shown as current.`;
}
