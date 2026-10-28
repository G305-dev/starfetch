import { InMemoryRateLimiter } from './in-memory-rate-limiter';

describe('InMemoryRateLimiter (fixed-window MVP limiter)', () => {
  it('allows up to the limit then denies with a retry window', () => {
    const limiter = new InMemoryRateLimiter();
    const t0 = 1_000_000;
    expect(limiter.tryConsume('k', 2, 60, t0).allowed).toBe(true);
    expect(limiter.tryConsume('k', 2, 60, t0 + 1).allowed).toBe(true);
    const denied = limiter.tryConsume('k', 2, 60, t0 + 2);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(50);
    limiter.onModuleDestroy();
  });

  it('resets after the window passes', () => {
    const limiter = new InMemoryRateLimiter();
    const t0 = 1_000_000;
    limiter.tryConsume('k', 1, 30, t0);
    expect(limiter.tryConsume('k', 1, 30, t0 + 1000).allowed).toBe(false);
    expect(limiter.tryConsume('k', 1, 30, t0 + 31_000).allowed).toBe(true);
    limiter.onModuleDestroy();
  });

  it('tracks keys independently', () => {
    const limiter = new InMemoryRateLimiter();
    const t0 = 1_000_000;
    limiter.tryConsume('a', 1, 60, t0);
    expect(limiter.tryConsume('a', 1, 60, t0).allowed).toBe(false);
    expect(limiter.tryConsume('b', 1, 60, t0).allowed).toBe(true);
    limiter.onModuleDestroy();
  });
});
