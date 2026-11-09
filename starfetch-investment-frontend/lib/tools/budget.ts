export const MAX_SAFE_MINOR_UNITS = Number.MAX_SAFE_INTEGER;

export type BudgetAmounts = {
  takeHomeIncome: number;
  otherIncome: number;
  housingUtilities: number;
  foodHousehold: number;
  transportFuel: number;
  familySchoolSupport: number;
  lifestyleSubscriptions: number;
  loanDebtRepayments: number;
  everythingElse: number;
};

export type BudgetResult = {
  totalIncomeMinor: number;
  totalSpendingMinor: number;
  balanceMinor: number;
  spendingPercentage: number | null;
  guidelineNeedsMinor: number;
  guidelineWantsMinor: number;
  guidelineSavingsDebtMinor: number;
};

type ParseAmountResult =
  | { valueMinor: number; error?: never }
  | { valueMinor?: never; error: string };

const amountPattern = /^\d+(?:\.\d{1,2})?$/;

/**
 * Parses a user-entered naira amount to integer kobo. Empty values are zero so
 * optional fields can stay blank; values with more than two decimal places,
 * negative values, non-numeric input, and unsafe totals are rejected.
 */
export function parseNairaToMinor(rawValue: string): ParseAmountResult {
  const value = rawValue.trim();
  if (!value) return { valueMinor: 0 };
  if (value.startsWith("-")) return { error: "Amounts cannot be negative." };
  if (!amountPattern.test(value)) return { error: "Enter an amount using digits and up to two decimal places." };

  const [whole, decimal = ""] = value.split(".");
  const minorText = `${whole.replace(/^0+(?=\d)/, "")}${decimal.padEnd(2, "0")}`;
  const minor = Number(minorText);
  if (!Number.isSafeInteger(minor) || minor > MAX_SAFE_MINOR_UNITS) return { error: "This amount is too large to calculate safely." };
  return { valueMinor: minor };
}

function sumMinor(values: number[]) {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0 || total > MAX_SAFE_MINOR_UNITS - value) {
      throw new RangeError("The total is too large to calculate safely.");
    }
    total += value;
  }
  return total;
}

function percentageOfMinor(amountMinor: number, percentage: number) {
  const wholeHundreds = Math.floor(amountMinor / 100);
  const remainder = amountMinor % 100;
  const value = wholeHundreds * percentage + Math.round((remainder * percentage) / 100);
  if (!Number.isSafeInteger(value) || value > MAX_SAFE_MINOR_UNITS) throw new RangeError("The guideline amount is too large to calculate safely.");
  return value;
}

function percentageOfIncome(spendingMinor: number, incomeMinor: number) {
  if (incomeMinor === 0) return null;
  const value = Math.round(((spendingMinor / incomeMinor) * 100) * 10) / 10;
  return Number.isFinite(value) ? value : null;
}

/** Calculates local-only monthly totals and illustrative 50/30/20 targets. */
export function calculateBudget(amounts: BudgetAmounts): BudgetResult {
  const totalIncomeMinor = sumMinor([amounts.takeHomeIncome, amounts.otherIncome]);
  const totalSpendingMinor = sumMinor([
    amounts.housingUtilities,
    amounts.foodHousehold,
    amounts.transportFuel,
    amounts.familySchoolSupport,
    amounts.lifestyleSubscriptions,
    amounts.loanDebtRepayments,
    amounts.everythingElse,
  ]);
  const balanceMinor = totalIncomeMinor - totalSpendingMinor;

  return {
    totalIncomeMinor,
    totalSpendingMinor,
    balanceMinor,
    spendingPercentage: percentageOfIncome(totalSpendingMinor, totalIncomeMinor),
    guidelineNeedsMinor: percentageOfMinor(totalIncomeMinor, 50),
    guidelineWantsMinor: percentageOfMinor(totalIncomeMinor, 30),
    guidelineSavingsDebtMinor: percentageOfMinor(totalIncomeMinor, 20),
  };
}

/** Formats integer kobo as a Nigerian naira display without floating-point rounding. */
export function formatNairaMinor(minor: number) {
  if (!Number.isSafeInteger(minor)) return "Not available";
  const negative = minor < 0;
  const absolute = Math.abs(minor);
  const naira = Math.floor(absolute / 100);
  const kobo = absolute % 100;
  const formattedNaira = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(naira);
  return `${negative ? "−" : ""}₦${formattedNaira}${kobo ? `.${String(kobo).padStart(2, "0")}` : ""}`;
}

export function formatPercentage(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Not available";
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}
