import {
  isWithinTradingWindow,
  lagosParts,
  refreshIntervalSecondsAt,
  secondsUntilNextLagosDay,
  secondsUntilNextLagosMonth,
} from './market-data.schedule';

describe('market-data schedule (Africa/Lagos, UTC+1)', () => {
  it('derives Lagos date/month across the UTC midnight boundary', () => {
    // 2026-10-31T23:30Z is already 2026-11-01 00:30 in Lagos.
    expect(lagosParts(Date.parse('2026-10-31T23:30:00Z'))).toMatchObject({ date: '2026-11-01', month: '2026-11', weekday: 0 });
  });

  it('uses the trading interval only on weekdays 09:00–16:30 Lagos', () => {
    // Thursday 2026-10-22.
    expect(isWithinTradingWindow(Date.parse('2026-10-22T07:59:00Z'))).toBe(false); // 08:59 WAT
    expect(isWithinTradingWindow(Date.parse('2026-10-22T08:00:00Z'))).toBe(true); // 09:00 WAT
    expect(isWithinTradingWindow(Date.parse('2026-10-22T15:29:00Z'))).toBe(true); // 16:29 WAT
    expect(isWithinTradingWindow(Date.parse('2026-10-22T15:30:00Z'))).toBe(false); // 16:30 WAT
    expect(isWithinTradingWindow(Date.parse('2026-10-24T10:00:00Z'))).toBe(false); // Saturday
    expect(refreshIntervalSecondsAt(Date.parse('2026-10-22T10:00:00Z'), 1_800)).toBe(1_800);
    expect(refreshIntervalSecondsAt(Date.parse('2026-10-22T20:00:00Z'), 1_800)).toBe(14_400);
  });

  it('computes budget-period reset horizons', () => {
    expect(secondsUntilNextLagosDay(Date.parse('2026-10-22T22:00:00Z'))).toBe(3_600); // 23:00 WAT
    expect(secondsUntilNextLagosMonth(Date.parse('2026-10-31T22:00:00Z'))).toBe(3_600); // 23:00 WAT on Oct 31
  });
});
