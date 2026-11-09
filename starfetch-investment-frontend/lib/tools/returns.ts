import { MAX_SAFE_MINOR_UNITS, formatNairaMinor, parseNairaToMinor } from "./budget";

export type ReturnsInputs = {
  startingAmountMinor: number;
  monthlyContributionMinor: number;
  months: number;
  annualReturnPercent: number;
  annualManagementFeePercent: number;
};

export type ReturnsProjection = {
  months: number;
  startingAmountMinor: number;
  additionalContributionsMinor: number;
  totalContributedMinor: number;
  projectedBeforeFeesMinor: number;
  estimatedManagementFeesMinor: number;
  projectedFinalBalanceMinor: number;
  projectedGainLossMinor: number;
};

type ParseResult<T> =
  | { value: T; error?: never }
  | { value?: never; error: string };

const signedDecimalPattern = /^-?\d+(?:\.\d+)?$/;
const nonNegativeDecimalPattern = /^\d+(?:\.\d+)?$/;

/** Parses a required Naira input into integer kobo, retaining up to two entered decimal places. */
export function parseRequiredNairaToMinor(rawValue: string, label: string): ParseResult<number> {
  if (!rawValue.trim()) return { error: `${label} is required.` };
  const parsed = parseNairaToMinor(rawValue);
  if (typeof parsed.valueMinor === "number") return { value: parsed.valueMinor };
  return { error: parsed.error ?? "Enter an amount using digits and up to two decimal places." };
}

/**
 * Uses whole monthly time steps. Fractions of a year are allowed only where
 * they describe a whole number of months (for example, 1.5 years = 18 months).
 */
export function parseInvestmentPeriodMonths(rawValue: string): ParseResult<number> {
  const value = rawValue.trim();
  if (!value) return { error: "Investment period is required." };
  if (!nonNegativeDecimalPattern.test(value)) return { error: "Enter the investment period as a number of years." };

  const years = Number(value);
  if (!Number.isFinite(years) || years <= 0) return { error: "Investment period must be greater than zero." };
  if (years > 100) return { error: "Investment period cannot exceed 100 years." };

  const months = years * 12;
  const wholeMonths = Math.round(months);
  if (Math.abs(months - wholeMonths) > 1e-9) return { error: "Enter a period that converts to a whole number of months (for example, 1 or 1.5 years)." };
  return { value: wholeMonths };
}

/** Accepts an illustrative annual rate, including negative scenarios, within stable model bounds. */
export function parseAnnualReturnPercent(rawValue: string): ParseResult<number> {
  const value = rawValue.trim();
  if (!value) return { error: "Assumed annual return is required." };
  if (!signedDecimalPattern.test(value)) return { error: "Enter the annual return as a valid percentage." };

  const percentage = Number(value);
  if (!Number.isFinite(percentage)) return { error: "Enter the annual return as a valid percentage." };
  if (percentage < -99.99 || percentage > 1000) return { error: "Enter an annual return between -99.99% and 1000%." };
  return { value: percentage };
}

/** Parses a non-negative annual fee that can be safely applied as a monthly deduction. */
export function parseAnnualManagementFeePercent(rawValue: string): ParseResult<number> {
  const value = rawValue.trim();
  if (!value) return { error: "Annual management fee is required." };
  if (!nonNegativeDecimalPattern.test(value)) return { error: "Enter the annual management fee as a valid percentage." };

  const percentage = Number(value);
  if (!Number.isFinite(percentage)) return { error: "Enter the annual management fee as a valid percentage." };
  if (percentage > 100) return { error: "Annual management fee cannot exceed 100%." };
  return { value: percentage };
}

function ensureSafeBalance(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > MAX_SAFE_MINOR_UNITS) {
    throw new RangeError("These assumptions produce an amount that is too large to calculate safely. Please use a shorter period or lower amounts/rates.");
  }
  return value;
}

/**
 * Runs a deterministic monthly illustration in minor Naira units.
 *
 * Each month, the pre-fee balance first receives the nominal annual return
 * divided by 12. The net balance receives that same monthly return, then the
 * annual management fee divided by 12 is charged on that evolved balance.
 * The monthly contribution is added at the end of the month in both paths.
 * The difference between the pre-fee and net paths is the fee impact.
 */
export function calculateReturnsProjection(input: ReturnsInputs): ReturnsProjection {
  const monthlyReturnRate = input.annualReturnPercent / 1200;
  const monthlyFeeRate = input.annualManagementFeePercent / 1200;
  const returnMultiplier = 1 + monthlyReturnRate;
  const netMultiplier = returnMultiplier * (1 - monthlyFeeRate);

  if (!Number.isFinite(returnMultiplier) || !Number.isFinite(netMultiplier) || returnMultiplier < 0 || netMultiplier < 0) {
    throw new RangeError("These assumptions cannot be calculated safely.");
  }

  const additionalContributionsMinor = input.monthlyContributionMinor * input.months;
  const totalContributedMinor = input.startingAmountMinor + additionalContributionsMinor;
  ensureSafeBalance(additionalContributionsMinor);
  ensureSafeBalance(totalContributedMinor);

  let projectedBeforeFeesMinor = input.startingAmountMinor;
  let projectedFinalBalanceMinor = input.startingAmountMinor;

  for (let month = 0; month < input.months; month += 1) {
    projectedBeforeFeesMinor = ensureSafeBalance((projectedBeforeFeesMinor * returnMultiplier) + input.monthlyContributionMinor);
    projectedFinalBalanceMinor = ensureSafeBalance((projectedFinalBalanceMinor * netMultiplier) + input.monthlyContributionMinor);
  }

  const estimatedManagementFeesMinor = projectedBeforeFeesMinor - projectedFinalBalanceMinor;
  const projectedGainLossMinor = projectedFinalBalanceMinor - totalContributedMinor;

  return {
    months: input.months,
    startingAmountMinor: input.startingAmountMinor,
    additionalContributionsMinor,
    totalContributedMinor,
    projectedBeforeFeesMinor,
    estimatedManagementFeesMinor,
    projectedFinalBalanceMinor,
    projectedGainLossMinor,
  };
}

/** Rounds an illustrative floating-point minor-unit projection only at display time. */
export function formatProjectionNairaMinor(value: number) {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_SAFE_MINOR_UNITS) return "Not available";
  return formatNairaMinor(Math.round(value));
}

export function formatProjectionPercent(value: number) {
  if (!Number.isFinite(value)) return "Not available";
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}
