import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IndividualAccountProfile, SaveIndividualKycInvestmentProfileInput } from "../lib/api/client";

type _IndividualAccountProfile = IndividualAccountProfile;
type _SaveIndividualKycInvestmentProfileInput = SaveIndividualKycInvestmentProfileInput;

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const draft = read("components/portal/InvestmentObjectiveRiskProfileDraft.tsx");
const profile = read("components/portal/IndividualProfileContent.tsx");
const mapping = read("lib/individual-kyc-mapping.ts");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const text of ["Investment Objective and Risk Profile", "Primary investment objective", "Capital preservation", "Income", "Balanced", "Growth", "Risk tolerance", "Conservative", "Moderate", "Aggressive", "Investment horizon", "180 days", "365 days", "1–3 years", "3–5 years", "5 years +", "Investment knowledge and experience", "None", "Limited", "Good", "Extensive", "Expected withdrawals", "Frequency", "Annual income (₦)", "Estimated net worth (₦)", "Investment restrictions or exclusions (if any)"]) {
  assert(draft.includes(text), `Investment profile form is missing: ${text}`);
}
assert(
  mapping.includes('"Capital preservation": "CAPITAL_PRESERVATION"')
    && mapping.includes('"180 days": "DAYS_180"')
    && mapping.includes('"5 years +": "YEARS_5_PLUS"')
    && mapping.includes("nairaToMinorUnits")
    && mapping.includes("minorUnitsToNaira"),
  "The UI options and naira/minor-unit conversions must follow the supplied wire mapping",
);
assert(
  profile.includes("saveIndividualKycInvestmentProfile({")
    && profile.includes('financialCurrency: "NGN"')
    && profile.includes("expectedWithdrawalsMinor")
    && profile.includes("annualIncomeMinor")
    && profile.includes("estimatedNetWorthMinor")
    && profile.includes("investmentRestrictions:"),
  "Investment Profile must save canonical values and monetary amounts in integer minor units",
);
assert(
  draft.includes("does not assess suitability or approve an investment")
    && !draft.includes("not submitted, saved, assessed, or retained"),
  "Saving investor preferences must not be described as suitability approval or as unsaved local-only data",
);

console.log("PASS — Investment Profile maps canonical options and precise kobo amounts to its versioned KYC API, without implying suitability approval");
