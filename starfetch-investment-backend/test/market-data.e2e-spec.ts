import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { MARKET_DATA_FETCH, MARKET_DATA_REDIS_CLIENT } from '../src/modules/market-data/market-data.constants';
import { MarketDataService } from '../src/modules/market-data/market-data.service';
import { FetchLike } from '../src/modules/market-data/ngn-market.client';
import {
  FakeMarketDataRedis,
  jsonResponse,
  syntheticCompaniesBody,
  syntheticSnapshotBody,
} from './utils/fake-market-data-redis';

/**
 * Real AppModule bootstrap with the market-data integration disabled (default),
 * enabled without an API key, enabled with real factories (no network at
 * startup) and enabled with synthetic Redis/provider fakes. No live provider or
 * Upstash request is ever made.
 */
const MARKET_ENV = [
  'MARKET_DATA_ENABLED',
  'MARKET_DATA_REDISTRIBUTION_APPROVED',
  'NGN_MARKET_API_KEY',
  'MARKET_DATA_REDIS_REST_URL',
  'MARKET_DATA_REDIS_REST_TOKEN',
  'MARKET_DATA_REFRESH_INTERVAL_SECONDS',
  'MARKET_DATA_MONTHLY_CALL_BUDGET',
] as const;
const SYNTHETIC_KEY = 'synthetic-ngn-market-key-0123456789';
const SYMBOLS = [
  'ACCESSCORP', 'AIRTELAFRI', 'ARADEL', 'BUACEMENT', 'BUAFOODS', 'DANGCEM', 'FIRSTHOLDCO',
  'GTCO', 'MTNN', 'NB', 'NESTLE', 'SEPLAT', 'UBA', 'ZENITHBANK',
];

function setMarketEnv(values: Partial<Record<(typeof MARKET_ENV)[number], string>>) {
  for (const name of MARKET_ENV) delete process.env[name];
  Object.assign(process.env, values);
}

const FULL_ENV = {
  MARKET_DATA_ENABLED: 'true',
  MARKET_DATA_REDISTRIBUTION_APPROVED: 'true',
  NGN_MARKET_API_KEY: SYNTHETIC_KEY,
  MARKET_DATA_REDIS_REST_URL: 'https://synthetic-upstash.invalid',
  MARKET_DATA_REDIS_REST_TOKEN: 'synthetic-upstash-token-0123456789',
};

async function boot(overrides: Array<{ provide: unknown; useValue: unknown }> = []): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  for (const o of overrides) builder = builder.overrideProvider(o.provide).useValue(o.useValue);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ bodyParser: false });
  configureApp(app);
  await app.init();
  return app;
}

describe('Market data — real bootstrap (e2e)', () => {
  let fetchSpy: jest.SpyInstance;
  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network disabled in tests'));
  });
  afterEach(() => fetchSpy.mockRestore());
  afterAll(() => setMarketEnv({}));

  describe.each([
    ['disabled by default (no configuration)', {}],
    ['enabled flag but no API key', { ...FULL_ENV, NGN_MARKET_API_KEY: undefined }],
    ['enabled but redistribution not approved', { ...FULL_ENV, MARKET_DATA_REDISTRIBUTION_APPROVED: undefined }],
    ['enabled with invalid configuration (non-HTTPS Redis URL)', { ...FULL_ENV, MARKET_DATA_REDIS_REST_URL: 'http://synthetic-upstash.invalid' }],
    ['enabled with invalid configuration (budget above the hard ceiling)', { ...FULL_ENV, MARKET_DATA_MONTHLY_CALL_BUDGET: '5000' }],
    ['enabled with invalid configuration (malformed refresh interval)', { ...FULL_ENV, MARKET_DATA_REFRESH_INTERVAL_SECONDS: '30m' }],
  ])('%s', (_label, env) => {
    let app: INestApplication;
    beforeAll(async () => {
      setMarketEnv(env as Record<string, string>);
      app = await boot();
    });
    afterAll(async () => app.close());

    it('boots, health is unaffected, endpoint is a non-cacheable FEATURE_UNAVAILABLE with no outbound calls', async () => {
      const server = app.getHttpServer();
      await request(server).get('/api/v1/health').expect(200);
      const res = await request(server).get('/api/v1/public/market-snapshot').expect(503);
      expect(res.body.error).toMatchObject({ code: 'FEATURE_UNAVAILABLE', context: { status: 'disabled' } });
      expect(res.body.error.requestId).toBeDefined();
      expect(res.headers['cache-control']).toBe('no-store');
      expect(JSON.stringify(res.body)).not.toMatch(/API_KEY|REDIS|synthetic|token/i);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('curated 503s are not logged as unhandled errors (no log flooding); unknown routes still use the global filter', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      const server = app.getHttpServer();
      await request(server).get('/api/v1/public/market-snapshot').expect(503);
      expect(errorSpy).not.toHaveBeenCalled();
      const notFound = await request(server).get('/api/v1/public/market-snapshot/unknown').expect(404);
      expect(notFound.body.error.code).toBe('NOT_FOUND');
      errorSpy.mockRestore();
    });
  });

  describe('enabled with real factories (synthetic Upstash URL)', () => {
    let app: INestApplication;
    beforeAll(async () => {
      setMarketEnv(FULL_ENV);
    });
    afterAll(async () => app?.close());

    it('performs no network I/O at startup; a Redis outage yields CACHE_UNAVAILABLE and never reaches the provider', async () => {
      app = await boot();
      expect(fetchSpy).not.toHaveBeenCalled(); // startup made no Upstash or provider call
      const server = app.getHttpServer();
      const res = await request(server).get('/api/v1/public/market-snapshot').expect(503);
      expect(res.body.error).toMatchObject({ code: 'SERVICE_UNAVAILABLE', context: { status: 'unavailable', reason: 'CACHE_UNAVAILABLE' } });
      expect(res.headers['retry-after']).toBe('60');
      const urls = fetchSpy.mock.calls.map((call) => String(call[0]));
      expect(urls.length).toBeGreaterThan(0);
      expect(urls.every((url) => url.startsWith('https://synthetic-upstash.invalid'))).toBe(true);
      expect(urls.some((url) => url.includes('ngnmarket'))).toBe(false);
      await request(server).get('/api/v1/health').expect(200);
    });
  });

  describe('enabled with synthetic Redis + provider', () => {
    let app: INestApplication;
    let redis: FakeMarketDataRedis;
    let providerCalls: string[];
    let providerMode: 'ok' | 'down';

    beforeAll(async () => {
      setMarketEnv(FULL_ENV);
      redis = new FakeMarketDataRedis(() => Date.now());
      providerCalls = [];
      providerMode = 'ok';
      const fakeFetch: FetchLike = async (url, init) => {
        providerCalls.push(url);
        expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${SYNTHETIC_KEY}`);
        if (providerMode === 'down') return jsonResponse(500, { success: false, error: { code: 'SERVER_ERROR' } });
        const now = new Date(Date.now() - 60_000).toISOString();
        return url.includes('/companies')
          ? jsonResponse(200, syntheticCompaniesBody(SYMBOLS, now))
          : jsonResponse(200, syntheticSnapshotBody(now));
      };
      app = await boot([
        { provide: MARKET_DATA_REDIS_CLIENT, useValue: redis },
        { provide: MARKET_DATA_FETCH, useValue: fakeFetch },
      ]);
    });
    afterAll(async () => app.close());

    it('serves the public contract without authentication, cached, inside the standard envelope', async () => {
      const server = app.getHttpServer();
      const res = await request(server).get('/api/v1/public/market-snapshot').expect(200);
      expect(res.headers['cache-control']).toBe('public, max-age=60, s-maxage=60');
      expect(res.headers['retry-after']).toBeUndefined();
      expect(res.body.meta.requestId).toBeDefined();
      const data = res.body.data;
      expect(data.status).toBe('ok');
      expect(data.dataType).toBe('delayed');
      expect(data.provider.attribution).toContain('NGN Market');
      expect(data.equities.map((e: { symbol: string }) => e.symbol)).toEqual(SYMBOLS);
      expect(data.equities[0]).toEqual({
        symbol: 'ACCESSCORP',
        companyName: 'Access Holdings Plc',
        lastPriceNgn: expect.any(Number),
        dailyChangePercent: expect.any(Number),
        quoteTimestamp: expect.any(String),
        available: true,
        unavailableReason: null,
        quoteAgeSeconds: expect.any(Number),
      });
      expect(data.equities[0].quoteAgeSeconds).toBeGreaterThanOrEqual(60);
      expect(data.equities[0].quoteTimestamp).not.toBe(data.cache.refreshedAt);
      expect(Object.keys(data).sort()).toEqual(
        ['cache', 'dataType', 'delayNotice', 'equities', 'generatedAt', 'marketSummary', 'provider', 'status'].sort(),
      );
      expect(data.marketSummary.allShareIndex).toBe(100_000.5);
      expect(JSON.stringify(res.body)).not.toContain(SYNTHETIC_KEY);
      expect(providerCalls).toHaveLength(2);

      await request(server).get('/api/v1/public/market-snapshot').expect(200);
      expect(providerCalls).toHaveLength(2); // served from the shared cache
    });

    it('per-quote 7-day rule through the real app: expired quote unavailable, CDN lifetime capped before expiry', async () => {
      const server = app.getHttpServer();
      app.get(MarketDataService).memoTtlMs = 0;
      const nowMs = Date.now();
      const sevenDays = 7 * 86_400_000;
      const items = SYMBOLS.map((symbol, i) => ({
        symbol,
        companyName: `Company ${i}`,
        lastPriceNgn: 10 + i,
        dailyChangePercent: 0.5,
        quoteTimestamp: new Date(nowMs - 3_600_000).toISOString(),
        available: true,
        unavailableReason: null,
      }));
      items[7].quoteTimestamp = new Date(nowMs - sevenDays - 1_000).toISOString(); // GTCO: just over 7 days
      items[8].quoteTimestamp = new Date(nowMs - sevenDays + 30_000).toISOString(); // MTNN: expires in ~30 s
      redis.seed(
        'sf:market-data:v1:snapshot',
        JSON.stringify({ schemaVersion: 1, equities: { refreshedAt: new Date(nowMs).toISOString(), items }, summary: null }),
      );
      const before = providerCalls.length;
      const res = await request(server).get('/api/v1/public/market-snapshot').expect(200);
      expect(providerCalls.length).toBe(before); // fresh cache, no refresh
      expect(res.body.data.equities[7]).toMatchObject({ symbol: 'GTCO', available: false, unavailableReason: 'QUOTE_EXPIRED', lastPriceNgn: null });
      expect(res.body.data.equities[8]).toMatchObject({ symbol: 'MTNN', available: true });
      const match = /^public, max-age=(\d+), s-maxage=(\d+)$/.exec(res.headers['cache-control']);
      expect(match).not.toBeNull();
      expect(Number(match![1])).toBeLessThanOrEqual(30);
      expect(match![1]).toBe(match![2]);
    });

    it('provider failure is isolated: endpoint 503 (no-store, Retry-After) while health and auth behave normally', async () => {
      const server = app.getHttpServer();
      // Expire the cache (corrupt document = treated as absent), bypass the
      // 15 s per-instance memo, and take the provider down.
      app.get(MarketDataService).memoTtlMs = 0;
      redis.seed('sf:market-data:v1:snapshot', JSON.stringify({ schemaVersion: 0 }));
      providerMode = 'down';
      const before = providerCalls.length;

      const res = await request(server).get('/api/v1/public/market-snapshot').expect(503);
      expect(res.body.error).toMatchObject({ code: 'SERVICE_UNAVAILABLE', context: { reason: 'REFRESH_FAILED' } });
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['retry-after']).toBe('300');
      expect(providerCalls.length - before).toBe(2); // one retry, then cooldown

      await request(server).get('/api/v1/public/market-snapshot').expect(503);
      expect(providerCalls.length - before).toBe(2); // cooldown: no further upstream calls

      const health = await request(server).get('/api/v1/health').expect(200);
      expect(health.body.data.status).toBe('ok');
      await request(server).get('/api/v1/me').expect(401); // auth guard unaffected
      expect(redis.keys().every((key) => key.startsWith('sf:market-data:v1:'))).toBe(true);
    });
  });
});
