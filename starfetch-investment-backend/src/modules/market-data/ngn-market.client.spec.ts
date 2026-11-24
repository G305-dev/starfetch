import { jsonResponse } from '../../../test/utils/fake-market-data-redis';
import { NGN_MARKET_COMPANIES_PATH } from './market-data.constants';
import { FetchLike, NgnMarketClient } from './ngn-market.client';

const KEY = 'synthetic-ngn-market-key-0123456789';

describe('NgnMarketClient (single attempt, synthetic responses only)', () => {
  it('sends the Bearer key only to the constant provider origin, refusing redirects', async () => {
    const fetchImpl = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(async () => jsonResponse(200, { success: true, data: {} }));
    const outcome = await new NgnMarketClient(fetchImpl, KEY).request(NGN_MARKET_COMPANIES_PATH);
    expect(outcome.kind).toBe('success');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.ngnmarket.com/v1/companies?limit=200&sort=market_cap&order=desc');
    expect(init.method).toBe('GET');
    expect(init.redirect).toBe('error');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('classifies 401 with the provider code and never echoes the key', async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(401, { success: false, error: { code: 'INVALID_API_KEY', message: `bad key ${KEY}` } });
    const outcome = await new NgnMarketClient(fetchImpl, KEY).request('/companies');
    expect(outcome).toMatchObject({ kind: 'http_error', status: 401, code: 'INVALID_API_KEY' });
    expect(JSON.stringify(outcome)).not.toContain(KEY);
  });

  it('extracts Retry-After from the header, else from meta.retry_after, on 429', async () => {
    const header = await new NgnMarketClient(
      async () => jsonResponse(429, { success: false, error: { code: 'RATE_LIMITED' } }, { 'retry-after': '42' }),
      KEY,
    ).request('/companies');
    expect(header).toMatchObject({ kind: 'http_error', status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 42 });
    const meta = await new NgnMarketClient(
      async () => jsonResponse(429, { success: false, error: { code: 'RATE_LIMITED' }, meta: { retry_after: 7 } }),
      KEY,
    ).request('/companies');
    expect(meta).toMatchObject({ retryAfterSeconds: 7 });
  });

  it('classifies 5xx, network errors, non-JSON bodies and timeouts', async () => {
    expect(await new NgnMarketClient(async () => jsonResponse(503, { success: false }), KEY).request('/x')).toMatchObject({
      kind: 'http_error',
      status: 503,
    });
    expect(await new NgnMarketClient(async () => { throw new TypeError('fetch failed'); }, KEY).request('/x')).toEqual({
      kind: 'network_error',
    });
    expect(await new NgnMarketClient(async () => new Response('<html>gateway</html>', { status: 200 }), KEY).request('/x')).toEqual({
      kind: 'malformed_body',
      status: 200,
    });
    // A provider that never answers is aborted by the per-attempt timeout.
    const hanging: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
      });
    expect(await new NgnMarketClient(hanging, KEY, 20).request('/x')).toEqual({ kind: 'timeout' });
  });

  it('caps an attempt at the caller-supplied deadline window, never above the configured timeout', async () => {
    const hanging: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
      });
    let started = Date.now();
    expect(await new NgnMarketClient(hanging, KEY, 5_000).request('/x', 30)).toEqual({ kind: 'timeout' });
    expect(Date.now() - started).toBeLessThan(2_000);
    started = Date.now();
    expect(await new NgnMarketClient(hanging, KEY, 30).request('/x', 60_000)).toEqual({ kind: 'timeout' });
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
