import {
  FEATURED_NGX_EQUITIES,
  PROVIDER_PERIOD_TTL_SECONDS,
  PROVIDER_RESET_GRACE_SECONDS,
  REDIS_KEYS,
  SNAPSHOT_TTL_SECONDS,
} from './market-data.constants';
import { CachedMarketSnapshot, MarketSummary, NormalizedEquityQuote } from './market-data.types';
import { parseStrictInstant } from './ngn-market.validation';

/**
 * The subset of the `@upstash/redis` client used by this module. Every method
 * may throw (timeout/outage); callers treat any throw as "Redis unavailable"
 * and never fall back to calling the provider directly.
 */
export interface MarketDataRedis {
  get(key: string): Promise<unknown>;
  set(key: string, value: string, opts: { nx: true; px: number } | { ex: number }): Promise<unknown>;
  eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown>;
}

/**
 * Atomic per-attempt budget reservation (one EVAL = one Redis command).
 * Denies, in order, when:
 *  1. the caller no longer owns the refresh lock (LOCK_LOST) — so an instance
 *     whose lock expired can never make another provider call;
 *  2. a cooldown is active;
 *  3. the Lagos calendar-month cap is reached;
 *  4. the provider-quota-period cap is reached (same cap; the stricter wins);
 *  5. the Lagos daily cap is reached.
 * Otherwise increments every counter (TTLs set on first use).
 *
 * Provider-period hash KEYS[5] fields: `end` (epoch ms of the validated
 * provider `reset_at`, 0 = not yet known), `count` (calls in the current
 * period), `next` (calls made after `end` but before `end + grace`, carried
 * into the new period), `start` (epoch ms the unknown period began). The
 * period only rolls over at `end + grace`, never earlier. When no valid
 * `reset_at` is ever observed, the count rolls over at most once per
 * `start + fallback` (31 days + grace), and the calendar caps still apply.
 */
export const RESERVE_ATTEMPT_SCRIPT = `
if redis.call('GET', KEYS[4]) ~= ARGV[5] then return {0, 'LOCK_LOST'} end
if redis.call('EXISTS', KEYS[3]) == 1 then return {0, 'COOLDOWN'} end
local now = tonumber(ARGV[6])
local grace = tonumber(ARGV[7])
local fallback = tonumber(ARGV[9])
local pEnd = tonumber(redis.call('HGET', KEYS[5], 'end') or '0')
local pCount = tonumber(redis.call('HGET', KEYS[5], 'count') or '0')
local pNext = tonumber(redis.call('HGET', KEYS[5], 'next') or '0')
local pStart = tonumber(redis.call('HGET', KEYS[5], 'start') or '0')
if pEnd > 0 and now >= pEnd + grace then
  pStart = pEnd
  pEnd = 0
  pCount = pNext
  pNext = 0
  redis.call('HSET', KEYS[5], 'end', 0, 'count', pCount, 'next', 0, 'start', pStart)
elseif pEnd == 0 and pStart > 0 and now >= pStart + fallback then
  pStart = 0
  pCount = 0
  redis.call('HSET', KEYS[5], 'count', 0, 'next', 0, 'start', 0)
end
local cap = tonumber(ARGV[1])
local month = tonumber(redis.call('GET', KEYS[1]) or '0')
if month >= cap then return {0, 'MONTHLY_BUDGET'} end
if pCount >= cap then
  local untilMs = 0
  if pEnd > 0 then untilMs = pEnd + grace elseif pStart > 0 then untilMs = pStart + fallback end
  return {0, 'PROVIDER_PERIOD_BUDGET', untilMs}
end
local day = tonumber(redis.call('GET', KEYS[2]) or '0')
if day >= tonumber(ARGV[2]) then return {0, 'DAILY_BUDGET'} end
month = redis.call('INCR', KEYS[1])
if month == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3])) end
day = redis.call('INCR', KEYS[2])
if day == 1 then redis.call('EXPIRE', KEYS[2], tonumber(ARGV[4])) end
pCount = redis.call('HINCRBY', KEYS[5], 'count', 1)
if pEnd > 0 and now >= pEnd then redis.call('HINCRBY', KEYS[5], 'next', 1) end
if pEnd == 0 and pStart == 0 then redis.call('HSET', KEYS[5], 'start', now) end
redis.call('EXPIRE', KEYS[5], tonumber(ARGV[8]))
return {1, month, day, pCount}
`.trim();

/**
 * Records a validated provider `reset_at` (ARGV[1], epoch ms) as the end of
 * the current provider quota period. It is adopted only when no period end is
 * known (after a rollover or on first use); a known end is only ever EXTENDED
 * (later value, before the current end) — never shortened or replaced early,
 * so a changed or malformed `reset_at` can never add capacity early.
 * Returns 1 adopted, 2 extended, 0 ignored.
 */
export const OBSERVE_PROVIDER_RESET_SCRIPT = `
local resetAt = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local grace = tonumber(ARGV[3])
local pEnd = tonumber(redis.call('HGET', KEYS[1], 'end') or '0')
if pEnd > 0 and now >= pEnd + grace then
  local pNext = tonumber(redis.call('HGET', KEYS[1], 'next') or '0')
  redis.call('HSET', KEYS[1], 'end', 0, 'count', pNext, 'next', 0, 'start', pEnd)
  pEnd = 0
end
if pEnd == 0 then
  redis.call('HSET', KEYS[1], 'end', resetAt)
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
  return 1
end
if now < pEnd and resetAt > pEnd then
  redis.call('HSET', KEYS[1], 'end', resetAt)
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
  return 2
end
return 0
`.trim();

/**
 * Ownership-safe, monotonic cache write: stores the snapshot only if the
 * caller still holds the refresh lock AND its `refreshedAt` (ARGV[4], epoch
 * ms) is newer than the stored version. An expired holder can therefore never
 * overwrite data written by a newer refresh.
 */
export const WRITE_SNAPSHOT_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 'LOCK_LOST' end
local current = tonumber(redis.call('GET', KEYS[3]) or '0')
if current >= tonumber(ARGV[4]) then return 'NOT_NEWER' end
redis.call('SET', KEYS[2], ARGV[2], 'EX', tonumber(ARGV[3]))
redis.call('SET', KEYS[3], ARGV[4], 'EX', tonumber(ARGV[3]))
return 'OK'
`.trim();

/** Compare-and-delete so an instance can only release its own lock. */
export const RELEASE_LOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`.trim();

/** Sets a cooldown only if it extends (never shortens) an active one. */
export const SET_COOLDOWN_SCRIPT = `
local current = redis.call('PTTL', KEYS[1])
if current >= tonumber(ARGV[2]) then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'PX', tonumber(ARGV[2]))
return 1
`.trim();

export type ReservationResult =
  | { allowed: true; monthCount: number; dayCount: number; providerPeriodCount: number }
  | { allowed: false; reason: 'LOCK_LOST' | 'COOLDOWN' | 'MONTHLY_BUDGET' | 'DAILY_BUDGET' }
  /** `untilMs` = epoch ms the provider period can roll over (0 = unknown). */
  | { allowed: false; reason: 'PROVIDER_PERIOD_BUDGET'; untilMs: number };

export type SnapshotWriteResult = 'OK' | 'LOCK_LOST' | 'NOT_NEWER';
export type ProviderResetObservation = 'ADOPTED' | 'EXTENDED' | 'IGNORED';

const MONTH_COUNTER_TTL_SECONDS = 40 * 24 * 3_600;
const DAY_COUNTER_TTL_SECONDS = 2 * 24 * 3_600;
/** Unknown provider period: counts roll over at most once per 31 days + grace. */
const UNKNOWN_PERIOD_FALLBACK_MS = (31 * 24 * 3_600 + PROVIDER_RESET_GRACE_SECONDS) * 1_000;

export class MarketDataStore {
  constructor(private readonly redis: MarketDataRedis) {}

  /** Returns the cached document, or null when absent or structurally invalid. Throws on Redis error. */
  async readSnapshot(): Promise<CachedMarketSnapshot | null> {
    const raw = await this.redis.get(REDIS_KEYS.snapshot);
    if (raw === null || raw === undefined) return null;
    let parsed: unknown;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
    return isCachedSnapshot(parsed) ? parsed : null;
  }

  /** Writes the snapshot only while `token` owns the lock and the snapshot is newer. Throws on Redis error. */
  async writeSnapshotIfOwner(token: string, snapshot: CachedMarketSnapshot): Promise<SnapshotWriteResult> {
    const result = await this.redis.eval(
      WRITE_SNAPSHOT_SCRIPT,
      [REDIS_KEYS.lock, REDIS_KEYS.snapshot, REDIS_KEYS.snapshotVersion],
      [token, JSON.stringify(snapshot), SNAPSHOT_TTL_SECONDS, Date.parse(snapshot.equities.refreshedAt)],
    );
    if (result === 'OK' || result === 'LOCK_LOST' || result === 'NOT_NEWER') return result;
    throw new Error('Unexpected snapshot write result');
  }

  /** Records a validated provider `reset_at` (epoch ms). Throws on Redis error. */
  async observeProviderReset(resetAtMs: number, nowMs: number): Promise<ProviderResetObservation> {
    const result = Number(
      await this.redis.eval(
        OBSERVE_PROVIDER_RESET_SCRIPT,
        [REDIS_KEYS.budgetProviderPeriod],
        [resetAtMs, nowMs, PROVIDER_RESET_GRACE_SECONDS * 1_000, PROVIDER_PERIOD_TTL_SECONDS],
      ),
    );
    return result === 1 ? 'ADOPTED' : result === 2 ? 'EXTENDED' : 'IGNORED';
  }

  /** Returns the active cooldown reason, or null. Throws on Redis error. */
  async getCooldown(): Promise<string | null> {
    const raw = await this.redis.get(REDIS_KEYS.cooldown);
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  }

  async setCooldown(reason: string, seconds: number): Promise<void> {
    const ms = Math.max(1_000, Math.round(seconds * 1_000));
    await this.redis.eval(SET_COOLDOWN_SCRIPT, [REDIS_KEYS.cooldown], [reason, ms]);
  }

  async acquireLock(token: string, ttlMs: number): Promise<boolean> {
    const result = await this.redis.set(REDIS_KEYS.lock, token, { nx: true, px: ttlMs });
    return result === 'OK';
  }

  async releaseLock(token: string): Promise<void> {
    await this.redis.eval(RELEASE_LOCK_SCRIPT, [REDIS_KEYS.lock], [token]);
  }

  async reserveAttempt(
    monthPeriod: string,
    day: string,
    monthlyCap: number,
    dailyCap: number,
    lockToken: string,
    nowMs: number,
  ): Promise<ReservationResult> {
    const result = await this.redis.eval(
      RESERVE_ATTEMPT_SCRIPT,
      [
        REDIS_KEYS.budgetMonth(monthPeriod),
        REDIS_KEYS.budgetDay(day),
        REDIS_KEYS.cooldown,
        REDIS_KEYS.lock,
        REDIS_KEYS.budgetProviderPeriod,
      ],
      [
        monthlyCap,
        dailyCap,
        MONTH_COUNTER_TTL_SECONDS,
        DAY_COUNTER_TTL_SECONDS,
        lockToken,
        nowMs,
        PROVIDER_RESET_GRACE_SECONDS * 1_000,
        PROVIDER_PERIOD_TTL_SECONDS,
        UNKNOWN_PERIOD_FALLBACK_MS,
      ],
    );
    if (!Array.isArray(result) || result.length < 2) throw new Error('Unexpected budget reservation result');
    if (Number(result[0]) === 1) {
      return {
        allowed: true,
        monthCount: Number(result[1]),
        dayCount: Number(result[2]),
        providerPeriodCount: Number(result[3]),
      };
    }
    const reason = String(result[1]);
    if (reason === 'PROVIDER_PERIOD_BUDGET') {
      const untilMs = Number(result[2] ?? 0);
      return { allowed: false, reason, untilMs: Number.isFinite(untilMs) && untilMs > 0 ? untilMs : 0 };
    }
    if (reason === 'LOCK_LOST' || reason === 'COOLDOWN' || reason === 'MONTHLY_BUDGET' || reason === 'DAILY_BUDGET') {
      return { allowed: false, reason };
    }
    throw new Error('Unexpected budget reservation result');
  }
}

function isCachedSnapshot(value: unknown): value is CachedMarketSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.equities)) return false;
  if (!isIso(value.equities.refreshedAt) || !Array.isArray(value.equities.items)) return false;
  const items = value.equities.items as unknown[];
  if (items.length !== FEATURED_NGX_EQUITIES.length) return false;
  const itemsValid = items.every((item, index) => isQuote(item) && item.symbol === FEATURED_NGX_EQUITIES[index].symbol);
  if (!itemsValid) return false;
  if (value.summary === null) return true;
  return isRecord(value.summary) && isIso(value.summary.refreshedAt) && isSummary(value.summary.data);
}

function isQuote(value: unknown): value is NormalizedEquityQuote {
  if (!isRecord(value) || typeof value.symbol !== 'string' || typeof value.companyName !== 'string') return false;
  if (typeof value.available !== 'boolean') return false;
  if (value.available) {
    return (
      isNumber(value.lastPriceNgn) &&
      parseStrictInstant(value.quoteTimestamp) !== null &&
      isNullableNumber(value.dailyChangePercent)
    );
  }
  return value.lastPriceNgn === null && value.quoteTimestamp === null && value.dailyChangePercent === null;
}

function isSummary(value: unknown): value is MarketSummary {
  if (!isRecord(value) || typeof value.tradingDate !== 'string') return false;
  const numeric: Array<keyof MarketSummary> = [
    'allShareIndex',
    'allShareIndexChange',
    'allShareIndexChangePercent',
    'equityMarketCapitalisation',
    'totalMarketCapitalisation',
  ];
  return numeric.every((key) => isNullableNumber(value[key])) && (value.providerUpdatedAt === null || isIso(value.providerUpdatedAt));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function isNullableNumber(value: unknown): boolean {
  return value === null || isNumber(value);
}
function isIso(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
