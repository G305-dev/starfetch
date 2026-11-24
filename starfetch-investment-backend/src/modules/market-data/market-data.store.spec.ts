import { FakeMarketDataRedis } from '../../../test/utils/fake-market-data-redis';
import { FEATURED_NGX_EQUITIES, REDIS_KEYS } from './market-data.constants';
import { MarketDataStore } from './market-data.store';
import { CachedMarketSnapshot } from './market-data.types';
import { unavailableQuote } from './ngn-market.validation';

function doc(refreshedAt = '2026-10-22T10:00:00.000Z'): CachedMarketSnapshot {
  return {
    schemaVersion: 1,
    equities: { refreshedAt, items: FEATURED_NGX_EQUITIES.map((e) => unavailableQuote(e.symbol, e.companyName, 'NOT_IN_PROVIDER_RESPONSE')) },
    summary: null,
  };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('MarketDataStore (isolated sf:market-data:v1: namespace)', () => {
  let now: number;
  let redis: FakeMarketDataRedis;
  let store: MarketDataStore;
  const reserve = (month: string, day: string, monthlyCap: number, dailyCap: number, token = 'owner') =>
    store.reserveAttempt(month, day, monthlyCap, dailyCap, token, now);

  beforeEach(async () => {
    now = Date.parse('2026-10-22T10:00:00Z');
    redis = new FakeMarketDataRedis(() => now);
    store = new MarketDataStore(redis);
  });

  it('uses only keys inside its own namespace (never the sf:corporate:o2: rate-limit keys)', async () => {
    await store.acquireLock('owner', 15_000);
    expect(await store.writeSnapshotIfOwner('owner', doc())).toBe('OK');
    await reserve('2026-10', '2026-10-22', 10, 5);
    await store.observeProviderReset(now + 10 * DAY, now);
    await store.setCooldown('X', 10);
    expect(redis.keys().sort()).toEqual(
      [
        REDIS_KEYS.snapshot,
        REDIS_KEYS.snapshotVersion,
        REDIS_KEYS.lock,
        REDIS_KEYS.budgetMonth('2026-10'),
        REDIS_KEYS.budgetDay('2026-10-22'),
        REDIS_KEYS.budgetProviderPeriod,
        REDIS_KEYS.cooldown,
      ].sort(),
    );
    expect(redis.keys().every((key) => key.startsWith('sf:market-data:v1:'))).toBe(true);
    expect(redis.keys().some((key) => key.startsWith('sf:corporate:o2:'))).toBe(false);
  });

  it('round-trips the snapshot with an 8-day TTL and rejects corrupt, foreign or non-strict documents', async () => {
    await store.acquireLock('owner', 15_000);
    await store.writeSnapshotIfOwner('owner', doc());
    expect(await store.readSnapshot()).toEqual(doc());
    expect(redis.pttl(REDIS_KEYS.snapshot)).toBe(8 * 24 * 3_600 * 1_000);
    expect(redis.pttl(REDIS_KEYS.snapshotVersion)).toBe(8 * 24 * 3_600 * 1_000);
    redis.seed(REDIS_KEYS.snapshot, '{not json');
    expect(await store.readSnapshot()).toBeNull();
    redis.seed(REDIS_KEYS.snapshot, JSON.stringify({ ...doc(), schemaVersion: 2 }));
    expect(await store.readSnapshot()).toBeNull();
    const tampered = doc();
    tampered.equities.items[0] = { ...tampered.equities.items[0], lastPriceNgn: 5 }; // unavailable item with a price
    redis.seed(REDIS_KEYS.snapshot, JSON.stringify(tampered));
    expect(await store.readSnapshot()).toBeNull();
    const ambiguous = doc();
    ambiguous.equities.items[0] = {
      ...ambiguous.equities.items[0],
      available: true,
      unavailableReason: null,
      lastPriceNgn: 5,
      quoteTimestamp: '2026-10-22 09:00:00', // no offset → not an unambiguous instant
    };
    redis.seed(REDIS_KEYS.snapshot, JSON.stringify(ambiguous));
    expect(await store.readSnapshot()).toBeNull();
  });

  describe('lock ownership', () => {
    it('lock is exclusive, expires, and can only be released by its owner (foreign release is a no-op)', async () => {
      expect(await store.acquireLock('a', 15_000)).toBe(true);
      expect(await store.acquireLock('b', 15_000)).toBe(false);
      await store.releaseLock('b');
      expect(redis.peek(REDIS_KEYS.lock)).toBe('a');
      await store.releaseLock('a');
      expect(await store.acquireLock('b', 15_000)).toBe(true);
      now += 15_001;
      expect(await store.acquireLock('c', 15_000)).toBe(true);
      await store.releaseLock('b'); // expired holder cannot release the new holder's lock
      expect(redis.peek(REDIS_KEYS.lock)).toBe('c');
    });

    it('cache write requires current lock ownership', async () => {
      expect(await store.writeSnapshotIfOwner('nobody', doc())).toBe('LOCK_LOST');
      expect(redis.peek(REDIS_KEYS.snapshot)).toBeNull();
      await store.acquireLock('a', 15_000);
      now += 15_001; // a's lock expired (holder paused)
      expect(await store.writeSnapshotIfOwner('a', doc())).toBe('LOCK_LOST');
      expect(redis.peek(REDIS_KEYS.snapshot)).toBeNull();
    });

    it('a stale holder can never overwrite newer data written by the next holder', async () => {
      await store.acquireLock('a', 15_000);
      now += 15_001; // a paused past its TTL
      await store.acquireLock('b', 15_000);
      expect(await store.writeSnapshotIfOwner('b', doc('2026-10-22T10:00:15.001Z'))).toBe('OK');
      expect(await store.writeSnapshotIfOwner('a', doc('2026-10-22T10:00:00.000Z'))).toBe('LOCK_LOST');
      expect((await store.readSnapshot())?.equities.refreshedAt).toBe('2026-10-22T10:00:15.001Z');
    });

    it('even a lock owner cannot replace the cache with an older or equal refresh', async () => {
      await store.acquireLock('a', 15_000);
      expect(await store.writeSnapshotIfOwner('a', doc('2026-10-22T10:00:10.000Z'))).toBe('OK');
      expect(await store.writeSnapshotIfOwner('a', doc('2026-10-22T10:00:05.000Z'))).toBe('NOT_NEWER');
      expect(await store.writeSnapshotIfOwner('a', doc('2026-10-22T10:00:10.000Z'))).toBe('NOT_NEWER');
      expect((await store.readSnapshot())?.equities.refreshedAt).toBe('2026-10-22T10:00:10.000Z');
    });

    it('a reservation is refused once the caller no longer owns the lock', async () => {
      expect(await reserve('2026-10', '2026-10-22', 10, 5)).toEqual({ allowed: false, reason: 'LOCK_LOST' });
      await store.acquireLock('owner', 15_000);
      expect((await reserve('2026-10', '2026-10-22', 10, 5)).allowed).toBe(true);
      now += 15_001;
      expect(await reserve('2026-10', '2026-10-22', 10, 5)).toEqual({ allowed: false, reason: 'LOCK_LOST' });
      expect(redis.peek(REDIS_KEYS.budgetMonth('2026-10'))).toBe('1'); // refused attempts are not counted
    });
  });

  it('cooldowns are extended but never shortened', async () => {
    await store.setCooldown('PROVIDER_QUOTA', 86_400);
    await store.setCooldown('REFRESH_FAILED', 600);
    expect(await store.getCooldown()).toBe('PROVIDER_QUOTA');
    expect(redis.pttl(REDIS_KEYS.cooldown)).toBe(86_400_000);
  });

  it('reserves attempts atomically against monthly and daily caps, denying during cooldown', async () => {
    await store.acquireLock('owner', 15_000);
    expect(await reserve('2026-10', '2026-10-22', 3, 2)).toEqual({ allowed: true, monthCount: 1, dayCount: 1, providerPeriodCount: 1 });
    expect(await reserve('2026-10', '2026-10-22', 3, 2)).toEqual({ allowed: true, monthCount: 2, dayCount: 2, providerPeriodCount: 2 });
    expect(await reserve('2026-10', '2026-10-22', 3, 2)).toEqual({ allowed: false, reason: 'DAILY_BUDGET' });
    expect(await reserve('2026-10', '2026-10-23', 3, 2)).toEqual({ allowed: true, monthCount: 3, dayCount: 1, providerPeriodCount: 3 });
    expect(await reserve('2026-10', '2026-10-24', 3, 2)).toEqual({ allowed: false, reason: 'MONTHLY_BUDGET' });
    expect(redis.pttl(REDIS_KEYS.budgetMonth('2026-10'))).toBe(40 * 24 * 3_600 * 1_000);
    await store.setCooldown('X', 60);
    expect(await reserve('2026-11', '2026-11-01', 3, 2)).toEqual({ allowed: false, reason: 'COOLDOWN' });
  });

  describe('provider quota period (billing renewal, reset_at)', () => {
    const period = () => redis.hpeek(REDIS_KEYS.budgetProviderPeriod);
    beforeEach(async () => {
      await store.acquireLock('owner', 60 * DAY);
    });

    it('adopts the first validated reset_at and never replaces it with an earlier one', async () => {
      const renewal = Date.parse('2026-11-15T23:57:00.000Z');
      expect(await store.observeProviderReset(renewal, now)).toBe('ADOPTED');
      expect(await store.observeProviderReset(Date.parse('2026-11-01T00:00:00.000Z'), now)).toBe('IGNORED');
      expect(period()?.end).toBe(String(renewal));
    });

    it('only extends a known period end (later value) — extension never adds capacity', async () => {
      const renewal = Date.parse('2026-11-15T23:57:00.000Z');
      await store.observeProviderReset(renewal, now);
      expect(await store.observeProviderReset(renewal + DAY, now)).toBe('EXTENDED');
      expect(period()?.end).toBe(String(renewal + DAY));
    });

    it('calendar rollover before billing renewal does not add capacity (provider-period cap still applies)', async () => {
      await store.observeProviderReset(Date.parse('2026-11-15T23:57:00.000Z'), now);
      for (let i = 0; i < 3; i += 1) expect((await reserve('2026-10', '2026-10-22', 3, 10)).allowed).toBe(true);
      now = Date.parse('2026-11-01T09:00:00Z'); // new Lagos month, provider period not renewed yet
      expect(await reserve('2026-11', '2026-11-01', 3, 10)).toEqual({
        allowed: false,
        reason: 'PROVIDER_PERIOD_BUDGET',
        untilMs: Date.parse('2026-11-15T23:57:00.000Z') + HOUR,
      });
      expect(redis.peek(REDIS_KEYS.budgetMonth('2026-11'))).toBeNull(); // nothing counted when denied
    });

    it('billing rollover releases capacity only after reset_at + 1 h grace, carrying grace-window calls over', async () => {
      const renewal = Date.parse('2026-11-15T23:57:00.000Z');
      await store.observeProviderReset(renewal, now);
      for (let i = 0; i < 2; i += 1) await reserve('2026-10', '2026-10-22', 3, 10);
      now = renewal + 30 * 60_000; // inside grace: still the old period (conservative)
      expect((await reserve('2026-11', '2026-11-16', 3, 10)).allowed).toBe(true); // 3rd call of the old period
      expect(await reserve('2026-11', '2026-11-16', 3, 10)).toMatchObject({ allowed: false, reason: 'PROVIDER_PERIOD_BUDGET' });
      expect(period()).toMatchObject({ count: '3', next: '1' });
      now = renewal + HOUR - 1; // 1 ms before the grace ends: still denied
      expect(await reserve('2026-11', '2026-11-16', 3, 10)).toMatchObject({ allowed: false, reason: 'PROVIDER_PERIOD_BUDGET' });
      now = renewal + HOUR;
      expect(await reserve('2026-11', '2026-11-16', 3, 10)).toEqual({ allowed: true, monthCount: 2, dayCount: 2, providerPeriodCount: 2 });
      expect(period()).toMatchObject({ end: '0', count: '2', next: '0', start: String(renewal) });
      // The new reset_at is adopted on the next response.
      expect(await store.observeProviderReset(Date.parse('2026-12-15T23:57:00.000Z'), now)).toBe('ADOPTED');
    });

    it('a different reset_at observed inside the grace window is ignored (no early reset)', async () => {
      const renewal = Date.parse('2026-11-15T23:57:00.000Z');
      await store.observeProviderReset(renewal, now);
      now = renewal + 10 * 60_000;
      expect(await store.observeProviderReset(Date.parse('2026-12-15T23:57:00.000Z'), now)).toBe('IGNORED');
      expect(period()?.end).toBe(String(renewal));
    });

    it('with no valid reset_at ever observed, counts roll over at most once per 31 days + grace', async () => {
      for (let i = 0; i < 3; i += 1) await reserve('2026-10', '2026-10-22', 3, 10);
      now = Date.parse('2026-11-05T10:00:00Z');
      expect(await reserve('2026-11', '2026-11-05', 3, 10)).toMatchObject({ allowed: false, reason: 'PROVIDER_PERIOD_BUDGET' });
      now = Date.parse('2026-10-22T10:00:00Z') + 31 * DAY + HOUR;
      expect((await reserve('2026-11', '2026-11-22', 3, 10)).allowed).toBe(true);
    });

    it('concurrent reservations never exceed the cap', async () => {
      await store.observeProviderReset(Date.parse('2026-11-15T23:57:00.000Z'), now);
      const results = await Promise.all(Array.from({ length: 20 }, () => reserve('2026-10', '2026-10-22', 7, 50)));
      expect(results.filter((r) => r.allowed)).toHaveLength(7);
      expect(redis.peek(REDIS_KEYS.budgetMonth('2026-10'))).toBe('7');
      expect(period()?.count).toBe('7');
    });
  });

  it('propagates Redis failures to the caller (which then never calls the provider)', async () => {
    redis.down = true;
    await expect(store.readSnapshot()).rejects.toThrow();
    await expect(reserve('2026-10', '2026-10-22', 3, 2)).rejects.toThrow();
    await expect(store.writeSnapshotIfOwner('owner', doc())).rejects.toThrow();
    await expect(store.observeProviderReset(now + DAY, now)).rejects.toThrow();
  });
});
