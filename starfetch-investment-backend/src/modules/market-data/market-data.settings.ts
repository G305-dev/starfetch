import {
  DEFAULT_MONTHLY_CALL_BUDGET,
  DEFAULT_REFRESH_INTERVAL_SECONDS,
  MAX_MONTHLY_CALL_BUDGET,
  MAX_REFRESH_INTERVAL_SECONDS,
  MIN_MONTHLY_CALL_BUDGET,
  MIN_REFRESH_INTERVAL_SECONDS,
} from './market-data.constants';

export type MarketDataDisabledReason =
  | 'FLAG_OFF'
  | 'REDISTRIBUTION_NOT_APPROVED'
  | 'API_KEY_MISSING'
  | 'API_KEY_INVALID'
  | 'REDIS_NOT_CONFIGURED'
  | 'INVALID_CONFIGURATION';

export interface RawMarketDataConfig {
  enabled?: unknown;
  redistributionApproved?: unknown;
  ngnMarketApiKey?: unknown;
  redisRestUrl?: unknown;
  redisRestToken?: unknown;
  refreshIntervalSeconds?: unknown;
  monthlyCallBudget?: unknown;
}

export type MarketDataSettings =
  | {
      state: 'enabled';
      apiKey: string;
      redisRestUrl: string;
      redisRestToken: string;
      refreshIntervalSeconds: number;
      monthlyCallBudget: number;
      dailyCallBudget: number;
    }
  | { state: 'disabled'; reason: MarketDataDisabledReason };

/**
 * Resolves market-data settings WITHOUT throwing. Missing or invalid
 * configuration never breaks application startup: it yields a disabled state
 * whose reason is logged server-side only (never returned to clients).
 *
 * Enablement requires ALL of: the explicit feature flag, an explicit
 * redistribution/terms approval flag, a plausible API key and a valid Upstash
 * REST endpoint + token. Without Redis there is no shared budget/lock, so the
 * integration stays disabled rather than calling the provider directly.
 */
export function resolveMarketDataSettings(raw: RawMarketDataConfig | undefined, dailyDivisor: number): MarketDataSettings {
  const cfg = raw ?? {};
  if (cfg.enabled !== true) return { state: 'disabled', reason: 'FLAG_OFF' };
  if (cfg.redistributionApproved !== true) return { state: 'disabled', reason: 'REDISTRIBUTION_NOT_APPROVED' };

  const apiKey = typeof cfg.ngnMarketApiKey === 'string' ? cfg.ngnMarketApiKey.trim() : '';
  if (!apiKey) return { state: 'disabled', reason: 'API_KEY_MISSING' };
  if (!/^[\x21-\x7e]{16,512}$/.test(apiKey)) return { state: 'disabled', reason: 'API_KEY_INVALID' };

  const redisRestUrl = typeof cfg.redisRestUrl === 'string' ? cfg.redisRestUrl.trim() : '';
  const redisRestToken = typeof cfg.redisRestToken === 'string' ? cfg.redisRestToken.trim() : '';
  if (!redisRestUrl || !redisRestToken) return { state: 'disabled', reason: 'REDIS_NOT_CONFIGURED' };
  if (!isSafeHttpsUrl(redisRestUrl) || redisRestToken.length < 16 || /\s/.test(redisRestToken)) {
    return { state: 'disabled', reason: 'INVALID_CONFIGURATION' };
  }

  const refreshIntervalSeconds = integerSetting(
    cfg.refreshIntervalSeconds,
    DEFAULT_REFRESH_INTERVAL_SECONDS,
    MIN_REFRESH_INTERVAL_SECONDS,
    MAX_REFRESH_INTERVAL_SECONDS,
  );
  const monthlyCallBudget = integerSetting(
    cfg.monthlyCallBudget,
    DEFAULT_MONTHLY_CALL_BUDGET,
    MIN_MONTHLY_CALL_BUDGET,
    MAX_MONTHLY_CALL_BUDGET,
  );
  if (refreshIntervalSeconds === undefined || monthlyCallBudget === undefined) {
    return { state: 'disabled', reason: 'INVALID_CONFIGURATION' };
  }

  return {
    state: 'enabled',
    apiKey,
    redisRestUrl,
    redisRestToken,
    refreshIntervalSeconds,
    monthlyCallBudget,
    dailyCallBudget: Math.ceil(monthlyCallBudget / dailyDivisor),
  };
}

/** Undefined/empty → default; out-of-range or non-integer → undefined (fail closed). */
function integerSetting(value: unknown, defaultValue: number, min: number, max: number): number | undefined {
  if (value === undefined || value === null || value === '') return defaultValue;
  const text = String(value).trim();
  if (!/^\d{1,7}$/.test(text)) return undefined;
  const parsed = Number(text);
  return parsed >= min && parsed <= max ? parsed : undefined;
}

function isSafeHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
}
