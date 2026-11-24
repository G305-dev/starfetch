import {
  LAGOS_UTC_OFFSET_MINUTES,
  OFF_HOURS_REFRESH_INTERVAL_SECONDS,
  TRADING_WINDOW_END_MINUTES,
  TRADING_WINDOW_START_MINUTES,
} from './market-data.constants';

export interface LagosParts {
  /** YYYY-MM-DD in Africa/Lagos (UTC+1, no DST). */
  date: string;
  /** YYYY-MM in Africa/Lagos — the local budget period. */
  month: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Minutes since local midnight. */
  minutes: number;
}

export function lagosParts(epochMs: number): LagosParts {
  const local = new Date(epochMs + LAGOS_UTC_OFFSET_MINUTES * 60_000);
  const iso = local.toISOString();
  return {
    date: iso.slice(0, 10),
    month: iso.slice(0, 7),
    weekday: local.getUTCDay(),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

/** True during the (deliberately wide) NGX weekday refresh window. Holidays are not modelled. */
export function isWithinTradingWindow(epochMs: number): boolean {
  const { weekday, minutes } = lagosParts(epochMs);
  return weekday >= 1 && weekday <= 5 && minutes >= TRADING_WINDOW_START_MINUTES && minutes < TRADING_WINDOW_END_MINUTES;
}

/** Refresh interval in force at `epochMs`. */
export function refreshIntervalSecondsAt(epochMs: number, tradingIntervalSeconds: number): number {
  return isWithinTradingWindow(epochMs) ? tradingIntervalSeconds : OFF_HOURS_REFRESH_INTERVAL_SECONDS;
}

/** Seconds until the next Lagos midnight (daily budget reset). */
export function secondsUntilNextLagosDay(epochMs: number): number {
  const { minutes } = lagosParts(epochMs);
  const local = new Date(epochMs + LAGOS_UTC_OFFSET_MINUTES * 60_000);
  const secondsIntoDay = minutes * 60 + local.getUTCSeconds();
  return Math.max(60, 24 * 3_600 - secondsIntoDay);
}

/** Seconds until the first day of the next Lagos calendar month (monthly budget reset). */
export function secondsUntilNextLagosMonth(epochMs: number): number {
  const local = new Date(epochMs + LAGOS_UTC_OFFSET_MINUTES * 60_000);
  const nextMonthLocalMidnightUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - LAGOS_UTC_OFFSET_MINUTES * 60_000;
  return Math.max(60, Math.ceil((nextMonthLocalMidnightUtc - epochMs) / 1_000));
}
