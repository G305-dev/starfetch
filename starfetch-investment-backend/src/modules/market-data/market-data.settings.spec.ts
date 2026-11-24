import { DAILY_BUDGET_DIVISOR } from './market-data.constants';
import { resolveMarketDataSettings } from './market-data.settings';

const KEY = 'synthetic-ngn-market-key-0123456789';
const valid = {
  enabled: true,
  redistributionApproved: true,
  ngnMarketApiKey: KEY,
  redisRestUrl: 'https://synthetic-upstash.example.test',
  redisRestToken: 'synthetic-upstash-token-0123456789',
};

describe('resolveMarketDataSettings', () => {
  it('is disabled by default (no configuration at all) and never throws', () => {
    expect(resolveMarketDataSettings(undefined, DAILY_BUDGET_DIVISOR)).toEqual({ state: 'disabled', reason: 'FLAG_OFF' });
    expect(resolveMarketDataSettings({}, DAILY_BUDGET_DIVISOR)).toEqual({ state: 'disabled', reason: 'FLAG_OFF' });
  });

  it('requires the explicit enable flag even when everything else is present', () => {
    expect(resolveMarketDataSettings({ ...valid, enabled: false }, DAILY_BUDGET_DIVISOR)).toEqual({ state: 'disabled', reason: 'FLAG_OFF' });
  });

  it('requires recorded redistribution/terms approval', () => {
    expect(resolveMarketDataSettings({ ...valid, redistributionApproved: false }, DAILY_BUDGET_DIVISOR)).toEqual({
      state: 'disabled',
      reason: 'REDISTRIBUTION_NOT_APPROVED',
    });
  });

  it('is disabled when the API key is missing, blank or implausible', () => {
    expect(resolveMarketDataSettings({ ...valid, ngnMarketApiKey: undefined }, 20)).toMatchObject({ reason: 'API_KEY_MISSING' });
    expect(resolveMarketDataSettings({ ...valid, ngnMarketApiKey: '   ' }, 20)).toMatchObject({ reason: 'API_KEY_MISSING' });
    expect(resolveMarketDataSettings({ ...valid, ngnMarketApiKey: 'short' }, 20)).toMatchObject({ reason: 'API_KEY_INVALID' });
    expect(resolveMarketDataSettings({ ...valid, ngnMarketApiKey: 'has space inside the key value' }, 20)).toMatchObject({
      reason: 'API_KEY_INVALID',
    });
  });

  it('is disabled without shared Redis (never calls the provider without a shared budget/lock)', () => {
    expect(resolveMarketDataSettings({ ...valid, redisRestUrl: undefined }, 20)).toMatchObject({ reason: 'REDIS_NOT_CONFIGURED' });
    expect(resolveMarketDataSettings({ ...valid, redisRestToken: '' }, 20)).toMatchObject({ reason: 'REDIS_NOT_CONFIGURED' });
  });

  it.each([
    ['http (not https)', { redisRestUrl: 'http://synthetic-upstash.example.test' }],
    ['embedded credentials', { redisRestUrl: 'https://user:pass@synthetic-upstash.example.test' }],
    ['query string', { redisRestUrl: 'https://synthetic-upstash.example.test/?token=x' }],
    ['not a URL', { redisRestUrl: 'not a url' }],
    ['short token', { redisRestToken: 'short' }],
    ['interval below minimum', { refreshIntervalSeconds: '60' }],
    ['interval above maximum', { refreshIntervalSeconds: '86400' }],
    ['non-numeric interval', { refreshIntervalSeconds: '30m' }],
    ['budget above the hard ceiling', { monthlyCallBudget: '3000' }],
    ['budget below minimum', { monthlyCallBudget: '10' }],
  ])('fails closed on invalid configuration: %s', (_label, override) => {
    expect(resolveMarketDataSettings({ ...valid, ...override }, 20)).toEqual({ state: 'disabled', reason: 'INVALID_CONFIGURATION' });
  });

  it('applies safe defaults: 30-minute interval, 2,400 monthly cap, derived daily cap', () => {
    expect(resolveMarketDataSettings(valid, DAILY_BUDGET_DIVISOR)).toEqual({
      state: 'enabled',
      apiKey: KEY,
      redisRestUrl: valid.redisRestUrl,
      redisRestToken: valid.redisRestToken,
      refreshIntervalSeconds: 1_800,
      monthlyCallBudget: 2_400,
      dailyCallBudget: 120,
    });
  });

  it('accepts lower budgets and in-range intervals', () => {
    expect(resolveMarketDataSettings({ ...valid, monthlyCallBudget: '1500', refreshIntervalSeconds: '3600' }, 20)).toMatchObject({
      state: 'enabled',
      monthlyCallBudget: 1_500,
      dailyCallBudget: 75,
      refreshIntervalSeconds: 3_600,
    });
  });
});
