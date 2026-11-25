import { HttpException, Logger } from '@nestjs/common';
import {
  FakeMarketDataRedis,
  jsonResponse,
  syntheticCompaniesBody,
  syntheticSnapshotBody,
} from '../../../test/utils/fake-market-data-redis';
import {
  FEATURED_NGX_EQUITIES,
  LOCK_RELEASE_WAIT_MS,
  LOCK_TTL_MARGIN_MS,
  PROVIDER_TIMEOUT_MS,
  REDIS_KEYS,
  REFRESH_DEADLINE_MS,
  REFRESH_LOCK_TTL_MS,
} from './market-data.constants';
import { MarketDataClock, MarketDataService, publicCacheMaxAgeSeconds, systemClock, withDeadline } from './market-data.service';
import { MarketDataSettings } from './market-data.settings';
import { MarketDataStore } from './market-data.store';
import { CachedMarketSnapshot } from './market-data.types';
import { FetchLike, NgnMarketClient } from './ngn-market.client';

const KEY = 'synthetic-ngn-market-key-0123456789';
const ALL = FEATURED_NGX_EQUITIES.map((e) => e.symbol);
/** Thursday 2026-10-22 11:00 WAT — inside the trading window. */
const TRADING_NOW = Date.parse('2026-10-22T10:00:00.000Z');
const QUOTE_TIME = '2026-10-22T09:40:00.000Z';

type Responder = (init: RequestInit) => Promise<Response> | Response;

class FakeClock implements MarketDataClock {
  constructor(public t: number) {}
  now = () => this.t;
  sleep = async (ms: number) => {
    this.t += ms;
  };
  advanceSeconds(seconds: number) {
    this.t += seconds * 1_000;
  }
}

/** Synthetic NGN Market. Routes by path; queued responders first, then the default. */
class FakeProvider {
  readonly calls: string[] = [];
  readonly companies: Responder[] = [];
  readonly snapshot: Responder[] = [];
  companiesDefault: Responder = () => jsonResponse(200, syntheticCompaniesBody(ALL, QUOTE_TIME));
  snapshotDefault: Responder = () => jsonResponse(200, syntheticSnapshotBody(QUOTE_TIME));
  readonly fetch: FetchLike = async (url, init) => {
    const path = url.replace('https://api.ngnmarket.com/v1', '');
    this.calls.push(path.startsWith('/companies') ? 'companies' : path.startsWith('/market/snapshot') ? 'snapshot' : path);
    const responder = path.startsWith('/companies')
      ? this.companies.shift() ?? this.companiesDefault
      : this.snapshot.shift() ?? this.snapshotDefault;
    return responder(init);
  };
  count(kind: 'companies' | 'snapshot') {
    return this.calls.filter((c) => c === kind).length;
  }
}

function enabledSettings(overrides: Partial<Extract<MarketDataSettings, { state: 'enabled' }>> = {}): MarketDataSettings {
  return {
    state: 'enabled',
    apiKey: KEY,
    redisRestUrl: 'https://synthetic-upstash.example.test',
    redisRestToken: 'synthetic-upstash-token-0123456789',
    refreshIntervalSeconds: 1_800,
    monthlyCallBudget: 2_400,
    dailyCallBudget: 120,
    ...overrides,
  };
}

function instance(redis: FakeMarketDataRedis, provider: FakeProvider, clock: FakeClock, settings = enabledSettings()) {
  const store = new MarketDataStore(redis);
  const service = new MarketDataService(settings, store, new NgnMarketClient(provider.fetch, KEY, 5_000), clock);
  service.memoTtlMs = 0;
  return { service, store };
}

function cachedDoc(refreshedAtMs: number, withSummary = false): CachedMarketSnapshot {
  return {
    schemaVersion: 1,
    equities: {
      refreshedAt: new Date(refreshedAtMs).toISOString(),
      items: FEATURED_NGX_EQUITIES.map((e, i) => ({
        symbol: e.symbol,
        companyName: e.companyName,
        lastPriceNgn: 10 + i,
        dailyChangePercent: -0.5,
        quoteTimestamp: '2026-10-21T13:30:00.000Z',
        available: true,
        unavailableReason: null,
      })),
    },
    summary: withSummary
      ? {
          refreshedAt: new Date(refreshedAtMs).toISOString(),
          data: {
            tradingDate: '2026-10-21',
            allShareIndex: 99_000,
            allShareIndexChange: -10,
            allShareIndexChangePercent: -0.01,
            equityMarketCapitalisation: 1,
            totalMarketCapitalisation: 2,
            providerUpdatedAt: '2026-10-21T17:00:00.000Z',
          },
        }
      : null,
  };
}

async function expectHttp(promise: Promise<unknown>, code: string, reason?: string) {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(HttpException);
  const exception = caught as HttpException;
  expect(exception.getStatus()).toBe(503);
  const body = exception.getResponse() as { code: string; context: { status: string; reason?: string } };
  expect(body.code).toBe(code);
  if (reason) expect(body.context.reason).toBe(reason);
  return body;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('MarketDataService', () => {
  let clock: FakeClock;
  let redis: FakeMarketDataRedis;
  let provider: FakeProvider;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    clock = new FakeClock(TRADING_NOW);
    redis = new FakeMarketDataRedis(clock.now);
    provider = new FakeProvider();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    const logged = JSON.stringify([...warn.mock.calls, ...error.mock.calls]);
    expect(logged).not.toContain(KEY); // credentials never logged
    jest.restoreAllMocks();
  });

  describe('disabled / missing configuration', () => {
    it.each(['FLAG_OFF', 'API_KEY_MISSING', 'REDIS_NOT_CONFIGURED', 'REDISTRIBUTION_NOT_APPROVED'] as const)(
      'returns FEATURE_UNAVAILABLE with zero Redis or provider calls (%s)',
      async (reason) => {
        const service = new MarketDataService({ state: 'disabled', reason }, undefined, undefined, clock);
        const body = await expectHttp(service.getPublicSnapshot(), 'FEATURE_UNAVAILABLE');
        expect(body.context).toEqual({ status: 'disabled' }); // reason is never exposed publicly
        expect(provider.calls).toEqual([]);
        expect(redis.commands).toEqual([]);
      },
    );
  });

  describe('refresh, cache and public contract', () => {
    it('cold cache: one refresh = companies + snapshot, both counted, contract populated', async () => {
      const { service } = instance(redis, provider, clock);
      const result = await service.getPublicSnapshot();

      expect(provider.calls).toEqual(['companies', 'snapshot']);
      expect(redis.peek(REDIS_KEYS.budgetMonth('2026-10'))).toBe('2');
      expect(redis.peek(REDIS_KEYS.budgetDay('2026-10-22'))).toBe('2');
      expect(result.status).toBe('ok');
      expect(result.dataType).toBe('delayed');
      expect(result.provider).toEqual({
        name: 'NGN Market',
        url: 'https://ngnmarket.com',
        attribution: 'Market data provided by NGN Market (ngnmarket.com).',
      });
      expect(result.equities.map((e) => e.symbol)).toEqual(ALL);
      expect(result.equities.every((e) => e.available && typeof e.lastPriceNgn === 'number')).toBe(true);
      expect(result.cache).toEqual({
        refreshedAt: new Date(TRADING_NOW).toISOString(),
        ageSeconds: 0,
        refreshIntervalSeconds: 1_800,
        nextRefreshDueAt: new Date(TRADING_NOW + 1_800_000).toISOString(),
        isStale: false,
        staleReason: null,
      });
      expect(result.marketSummary).toMatchObject({ allShareIndex: 100_000.5, tradingDate: '2026-10-22', isStale: false });
    });

    it('distinguishes the provider quote timestamp from the Starfetch cache refresh timestamp', async () => {
      const { service } = instance(redis, provider, clock);
      const first = await service.getPublicSnapshot();
      clock.advanceSeconds(600);
      const later = await service.getPublicSnapshot(); // cache hit
      expect(first.equities[0].quoteTimestamp).toBe(QUOTE_TIME);
      expect(first.cache.refreshedAt).toBe('2026-10-22T10:00:00.000Z');
      expect(later.cache.refreshedAt).toBe('2026-10-22T10:00:00.000Z');
      expect(later.cache.ageSeconds).toBe(600);
      expect(later.generatedAt).toBe('2026-10-22T10:10:00.000Z');
      expect(later.marketSummary?.providerUpdatedAt).toBe(QUOTE_TIME);
      expect(later.marketSummary?.refreshedAt).toBe('2026-10-22T10:00:00.000Z');
    });

    it('cache hit on the same and on another instance makes no provider calls', async () => {
      const a = instance(redis, provider, clock);
      const b = instance(redis, provider, clock);
      await a.service.getPublicSnapshot();
      clock.advanceSeconds(1_799);
      await a.service.getPublicSnapshot();
      const fromB = await b.service.getPublicSnapshot();
      expect(provider.calls).toEqual(['companies', 'snapshot']);
      expect(fromB.status).toBe('ok');
    });

    it('expiry: refreshes once the 30-minute interval elapses (trading hours)', async () => {
      const { service } = instance(redis, provider, clock);
      await service.getPublicSnapshot();
      clock.advanceSeconds(1_800);
      const refreshed = await service.getPublicSnapshot();
      expect(provider.count('companies')).toBe(2);
      expect(refreshed.cache.ageSeconds).toBe(0);
    });

    it('outside trading hours uses the 4-hour interval', async () => {
      clock.t = Date.parse('2026-10-22T19:00:00.000Z'); // 20:00 WAT
      const { service } = instance(redis, provider, clock);
      await service.getPublicSnapshot();
      clock.advanceSeconds(3 * 3_600);
      expect((await service.getPublicSnapshot()).cache.refreshIntervalSeconds).toBe(14_400);
      expect(provider.count('companies')).toBe(1);
      clock.advanceSeconds(3_600);
      await service.getPublicSnapshot();
      expect(provider.count('companies')).toBe(2);
    });

    it('reports missing symbols as unavailable while serving the rest', async () => {
      provider.companiesDefault = () => jsonResponse(200, syntheticCompaniesBody(['DANGCEM', 'GTCO', 'MTNN'], QUOTE_TIME));
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(result.equities).toHaveLength(14);
      expect(result.equities.filter((e) => e.available).map((e) => e.symbol)).toEqual(['DANGCEM', 'GTCO', 'MTNN']);
      expect(result.equities.find((e) => e.symbol === 'NB')).toMatchObject({
        lastPriceNgn: null,
        dailyChangePercent: null,
        quoteTimestamp: null,
        unavailableReason: 'NOT_IN_PROVIDER_RESPONSE',
      });
    });

    it('public payload carries no credentials, raw provider fields, quota data or live/real-time claims', async () => {
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      const json = JSON.stringify(result);
      expect(json).not.toContain(KEY);
      expect(json).not.toMatch(/calls_remaining|calls_used|reset_at|prev_close|market_cap"|logo_url|SYNTHETIC/);
      expect(json).not.toMatch(/\blive\b|real-?time/i);
    });

    it('summary is optional: a failed snapshot leaves it null on a cold cache (never derived)', async () => {
      provider.snapshotDefault = () => jsonResponse(500, { success: false, error: { code: 'SERVER_ERROR' } });
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(result.status).toBe('ok');
      expect(result.marketSummary).toBeNull();
      expect(provider.calls).toEqual(['companies', 'snapshot']); // snapshot: single attempt, no retry
    });

    it('a failed snapshot keeps the previous provider summary with its own (older) refresh time', async () => {
      redis.seed(REDIS_KEYS.snapshot, JSON.stringify(cachedDoc(TRADING_NOW - 3 * 3_600_000, true)));
      provider.snapshotDefault = () => jsonResponse(500, { success: false });
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(result.cache.ageSeconds).toBe(0);
      expect(result.marketSummary).toMatchObject({
        tradingDate: '2026-10-21',
        refreshedAt: new Date(TRADING_NOW - 3 * 3_600_000).toISOString(),
        isStale: true,
      });
    });

    it('per-instance memo avoids repeated Redis reads within 15 s', async () => {
      const { service } = instance(redis, provider, clock);
      service.memoTtlMs = 15_000;
      await service.getPublicSnapshot();
      const reads = redis.countOf('GET');
      clock.advanceSeconds(10);
      await service.getPublicSnapshot();
      expect(redis.countOf('GET')).toBe(reads);
    });
  });

  describe('market summary with the provider UTC-midnight trading date', () => {
    it('a provider snapshot whose date is UTC midnight populates the summary (normalised, cached, updated_at kept separate)', async () => {
      const body = syntheticSnapshotBody(QUOTE_TIME) as { data: Record<string, unknown> };
      expect(body.data.date).toBe('2026-10-22T00:00:00.000Z'); // fixture mirrors the observed provider format
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(result.status).toBe('ok');
      expect(result.marketSummary).toEqual({
        tradingDate: '2026-10-22',
        allShareIndex: 100_000.5,
        allShareIndexChange: 500.25,
        allShareIndexChangePercent: 0.5,
        equityMarketCapitalisation: 50_000,
        totalMarketCapitalisation: 60_000,
        providerUpdatedAt: QUOTE_TIME,
        refreshedAt: new Date(TRADING_NOW).toISOString(),
        isStale: false,
      });
      const cached = JSON.parse(redis.peek(REDIS_KEYS.snapshot) as string) as CachedMarketSnapshot;
      expect(cached.summary?.data.tradingDate).toBe('2026-10-22');
      expect(provider.calls).toEqual(['companies', 'snapshot']);
    });

    it('a summary rejected for its date leaves marketSummary null while all equities stay available (no cooldown, no extra call)', async () => {
      provider.snapshotDefault = () => {
        const body = syntheticSnapshotBody(QUOTE_TIME) as { data: Record<string, unknown> };
        body.data.date = '2026-10-22T09:40:00.000Z'; // not midnight: never truncated into a date
        return jsonResponse(200, body);
      };
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(result.status).toBe('ok');
      expect(result.marketSummary).toBeNull();
      expect(result.equities.every((e) => e.available)).toBe(true);
      expect(provider.calls).toEqual(['companies', 'snapshot']);
      expect(redis.peek(REDIS_KEYS.budgetMonth('2026-10'))).toBe('2');
      expect(redis.peek(REDIS_KEYS.cooldown)).toBeNull();
      const logged = JSON.stringify(warn.mock.calls);
      expect(logged).toContain('MALFORMED_SUMMARY');
      expect(logged).not.toContain('2026-10-22T09:40:00.000Z'); // reason code only, never the provider value
    });

    it('a cached summary expires after 7 days even when newer equities keep being refreshed', async () => {
      await instance(redis, provider, clock).service.getPublicSnapshot();
      clock.t = TRADING_NOW + 7 * 86_400_000 + 3_600_000; // the following Thursday, 11:00Z
      const laterQuote = new Date(clock.t - 20 * 60_000).toISOString();
      provider.companiesDefault = () => jsonResponse(200, syntheticCompaniesBody(ALL, laterQuote));
      provider.snapshotDefault = () => jsonResponse(500, { success: false, error: { code: 'SERVER_ERROR' } });
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(result.status).toBe('ok');
      expect(result.equities.every((e) => e.available && e.quoteTimestamp === laterQuote)).toBe(true);
      expect(result.marketSummary).toBeNull(); // the 22 Oct summary is kept in the cache but never served as current
    });

    it('after deployment: a fresh cached snapshot with a null summary is not refetched early; the next scheduled refresh fills it', async () => {
      redis.seed(REDIS_KEYS.snapshot, JSON.stringify(cachedDoc(TRADING_NOW - 600_000, false)));
      redis.seed(REDIS_KEYS.budgetMonth('2026-10'), '57');
      const { service } = instance(redis, provider, clock);
      const before = await service.getPublicSnapshot();
      expect(before.marketSummary).toBeNull();
      expect(provider.calls).toEqual([]); // no early provider call, no cache flush needed
      clock.advanceSeconds(1_800 - 600);
      const after = await service.getPublicSnapshot();
      expect(provider.calls).toEqual(['companies', 'snapshot']);
      expect(after.marketSummary).toMatchObject({ tradingDate: '2026-10-22', isStale: false });
      expect(redis.peek(REDIS_KEYS.budgetMonth('2026-10'))).toBe('59'); // existing counters continue, never reset
    });
  });

  describe('distributed lock / multi-instance concurrency', () => {
    it('cold cache: 12 concurrent requests across 3 instances cause exactly one upstream refresh', async () => {
      const gate = deferred<void>();
      const called = deferred<void>();
      provider.companies.push(async () => {
        called.resolve();
        await gate.promise;
        return jsonResponse(200, syntheticCompaniesBody(ALL, QUOTE_TIME));
      });
      const instances = [instance(redis, provider, clock), instance(redis, provider, clock), instance(redis, provider, clock)];
      const requests = Array.from({ length: 12 }, (_, i) => instances[i % 3].service.getPublicSnapshot().then(
        (value) => ({ ok: true as const, value }),
        (reason: HttpException) => ({ ok: false as const, reason }),
      ));
      await called.promise;
      gate.resolve();
      const results = await Promise.all(requests);

      expect(provider.calls).toEqual(['companies', 'snapshot']);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      const rejected = results.filter((r): r is { ok: false; reason: HttpException } => !r.ok);
      expect(rejected).toHaveLength(11);
      for (const r of rejected) {
        expect(r.reason.getResponse()).toMatchObject({ code: 'SERVICE_UNAVAILABLE', context: { reason: 'REFRESH_IN_PROGRESS', retryAfterSeconds: 5 } });
      }
      // Afterwards every instance is served from the shared cache.
      for (const i of instances) expect((await i.service.getPublicSnapshot()).status).toBe('ok');
      expect(provider.count('companies')).toBe(1);
    });

    it('at expiry: concurrent instances do not duplicate the refresh; non-holders serve the cached copy', async () => {
      redis.seed(REDIS_KEYS.snapshot, JSON.stringify(cachedDoc(TRADING_NOW - 1_800_000)));
      const gate = deferred<void>();
      const called = deferred<void>();
      provider.companies.push(async () => {
        called.resolve();
        await gate.promise;
        return jsonResponse(200, syntheticCompaniesBody(ALL, QUOTE_TIME));
      });
      const instances = [instance(redis, provider, clock), instance(redis, provider, clock), instance(redis, provider, clock)];
      const requests = Array.from({ length: 9 }, (_, i) => instances[i % 3].service.getPublicSnapshot());
      await called.promise;
      gate.resolve();
      const results = await Promise.all(requests);
      expect(provider.count('companies')).toBe(1);
      const ages = results.map((r) => r.cache.ageSeconds).sort((x, y) => x - y);
      expect(ages[0]).toBe(0); // the lock holder
      expect(ages.slice(1).every((age) => age === 1_800)).toBe(true); // others: cached, within grace
      expect(results.every((r) => r.status === 'ok')).toBe(true);
    });

    it('double-checks the cache under the lock (a peer that just refreshed prevents a second call)', async () => {
      redis.seed(REDIS_KEYS.snapshot, JSON.stringify(cachedDoc(TRADING_NOW - 1_800_000)));
      const { service, store } = instance(redis, provider, clock);
      const original = store.readSnapshot.bind(store);
      jest.spyOn(store, 'readSnapshot').mockImplementationOnce(async () => {
        const due = await original();
        redis.seed(REDIS_KEYS.snapshot, JSON.stringify(cachedDoc(TRADING_NOW))); // peer finished meanwhile
        return due;
      });
      const result = await service.getPublicSnapshot();
      expect(provider.calls).toEqual([]);
      expect(result.cache.refreshedAt).toBe(new Date(TRADING_NOW).toISOString());
    });
  });

  describe('upstream failures (401, 429, 5xx, timeout, malformed)', () => {
    it('401: single attempt, 1-hour auth cooldown, then no further provider calls', async () => {
      provider.companies.push(() => jsonResponse(401, { success: false, error: { code: 'INVALID_API_KEY', message: 'x' } }));
      const { service } = instance(redis, provider, clock);
      await expectHttp(service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_FAILED');
      expect(provider.calls).toEqual(['companies']);
      expect(redis.peek(REDIS_KEYS.cooldown)).toBe('PROVIDER_AUTH');
      expect(redis.pttl(REDIS_KEYS.cooldown)).toBe(3_600_000);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('HTTP_401_INVALID_API_KEY'));
      clock.advanceSeconds(1_800);
      await expectHttp(service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_PAUSED');
      expect(provider.calls).toEqual(['companies']);
    });

    it('429 RATE_LIMITED: no retry, cooldown honours Retry-After, resumes afterwards', async () => {
      provider.companies.push(() => jsonResponse(429, { success: false, error: { code: 'RATE_LIMITED' } }, { 'retry-after': '120' }));
      const { service } = instance(redis, provider, clock);
      await expectHttp(service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_PAUSED');
      expect(provider.calls).toEqual(['companies']);
      expect(redis.pttl(REDIS_KEYS.cooldown)).toBe(120_000);
      clock.advanceSeconds(121);
      expect((await service.getPublicSnapshot()).status).toBe('ok');
    });

    it('429 QUOTA_EXCEEDED: pauses until the provider reset time + 1 h grace (never early)', async () => {
      const resetAt = new Date(TRADING_NOW + 3 * 86_400_000).toISOString();
      provider.companies.push(() =>
        jsonResponse(429, { success: false, error: { code: 'QUOTA_EXCEEDED' }, meta: { calls_remaining: 0, reset_at: resetAt } }),
      );
      const { service } = instance(redis, provider, clock);
      await expectHttp(service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_PAUSED');
      expect(redis.pttl(REDIS_KEYS.cooldown)).toBe(3 * 86_400_000 + 3_600_000);
      expect(provider.calls).toEqual(['companies']);
    });

    it('5xx: one retry (both attempts counted), failure cooldown, snapshot skipped', async () => {
      provider.companiesDefault = () => jsonResponse(503, { success: false, error: { code: 'SERVER_ERROR' } });
      const { service } = instance(redis, provider, clock);
      await expectHttp(service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_FAILED');
      expect(provider.calls).toEqual(['companies', 'companies']);
      expect(redis.peek(REDIS_KEYS.budgetMonth('2026-10'))).toBe('2');
      expect(redis.peek(REDIS_KEYS.cooldown)).toBe('REFRESH_FAILED');
      expect(redis.pttl(REDIS_KEYS.cooldown)).toBe(600_000);
      await expectHttp(service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_PAUSED');
      expect(provider.calls).toHaveLength(2);
    });

    it('timeout then success: retried after backoff, every attempt counted', async () => {
      provider.companies.push(() => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      });
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(provider.calls).toEqual(['companies', 'companies', 'snapshot']);
      expect(redis.peek(REDIS_KEYS.budgetMonth('2026-10'))).toBe('3');
      expect(result.status).toBe('ok');
    });

    it('malformed data: no retry, previous cache retained and labelled stale', async () => {
      redis.seed(REDIS_KEYS.snapshot, JSON.stringify(cachedDoc(TRADING_NOW - 3 * 3_600_000)));
      provider.companies.push(() => jsonResponse(200, { success: true, data: { unexpected: true } }));
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(provider.calls).toEqual(['companies']);
      expect(result.status).toBe('stale');
      expect(result.cache).toMatchObject({ isStale: true, staleReason: 'REFRESH_FAILED', ageSeconds: 10_800 });
      expect(result.equities[0].lastPriceNgn).toBe(10); // cached value, not invented
      expect(JSON.parse(redis.peek(REDIS_KEYS.snapshot)!).equities.refreshedAt).toBe(new Date(TRADING_NOW - 10_800_000).toISOString());
    });

    it('never serves data older than 7 days: unavailable instead', async () => {
      redis.seed(REDIS_KEYS.snapshot, JSON.stringify(cachedDoc(TRADING_NOW - 8 * 86_400_000)));
      provider.companiesDefault = () => jsonResponse(500, { success: false });
      await expectHttp(instance(redis, provider, clock).service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_FAILED');
    });
  });

  describe('hard budget', () => {
    it('monthly cap reached: zero provider calls, labelled stale data served, paused until next month', async () => {
      redis.seed(REDIS_KEYS.budgetMonth('2026-10'), '2400');
      redis.seed(REDIS_KEYS.snapshot, JSON.stringify(cachedDoc(TRADING_NOW - 3_600_000)));
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(provider.calls).toEqual([]);
      expect(result).toMatchObject({ status: 'stale', cache: { isStale: true, staleReason: 'REFRESH_PAUSED' } });
      expect(redis.peek(REDIS_KEYS.cooldown)).toBe('MONTHLY_BUDGET');
      expect(redis.pttl(REDIS_KEYS.cooldown)).toBe(Date.parse('2026-10-31T23:00:00.000Z') - TRADING_NOW);
    });

    it('monthly cap with no cache: unavailable, never a fabricated fallback', async () => {
      redis.seed(REDIS_KEYS.budgetMonth('2026-10'), '2400');
      await expectHttp(instance(redis, provider, clock).service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_PAUSED');
      expect(provider.calls).toEqual([]);
    });

    it('retries count against the budget: a retry that would exceed the cap is not made', async () => {
      redis.seed(REDIS_KEYS.budgetMonth('2026-10'), '2399');
      provider.companiesDefault = () => jsonResponse(502, { success: false });
      await expectHttp(instance(redis, provider, clock).service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_PAUSED');
      expect(provider.calls).toEqual(['companies']);
      expect(redis.peek(REDIS_KEYS.budgetMonth('2026-10'))).toBe('2400');
    });

    it('daily cap reached: zero calls, paused until the next Lagos day', async () => {
      redis.seed(REDIS_KEYS.budgetDay('2026-10-22'), '120');
      await expectHttp(instance(redis, provider, clock).service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_PAUSED');
      expect(provider.calls).toEqual([]);
      expect(redis.peek(REDIS_KEYS.cooldown)).toBe('DAILY_BUDGET');
      expect(redis.pttl(REDIS_KEYS.cooldown)).toBe(Date.parse('2026-10-22T23:00:00.000Z') - TRADING_NOW);
    });

    it('provider-reported remaining calls at/below the 300 reserve pause refreshes until reset', async () => {
      const resetAt = new Date(TRADING_NOW + 5 * 86_400_000).toISOString();
      provider.companies.push(() =>
        jsonResponse(200, syntheticCompaniesBody(ALL, QUOTE_TIME, {}, { plan: 'free', calls_used: 2_750, calls_remaining: 250, reset_at: resetAt })),
      );
      const { service } = instance(redis, provider, clock);
      const result = await service.getPublicSnapshot();
      expect(result.status).toBe('ok'); // the successful data is still served
      expect(provider.calls).toEqual(['companies']); // snapshot attempt denied by the new cooldown
      expect(redis.peek(REDIS_KEYS.cooldown)).toBe('PROVIDER_QUOTA_RESERVE');
      expect(redis.pttl(REDIS_KEYS.cooldown)).toBe(5 * 86_400_000 + 3_600_000);
      clock.advanceSeconds(3_600);
      expect((await service.getPublicSnapshot()).status).toBe('stale');
      expect(provider.calls).toEqual(['companies']);
    });
  });

  describe('Redis failure: fail safe, never call the provider directly', () => {
    it('cache read failure → CACHE_UNAVAILABLE, zero provider calls', async () => {
      redis.down = true;
      await expectHttp(instance(redis, provider, clock).service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'CACHE_UNAVAILABLE');
      expect(provider.calls).toEqual([]);
    });

    it('lock failure → cached data served as stale, zero provider calls', async () => {
      redis.seed(REDIS_KEYS.snapshot, JSON.stringify(cachedDoc(TRADING_NOW - 3_600_000)));
      redis.failWhen = (command) => command === 'SET';
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(provider.calls).toEqual([]);
      expect(result).toMatchObject({ status: 'stale', cache: { staleReason: 'REFRESH_PAUSED' } });
    });

    it('budget reservation failure → zero provider calls', async () => {
      redis.failWhen = (command) => command === 'EVAL';
      await expectHttp(instance(redis, provider, clock).service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_PAUSED');
      expect(provider.calls).toEqual([]);
    });

    it('cache write failure after a successful (counted) call still serves that data', async () => {
      redis.failWhen = (_command, script) => script === 'WRITE'; // the guarded snapshot write
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(result.status).toBe('ok');
      expect(redis.peek(REDIS_KEYS.snapshot)).toBeNull();
      expect(redis.peek(REDIS_KEYS.lock)).toBeNull(); // lock released
    });
  });
  describe('per-quote 7-day maximum and quote freshness (serve time)', () => {
    const SEVEN_DAYS = 7 * 86_400_000;
    function docWithQuotes(refreshedAtMs: number, quoteTimes: Record<string, string>, fallback: string): CachedMarketSnapshot {
      const doc = cachedDoc(refreshedAtMs);
      doc.equities.items = doc.equities.items.map((item) => ({ ...item, quoteTimestamp: quoteTimes[item.symbol] ?? fallback }));
      return doc;
    }

    it('fresh cache holding an expired quote: that equity is unavailable, the rest served with their own timestamps', async () => {
      const doc = docWithQuotes(TRADING_NOW - 600_000, { GTCO: new Date(TRADING_NOW - SEVEN_DAYS - 1).toISOString() }, QUOTE_TIME);
      redis.seed(REDIS_KEYS.snapshot, JSON.stringify(doc));
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(provider.calls).toEqual([]); // cache not due: freshness of the CACHE is separate
      expect(result.status).toBe('ok');
      expect(result.cache).toMatchObject({ isStale: false, ageSeconds: 600 });
      expect(result.equities.find((e) => e.symbol === 'GTCO')).toEqual({
        symbol: 'GTCO',
        companyName: 'Guaranty Trust Holding Company Plc',
        lastPriceNgn: null,
        dailyChangePercent: null,
        quoteTimestamp: null,
        available: false,
        unavailableReason: 'QUOTE_EXPIRED',
        quoteAgeSeconds: null,
      });
      expect(result.equities.find((e) => e.symbol === 'MTNN')).toMatchObject({
        available: true,
        quoteTimestamp: QUOTE_TIME,
        quoteAgeSeconds: 1_200,
      });
    });

    it('just below, exactly at, and above 7 days (measured from quoteTimestamp, not refreshedAt)', async () => {
      const exactlySeven = new Date(TRADING_NOW - SEVEN_DAYS).toISOString();
      redis.seed(REDIS_KEYS.snapshot, JSON.stringify(docWithQuotes(TRADING_NOW, {}, exactlySeven)));
      const { service } = instance(redis, provider, clock);
      const atLimit = await service.getPublicSnapshot();
      expect(atLimit.equities.every((e) => e.available && e.quoteAgeSeconds === 7 * 86_400)).toBe(true);
      clock.t = TRADING_NOW + 1;
      await expectHttp(service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'QUOTES_EXPIRED');
      expect(provider.calls).toEqual([]);

      const justBelow = new Date(TRADING_NOW - SEVEN_DAYS + 1).toISOString();
      redis.seed(REDIS_KEYS.snapshot, JSON.stringify(docWithQuotes(TRADING_NOW, {}, justBelow)));
      expect((await service.getPublicSnapshot()).equities.every((e) => e.available)).toBe(true);
    });

    it('mixed fresh and expired quotes: only the expired equities become unavailable', async () => {
      const old = new Date(TRADING_NOW - 8 * 86_400_000).toISOString();
      const doc = docWithQuotes(TRADING_NOW - 60_000, { ACCESSCORP: old, NB: old, ZENITHBANK: old }, QUOTE_TIME);
      redis.seed(REDIS_KEYS.snapshot, JSON.stringify(doc));
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(result.equities.filter((e) => !e.available).map((e) => e.symbol)).toEqual(['ACCESSCORP', 'NB', 'ZENITHBANK']);
      expect(result.equities.filter((e) => !e.available).every((e) => e.unavailableReason === 'QUOTE_EXPIRED')).toBe(true);
      expect(result.equities.filter((e) => e.available)).toHaveLength(11);
    });

    it('cache ageing without a refresh: quotes expire on schedule while the provider is paused (limit never extended)', async () => {
      const quoteAt = TRADING_NOW - SEVEN_DAYS + 31 * 60_000; // expires in 31 minutes
      redis.seed(REDIS_KEYS.snapshot, JSON.stringify(docWithQuotes(TRADING_NOW - 3_600_000, {}, new Date(quoteAt).toISOString())));
      redis.seed(REDIS_KEYS.cooldown, 'MANUAL', 30 * 86_400_000); // provider paused (emergency stop)
      const { service } = instance(redis, provider, clock);
      const before = await service.getPublicSnapshot();
      expect(before.equities.every((e) => e.available)).toBe(true);
      expect(before.status).toBe('stale'); // cache is due but refresh paused
      clock.advanceSeconds(31 * 60);
      expect((await service.getPublicSnapshot()).equities.every((e) => e.available)).toBe(true); // exactly 7 days
      clock.advanceSeconds(1);
      await expectHttp(service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_PAUSED');
      expect(provider.calls).toEqual([]);
    });

    it('an old quote in a brand-new fetch never looks fresh: QUOTE_EXPIRED while the cache itself is fresh', async () => {
      provider.companiesDefault = () =>
        jsonResponse(200, syntheticCompaniesBody(ALL, QUOTE_TIME, { SEPLAT: { last_updated: '2026-10-12T10:00:00.000Z' } }));
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(result.cache).toMatchObject({ ageSeconds: 0, isStale: false });
      expect(result.equities.find((e) => e.symbol === 'SEPLAT')).toMatchObject({ available: false, unavailableReason: 'QUOTE_EXPIRED' });
      expect(result.dataType).toBe('delayed');
    });

    it('a fetch whose quotes are all older than 7 days is rejected: previous cache kept, failure cooldown', async () => {
      redis.seed(REDIS_KEYS.snapshot, JSON.stringify(cachedDoc(TRADING_NOW - 3 * 3_600_000)));
      provider.companiesDefault = () => jsonResponse(200, syntheticCompaniesBody(ALL, '2026-10-01T10:00:00.000Z'));
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(result).toMatchObject({ status: 'stale', cache: { staleReason: 'REFRESH_FAILED' } });
      expect(result.equities[0]).toMatchObject({ quoteTimestamp: '2026-10-21T13:30:00.000Z', available: true });
      expect(redis.peek(REDIS_KEYS.cooldown)).toBe('REFRESH_FAILED');
    });

    it('weekend: Friday-close quotes stay available (delayed, with their age) — no trading calendar is invented', async () => {
      clock.t = Date.parse('2026-10-24T11:00:00.000Z'); // Saturday 12:00 WAT
      provider.companiesDefault = () => jsonResponse(200, syntheticCompaniesBody(ALL, '2026-10-23T14:30:00.000Z'));
      provider.snapshotDefault = () => jsonResponse(200, syntheticSnapshotBody('2026-10-23T17:00:00.000Z'));
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(result.status).toBe('ok');
      expect(result.dataType).toBe('delayed');
      expect(result.cache.refreshIntervalSeconds).toBe(14_400);
      expect(result.equities.every((e) => e.available && e.quoteTimestamp === '2026-10-23T14:30:00.000Z')).toBe(true);
      expect(result.equities[0].quoteAgeSeconds).toBe(20.5 * 3_600);
      expect(result.marketSummary).toMatchObject({ tradingDate: '2026-10-23', isStale: false });
      expect(JSON.stringify(result).toLowerCase()).not.toMatch(/real[- ]?time|"live"/);
    });

    it('timestamps are preserved per equity through the cache (never substituted by refresh or generated time)', async () => {
      const overrides = Object.fromEntries(ALL.map((symbol, i) => [symbol, { last_updated: new Date(TRADING_NOW - (i + 1) * 3_600_000).toISOString() }]));
      provider.companiesDefault = () => jsonResponse(200, syntheticCompaniesBody(ALL, QUOTE_TIME, overrides));
      const a = instance(redis, provider, clock);
      await a.service.getPublicSnapshot();
      clock.advanceSeconds(300);
      const fromCache = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(provider.count('companies')).toBe(1);
      fromCache.equities.forEach((e, i) => {
        expect(e.quoteTimestamp).toBe(new Date(TRADING_NOW - (i + 1) * 3_600_000).toISOString());
        expect(e.quoteAgeSeconds).toBe((i + 1) * 3_600 + 300);
      });
      expect(fromCache.cache.refreshedAt).toBe(new Date(TRADING_NOW).toISOString());
      expect(fromCache.generatedAt).toBe(new Date(TRADING_NOW + 300_000).toISOString());
    });

    it('market summary older than 7 days is withheld at serve time (never shown as current)', async () => {
      const doc = cachedDoc(TRADING_NOW - 600_000, true);
      doc.summary!.data = { ...doc.summary!.data, tradingDate: '2026-10-14', providerUpdatedAt: '2026-10-14T17:00:00.000Z' };
      redis.seed(REDIS_KEYS.snapshot, JSON.stringify(doc));
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(result.marketSummary).toBeNull();
    });
  });

  describe('CDN cache lifetime never outlives a served quote', () => {
    it('is 60 s normally, shortened as the earliest quote approaches 7 days, 0 at the limit', async () => {
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(publicCacheMaxAgeSeconds(result)).toBe(60);
      const nearlyExpired = {
        ...result,
        equities: result.equities.map((e, i) =>
          i === 3 ? { ...e, quoteTimestamp: new Date(TRADING_NOW - 7 * 86_400_000 + 20_000).toISOString() } : e,
        ),
      };
      expect(publicCacheMaxAgeSeconds(nearlyExpired)).toBe(20);
      const atLimit = {
        ...result,
        equities: result.equities.map((e, i) => (i === 3 ? { ...e, quoteTimestamp: new Date(TRADING_NOW - 7 * 86_400_000).toISOString() } : e)),
      };
      expect(publicCacheMaxAgeSeconds(atLimit)).toBe(0);
    });
  });

  describe('overall refresh deadline, lock lifetime and ownership', () => {
    it('lock TTL outlives the deadline plus release wait and margin; deadline fits the 8 s frontend timeout', () => {
      expect(REFRESH_LOCK_TTL_MS).toBeGreaterThanOrEqual(REFRESH_DEADLINE_MS + LOCK_RELEASE_WAIT_MS + LOCK_TTL_MARGIN_MS);
      expect(REFRESH_DEADLINE_MS + LOCK_RELEASE_WAIT_MS).toBeLessThan(8_000);
      expect(PROVIDER_TIMEOUT_MS).toBeLessThan(REFRESH_DEADLINE_MS);
    });

    it('withDeadline rejects a hung operation at the deadline (real timers) and refuses to start after it', async () => {
      const started = Date.now();
      await expect(withDeadline(systemClock, Date.now() + 40, () => new Promise(() => undefined))).rejects.toThrow('deadline');
      expect(Date.now() - started).toBeLessThan(1_000);
      const op = jest.fn(async () => 1);
      await expect(withDeadline(systemClock, Date.now() - 1, op)).rejects.toThrow('deadline');
      expect(op).not.toHaveBeenCalled();
    });

    it('acquires the lock once with the fixed TTL and never renews it', async () => {
      const ttls: number[] = [];
      redis.beforeCommand = (command) => {
        if (command === 'SET') ttls.push(redis.pttl(REDIS_KEYS.lock));
      };
      const meta = { plan: 'free', calls_used: 10, calls_remaining: 2_990, reset_at: '2026-11-15T23:57:00.000Z' };
      provider.companiesDefault = () => jsonResponse(200, syntheticCompaniesBody(ALL, QUOTE_TIME, {}, meta));
      let lockTtlAfterSet = 0;
      provider.snapshotDefault = () => {
        lockTtlAfterSet = redis.pttl(REDIS_KEYS.lock);
        return jsonResponse(200, syntheticSnapshotBody(QUOTE_TIME, meta));
      };
      await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(redis.countOf('SET')).toBe(1);
      expect(ttls).toEqual([-2]); // lock absent before the single SET NX
      expect(lockTtlAfterSet).toBe(REFRESH_LOCK_TTL_MS); // fixed TTL, never extended
      expect(redis.log.filter((c) => c.startsWith('EVAL'))).toEqual([
        'EVAL:RESERVE',
        'EVAL:OBSERVE_RESET',
        'EVAL:RESERVE',
        'EVAL:WRITE',
        'EVAL:RELEASE',
      ]);
    });

    it('slow provider: a timed-out first attempt consumes the window — no retry, no snapshot call, within the deadline', async () => {
      provider.companies.push(() => {
        clock.t += PROVIDER_TIMEOUT_MS;
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      });
      const start = clock.t;
      await expectHttp(instance(redis, provider, clock).service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_FAILED');
      expect(provider.calls).toEqual(['companies']);
      expect(redis.peek(REDIS_KEYS.budgetMonth('2026-10'))).toBe('1');
      expect(redis.peek(REDIS_KEYS.cooldown)).toBe('REFRESH_FAILED');
      expect(clock.t - start).toBeLessThanOrEqual(REFRESH_DEADLINE_MS);
    });

    it('slow but successful companies call: the optional snapshot call is skipped, equities still cached', async () => {
      provider.companies.push(() => {
        clock.t += 4_000;
        return jsonResponse(200, syntheticCompaniesBody(ALL, QUOTE_TIME));
      });
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(provider.calls).toEqual(['companies']);
      expect(result.status).toBe('ok');
      expect(result.marketSummary).toBeNull();
      expect(JSON.parse(redis.peek(REDIS_KEYS.snapshot)!).equities.refreshedAt).toBe(new Date(TRADING_NOW + 4_000).toISOString());
    });

    it('slow Redis: deadline reached before any provider attempt — zero calls, zero budget, no cooldown', async () => {
      redis.seed(REDIS_KEYS.snapshot, JSON.stringify(cachedDoc(TRADING_NOW - 3_600_000)));
      redis.beforeCommand = () => {
        clock.t += 1_000;
      };
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(provider.calls).toEqual([]);
      expect(result).toMatchObject({ status: 'stale', cache: { staleReason: 'REFRESH_FAILED' } });
      expect(redis.peek(REDIS_KEYS.budgetMonth('2026-10'))).toBeNull();
      expect(redis.peek(REDIS_KEYS.cooldown)).toBeNull();
      expect(redis.peek(REDIS_KEYS.lock)).toBeNull(); // released
    });

    it('very slow Redis: deadline exceeded during lock acquisition — the lock is released, nothing else runs', async () => {
      redis.beforeCommand = () => {
        clock.t += 2_100;
      };
      await expectHttp(instance(redis, provider, clock).service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_FAILED');
      expect(provider.calls).toEqual([]);
      expect(redis.log).toEqual(['GET', 'GET', 'SET', 'EVAL:RELEASE']);
      expect(redis.peek(REDIS_KEYS.lock)).toBeNull();
    });

    it('lock expires mid-refresh and a peer takes it: no further provider attempt, no cache write, peer lock untouched', async () => {
      provider.companies.push(() => {
        redis.expire(REDIS_KEYS.lock);
        redis.seed(REDIS_KEYS.lock, 'peer-token', REFRESH_LOCK_TTL_MS);
        return jsonResponse(200, syntheticCompaniesBody(ALL, QUOTE_TIME));
      });
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(provider.calls).toEqual(['companies']); // snapshot attempt refused: LOCK_LOST
      expect(result.status).toBe('ok'); // this request still gets the data it legitimately fetched
      expect(redis.peek(REDIS_KEYS.snapshot)).toBeNull(); // but it is not cached
      expect(redis.peek(REDIS_KEYS.lock)).toBe('peer-token'); // foreign release is a no-op
      expect(redis.peek(REDIS_KEYS.budgetMonth('2026-10'))).toBe('1');
    });

    it('lock lost before the first attempt: zero provider calls, reported as REFRESH_IN_PROGRESS (no cooldown)', async () => {
      redis.beforeCommand = (_command, script) => {
        if (script === 'RESERVE') redis.expire(REDIS_KEYS.lock);
      };
      await expectHttp(instance(redis, provider, clock).service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_IN_PROGRESS');
      expect(provider.calls).toEqual([]);
      expect(redis.peek(REDIS_KEYS.budgetMonth('2026-10'))).toBeNull();
      expect(redis.peek(REDIS_KEYS.cooldown)).toBeNull();
    });

    it('a Redis step that settles after the deadline stops the refresh before the next step', async () => {
      let gets = 0;
      redis.beforeCommand = (command) => {
        if (command === 'GET' && ++gets === 2) clock.t += REFRESH_DEADLINE_MS + 1; // cooldown check is slow
      };
      await expectHttp(instance(redis, provider, clock).service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_FAILED');
      expect(redis.log).toEqual(['GET', 'GET']); // no lock, no reservation, no provider call
      expect(provider.calls).toEqual([]);
    });

    it('a reservation that completes after the deadline is not followed by a provider attempt', async () => {
      redis.beforeCommand = (_command, script) => {
        if (script === 'RESERVE') clock.t += REFRESH_DEADLINE_MS;
      };
      await expectHttp(instance(redis, provider, clock).service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_FAILED');
      expect(provider.calls).toEqual([]);
    });

    it('ownership lost just before the write: cache write refused', async () => {
      provider.snapshot.push(() => {
        redis.expire(REDIS_KEYS.lock);
        return jsonResponse(200, syntheticSnapshotBody(QUOTE_TIME));
      });
      await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(provider.calls).toEqual(['companies', 'snapshot']);
      expect(redis.peek(REDIS_KEYS.snapshot)).toBeNull();
      expect(warn.mock.calls.flat().join(' ')).toContain('LOCK_LOST');
    });

    it('a stale holder cannot overwrite newer data written by the next holder', async () => {
      const a = instance(redis, provider, clock);
      const b = instance(redis, provider, clock);
      let bResult: Awaited<ReturnType<MarketDataService['getPublicSnapshot']>> | undefined;
      provider.companies.push(async () => {
        // A is paused past its lock TTL; B refreshes with newer data meanwhile.
        clock.t += REFRESH_LOCK_TTL_MS + 1;
        redis.expire(REDIS_KEYS.lock);
        provider.companies.unshift(() => jsonResponse(200, syntheticCompaniesBody(ALL, QUOTE_TIME, { GTCO: { price: 777 } })));
        bResult = await b.service.getPublicSnapshot();
        return jsonResponse(200, syntheticCompaniesBody(ALL, QUOTE_TIME, { GTCO: { price: 111 } }));
      });
      await a.service.getPublicSnapshot();
      expect(bResult?.status).toBe('ok');
      const cached = JSON.parse(redis.peek(REDIS_KEYS.snapshot)!) as CachedMarketSnapshot;
      expect(cached.equities.items.find((e) => e.symbol === 'GTCO')?.lastPriceNgn).toBe(777);
      expect(provider.calls).toEqual(['companies', 'companies', 'snapshot']); // A made no attempt after losing the lock
    });

    it('recovery after an interrupted refresh: the crashed holder\'s lock expires and its counted attempt stays counted', async () => {
      redis.seed(REDIS_KEYS.lock, 'crashed-instance', REFRESH_LOCK_TTL_MS);
      redis.seed(REDIS_KEYS.budgetMonth('2026-10'), '1');
      redis.seed(REDIS_KEYS.budgetDay('2026-10-22'), '1');
      const { service } = instance(redis, provider, clock);
      const body = await expectHttp(service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_IN_PROGRESS');
      expect(body.context).toMatchObject({ retryAfterSeconds: 5 });
      clock.t += REFRESH_LOCK_TTL_MS;
      const result = await service.getPublicSnapshot();
      expect(result.status).toBe('ok');
      expect(redis.peek(REDIS_KEYS.budgetMonth('2026-10'))).toBe('3');
    });
  });

  describe('provider quota period (billing renewal) and malformed reset data', () => {
    const RENEWAL = '2026-11-15T23:57:00.000Z';
    const metaWith = (reset_at: unknown, calls_remaining = 2_000) => ({ plan: 'free', calls_used: 1_000, calls_remaining, reset_at });

    it('records a validated reset_at once per refresh as the provider period end', async () => {
      provider.companiesDefault = () => jsonResponse(200, syntheticCompaniesBody(ALL, QUOTE_TIME, {}, metaWith(RENEWAL)));
      provider.snapshotDefault = () => jsonResponse(200, syntheticSnapshotBody(QUOTE_TIME, metaWith(RENEWAL)));
      await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(redis.hpeek(REDIS_KEYS.budgetProviderPeriod)).toMatchObject({ end: String(Date.parse(RENEWAL)), count: '2' });
      expect(redis.countLogged('EVAL:OBSERVE_RESET')).toBe(1);
    });

    it('calendar-month rollover before billing renewal: provider-period cap still blocks, zero calls', async () => {
      clock.t = Date.parse('2026-11-02T10:00:00.000Z'); // Monday 11:00 WAT, new Lagos month
      redis.hseed(REDIS_KEYS.budgetProviderPeriod, { end: Date.parse(RENEWAL), count: 2_400, next: 0, start: 0 });
      await expectHttp(instance(redis, provider, clock).service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_PAUSED');
      expect(provider.calls).toEqual([]);
      expect(redis.peek(REDIS_KEYS.cooldown)).toBe('PROVIDER_PERIOD_BUDGET');
      expect(redis.pttl(REDIS_KEYS.cooldown)).toBe(Date.parse(RENEWAL) + 3_600_000 - clock.t);
      expect(redis.peek(REDIS_KEYS.budgetMonth('2026-11'))).toBeNull();
    });

    it('billing rollover: capacity returns after reset_at + grace even though the Lagos month has not changed', async () => {
      clock.t = Date.parse(RENEWAL) + 3_600_000; // Monday 16 Nov 00:57 WAT + 1 h
      redis.hseed(REDIS_KEYS.budgetProviderPeriod, { end: Date.parse(RENEWAL), count: 2_400, next: 0, start: 0 });
      redis.seed(REDIS_KEYS.budgetMonth('2026-11'), '500');
      const next = '2026-12-15T23:57:00.000Z';
      provider.companiesDefault = () => jsonResponse(200, syntheticCompaniesBody(ALL, '2026-11-13T14:30:00.000Z', {}, metaWith(next)));
      provider.snapshotDefault = () => jsonResponse(200, syntheticSnapshotBody('2026-11-13T17:00:00.000Z', metaWith(next)));
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(result.status).toBe('ok');
      expect(redis.hpeek(REDIS_KEYS.budgetProviderPeriod)).toMatchObject({ end: String(Date.parse(next)), count: '2' });
      expect(redis.peek(REDIS_KEYS.budgetMonth('2026-11'))).toBe('502');
    });

    it.each([
      ['not a timestamp', 'soon'],
      ['date only', '2026-11-15'],
      ['in the past', '2026-10-01T00:00:00.000Z'],
      ['too far ahead', '2027-06-01T00:00:00.000Z'],
      ['impossible date', '2026-11-31T00:00:00.000Z'],
    ])('malformed reset_at (%s) is ignored for budgeting and cooldowns fall back to 24 h', async (_label, resetAt) => {
      provider.companiesDefault = () => jsonResponse(200, syntheticCompaniesBody(ALL, QUOTE_TIME, {}, metaWith(resetAt, 250)));
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(result.status).toBe('ok');
      expect(redis.hpeek(REDIS_KEYS.budgetProviderPeriod)?.end ?? '0').toBe('0');
      expect(redis.peek(REDIS_KEYS.cooldown)).toBe('PROVIDER_QUOTA_RESERVE');
      expect(redis.pttl(REDIS_KEYS.cooldown)).toBe(24 * 3_600_000);
    });

    it('QUOTA_EXCEEDED with a malformed reset_at pauses for the conservative 24 h default', async () => {
      provider.companies.push(() =>
        jsonResponse(429, { success: false, error: { code: 'QUOTA_EXCEEDED' }, meta: { calls_remaining: 0, reset_at: 'tomorrow' } }),
      );
      await expectHttp(instance(redis, provider, clock).service.getPublicSnapshot(), 'SERVICE_UNAVAILABLE', 'REFRESH_PAUSED');
      expect(redis.pttl(REDIS_KEYS.cooldown)).toBe(24 * 3_600_000);
    });

    it('reserve reached: provider calls_remaining at exactly 300 pauses until reset + grace', async () => {
      provider.companiesDefault = () => jsonResponse(200, syntheticCompaniesBody(ALL, QUOTE_TIME, {}, metaWith(RENEWAL, 300)));
      await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(redis.peek(REDIS_KEYS.cooldown)).toBe('PROVIDER_QUOTA_RESERVE');
      expect(redis.pttl(REDIS_KEYS.cooldown)).toBe(Date.parse(RENEWAL) + 3_600_000 - TRADING_NOW);
      expect(provider.calls).toEqual(['companies']);
    });

    it('Redis failure while recording the provider period never blocks serving and never calls more', async () => {
      redis.failWhen = (_command, script) => script === 'OBSERVE_RESET';
      const result = await instance(redis, provider, clock).service.getPublicSnapshot();
      expect(result.status).toBe('ok');
      expect(provider.calls).toEqual(['companies', 'snapshot']);
    });
  });
});
