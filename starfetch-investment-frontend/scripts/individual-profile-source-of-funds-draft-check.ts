import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IndividualAccountProfile } from "../lib/api/client";

// Keeps this standalone source check on the project-root compilation path.
type _IndividualAccountProfile = IndividualAccountProfile;

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const draft = read("components/portal/SourceOfFundsDraft.tsx");
const profile = read("components/portal/IndividualProfileContent.tsx");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const text of ["Source of Funds and Wealth", "AML/CFT", "Salary / employment", "Business income", "Sale of assets", "Inheritance / gift", "Savings", "Pension / retirement", "Investment proceeds", "Other (specify)", "If other, specify", "Expected annual inflow (₦)", "Expected transaction frequency"]) {
  assert(draft.includes(text), `Missing required source-of-funds draft content: ${text}`);
}
assert(
  !draft.includes("Use this current-page draft to review the source of funds for a future approved workflow.")
    && draft.includes('type="checkbox"')
    && draft.includes("emptySourceOfFundsDraft")
    && !/(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]|fetch\(|updateMyProfile|console\.(log|info|debug)/i.test(draft),
  "The requested Source of Funds explanatory copy must be removed while the data remains a current-page-only draft with no browser persistence, API write, AML/CFT screening, or logging",
);
assert(
  profile.includes("SourceOfFundsDraft")
    && profile.includes("setLocalSourceOfFundsDraft")
    && !profile.includes('title: "Employment and Source of Funds"'),
  "The Source of Funds and Wealth form must replace the unavailable Employment and Source of Funds card in Personal Information",
);

console.log("PASS — Individual Profile includes the requested local Source of Funds and Wealth draft without the removed explanatory copy, and without persisting, transmitting, screening, assessing, or verifying AML/CFT information");
