import { syntheticCompaniesBody, syntheticSnapshotBody } from '../../../test/utils/fake-market-data-redis';
import { FEATURED_NGX_EQUITIES } from './market-data.constants';
import {
  checkQuoteInstant,
  isSummaryCurrent,
  parseCompaniesResponse,
  parseProviderErrorCode,
  parseQuotaMeta,
  parseSnapshotResponse,
  parseStrictInstant,
  validResetAtMs,
} from './ngn-market.validation';

const NOW = new Date('2026-10-22T11:00:00.000Z');
const QUOTE_TIME = '2026-10-22T10:40:00.000Z';
const ALL = FEATURED_NGX_EQUITIES.map((e) => e.symbol);

describe('NGN Market response validation & normalization', () => {
  it('supports exactly the 14 verified homepage equities in directory order', () => {
    expect(ALL).toEqual([
      'ACCESSCORP', 'AIRTELAFRI', 'ARADEL', 'BUACEMENT', 'BUAFOODS', 'DANGCEM', 'FIRSTHOLDCO',
      'GTCO', 'MTNN', 'NB', 'NESTLE', 'SEPLAT', 'UBA', 'ZENITHBANK',
    ]);
  });

  it('normalizes a valid response: provider price/percent/timestamp passed through, curated names, order preserved', () => {
    const body = syntheticCompaniesBody(['ZZEXTRA', ...ALL.slice().reverse()], QUOTE_TIME);
    const result = parseCompaniesResponse(body, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((q) => q.symbol)).toEqual(ALL); // extra symbol dropped, order = directory
    const dangcem = result.value.find((q) => q.symbol === 'DANGCEM')!;
    expect(dangcem).toEqual({
      symbol: 'DANGCEM',
      companyName: 'Dangote Cement Plc',
      lastPriceNgn: expect.any(Number),
      dailyChangePercent: 1.01,
      quoteTimestamp: QUOTE_TIME,
      available: true,
      unavailableReason: null,
    });
    expect(result.value.every((q) => q.available)).toBe(true);
  });

  it('reports symbols absent from the provider response as unavailable (never guessed)', () => {
    const result = parseCompaniesResponse(syntheticCompaniesBody(['DANGCEM', 'GTCO'], QUOTE_TIME), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const nestle = result.value.find((q) => q.symbol === 'NESTLE')!;
    expect(nestle).toEqual({
      symbol: 'NESTLE',
      companyName: 'Nestlé Nigeria Plc',
      lastPriceNgn: null,
      dailyChangePercent: null,
      quoteTimestamp: null,
      available: false,
      unavailableReason: 'NOT_IN_PROVIDER_RESPONSE',
    });
    expect(result.value.filter((q) => q.available).map((q) => q.symbol)).toEqual(['DANGCEM', 'GTCO']);
  });

  it('marks duplicated symbols as unavailable rather than choosing one', () => {
    const body = syntheticCompaniesBody(['GTCO', 'GTCO', 'MTNN'], QUOTE_TIME, {});
    const result = parseCompaniesResponse(body, NOW);
    expect(result.ok && result.value.find((q) => q.symbol === 'GTCO')?.unavailableReason).toBe('DUPLICATE_IN_PROVIDER_RESPONSE');
  });

  it.each([
    ['zero price', { price: 0 }, 'INVALID_PRICE'],
    ['negative price', { price: -5 }, 'INVALID_PRICE'],
    ['non-numeric price', { price: 'abc' }, 'INVALID_PRICE'],
    ['NaN-like price', { price: 'NaN' }, 'INVALID_PRICE'],
    ['Infinity price', { price: Infinity }, 'INVALID_PRICE'],
    ['missing price', { price: undefined }, 'INVALID_PRICE'],
    ['absurd price', { price: 99_999_999 }, 'INVALID_PRICE'],
    ['missing timestamp', { last_updated: undefined }, 'MISSING_QUOTE_TIMESTAMP'],
    ['null timestamp', { last_updated: null }, 'MISSING_QUOTE_TIMESTAMP'],
    ['unparseable timestamp', { last_updated: 'yesterday' }, 'INVALID_QUOTE_TIMESTAMP'],
    ['timestamp in the future', { last_updated: '2026-10-22T12:00:00.000Z' }, 'FUTURE_QUOTE_TIMESTAMP'],
    ['timestamp older than 7 days', { last_updated: '2026-10-15T10:59:59.999Z' }, 'QUOTE_EXPIRED'],
  ])('treats malformed quote data as unavailable with a reason code: %s', (_label, override, reason) => {
    const body = syntheticCompaniesBody(['GTCO', 'MTNN'], QUOTE_TIME, { GTCO: override as Record<string, unknown> });
    const result = parseCompaniesResponse(body, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.find((q) => q.symbol === 'GTCO')).toEqual({
      symbol: 'GTCO',
      companyName: 'Guaranty Trust Holding Company Plc',
      lastPriceNgn: null,
      dailyChangePercent: null,
      quoteTimestamp: null,
      available: false,
      unavailableReason: reason,
    });
    expect(result.value.find((q) => q.symbol === 'MTNN')).toMatchObject({ available: true, quoteTimestamp: QUOTE_TIME });
  });

  describe('quote timestamps (strict, zero future tolerance, testable clock)', () => {
    const quoteFor = (lastUpdated: unknown, now: Date = NOW) => {
      const body = syntheticCompaniesBody(['GTCO', 'MTNN'], QUOTE_TIME, { GTCO: { last_updated: lastUpdated } });
      const result = parseCompaniesResponse(body, now);
      if (!result.ok) throw new Error('expected ok');
      return result.value.find((q) => q.symbol === 'GTCO')!;
    };

    it('accepts a historical timestamp and preserves it exactly (never replaced by the clock or refresh time)', () => {
      expect(quoteFor('2026-10-20T13:30:00.000Z')).toMatchObject({ available: true, quoteTimestamp: '2026-10-20T13:30:00.000Z' });
    });

    it('accepts a timestamp exactly equal to the validation clock', () => {
      expect(quoteFor(NOW.toISOString())).toMatchObject({ available: true, quoteTimestamp: NOW.toISOString() });
    });

    it.each([
      ['+1 ms', '2026-10-22T11:00:00.001Z'],
      ['+5 minutes (old tolerance removed)', '2026-10-22T11:05:00.000Z'],
      ['+1 ms via an offset', '2026-10-22T12:00:00.001+01:00'],
      ['sub-millisecond after the clock', '2026-10-22T11:00:00.0000001Z'],
    ])('rejects a future timestamp (%s) — never clamped', (_label, value) => {
      expect(quoteFor(value)).toMatchObject({ available: false, unavailableReason: 'FUTURE_QUOTE_TIMESTAMP', quoteTimestamp: null });
    });

    it('uses the injected clock, not the wall clock', () => {
      const pastClock = Date.parse('2020-01-01T00:00:00.000Z');
      expect(checkQuoteInstant('2020-01-01T00:00:00.001Z', pastClock)).toEqual({ ok: false, reason: 'FUTURE_QUOTE_TIMESTAMP' });
      expect(checkQuoteInstant('2019-12-31T23:59:59.999Z', pastClock)).toMatchObject({ ok: true });
      expect(checkQuoteInstant(QUOTE_TIME, pastClock)).toEqual({ ok: false, reason: 'FUTURE_QUOTE_TIMESTAMP' });
    });

    it.each([
      ['no offset (local time)', '2026-10-22T10:00:00'],
      ['space separator', '2026-10-22 10:00:00Z'],
      ['date only', '2026-10-22'],
      ['no seconds', '2026-10-22T10:00Z'],
      ['offset without colon', '2026-10-22T10:00:00+0100'],
      ['hour-only offset', '2026-10-22T10:00:00+01'],
      ['US-style date', '10/22/2026 10:00'],
      ['RFC 2822 string', 'Thu, 22 Oct 2026 10:00:00 GMT'],
      ['epoch number', 1_792_659_600_000],
      ['epoch string', '1792659600000'],
      ['lowercase z', '2026-10-22T10:00:00z'],
      ['invalid offset', '2026-10-22T10:00:00+15:00'],
      ['empty-ish garbage', 'T'],
      ['object', { at: '2026-10-22T10:00:00Z' }],
    ])('rejects an invalid or ambiguous format (%s)', (_label, value) => {
      expect(quoteFor(value)).toMatchObject({ available: false, unavailableReason: 'INVALID_QUOTE_TIMESTAMP' });
    });

    it.each([
      ['31 April', '2026-04-31T10:00:00Z'],
      ['29 February in a non-leap year', '2026-02-29T10:00:00Z'],
      ['month 13', '2026-13-01T10:00:00Z'],
      ['day 00', '2026-10-00T10:00:00Z'],
      ['hour 24', '2026-10-21T24:00:00Z'],
      ['minute 60', '2026-10-21T10:60:00Z'],
      ['leap second', '2026-10-21T23:59:60Z'],
    ])('rejects an impossible calendar date/time instead of rolling it over (%s)', (_label, value) => {
      expect(quoteFor(value)).toMatchObject({ available: false, unavailableReason: 'INVALID_QUOTE_TIMESTAMP' });
    });

    it('accepts a real leap day and explicit offsets, normalising to UTC without changing the instant', () => {
      expect(parseStrictInstant('2024-02-29T12:00:00Z')).toEqual({ ms: Date.parse('2024-02-29T12:00:00Z'), subMillisecond: false });
      expect(quoteFor('2026-10-22T11:30:00+01:00')).toMatchObject({ available: true, quoteTimestamp: '2026-10-22T10:30:00.000Z' });
      expect(quoteFor('2026-10-22T05:30:00-04:30')).toMatchObject({ available: true, quoteTimestamp: '2026-10-22T10:00:00.000Z' });
    });

    it('a valid timestamp with an invalid price is unavailable (INVALID_PRICE), the timestamp is not kept', () => {
      const body = syntheticCompaniesBody(['GTCO', 'MTNN'], QUOTE_TIME, { GTCO: { price: -1 } });
      const result = parseCompaniesResponse(body, NOW);
      expect(result.ok && result.value.find((q) => q.symbol === 'GTCO')).toMatchObject({
        available: false,
        unavailableReason: 'INVALID_PRICE',
        quoteTimestamp: null,
        lastPriceNgn: null,
      });
    });

    it('mixed equities: one invalid timestamp affects only that equity; others keep their own timestamps', () => {
      const body = syntheticCompaniesBody(['GTCO', 'MTNN', 'UBA'], QUOTE_TIME, {
        GTCO: { last_updated: '2026-10-22T11:00:00.001Z' },
        UBA: { last_updated: '2026-10-21T14:30:00.000Z' },
      });
      const result = parseCompaniesResponse(body, NOW);
      if (!result.ok) throw new Error('expected ok');
      const bySymbol = Object.fromEntries(result.value.map((q) => [q.symbol, q]));
      expect(bySymbol.GTCO).toMatchObject({ available: false, unavailableReason: 'FUTURE_QUOTE_TIMESTAMP', quoteTimestamp: null });
      expect(bySymbol.MTNN).toMatchObject({ available: true, quoteTimestamp: QUOTE_TIME });
      expect(bySymbol.UBA).toMatchObject({ available: true, quoteTimestamp: '2026-10-21T14:30:00.000Z' });
    });
  });

  describe('7-day per-quote maximum (measured from each quote timestamp)', () => {
    const SEVEN_DAYS = 7 * 24 * 3_600_000;
    it('just below, exactly at, and above 7 days', () => {
      const now = NOW.getTime();
      expect(checkQuoteInstant(new Date(now - SEVEN_DAYS + 1).toISOString(), now)).toMatchObject({ ok: true });
      expect(checkQuoteInstant(new Date(now - SEVEN_DAYS).toISOString(), now)).toMatchObject({ ok: true });
      expect(checkQuoteInstant(new Date(now - SEVEN_DAYS - 1).toISOString(), now)).toEqual({ ok: false, reason: 'QUOTE_EXPIRED' });
    });

    it('old quotes in an otherwise fresh provider response are unavailable (QUOTE_EXPIRED)', () => {
      const body = syntheticCompaniesBody(['GTCO', 'MTNN'], QUOTE_TIME, { GTCO: { last_updated: '2026-10-10T10:00:00.000Z' } });
      const result = parseCompaniesResponse(body, NOW);
      expect(result.ok && result.value.find((q) => q.symbol === 'GTCO')?.unavailableReason).toBe('QUOTE_EXPIRED');
    });

    it('a response where every featured quote is older than 7 days is rejected (cache not overwritten)', () => {
      expect(parseCompaniesResponse(syntheticCompaniesBody(ALL, '2026-10-01T10:00:00.000Z'), NOW)).toEqual({
        ok: false,
        error: 'NO_USABLE_QUOTES',
      });
    });

    it('weekend: Friday-close quotes are still available on Sunday (no trading calendar assumed)', () => {
      const sunday = new Date('2026-10-25T12:00:00.000Z');
      const body = syntheticCompaniesBody(ALL, '2026-10-23T14:30:00.000Z');
      const result = parseCompaniesResponse(body, sunday);
      expect(result.ok && result.value.every((q) => q.available && q.quoteTimestamp === '2026-10-23T14:30:00.000Z')).toBe(true);
    });
  });

  it('accepts strict numeric strings and nulls out-of-range percentages without computing them', () => {
    const body = syntheticCompaniesBody(['GTCO', 'MTNN'], QUOTE_TIME, {
      GTCO: { price: '55.25', price_change_percent: '-2.5' },
      MTNN: { price_change_percent: 250, prev_close: 50 },
    });
    const result = parseCompaniesResponse(body, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.find((q) => q.symbol === 'GTCO')).toMatchObject({ lastPriceNgn: 55.25, dailyChangePercent: -2.5 });
    expect(result.value.find((q) => q.symbol === 'MTNN')).toMatchObject({ available: true, dailyChangePercent: null });
  });

  it.each([
    ['null body', null],
    ['string body', 'oops'],
    ['success false', { success: false, error: { code: 'SERVER_ERROR', message: 'x' } }],
    ['data is an array (undocumented shape)', { success: true, data: [] }],
    ['data.data missing', { success: true, data: { items: [] } }],
  ])('rejects malformed envelopes: %s', (_label, body) => {
    expect(parseCompaniesResponse(body, NOW)).toEqual({ ok: false, error: 'MALFORMED_ENVELOPE' });
  });

  it('rejects a response with no usable featured quote (so good cached data is not overwritten)', () => {
    expect(parseCompaniesResponse(syntheticCompaniesBody(['ZZONE', 'ZZTWO'], QUOTE_TIME), NOW)).toEqual({
      ok: false,
      error: 'NO_USABLE_QUOTES',
    });
  });

  it('maps the market snapshot exactly as supplied (no derivation from equities)', () => {
    const result = parseSnapshotResponse(syntheticSnapshotBody('2026-10-22T10:40:00.000Z'), NOW);
    expect(result).toEqual({
      ok: true,
      value: {
        tradingDate: '2026-10-22',
        allShareIndex: 100_000.5,
        allShareIndexChange: 500.25,
        allShareIndexChangePercent: 0.5,
        equityMarketCapitalisation: 50_000,
        totalMarketCapitalisation: 60_000,
        providerUpdatedAt: '2026-10-22T10:40:00.000Z',
      },
    });
  });

  it('rejects snapshots without a valid trading date or ASI; nulls individually invalid fields', () => {
    const base = syntheticSnapshotBody('2026-10-22T10:40:00.000Z') as { data: Record<string, unknown> };
    expect(parseSnapshotResponse({ ...base, data: { ...base.data, date: '2026-13-45' } }, NOW)).toEqual({ ok: false, error: 'MALFORMED_SUMMARY' });
    expect(parseSnapshotResponse({ ...base, data: { ...base.data, asi: null } }, NOW)).toEqual({ ok: false, error: 'NO_USABLE_SUMMARY' });
    const partial = parseSnapshotResponse({ ...base, data: { ...base.data, market_cap: 'n/a', asi_change_percent: 'x' } }, NOW);
    expect(partial.ok && partial.value).toMatchObject({ equityMarketCapitalisation: null, allShareIndexChangePercent: null });
    expect(parseSnapshotResponse({ success: true }, NOW)).toEqual({ ok: false, error: 'MALFORMED_ENVELOPE' });
  });

  it('market summary must be current: trading date not in the future nor > 7 days old; strict updated_at', () => {
    const base = syntheticSnapshotBody('2026-10-22T10:40:00.000Z') as { data: Record<string, unknown> };
    const withData = (data: Record<string, unknown>) => parseSnapshotResponse({ ...base, data: { ...base.data, ...data } }, NOW);
    expect(withData({ date: '2026-10-23' })).toEqual({ ok: false, error: 'SUMMARY_NOT_CURRENT' });
    expect(withData({ date: '2026-10-14', updated_at: '2026-10-14T17:00:00.000Z' })).toEqual({ ok: false, error: 'SUMMARY_NOT_CURRENT' });
    expect(withData({ date: '2026-10-15', updated_at: '2026-10-15T11:00:00.000Z' }).ok).toBe(true);
    // Future/ambiguous updated_at is nulled, never clamped or replaced.
    expect(withData({ updated_at: '2026-10-22T11:00:00.001Z' })).toMatchObject({ ok: true, value: { providerUpdatedAt: null } });
    expect(withData({ updated_at: '2026-10-22 10:00:00' })).toMatchObject({ ok: true, value: { providerUpdatedAt: null } });
    expect(isSummaryCurrent({ tradingDate: '2026-10-22', providerUpdatedAt: null }, NOW.getTime())).toBe(true);
  });

  it('parses quota metadata defensively and sanitizes provider error codes', () => {
    expect(parseQuotaMeta({ meta: { calls_remaining: 120, reset_at: '2026-11-05T00:00:00Z' } })).toEqual({
      callsRemaining: 120,
      resetAt: '2026-11-05T00:00:00.000Z',
    });
    expect(parseQuotaMeta({ meta: { calls_remaining: -1, reset_at: 'never' } })).toEqual({ callsRemaining: null, resetAt: null });
    expect(parseQuotaMeta({ meta: { calls_remaining: 5, reset_at: '2026-11-05' } })).toEqual({ callsRemaining: 5, resetAt: null });
    expect(parseQuotaMeta({ meta: { calls_remaining: 5, reset_at: '2026-02-30T00:00:00Z' } })).toEqual({ callsRemaining: 5, resetAt: null });
    expect(parseQuotaMeta(null)).toEqual({ callsRemaining: null, resetAt: null });
    expect(parseProviderErrorCode({ success: false, error: { code: 'QUOTA_EXCEEDED' } })).toBe('QUOTA_EXCEEDED');
    expect(parseProviderErrorCode({ success: false, error: { code: '<script>' } })).toBeUndefined();
  });

  it('validates reset_at for budgeting: strictly future and at most one provider period (+1 day) ahead', () => {
    const now = NOW.getTime();
    expect(validResetAtMs('2026-11-15T23:57:00.000Z', now)).toBe(Date.parse('2026-11-15T23:57:00.000Z'));
    expect(validResetAtMs(NOW.toISOString(), now)).toBeNull(); // not in the future
    expect(validResetAtMs('2026-10-01T00:00:00.000Z', now)).toBeNull(); // past
    expect(validResetAtMs('2027-01-01T00:00:00.000Z', now)).toBeNull(); // > 32 days ahead
    expect(validResetAtMs('2099-01-01T00:00:00.000Z', now)).toBeNull();
    expect(validResetAtMs(null, now)).toBeNull();
  });
});
