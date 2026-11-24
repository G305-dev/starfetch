import { NGN_MARKET_API_BASE_URL, PROVIDER_TIMEOUT_MS } from './market-data.constants';
import { ProviderQuotaMeta } from './market-data.types';
import { parseProviderErrorCode, parseQuotaMeta } from './ngn-market.validation';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type ProviderAttemptOutcome =
  | { kind: 'success'; body: unknown; meta: ProviderQuotaMeta }
  | {
      kind: 'http_error';
      status: number;
      code: string | undefined;
      retryAfterSeconds: number | undefined;
      meta: ProviderQuotaMeta;
    }
  | { kind: 'timeout' }
  | { kind: 'network_error' }
  | { kind: 'malformed_body'; status: number };

const MAX_BODY_BYTES = 2 * 1024 * 1024;

/**
 * Single-attempt NGN Market HTTP client. It performs exactly ONE request per
 * call — retries, budget reservation and cooldowns are owned by the caller so
 * that every attempt is counted before it is made.
 *
 * Security: the API key is only ever placed in the Authorization header of a
 * request to the constant provider origin; redirects are refused so the key is
 * never forwarded elsewhere; nothing here logs or returns the key.
 */
export class NgnMarketClient {
  constructor(
    private readonly fetchImpl: FetchLike,
    private readonly apiKey: string,
    private readonly timeoutMs: number = PROVIDER_TIMEOUT_MS,
  ) {}

  /**
   * @param timeoutMs optional per-attempt timeout; the caller passes the time
   *   left before its refresh deadline. Never exceeds the constructor timeout.
   */
  async request(path: string, timeoutMs?: number): Promise<ProviderAttemptOutcome> {
    const effectiveTimeoutMs = Math.max(1, Math.min(this.timeoutMs, timeoutMs ?? this.timeoutMs));
    let response: Response;
    try {
      response = await this.fetchImpl(`${NGN_MARKET_API_BASE_URL}${path}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(effectiveTimeoutMs),
      });
    } catch (error) {
      return isTimeout(error) ? { kind: 'timeout' } : { kind: 'network_error' };
    }

    let body: unknown;
    try {
      const text = await response.text();
      if (text.length > MAX_BODY_BYTES) return { kind: 'malformed_body', status: response.status };
      body = JSON.parse(text);
    } catch (error) {
      if (isTimeout(error)) return { kind: 'timeout' };
      return { kind: 'malformed_body', status: response.status };
    }

    const meta = parseQuotaMeta(body);
    if (response.ok) return { kind: 'success', body, meta };
    return {
      kind: 'http_error',
      status: response.status,
      code: parseProviderErrorCode(body),
      retryAfterSeconds: retryAfterSeconds(response.headers.get('retry-after'), body),
      meta,
    };
  }
}

function retryAfterSeconds(header: string | null, body: unknown): number | undefined {
  if (header && /^\d{1,7}$/.test(header.trim())) return Number(header.trim());
  const meta = typeof body === 'object' && body !== null ? (body as { meta?: { retry_after?: unknown } }).meta : undefined;
  const value = meta?.retry_after;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function isTimeout(error: unknown): boolean {
  // DOMException is not reliably `instanceof Error` across realms, so match by name.
  const name = typeof error === 'object' && error !== null ? (error as { name?: unknown }).name : undefined;
  return name === 'TimeoutError' || name === 'AbortError';
}
