import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import { createHmac } from 'node:crypto';

export const CORPORATE_O2_REDIS_CLIENT = Symbol('CORPORATE_O2_REDIS_CLIENT');
export const CORPORATE_O2_RATE_LIMITER = Symbol('CORPORATE_O2_RATE_LIMITER');

export interface CorporateO2RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface CorporateO2RateLimiter {
  consumeUser(userId: string, limit: number, windowSeconds: number): Promise<CorporateO2RateLimitResult>;
}

/**
 * One Redis EVAL performs the fixed-window increment and TTL assignment
 * atomically. The first accepted request starts the 1-hour window; rejected
 * requests continue incrementing the same bucket, matching the legacy policy.
 */
export const CORPORATE_O2_FIXED_WINDOW_LUA = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then
  redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[1]))
  ttl = tonumber(ARGV[1])
end
if count > tonumber(ARGV[2]) then
  return {0, ttl}
end
return {1, ttl}
`;

const HMAC_DOMAIN = 'starfetch:corporate-o2:rate-limit:v1\0';
const KEY_PREFIX = 'sf:corporate:o2:rate:v1:';
const UNAVAILABLE = {
  code: 'SERVICE_UNAVAILABLE',
  message: 'Corporate registration is temporarily unavailable.',
} as const;

@Injectable()
export class UpstashCorporateO2RateLimiter implements CorporateO2RateLimiter {
  constructor(
    private readonly config: ConfigService,
    @Inject(CORPORATE_O2_REDIS_CLIENT) private readonly redis: Redis | undefined,
  ) {}

  async consumeUser(userId: string, limit: number, windowSeconds: number): Promise<CorporateO2RateLimitResult> {
    if (!this.redis || !userId || !Number.isSafeInteger(limit) || limit < 1 ||
        !Number.isSafeInteger(windowSeconds) || windowSeconds < 1) {
      throw unavailable();
    }

    let keyDigest: string;
    try {
      keyDigest = this.userDigest(userId);
    } catch {
      throw unavailable();
    }

    try {
      const raw = await this.redis.eval(
        CORPORATE_O2_FIXED_WINDOW_LUA,
        [`${KEY_PREFIX}${keyDigest}`],
        [windowSeconds * 1000, limit],
      );
      if (!Array.isArray(raw) || raw.length !== 2) throw unavailable();
      const allowedValue = asFiniteNumber(raw[0]);
      const ttlMilliseconds = asFiniteNumber(raw[1]);
      if ((allowedValue !== 0 && allowedValue !== 1) || ttlMilliseconds < 0) throw unavailable();
      if (allowedValue === 1) return { allowed: true };
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(ttlMilliseconds / 1000)) };
    } catch {
      // No in-memory fallback: a Redis timeout, bad response or outage denies
      // the mutation with the same non-sensitive 503 response.
      throw unavailable();
    }
  }

  private userDigest(userId: string): string {
    const encoded = this.config.get<string>('corporate.o2.rateLimitHmacSecret');
    if (!encoded) throw unavailable();
    const key = Buffer.from(encoded, 'base64');
    const canonical = key.toString('base64').replace(/=+$/, '') === encoded.replace(/=+$/, '');
    if (key.byteLength < 32 || !canonical) {
      key.fill(0);
      throw unavailable();
    }
    try {
      return createHmac('sha256', key).update(HMAC_DOMAIN).update(userId, 'utf8').digest('hex');
    } finally {
      key.fill(0);
    }
  }
}

function asFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return Number.NaN;
}

function unavailable(): HttpException {
  return new HttpException(UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE);
}
