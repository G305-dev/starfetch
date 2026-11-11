import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calculateBudget,
  MAX_SAFE_MINOR_UNITS,
  formatNairaMinor,
  formatPercentage,
  parseNairaToMinor,
  type BudgetAmounts,
} from "../lib/tools/budget";

const root = process.cwd();
const toolsPage = readFileSync(join(root, "app/tools/page.tsx"), "utf8");
const budgetPage = readFileSync(join(root, "app/tools/budget/page.tsx"), "utf8");
const planner = readFileSync(join(root, "components/tools/BudgetPlanner.tsx"), "utf8");
const authProvider = readFileSync(join(root, "components/auth/AuthProvider.tsx"), "utf8");

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

function amount(value: string, label: string) {
  const parsed = parseNairaToMinor(value);
  if ("error" in parsed) throw new Error(`${label}: expected a valid amount, received ${parsed.error}`);
  return parsed.valueMinor;
}

function blankBudget(): BudgetAmounts {
  return {
    takeHomeIncome: 0,
    otherIncome: 0,
    housingUtilities: 0,
    foodHousehold: 0,
    transportFuel: 0,
    familySchoolSupport: 0,
    lifestyleSubscriptions: 0,
    loanDebtRepayments: 0,
    everythingElse: 0,
  };
}

expectEqual(amount("850000", "integer amount"), 85000000, "integer naira conversion");
expectEqual(amount("125500.50", "decimal amount"), 12550050, "decimal naira conversion");
expectEqual(amount("", "empty optional amount"), 0, "empty amount conversion");
for (const invalid of ["-1", "1.234", "abc", "Infinity", "1e6"]) {
  const parsed = parseNairaToMinor(invalid);
  if (!("error" in parsed)) throw new Error(`Invalid amount was accepted: ${invalid}`);
}

const example = calculateBudget({
  takeHomeIncome: amount("850000", "take-home income"),
  otherIncome: amount("150000", "other income"),
  housingUtilities: amount("300000", "housing"),
  foodHousehold: amount("100000", "food"),
  transportFuel: amount("50000", "transport"),
  familySchoolSupport: amount("100000", "family"),
  lifestyleSubscriptions: amount("50000", "lifestyle"),
  loanDebtRepayments: amount("50000", "loan"),
  everythingElse: amount("25000", "everything else"),
});
expectEqual(example.totalIncomeMinor, 100000000, "total income");
expectEqual(example.totalSpendingMinor, 67500000, "total spending");
expectEqual(example.balanceMinor, 32500000, "remaining balance");
expectEqual(example.spendingPercentage, 67.5, "spending percentage");
expectEqual(example.guidelineNeedsMinor, 50000000, "50 percent guideline");
expectEqual(example.guidelineWantsMinor, 30000000, "30 percent guideline");
expectEqual(example.guidelineSavingsDebtMinor, 20000000, "20 percent guideline");

const incomeWithoutExpenses = calculateBudget({ ...blankBudget(), takeHomeIncome: amount("500000", "income only") });
expectEqual(incomeWithoutExpenses.totalSpendingMinor, 0, "no-expense total");
expectEqual(incomeWithoutExpenses.balanceMinor, 50000000, "no-expense balance");

const shortfall = calculateBudget({ ...blankBudget(), takeHomeIncome: amount("100000", "shortfall income"), housingUtilities: amount("120000", "shortfall expense") });
expectEqual(shortfall.balanceMinor, -2000000, "shortfall balance");

const zeroIncome = calculateBudget({ ...blankBudget(), housingUtilities: amount("500", "zero-income expense") });
expectEqual(zeroIncome.totalIncomeMinor, 0, "zero income total");
expectEqual(zeroIncome.spendingPercentage, null, "zero income percentage");
expectEqual(formatNairaMinor(12550050), "₦125,500.50", "decimal currency display");
expectEqual(formatNairaMinor(-2000000), "−₦20,000", "negative currency display");
expectEqual(formatPercentage(null), "Not available", "zero-income percentage display");
let overflowRejected = false;
try {
  calculateBudget({ ...blankBudget(), takeHomeIncome: MAX_SAFE_MINOR_UNITS, otherIncome: MAX_SAFE_MINOR_UNITS });
} catch (error) {
  overflowRejected = error instanceof RangeError;
}
if (!overflowRejected) throw new Error("Unsafe combined income total was not rejected");

if (!toolsPage.includes('href: "/tools/budget"') || !toolsPage.includes('<Link href={tool.href}')) throw new Error("Budget Planner card does not use local Next Link navigation");
if (!budgetPage.includes('<BudgetPlanner />') || !budgetPage.includes('<Navbar />') || !budgetPage.includes('<Footer />')) throw new Error("Budget Planner route does not use the planner and shared site navigation");
for (const text of [
  "Monthly income",
  "Monthly spending",
  "Take-home income (₦)",
  "Everything else (₦)",
  "Calculate my budget",
  "Your results appear here",
  "Illustrative planning tool only; not financial advice. The 50/30/20 guideline (needs/wants/savings) is a rule of thumb, not a rule.",
]) {
  if (!planner.includes(text)) throw new Error(`Budget Planner is missing required copy: ${text}`);
}
if (/(localStorage|sessionStorage|document\.cookie|console\.(log|info|debug)|fetch\()/i.test(planner)) throw new Error("Budget Planner must not persist, transmit, or log financial inputs");
if (!authProvider.includes('pathname === "/tools/budget"') || !authProvider.includes('if (!skipInitialSessionRefresh) void refreshSession();')) throw new Error("Budget Planner must suppress the global authentication refresh on its public route");
if (/starfetchinvestltd\.com\.ng\/tools\/budget/i.test(toolsPage + budgetPage + planner)) throw new Error("Budget Planner uses a legacy website destination");

console.log("PASS — Budget Planner validates local currency inputs, calculates totals/balances/guidelines safely, handles zero and shortfall cases, formats naira, and keeps all budget values local to the browser");
