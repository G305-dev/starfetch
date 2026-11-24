/**
 * Market-data module constants.
 *
 * Every value here is deliberately conservative: the NGN Market Free plan
 * allows 3,000 calls per quota period (shared by all keys on the account) and
 * 30 calls per minute. The module never exceeds the hard cap below, counts every
 * attempt (including failures and retries), and keeps operational headroom.
 */

/** DI token for the market-data Upstash Redis client (or `undefined`). */
export const MARKET_DATA_REDIS_CLIENT = Symbol('MARKET_DATA_REDIS_CLIENT');
/** DI token for the fetch implementation used for provider calls (tests inject a fake). */
export const MARKET_DATA_FETCH = Symbol('MARKET_DATA_FETCH');
/** DI token for the resolved, immutable market-data settings. */
export const MARKET_DATA_SETTINGS = Symbol('MARKET_DATA_SETTINGS');
/** DI token for the clock (tests inject a controllable clock). */
export const MARKET_DATA_CLOCK = Symbol('MARKET_DATA_CLOCK');
/** DI token for the Redis-backed store (`undefined` when disabled). */
export const MARKET_DATA_STORE = Symbol('MARKET_DATA_STORE');
/** DI token for the provider client (`undefined` when disabled). */
export const MARKET_DATA_PROVIDER_CLIENT = Symbol('MARKET_DATA_PROVIDER_CLIENT');

/**
 * Provider base URL is a constant (not configurable) so a misconfigured
 * environment variable can never send the API key to another host.
 */
export const NGN_MARKET_API_BASE_URL = 'https://api.ngnmarket.com/v1';
export const NGN_MARKET_COMPANIES_PATH = '/companies?limit=200&sort=market_cap&order=desc';
export const NGN_MARKET_SNAPSHOT_PATH = '/market/snapshot';

export const PROVIDER_NAME = 'NGN Market';
export const PROVIDER_URL = 'https://ngnmarket.com';
/** NGN Market Terms §8: public-facing products must attribute NGN Market. */
export const PROVIDER_ATTRIBUTION = 'Market data provided by NGN Market (ngnmarket.com).';
/**
 * The provider documents ~20-minute refreshes during NGX trading hours and the
 * latest close outside them. The module therefore labels data as delayed and
 * never as live or real-time.
 */
export const DATA_DELAY_NOTICE =
  'Delayed data. NGN Market refreshes prices approximately every 20 minutes during NGX trading hours; outside trading hours prices reflect the latest available close. Starfetch caches provider data and refreshes it periodically. Not investment advice.';

/** Redis namespace — isolated from every other Starfetch key prefix. */
export const MARKET_DATA_REDIS_PREFIX = 'sf:market-data:v1:';
export const REDIS_KEYS = {
  snapshot: `${MARKET_DATA_REDIS_PREFIX}snapshot`,
  lock: `${MARKET_DATA_REDIS_PREFIX}refresh-lock`,
  cooldown: `${MARKET_DATA_REDIS_PREFIX}cooldown`,
  budgetMonth: (period: string) => `${MARKET_DATA_REDIS_PREFIX}budget:month:${period}`,
  budgetDay: (day: string) => `${MARKET_DATA_REDIS_PREFIX}budget:day:${day}`,
  /** Hash {end, count, next}: calls counted against the provider quota period ending at `end` (epoch ms). */
  budgetProviderPeriod: `${MARKET_DATA_REDIS_PREFIX}budget:provider-period`,
  /** Epoch-ms `refreshedAt` of the cached snapshot (compare-and-set guard against older writes). */
  snapshotVersion: `${MARKET_DATA_REDIS_PREFIX}snapshot-version`,
} as const;

/** Provider Free-plan quota per period. */
export const PROVIDER_FREE_PLAN_QUOTA = 3_000;
/** Default local monthly cap (leaves 600 calls of headroom on the shared pool). */
export const DEFAULT_MONTHLY_CALL_BUDGET = 2_400;
/** Absolute ceiling — configuration can lower but never raise the cap above this. */
export const MAX_MONTHLY_CALL_BUDGET = 2_700;
export const MIN_MONTHLY_CALL_BUDGET = 100;
/** Daily cap = ceil(monthly / DAILY_BUDGET_DIVISOR) — stops a bug burning the month in a day. */
export const DAILY_BUDGET_DIVISOR = 20;
/**
 * When the provider reports `calls_remaining` at or below this, stop calling
 * until the provider's `reset_at` (protects the shared pool across keys).
 */
export const PROVIDER_REMAINING_RESERVE = 300;
/**
 * The provider documents that quotas reset on the account's billing renewal
 * date (reported as `meta.reset_at`), not the calendar month. Calls keep
 * counting against the old provider period until `reset_at` + this grace, so
 * clock skew can never release capacity early.
 */
export const PROVIDER_RESET_GRACE_SECONDS = 3_600;
/** A `reset_at` further ahead than one provider period (+1 day) is treated as malformed. */
export const MAX_RESET_AT_HORIZON_MS = 32 * 24 * 3_600_000;
/** TTL of the provider-period counter hash (outlives any valid period + grace). */
export const PROVIDER_PERIOD_TTL_SECONDS = 40 * 24 * 3_600;

/** Refresh interval during the NGX trading window (seconds). */
export const DEFAULT_REFRESH_INTERVAL_SECONDS = 1_800;
export const MIN_REFRESH_INTERVAL_SECONDS = 1_200;
export const MAX_REFRESH_INTERVAL_SECONDS = 7_200;
/** Refresh interval outside the trading window, weekends included (seconds). */
export const OFF_HOURS_REFRESH_INTERVAL_SECONDS = 14_400;
/**
 * Trading window used for refresh cadence, in Africa/Lagos time (UTC+1, no DST).
 * Deliberately wider than the NGX session so closing prices are captured.
 */
export const TRADING_WINDOW_START_MINUTES = 9 * 60;
export const TRADING_WINDOW_END_MINUTES = 16 * 60 + 30;
export const LAGOS_UTC_OFFSET_MINUTES = 60;

/** Grace beyond the refresh interval before cached data is labelled stale. */
export const STALE_GRACE_SECONDS = 600;
/**
 * Cache-age safeguard: a cached document whose Starfetch refresh is older than
 * this is never served (unavailable instead). Independent of quote age.
 */
export const MAX_STALE_SERVE_SECONDS = 7 * 24 * 3_600;
/**
 * Per-equity maximum quote age, measured from that equity's own provider quote
 * timestamp (`last_updated`), enforced at normalisation AND at serve time. An
 * age of exactly 7 days is still served; 1 ms older is unavailable. Never
 * extended while the provider is down.
 */
export const MAX_QUOTE_AGE_MS = 7 * 24 * 3_600_000;
/** Redis TTL for the cached snapshot document. */
export const SNAPSHOT_TTL_SECONDS = 8 * 24 * 3_600;

/** Per-attempt provider timeout (an attempt is further capped by the refresh deadline). */
export const PROVIDER_TIMEOUT_MS = 5_000;
/** Companies endpoint: at most one retry, only for 5xx/network/timeout. */
export const COMPANIES_MAX_ATTEMPTS = 2;
/** Snapshot endpoint: a single attempt per refresh (summary is optional). */
export const SNAPSHOT_MAX_ATTEMPTS = 1;
export const RETRY_BACKOFF_MS = 500;
/**
 * Overall deadline for a request that refreshes, measured from the start of
 * the request: covers the cache read, cooldown check, lock, double-check,
 * every provider attempt and retry, budget reservations and the cache write.
 * Chosen so the backend answers inside the frontend's 8 s timeout and far
 * below any Vercel function maximum. No step starts after the deadline.
 */
export const REFRESH_DEADLINE_MS = 6_000;
/** A provider attempt is only started if at least this much time remains (after the write reserve). */
export const MIN_PROVIDER_ATTEMPT_MS = 1_500;
/** Time kept back from provider attempts so the cache write can still happen before the deadline. */
export const CACHE_WRITE_RESERVE_MS = 1_000;
/** Bounded wait for the (best-effort) lock release after the refresh. */
export const LOCK_RELEASE_WAIT_MS = 500;
/** Safety margin by which the lock outlives the deadline (clock drift, in-flight Redis latency). */
export const LOCK_TTL_MARGIN_MS = 8_000;
/** Lock TTL. Never renewed; > deadline + release wait + margin, so it outlives every refresh. */
export const REFRESH_LOCK_TTL_MS = 15_000;

/** Cooldowns (no provider calls while active). */
export const FAILURE_COOLDOWN_SECONDS = 600;
export const AUTH_FAILURE_COOLDOWN_SECONDS = 3_600;
export const DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS = 60;
export const MAX_RATE_LIMIT_COOLDOWN_SECONDS = 3_600;
export const DEFAULT_QUOTA_COOLDOWN_SECONDS = 24 * 3_600;
export const MAX_QUOTA_COOLDOWN_SECONDS = 31 * 24 * 3_600;

/** Per-instance memo of a fresh Redis read (reduces Redis commands per request). */
export const LOCAL_MEMO_TTL_MS = 15_000;

/**
 * The 14 homepage equities, exactly as listed in the frontend
 * `featuredNgxEquities` directory (order preserved). Symbols were checked
 * against NGN Market stock pages; company names are Starfetch display names.
 * No symbol is guessed: anything absent from a provider response is reported
 * as unavailable.
 */
export const FEATURED_NGX_EQUITIES: ReadonlyArray<{ symbol: string; companyName: string }> = Object.freeze([
  { symbol: 'ACCESSCORP', companyName: 'Access Holdings Plc' },
  { symbol: 'AIRTELAFRI', companyName: 'Airtel Africa Plc' },
  { symbol: 'ARADEL', companyName: 'Aradel Holdings Plc' },
  { symbol: 'BUACEMENT', companyName: 'BUA Cement Plc' },
  { symbol: 'BUAFOODS', companyName: 'BUA Foods Plc' },
  { symbol: 'DANGCEM', companyName: 'Dangote Cement Plc' },
  { symbol: 'FIRSTHOLDCO', companyName: 'First HoldCo Plc' },
  { symbol: 'GTCO', companyName: 'Guaranty Trust Holding Company Plc' },
  { symbol: 'MTNN', companyName: 'MTN Nigeria Communications Plc' },
  { symbol: 'NB', companyName: 'Nigerian Breweries Plc' },
  { symbol: 'NESTLE', companyName: 'Nestlé Nigeria Plc' },
  { symbol: 'SEPLAT', companyName: 'Seplat Energy Plc' },
  { symbol: 'UBA', companyName: 'United Bank for Africa Plc' },
  { symbol: 'ZENITHBANK', companyName: 'Zenith Bank Plc' },
]);
