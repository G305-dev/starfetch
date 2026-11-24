import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ERROR_CODES } from '../../common/errors/error-codes';
import {
  AUTH_FAILURE_COOLDOWN_SECONDS,
  CACHE_WRITE_RESERVE_MS,
  COMPANIES_MAX_ATTEMPTS,
  DATA_DELAY_NOTICE,
  DEFAULT_QUOTA_COOLDOWN_SECONDS,
  DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS,
  FAILURE_COOLDOWN_SECONDS,
  LOCAL_MEMO_TTL_MS,
  LOCK_RELEASE_WAIT_MS,
  MARKET_DATA_CLOCK,
  MARKET_DATA_PROVIDER_CLIENT,
  MARKET_DATA_SETTINGS,
  MARKET_DATA_STORE,
  MAX_QUOTA_COOLDOWN_SECONDS,
  MAX_QUOTE_AGE_MS,
  MAX_RATE_LIMIT_COOLDOWN_SECONDS,
  MAX_STALE_SERVE_SECONDS,
  MIN_PROVIDER_ATTEMPT_MS,
  NGN_MARKET_COMPANIES_PATH,
  NGN_MARKET_SNAPSHOT_PATH,
  PROVIDER_ATTRIBUTION,
  PROVIDER_NAME,
  PROVIDER_REMAINING_RESERVE,
  PROVIDER_RESET_GRACE_SECONDS,
  PROVIDER_TIMEOUT_MS,
  PROVIDER_URL,
  REFRESH_DEADLINE_MS,
  REFRESH_LOCK_TTL_MS,
  RETRY_BACKOFF_MS,
  SNAPSHOT_MAX_ATTEMPTS,
  STALE_GRACE_SECONDS,
} from './market-data.constants';
import {
  lagosParts,
  refreshIntervalSecondsAt,
  secondsUntilNextLagosDay,
  secondsUntilNextLagosMonth,
} from './market-data.schedule';
import { MarketDataSettings } from './market-data.settings';
import { MarketDataStore } from './market-data.store';
import {
  CachedMarketSnapshot,
  ProviderQuotaMeta,
  PublicEquityQuote,
  PublicMarketSnapshot,
  StaleReason,
  UnavailableReason,
} from './market-data.types';
import { NgnMarketClient } from './ngn-market.client';
import {
  checkQuoteInstant,
  isSummaryCurrent,
  parseCompaniesResponse,
  parseSnapshotResponse,
  unavailableQuote,
  validResetAtMs,
} from './ngn-market.validation';

export interface MarketDataClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const systemClock: MarketDataClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

type RefreshOutcome = { kind: 'refreshed'; snapshot: CachedMarketSnapshot } | { kind: 'not_refreshed'; reason: StaleReason };
type CallOutcome =
  | { kind: 'ok'; body: unknown }
  | { kind: 'failed'; reason: StaleReason; detail: string; cooldown: boolean };

/** Per-refresh state: lock ownership token and the overall deadline (epoch ms). */
interface RefreshContext {
  token: string;
  deadlineMs: number;
  providerResetObserved: boolean;
}

/** Thrown internally when a step would start, or did not finish, before the refresh deadline. */
class DeadlineExceededError extends Error {
  constructor() {
    super('market data refresh deadline exceeded');
    this.name = 'DeadlineExceededError';
  }
}

/**
 * Races `operation` against the time left until `deadlineMs` (by the injected
 * clock). Refuses to start when no time is left, and rejects with
 * DeadlineExceededError if the operation is still pending at the deadline or
 * the clock has passed the deadline by the time it settles. The underlying
 * request may still complete; every write it could perform is
 * ownership-guarded and monotonic, so a late completion is harmless.
 */
export async function withDeadline<T>(clock: MarketDataClock, deadlineMs: number, operation: () => Promise<T>): Promise<T> {
  const remaining = deadlineMs - clock.now();
  if (remaining <= 0) throw new DeadlineExceededError();
  let timer: NodeJS.Timeout | undefined;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DeadlineExceededError()), remaining);
    timer.unref?.();
  });
  try {
    const result = await Promise.race([operation(), expiry]);
    if (clock.now() > deadlineMs) throw new DeadlineExceededError();
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const RETRY_AFTER_SECONDS: Record<UnavailableReason, number> = {
  REFRESH_IN_PROGRESS: 5,
  REFRESH_FAILED: 300,
  REFRESH_PAUSED: 300,
  CACHE_UNAVAILABLE: 60,
  QUOTES_EXPIRED: 300,
};

/**
 * Serves the public market snapshot from the shared Upstash cache and, only
 * when the cache is due, refreshes it from NGN Market under a distributed
 * lock and a hard, attempt-counted budget.
 *
 * Fail-safe rules:
 *  - Disabled/misconfigured → 503 FEATURE_UNAVAILABLE, zero Redis/provider calls.
 *  - One overall deadline (REFRESH_DEADLINE_MS from request start) bounds every
 *    step of a refresh; nothing starts after it, and the lock (never renewed)
 *    outlives it. Lock ownership is re-checked atomically before every provider
 *    attempt and at the cache write.
 *  - Each equity is served only while its own quote timestamp is ≤ 7 days old
 *    (checked at normalisation and on every response), independently of the
 *    cache-age safeguard.
 *  - Any Redis error → no provider call (stale cache if already read, else 503).
 *  - Budget exhausted / cooldown / lock held → no provider call.
 *  - Nothing is fabricated: unavailable values are null and stale data is labelled.
 */
@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private memo: { snapshot: CachedMarketSnapshot; atMs: number; staleReason: StaleReason | null } | null = null;

  constructor(
    @Inject(MARKET_DATA_SETTINGS) private readonly settings: MarketDataSettings,
    @Inject(MARKET_DATA_STORE) private readonly store: MarketDataStore | undefined,
    @Inject(MARKET_DATA_PROVIDER_CLIENT) private readonly client: NgnMarketClient | undefined,
    @Inject(MARKET_DATA_CLOCK) private readonly clock: MarketDataClock,
  ) {
    if (settings.state === 'disabled' && settings.reason !== 'FLAG_OFF') {
      // Reason codes only — never configuration values.
      this.logger.warn(`Market data integration is disabled (${settings.reason}).`);
    }
  }

  /** Test seam: lets specs disable the per-instance memo. */
  memoTtlMs = LOCAL_MEMO_TTL_MS;

  async getPublicSnapshot(): Promise<PublicMarketSnapshot> {
    const settings = this.settings;
    if (settings.state !== 'enabled' || !this.store || !this.client) throw disabledError();
    const nowMs = this.clock.now();
    const deadlineMs = nowMs + REFRESH_DEADLINE_MS;

    const memo = this.memo;
    if (memo && nowMs - memo.atMs < this.memoTtlMs && (memo.staleReason !== null || !this.isDue(memo.snapshot, nowMs))) {
      return this.serve(memo.snapshot, nowMs, memo.staleReason);
    }

    let cached: CachedMarketSnapshot | null;
    try {
      cached = await this.store.readSnapshot();
    } catch {
      this.logger.warn('Market data cache read failed; serving unavailable without provider call.');
      throw unavailableError('CACHE_UNAVAILABLE');
    }

    if (cached && !this.isDue(cached, nowMs)) {
      this.memo = { snapshot: cached, atMs: nowMs, staleReason: null };
      return this.serve(cached, nowMs, null);
    }

    const outcome = await this.refresh(cached, deadlineMs);
    const afterMs = this.clock.now();
    if (outcome.kind === 'refreshed') {
      this.memo = { snapshot: outcome.snapshot, atMs: afterMs, staleReason: null };
      return this.serve(outcome.snapshot, afterMs, null);
    }

    // Cache-age safeguard (separate from the per-quote 7-day rule applied in serve()).
    if (cached && this.ageSeconds(cached.equities.refreshedAt, afterMs) <= MAX_STALE_SERVE_SECONDS) {
      this.memo = { snapshot: cached, atMs: afterMs, staleReason: outcome.reason };
      return this.serve(cached, afterMs, outcome.reason);
    }
    throw unavailableError(outcome.reason);
  }

  /**
   * Presents a snapshot, applying the per-quote 7-day rule at serve time. A
   * response in which no equity remains available is not served (503) — old
   * quotes are never passed off as current, whatever the cache age.
   */
  private serve(snapshot: CachedMarketSnapshot, nowMs: number, staleReason: StaleReason | null): PublicMarketSnapshot {
    const presented = this.present(snapshot, nowMs, staleReason);
    if (!presented.equities.some((equity) => equity.available)) {
      throw unavailableError(staleReason ?? 'QUOTES_EXPIRED');
    }
    return presented;
  }

  private isDue(snapshot: CachedMarketSnapshot, nowMs: number): boolean {
    const interval = this.intervalAt(nowMs);
    return this.ageSeconds(snapshot.equities.refreshedAt, nowMs) >= interval;
  }

  private intervalAt(nowMs: number): number {
    const settings = this.settings as Extract<MarketDataSettings, { state: 'enabled' }>;
    return refreshIntervalSecondsAt(nowMs, settings.refreshIntervalSeconds);
  }

  private ageSeconds(iso: string, nowMs: number): number {
    return Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 1_000));
  }

  private async refresh(cached: CachedMarketSnapshot | null, deadlineMs: number): Promise<RefreshOutcome> {
    const store = this.store as MarketDataStore;
    try {
      if (await withDeadline(this.clock, deadlineMs, () => store.getCooldown())) {
        return { kind: 'not_refreshed', reason: 'REFRESH_PAUSED' };
      }
    } catch (error) {
      if (error instanceof DeadlineExceededError) return this.deadlineExceeded('cooldown check');
      this.logger.warn('Market data cooldown check failed; skipping provider refresh.');
      return { kind: 'not_refreshed', reason: 'REFRESH_PAUSED' };
    }

    const context: RefreshContext = { token: randomUUID(), deadlineMs, providerResetObserved: false };
    let acquired: boolean;
    try {
      acquired = await withDeadline(this.clock, deadlineMs, () => store.acquireLock(context.token, REFRESH_LOCK_TTL_MS));
    } catch (error) {
      if (error instanceof DeadlineExceededError) {
        // The SET NX may still land: release (owner-only) so the lock is not held for its full TTL.
        await this.releaseLock(context.token);
        return this.deadlineExceeded('lock acquisition');
      }
      this.logger.warn('Market data lock acquisition failed; skipping provider refresh.');
      return { kind: 'not_refreshed', reason: 'REFRESH_PAUSED' };
    }
    if (!acquired) return { kind: 'not_refreshed', reason: 'REFRESH_IN_PROGRESS' };

    try {
      // Double-check under the lock: another instance may have just refreshed.
      let latest: CachedMarketSnapshot | null;
      try {
        latest = await withDeadline(this.clock, deadlineMs, () => store.readSnapshot());
      } catch (error) {
        if (error instanceof DeadlineExceededError) return this.deadlineExceeded('lock double-check');
        return { kind: 'not_refreshed', reason: 'REFRESH_PAUSED' };
      }
      if (latest && !this.isDue(latest, this.clock.now())) return { kind: 'refreshed', snapshot: latest };
      return await this.runRefresh(latest ?? cached, context);
    } finally {
      await this.releaseLock(context.token);
    }
  }

  /** Owner-only release with a short bounded wait; the lock otherwise expires on its own (never renewed). */
  private async releaseLock(token: string): Promise<void> {
    const store = this.store as MarketDataStore;
    try {
      await withDeadline(this.clock, this.clock.now() + LOCK_RELEASE_WAIT_MS, () => store.releaseLock(token));
    } catch {
      this.logger.warn('Market data lock release failed; lock will expire automatically.');
    }
  }

  private deadlineExceeded(step: string): RefreshOutcome {
    this.logger.warn(`Market data refresh deadline reached during ${step}; no further refresh steps.`);
    return { kind: 'not_refreshed', reason: 'REFRESH_FAILED' };
  }

  private async runRefresh(base: CachedMarketSnapshot | null, context: RefreshContext): Promise<RefreshOutcome> {
    const store = this.store as MarketDataStore;
    const companies = await this.callWithBudget(NGN_MARKET_COMPANIES_PATH, COMPANIES_MAX_ATTEMPTS, context);
    if (companies.kind === 'failed') {
      this.logger.warn(`Market data equities refresh failed (${companies.detail}).`);
      if (companies.cooldown) await this.safeCooldown('REFRESH_FAILED', FAILURE_COOLDOWN_SECONDS, context.deadlineMs);
      return { kind: 'not_refreshed', reason: companies.reason };
    }
    const parsedCompanies = parseCompaniesResponse(companies.body, new Date(this.clock.now()));
    if (!parsedCompanies.ok) {
      this.logger.warn(`Market data equities response rejected (${parsedCompanies.error}).`);
      await this.safeCooldown('REFRESH_FAILED', FAILURE_COOLDOWN_SECONDS, context.deadlineMs);
      return { kind: 'not_refreshed', reason: 'REFRESH_FAILED' };
    }
    const equitiesRefreshedAt = new Date(this.clock.now()).toISOString();

    // Summary is optional: failure (or no time left) keeps the previous provider summary with its own refresh time.
    let summary = base?.summary ?? null;
    const snapshotCall = await this.callWithBudget(NGN_MARKET_SNAPSHOT_PATH, SNAPSHOT_MAX_ATTEMPTS, context);
    if (snapshotCall.kind === 'ok') {
      const parsedSummary = parseSnapshotResponse(snapshotCall.body, new Date(this.clock.now()));
      if (parsedSummary.ok) {
        summary = { refreshedAt: new Date(this.clock.now()).toISOString(), data: parsedSummary.value };
      } else {
        this.logger.warn(`Market data summary response rejected (${parsedSummary.error}).`);
      }
    } else {
      this.logger.warn(`Market data summary refresh skipped or failed (${snapshotCall.detail}).`);
    }

    const snapshot: CachedMarketSnapshot = {
      schemaVersion: 1,
      equities: { refreshedAt: equitiesRefreshedAt, items: parsedCompanies.value },
      summary,
    };
    try {
      const written = await withDeadline(this.clock, context.deadlineMs, () =>
        store.writeSnapshotIfOwner(context.token, snapshot),
      );
      if (written !== 'OK') {
        this.logger.warn(`Market data cache write refused (${written}); serving this refresh without caching.`);
      }
    } catch (error) {
      const detail = error instanceof DeadlineExceededError ? 'DEADLINE' : 'REDIS_ERROR';
      this.logger.warn(`Market data cache write failed (${detail}); serving this refresh without caching.`);
    }
    return { kind: 'refreshed', snapshot };
  }

  /**
   * Performs up to `maxAttempts` provider requests. EVERY attempt reserves one
   * unit of the shared budget before it is made, so failures and retries count.
   * The reservation also re-checks lock ownership atomically. Only timeouts,
   * network errors and 5xx are retried, and no attempt (or backoff) starts
   * unless enough time remains before the deadline for it and the cache write.
   */
  private async callWithBudget(path: string, maxAttempts: number, context: RefreshContext): Promise<CallOutcome> {
    const settings = this.settings as Extract<MarketDataSettings, { state: 'enabled' }>;
    const store = this.store as MarketDataStore;
    const client = this.client as NgnMarketClient;
    let lastDetail = 'NO_ATTEMPT';
    let attempted = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (attempt > 1) {
        const backoff = RETRY_BACKOFF_MS * (attempt - 1);
        if (this.attemptWindowMs(context, backoff) < MIN_PROVIDER_ATTEMPT_MS) break;
        await this.clock.sleep(backoff);
      }
      if (this.attemptWindowMs(context) < MIN_PROVIDER_ATTEMPT_MS) break;

      const nowMs = this.clock.now();
      const { month, date } = lagosParts(nowMs);
      let reservation;
      try {
        reservation = await withDeadline(this.clock, context.deadlineMs, () =>
          store.reserveAttempt(month, date, settings.monthlyCallBudget, settings.dailyCallBudget, context.token, nowMs),
        );
      } catch (error) {
        if (error instanceof DeadlineExceededError) break;
        return { kind: 'failed', reason: 'REFRESH_PAUSED', detail: 'BUDGET_STORE_UNAVAILABLE', cooldown: false };
      }
      if (!reservation.allowed) {
        if (reservation.reason === 'LOCK_LOST') {
          this.logger.warn('Market data refresh lock was lost; no further provider attempts.');
          return { kind: 'failed', reason: 'REFRESH_IN_PROGRESS', detail: 'LOCK_LOST', cooldown: false };
        }
        if (reservation.reason === 'DAILY_BUDGET') {
          await this.safeCooldown('DAILY_BUDGET', secondsUntilNextLagosDay(nowMs), context.deadlineMs);
        } else if (reservation.reason === 'MONTHLY_BUDGET') {
          await this.safeCooldown('MONTHLY_BUDGET', secondsUntilNextLagosMonth(nowMs), context.deadlineMs);
        } else if (reservation.reason === 'PROVIDER_PERIOD_BUDGET') {
          const seconds = reservation.untilMs > nowMs ? Math.ceil((reservation.untilMs - nowMs) / 1_000) : DEFAULT_QUOTA_COOLDOWN_SECONDS;
          await this.safeCooldown('PROVIDER_PERIOD_BUDGET', Math.min(seconds, MAX_QUOTA_COOLDOWN_SECONDS), context.deadlineMs);
        }
        return { kind: 'failed', reason: 'REFRESH_PAUSED', detail: reservation.reason, cooldown: false };
      }

      // Re-check after the reservation round-trip: the unit stays counted (conservative), but no
      // attempt is started without a usable window before the deadline.
      if (this.attemptWindowMs(context) < MIN_PROVIDER_ATTEMPT_MS) break;
      attempted = true;
      const outcome = await client.request(path, this.attemptWindowMs(context));
      if (outcome.kind === 'success' || outcome.kind === 'http_error') await this.observeQuota(outcome.meta, context);

      if (outcome.kind === 'success') return { kind: 'ok', body: outcome.body };
      if (outcome.kind === 'timeout' || outcome.kind === 'network_error') {
        lastDetail = outcome.kind.toUpperCase();
        continue;
      }
      if (outcome.kind === 'malformed_body') {
        return { kind: 'failed', reason: 'REFRESH_FAILED', detail: `MALFORMED_BODY_${outcome.status}`, cooldown: true };
      }

      const detail = `HTTP_${outcome.status}${outcome.code ? `_${outcome.code}` : ''}`;
      if (outcome.status === 401 || outcome.status === 403) {
        this.logger.error(`NGN Market rejected the configured credentials or plan (${detail}); pausing refreshes.`);
        await this.safeCooldown('PROVIDER_AUTH', AUTH_FAILURE_COOLDOWN_SECONDS, context.deadlineMs);
        return { kind: 'failed', reason: 'REFRESH_FAILED', detail, cooldown: false };
      }
      if (outcome.status === 429) {
        if (outcome.code === 'QUOTA_EXCEEDED') {
          await this.safeCooldown('PROVIDER_QUOTA', this.secondsUntilProviderReset(outcome.meta.resetAt), context.deadlineMs);
        } else {
          const seconds = Math.min(Math.max(outcome.retryAfterSeconds ?? DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS, 1), MAX_RATE_LIMIT_COOLDOWN_SECONDS);
          await this.safeCooldown('PROVIDER_RATE_LIMIT', seconds, context.deadlineMs);
        }
        return { kind: 'failed', reason: 'REFRESH_PAUSED', detail, cooldown: false };
      }
      if (outcome.status >= 500) {
        lastDetail = detail;
        continue;
      }
      return { kind: 'failed', reason: 'REFRESH_FAILED', detail, cooldown: true };
    }
    if (!attempted) {
      // Deadline reached before any attempt: nothing was spent, no cooldown.
      return { kind: 'failed', reason: 'REFRESH_FAILED', detail: 'DEADLINE', cooldown: false };
    }
    return { kind: 'failed', reason: 'REFRESH_FAILED', detail: lastDetail === 'NO_ATTEMPT' ? 'DEADLINE' : lastDetail, cooldown: true };
  }

  /** Time available for a provider attempt (after `afterMs` more), keeping the cache-write reserve. */
  private attemptWindowMs(context: RefreshContext, afterMs = 0): number {
    return Math.min(PROVIDER_TIMEOUT_MS, context.deadlineMs - this.clock.now() - afterMs - CACHE_WRITE_RESERVE_MS);
  }

  /**
   * Protects the shared provider pool using the provider's own report: pauses
   * at/below the remaining-calls reserve, and records a validated `reset_at` as
   * the provider quota period end (once per refresh; malformed values ignored).
   */
  private async observeQuota(meta: ProviderQuotaMeta, context: RefreshContext): Promise<void> {
    const nowMs = this.clock.now();
    const resetAtMs = validResetAtMs(meta.resetAt, nowMs);
    if (meta.resetAt !== null && resetAtMs === null) {
      this.logger.warn('NGN Market reset_at is outside the accepted range; ignored for budgeting.');
    }
    if (resetAtMs !== null && !context.providerResetObserved) {
      context.providerResetObserved = true;
      try {
        await withDeadline(this.clock, context.deadlineMs, () =>
          (this.store as MarketDataStore).observeProviderReset(resetAtMs, nowMs),
        );
      } catch {
        this.logger.warn('Market data provider quota period could not be recorded.');
      }
    }
    if (meta.callsRemaining === null || meta.callsRemaining > PROVIDER_REMAINING_RESERVE) return;
    this.logger.warn(`NGN Market reports ${meta.callsRemaining} calls remaining; pausing refreshes until quota reset.`);
    await this.safeCooldown('PROVIDER_QUOTA_RESERVE', this.secondsUntilProviderReset(meta.resetAt), context.deadlineMs);
  }

  /** Seconds until a validated provider reset + grace (never early); conservative default otherwise. */
  private secondsUntilProviderReset(resetAt: string | null): number {
    const nowMs = this.clock.now();
    const resetAtMs = validResetAtMs(resetAt, nowMs);
    if (resetAtMs === null) return DEFAULT_QUOTA_COOLDOWN_SECONDS;
    const seconds = Math.ceil((resetAtMs - nowMs) / 1_000) + PROVIDER_RESET_GRACE_SECONDS;
    return Math.min(seconds, MAX_QUOTA_COOLDOWN_SECONDS);
  }

  private async safeCooldown(reason: string, seconds: number, deadlineMs: number): Promise<void> {
    try {
      await withDeadline(this.clock, deadlineMs, () => (this.store as MarketDataStore).setCooldown(reason, seconds));
    } catch {
      this.logger.warn(`Market data cooldown (${reason}) could not be recorded.`);
    }
  }

  private present(snapshot: CachedMarketSnapshot, nowMs: number, staleReason: StaleReason | null): PublicMarketSnapshot {
    const interval = this.intervalAt(nowMs);
    const refreshedAtMs = Date.parse(snapshot.equities.refreshedAt);
    const ageSeconds = this.ageSeconds(snapshot.equities.refreshedAt, nowMs);
    const isStale = ageSeconds > interval + STALE_GRACE_SECONDS;

    let marketSummary: PublicMarketSnapshot['marketSummary'] = null;
    if (snapshot.summary) {
      const summaryAge = this.ageSeconds(snapshot.summary.refreshedAt, nowMs);
      if (summaryAge <= MAX_STALE_SERVE_SECONDS && isSummaryCurrent(snapshot.summary.data, nowMs)) {
        marketSummary = {
          ...snapshot.summary.data,
          refreshedAt: snapshot.summary.refreshedAt,
          isStale: summaryAge > interval + STALE_GRACE_SECONDS,
        };
      }
    }

    return {
      status: isStale ? 'stale' : 'ok',
      provider: { name: PROVIDER_NAME, url: PROVIDER_URL, attribution: PROVIDER_ATTRIBUTION },
      dataType: 'delayed',
      delayNotice: DATA_DELAY_NOTICE,
      cache: {
        refreshedAt: snapshot.equities.refreshedAt,
        ageSeconds,
        refreshIntervalSeconds: interval,
        nextRefreshDueAt: new Date(refreshedAtMs + interval * 1_000).toISOString(),
        isStale,
        staleReason: isStale ? (staleReason ?? 'REFRESH_FAILED') : null,
      },
      equities: snapshot.equities.items.map((item) => presentEquity(item, nowMs)),
      marketSummary,
      generatedAt: new Date(nowMs).toISOString(),
    };
  }
}

/**
 * Serve-time per-quote check: an equity whose own quote timestamp is now older
 * than 7 days (or later than the clock) is served as unavailable. The stored
 * quote timestamp is passed through unchanged; nothing is substituted.
 */
function presentEquity(item: CachedMarketSnapshot['equities']['items'][number], nowMs: number): PublicEquityQuote {
  if (!item.available) return { ...item, quoteAgeSeconds: null };
  const check = checkQuoteInstant(item.quoteTimestamp, nowMs);
  if (!check.ok) return { ...unavailableQuote(item.symbol, item.companyName, check.reason), quoteAgeSeconds: null };
  return { ...item, quoteAgeSeconds: Math.floor((nowMs - check.ms) / 1_000) };
}

/**
 * Shared-cache lifetime for a successful response: at most 60 s, and never
 * beyond the moment any served quote would pass the 7-day limit or the cache
 * itself would pass the cache-age safeguard. 0 means "do not cache".
 */
export function publicCacheMaxAgeSeconds(snapshot: PublicMarketSnapshot): number {
  const generatedMs = Date.parse(snapshot.generatedAt);
  const expiries: number[] = [Date.parse(snapshot.cache.refreshedAt) + MAX_STALE_SERVE_SECONDS * 1_000];
  for (const equity of snapshot.equities) {
    if (equity.available && equity.quoteTimestamp) expiries.push(Date.parse(equity.quoteTimestamp) + MAX_QUOTE_AGE_MS);
  }
  const summary = snapshot.marketSummary;
  if (summary) {
    expiries.push(Date.parse(summary.refreshedAt) + MAX_STALE_SERVE_SECONDS * 1_000);
    if (summary.providerUpdatedAt) expiries.push(Date.parse(summary.providerUpdatedAt) + MAX_QUOTE_AGE_MS);
    // isSummaryCurrent: trading date is too old once the Lagos date is > 7 days later (Lagos = UTC+1).
    expiries.push(Date.parse(`${summary.tradingDate}T00:00:00.000Z`) + MAX_QUOTE_AGE_MS + 24 * 3_600_000 - 3_600_000);
  }
  const seconds = Math.floor((Math.min(...expiries) - generatedMs) / 1_000);
  return Number.isFinite(seconds) ? Math.max(0, Math.min(PUBLIC_CACHE_MAX_AGE_SECONDS, seconds)) : 0;
}

export const PUBLIC_CACHE_MAX_AGE_SECONDS = 60;

export function disabledError(): HttpException {
  return new HttpException(
    { code: ERROR_CODES.FEATURE_UNAVAILABLE, message: 'Market data is not available.', context: { status: 'disabled' } },
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}

export function unavailableError(reason: UnavailableReason): HttpException {
  return new HttpException(
    {
      code: ERROR_CODES.SERVICE_UNAVAILABLE,
      message: 'Market data is temporarily unavailable.',
      context: { status: 'unavailable', reason, retryAfterSeconds: RETRY_AFTER_SECONDS[reason] },
    },
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}
