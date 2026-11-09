import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calculateReturnsProjection,
  formatProjectionNairaMinor,
  parseAnnualManagementFeePercent,
  parseAnnualReturnPercent,
  parseInvestmentPeriodMonths,
  parseRequiredNairaToMinor,
  type ReturnsInputs,
} from "../lib/tools/returns";

const root = process.cwd();
const toolsPage = readFileSync(join(root, "app/tools/page.tsx"), "utf8");
const returnsPage = readFileSync(join(root, "app/tools/returns/page.tsx"), "utf8");
const calculator = readFileSync(join(root, "components/tools/ReturnsCalculator.tsx"), "utf8");
const authProvider = readFileSync(join(root, "components/auth/AuthProvider.tsx"), "utf8");

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

function expectNear(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 0.0001) throw new Error(`${label}: expected ${expected}, received ${actual}`);
}

function parseMoney(value: string, label: string) {
  const parsed = parseRequiredNairaToMinor(value, label);
  if ("error" in parsed) throw new Error(`${label}: ${parsed.error}`);
  return parsed.value;
}

function projection(overrides: Partial<ReturnsInputs> = {}) {
  return calculateReturnsProjection({
    startingAmountMinor: parseMoney("500000", "Starting amount"),
    monthlyContributionMinor: parseMoney("50000", "Monthly contribution"),
    months: 60,
    annualReturnPercent: 15,
    annualManagementFeePercent: 1.5,
    ...overrides,
  });
}

// Independently calculated with the documented monthly sequence and high-precision decimal arithmetic.
const defaultProjection = projection();
expectEqual(Math.round(defaultProjection.totalContributedMinor), 350000000, "default total contributed in kobo");
expectEqual(Math.round(defaultProjection.projectedBeforeFeesMinor), 548231606, "default gross monthly-compounding projection");
expectEqual(Math.round(defaultProjection.estimatedManagementFeesMinor), 25529978, "default monthly fee impact");
expectEqual(Math.round(defaultProjection.projectedFinalBalanceMinor), 522701629, "default net monthly-compounding projection");
expectEqual(Math.round(defaultProjection.projectedGainLossMinor), 172701629, "default gain");
expectEqual(formatProjectionNairaMinor(defaultProjection.projectedFinalBalanceMinor), "₦5,227,016.29", "default formatted final balance");

const startingOnly = projection({ monthlyContributionMinor: 0 });
expectEqual(Math.round(startingOnly.totalContributedMinor), 50000000, "starting-only total contributed");
const monthlyOnly = projection({ startingAmountMinor: 0 });
expectEqual(Math.round(monthlyOnly.totalContributedMinor), 300000000, "monthly-only total contributed");

const zeroReturn = projection({ annualReturnPercent: 0 });
expectEqual(Math.round(zeroReturn.projectedBeforeFeesMinor), 350000000, "zero-return gross equals total contributed");
if (!(zeroReturn.projectedFinalBalanceMinor < zeroReturn.projectedBeforeFeesMinor)) throw new Error("Zero-return projection must still reflect a positive fee impact");

const negativeReturn = projection({ annualReturnPercent: -10, annualManagementFeePercent: 0 });
if (!(negativeReturn.projectedFinalBalanceMinor < negativeReturn.totalContributedMinor)) throw new Error("Negative return projection must show a loss with zero fees");

const zeroFee = projection({ annualManagementFeePercent: 0 });
expectNear(zeroFee.estimatedManagementFeesMinor, 0, "zero management fee impact");
expectNear(zeroFee.projectedBeforeFeesMinor, zeroFee.projectedFinalBalanceMinor, "zero management fee final balance");

const higherFee = projection({ annualManagementFeePercent: 10 });
if (!(higherFee.projectedFinalBalanceMinor < defaultProjection.projectedFinalBalanceMinor)) throw new Error("Higher management fee must lower the projected final balance");

const shortPeriod = projection({ months: 1 });
expectEqual(Math.round(shortPeriod.totalContributedMinor), 55000000, "one-month total contributed");
const longPeriod = projection({ months: 360 });
if (!(longPeriod.projectedFinalBalanceMinor > defaultProjection.projectedFinalBalanceMinor)) throw new Error("Longer period must grow the positive-return default scenario");

expectEqual(parseInvestmentPeriodMonths("1.5").value, 18, "half-year investment period conversion");
for (const { value, parser, label } of [
  { value: "", parser: () => parseRequiredNairaToMinor("", "Starting amount"), label: "empty starting amount" },
  { value: "-1", parser: () => parseRequiredNairaToMinor("-1", "Starting amount"), label: "negative starting amount" },
  { value: "1.234", parser: () => parseRequiredNairaToMinor("1.234", "Starting amount"), label: "over-precise money" },
  { value: "0", parser: () => parseInvestmentPeriodMonths("0"), label: "zero period" },
  { value: "0.1", parser: () => parseInvestmentPeriodMonths("0.1"), label: "partial-month period" },
  { value: "-100", parser: () => parseAnnualReturnPercent("-100"), label: "too-negative return" },
  { value: "1001", parser: () => parseAnnualReturnPercent("1001"), label: "too-high return" },
  { value: "-0.01", parser: () => parseAnnualManagementFeePercent("-0.01"), label: "negative fee" },
  { value: "101", parser: () => parseAnnualManagementFeePercent("101"), label: "too-high fee" },
]) {
  const parsed = parser();
  if (!("error" in parsed)) throw new Error(`Expected validation error for ${label}: ${value}`);
}

if (!toolsPage.includes('href: "/tools/returns"') || !toolsPage.includes('<Link href={tool.href}')) throw new Error("Returns Calculator card does not use local Next Link navigation");
if (!returnsPage.includes('<ReturnsCalculator />') || !returnsPage.includes('<Navbar />') || !returnsPage.includes('<Footer />')) throw new Error("Returns Calculator route does not use the calculator and shared site navigation");
for (const text of [
  "Starting amount (₦)",
  "Monthly contribution (₦)",
  "Investment period (years)",
  "Assumed annual return (%)",
  "You choose the assumption. Compare a savings-account rate against an investment rate to see the gap.",
  "Annual management fee (%)",
  "Project my returns",
  "Your projection appears here",
  "Set your amounts and assumptions, then press Project my returns.",
  "Projections are illustrations based entirely on the assumptions you enter — they are not forecasts, promises or indications of any Starfetch product&apos;s performance. Investment values can fall as well as rise. Figures compound monthly and ignore taxes.",
]) {
  if (!calculator.includes(text)) throw new Error(`Returns Calculator is missing required copy: ${text}`);
}
if (/(localStorage|sessionStorage|document\.cookie|console\.(log|info|debug)|fetch\()/i.test(calculator)) throw new Error("Returns Calculator must not persist, transmit, or log financial inputs");
if (!authProvider.includes('pathname === "/tools/returns"') || !authProvider.includes('if (!skipInitialSessionRefresh) void refreshSession();')) throw new Error("Returns Calculator must suppress the global authentication refresh on its public route");
if (/starfetchinvestltd\.com\.ng\/tools\/returns/i.test(toolsPage + returnsPage + calculator)) throw new Error("Returns Calculator uses a legacy website destination");

console.log("PASS — Returns Calculator validates local inputs, applies documented monthly compounding and monthly fees, formats naira accurately, supports gains/losses, and keeps projection values in the browser");
