import {
  MarketDataRedis,
  OBSERVE_PROVIDER_RESET_SCRIPT,
  RELEASE_LOCK_SCRIPT,
  RESERVE_ATTEMPT_SCRIPT,
  SET_COOLDOWN_SCRIPT,
  WRITE_SNAPSHOT_SCRIPT,
} from '../../src/modules/market-data/market-data.store';

/** Names used in `FakeMarketDataRedis.log` / fault injection for each Lua script. */
export type FakeScriptName = 'RESERVE' | 'RELEASE' | 'COOLDOWN' | 'WRITE' | 'OBSERVE_RESET';
const SCRIPT_NAMES = new Map<string, FakeScriptName>([
  [RESERVE_ATTEMPT_SCRIPT, 'RESERVE'],
  [RELEASE_LOCK_SCRIPT, 'RELEASE'],
  [SET_COOLDOWN_SCRIPT, 'COOLDOWN'],
  [WRITE_SNAPSHOT_SCRIPT, 'WRITE'],
  [OBSERVE_PROVIDER_RESET_SCRIPT, 'OBSERVE_RESET'],
]);

/**
 * In-memory stand-in for the Upstash REST client used by the market-data
 * module (synthetic; no network). Each command executes atomically after an
 * async yield, so concurrent callers interleave between commands exactly as
 * independent Vercel instances would against one Redis. The Lua scripts are
 * implemented with the same semantics as the scripts in `market-data.store.ts`
 * (dispatch is by exact script identity); the real scripts are additionally
 * exercised against a real redis-server outside Jest.
 */
export class FakeMarketDataRedis implements MarketDataRedis {
  private readonly entries = new Map<string, { value: string; expiresAt: number | null }>();
  private readonly hashes = new Map<string, { fields: Map<string, string>; expiresAt: number | null }>();
  readonly commands: string[] = [];
  /** Commands with script names, e.g. `GET`, `SET`, `EVAL:RESERVE`. */
  readonly log: string[] = [];
  /** When set, every command rejects (simulated outage/timeout). */
  down = false;
  /** Optional per-command failure injection (`script` set for EVAL). */
  failWhen?: (command: string, script?: FakeScriptName) => boolean;
  /**
   * Optional hook run before a command executes (after the async yield): used
   * to simulate latency (advance the fake clock), lock expiry or a peer's
   * writes landing between commands.
   */
  beforeCommand?: (command: string, script?: FakeScriptName) => void | Promise<void>;

  constructor(private readonly now: () => number) {}

  async get(key: string): Promise<unknown> {
    await this.enter('GET');
    return this.read(key);
  }

  async set(key: string, value: string, opts: { nx: true; px: number } | { ex: number }): Promise<unknown> {
    await this.enter('SET');
    if ('nx' in opts) {
      if (this.read(key) !== null) return null;
      this.write(key, value, opts.px);
      return 'OK';
    }
    this.write(key, value, opts.ex * 1_000);
    return 'OK';
  }

  async eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown> {
    const name = SCRIPT_NAMES.get(script);
    await this.enter('EVAL', name);
    if (script === RESERVE_ATTEMPT_SCRIPT) {
      const [monthKey, dayKey, cooldownKey, lockKey, periodKey] = keys;
      const token = String(args[4]);
      const [monthCap, dayCap, monthTtl, dayTtl] = args.slice(0, 4).map(Number);
      const [now, grace, periodTtl, fallback] = [Number(args[5]), Number(args[6]), Number(args[7]), Number(args[8])];
      if (this.read(lockKey) !== token) return [0, 'LOCK_LOST'];
      if (this.read(cooldownKey) !== null) return [0, 'COOLDOWN'];
      let pEnd = this.hnum(periodKey, 'end');
      let pCount = this.hnum(periodKey, 'count');
      const pNext = this.hnum(periodKey, 'next');
      let pStart = this.hnum(periodKey, 'start');
      if (pEnd > 0 && now >= pEnd + grace) {
        pStart = pEnd;
        pEnd = 0;
        pCount = pNext;
        this.hset(periodKey, { end: 0, count: pCount, next: 0, start: pStart });
      } else if (pEnd === 0 && pStart > 0 && now >= pStart + fallback) {
        pStart = 0;
        pCount = 0;
        this.hset(periodKey, { count: 0, next: 0, start: 0 });
      }
      if (Number(this.read(monthKey) ?? '0') >= monthCap) return [0, 'MONTHLY_BUDGET'];
      if (pCount >= monthCap) {
        const untilMs = pEnd > 0 ? pEnd + grace : pStart > 0 ? pStart + fallback : 0;
        return [0, 'PROVIDER_PERIOD_BUDGET', untilMs];
      }
      if (Number(this.read(dayKey) ?? '0') >= dayCap) return [0, 'DAILY_BUDGET'];
      const month = this.incr(monthKey, monthTtl);
      const day = this.incr(dayKey, dayTtl);
      pCount += 1;
      this.hset(periodKey, { count: pCount });
      if (pEnd > 0 && now >= pEnd) this.hset(periodKey, { next: this.hnum(periodKey, 'next') + 1 });
      if (pEnd === 0 && pStart === 0) this.hset(periodKey, { start: now });
      this.hashes.get(periodKey)!.expiresAt = this.now() + periodTtl * 1_000;
      return [1, month, day, pCount];
    }
    if (script === OBSERVE_PROVIDER_RESET_SCRIPT) {
      const periodKey = keys[0];
      const [resetAt, now, grace, ttl] = args.map(Number);
      let pEnd = this.hnum(periodKey, 'end');
      if (pEnd > 0 && now >= pEnd + grace) {
        this.hset(periodKey, { end: 0, count: this.hnum(periodKey, 'next'), next: 0, start: pEnd });
        pEnd = 0;
      }
      if (pEnd === 0 || (now < pEnd && resetAt > pEnd)) {
        this.hset(periodKey, { end: resetAt });
        this.hashes.get(periodKey)!.expiresAt = this.now() + ttl * 1_000;
        return pEnd === 0 ? 1 : 2;
      }
      return 0;
    }
    if (script === WRITE_SNAPSHOT_SCRIPT) {
      const [lockKey, snapshotKey, versionKey] = keys;
      const [token, json, ttl, version] = [String(args[0]), String(args[1]), Number(args[2]), Number(args[3])];
      if (this.read(lockKey) !== token) return 'LOCK_LOST';
      if (Number(this.read(versionKey) ?? '0') >= version) return 'NOT_NEWER';
      this.write(snapshotKey, json, ttl * 1_000);
      this.write(versionKey, String(version), ttl * 1_000);
      return 'OK';
    }
    if (script === RELEASE_LOCK_SCRIPT) {
      if (this.read(keys[0]) === String(args[0])) {
        this.entries.delete(keys[0]);
        return 1;
      }
      return 0;
    }
    if (script === SET_COOLDOWN_SCRIPT) {
      const current = this.pttl(keys[0]);
      const ms = Number(args[1]);
      if (current >= ms) return 0;
      this.write(keys[0], String(args[0]), ms);
      return 1;
    }
    throw new Error('FakeMarketDataRedis: unknown script');
  }

  // ---- inspection helpers (tests only) ----
  peek(key: string): string | null {
    return this.read(key);
  }
  hpeek(key: string): Record<string, string> | null {
    const hash = this.liveHash(key);
    return hash ? Object.fromEntries(hash.fields) : null;
  }
  hseed(key: string, fields: Record<string, number>, ttlMs: number | null = null): void {
    this.hset(key, fields);
    this.hashes.get(key)!.expiresAt = ttlMs === null ? null : this.now() + ttlMs;
  }
  /** Simulates the key expiring (e.g. a lock TTL elapsing while its holder is paused). */
  expire(key: string): void {
    this.entries.delete(key);
    this.hashes.delete(key);
  }
  pttl(key: string): number {
    const entry = this.live(key);
    if (!entry) return -2;
    return entry.expiresAt === null ? -1 : entry.expiresAt - this.now();
  }
  seed(key: string, value: string, ttlMs: number | null = null): void {
    this.write(key, value, ttlMs);
  }
  keys(): string[] {
    return [
      ...[...this.entries.keys()].filter((key) => this.live(key)),
      ...[...this.hashes.keys()].filter((key) => this.liveHash(key)),
    ];
  }
  countOf(command: string): number {
    return this.commands.filter((c) => c === command).length;
  }
  countLogged(entry: string): number {
    return this.log.filter((c) => c === entry).length;
  }

  private async enter(command: string, script?: FakeScriptName): Promise<void> {
    await Promise.resolve();
    this.commands.push(command);
    this.log.push(script ? `${command}:${script}` : command);
    await this.beforeCommand?.(command, script);
    if (this.down || this.failWhen?.(command, script)) throw new Error('simulated redis failure');
  }
  private liveHash(key: string) {
    const hash = this.hashes.get(key);
    if (!hash) return undefined;
    if (hash.expiresAt !== null && hash.expiresAt <= this.now()) {
      this.hashes.delete(key);
      return undefined;
    }
    return hash;
  }
  private hnum(key: string, field: string): number {
    return Number(this.liveHash(key)?.fields.get(field) ?? '0');
  }
  private hset(key: string, fields: Record<string, number>): void {
    const hash = this.liveHash(key) ?? { fields: new Map<string, string>(), expiresAt: null };
    for (const [field, value] of Object.entries(fields)) hash.fields.set(field, String(value));
    this.hashes.set(key, hash);
  }
  private live(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }
  private read(key: string): string | null {
    return this.live(key)?.value ?? null;
  }
  private write(key: string, value: string, ttlMs: number | null): void {
    this.entries.set(key, { value, expiresAt: ttlMs === null ? null : this.now() + ttlMs });
  }
  private incr(key: string, ttlSeconds: number): number {
    const entry = this.live(key);
    const next = Number(entry?.value ?? '0') + 1;
    if (entry) entry.value = String(next);
    else this.write(key, String(next), null);
    if (next === 1) this.entries.get(key)!.expiresAt = this.now() + ttlSeconds * 1_000;
    return next;
  }
}

/** Synthetic NGN Market `/companies` payload for the given symbols (prices are fake). */
export function syntheticCompaniesBody(
  symbols: string[],
  lastUpdated: string,
  overrides: Record<string, Record<string, unknown>> = {},
  meta: Record<string, unknown> = { plan: 'free', calls_used: 10, calls_remaining: 2_990, reset_at: '2099-01-01T00:00:00.000Z' },
): Record<string, unknown> {
  const data = symbols.map((symbol, index) => ({
    id: index + 1,
    symbol,
    name: `SYNTHETIC ${symbol} PLC`,
    price: 100 + index,
    prev_close: 99 + index,
    price_change: 1,
    price_change_percent: 1.01,
    volume: 1_000,
    market_cap: 123_456,
    last_updated: lastUpdated,
    ...(overrides[symbol] ?? {}),
  }));
  return { success: true, data: { data, pagination: { page: 1, limit: 200, total: data.length, total_pages: 1 } }, meta };
}

/** Synthetic NGN Market `/market/snapshot` payload (values are fake). */
export function syntheticSnapshotBody(
  updatedAt: string,
  meta: Record<string, unknown> = { plan: 'free', calls_used: 11, calls_remaining: 2_989, reset_at: '2099-01-01T00:00:00.000Z' },
): Record<string, unknown> {
  return {
    success: true,
    data: {
      date: updatedAt.slice(0, 10),
      asi: 100_000.5,
      asi_change: 500.25,
      asi_change_percent: 0.5,
      ytd_asi_change_percent: 10,
      deals: 1,
      volume: 2,
      value_traded: 3,
      market_cap: { equity: 50_000, bonds: 1, etfs: 1, total: 60_000 },
      updated_at: updatedAt,
    },
    meta,
  };
}

export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}
