/** Replaceable rate-limiter port (distributed implementation can swap in later). */
export const RATE_LIMITER = 'RATE_LIMITER';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface RateLimiter {
  tryConsume(key: string, limit: number, windowSeconds: number, nowMs?: number): RateLimitResult;
}
