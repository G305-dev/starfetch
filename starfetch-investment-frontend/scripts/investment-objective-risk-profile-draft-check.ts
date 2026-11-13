import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IndividualAccountProfile } from "../lib/api/client";

// Keeps this standalone source check on the project-root compilation path.
type _IndividualAccountProfile = IndividualAccountProfile;

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const draft = read("components/portal/InvestmentObjectiveRiskProfileDraft.tsx");
const profile = read("components/portal/IndividualProfileContent.tsx");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const requiredCopy = [
  "Investment Objective and Risk Profile",
  "Primary investment objective",
  "Capital preservation",
  "Income",
  "Balanced",
  "Growth",
  "Risk tolerance",
  "Conservative",
  "Moderate",
  "Aggressive",
  "Investment horizon",
  "< 1 year",
  "1–3 years",
  "3–5 years",
  "5 years +",
  "Investment knowledge and experience",
  "None",
  "Limited",
  "Good",
  "Extensive",
  "Expected withdrawals",
  "Frequency",
  "Annual income (₦)",
  "Estimated net worth (₦)",
  "Investment restrictions or exclusions (if any)",
];
for (const text of requiredCopy) assert(draft.includes(text), `Investment objective/risk draft is missing: ${text}`);
assert(
  draft.includes('type="radio"')
    && draft.includes("emptyInvestmentObjectiveRiskDraft")
    && draft.includes("not submitted, saved, assessed, or retained")
    && !/(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]|fetch\(|updateMyProfile|console\.(log|info|debug)/i.test(draft),
  "Investment objective/risk data must remain a current-page-only draft with no browser persistence, API write, or logging",
);
assert(
  profile.includes("InvestmentObjectiveRiskProfileDraft")
    && profile.includes("setLocalInvestmentRiskDraft")
    && !profile.includes('title: "Identity Verification"')
    && !profile.includes('title: "Investment Risk Profile"'),
  "The new investment objective/risk section must replace the unavailable Identity Verification and Investment Risk Profile cards in the Individual profile",
);

console.log("PASS — Individual Profile renders the requested local Investment Objective and Risk Profile section without persisting, transmitting, assessing, or verifying investor suitability data");
