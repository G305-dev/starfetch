import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { RateLimiter, RateLimitResult } from './rate-limiter';

interface Bucket {
  count: number;
  resetAtMs: number;
}

/**
 * MVP application-level fixed-window rate limiter (per-process, in-memory).
 * Isolated behind the RATE_LIMITER port so a distributed (e.g. Redis)
 * implementation can replace it without touching authentication logic.
 */
@Injectable()
export class InMemoryRateLimiter implements RateLimiter, OnModuleDestroy {
  private readonly buckets = new Map<string, Bucket>();
  private readonly sweeper: NodeJS.Timeout;

  constructor() {
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }

  tryConsume(key: string, limit: number, windowSeconds: number, nowMs = Date.now()): RateLimitResult {
    const windowMs = windowSeconds * 1000;
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAtMs <= nowMs) {
      bucket = { count: 0, resetAtMs: nowMs + windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAtMs - nowMs) / 1000)),
      };
    }
    return { allowed: true };
  }

  private sweep(nowMs = Date.now()): void {
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAtMs <= nowMs) this.buckets.delete(key);
    }
  }
}
