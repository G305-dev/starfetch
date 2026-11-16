import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SaveIndividualKycSourceOfFundsInput } from "../lib/api/client";

type _SaveIndividualKycSourceOfFundsInput = SaveIndividualKycSourceOfFundsInput;

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const draft = read("components/portal/SourceOfFundsDraft.tsx");
const profile = read("components/portal/IndividualProfileContent.tsx");
const mapping = read("lib/individual-kyc-mapping.ts");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const text of ["Source of Funds and Wealth", "AML/CFT", "Salary / employment", "Business income", "Sale of assets", "Inheritance / gift", "Savings", "Pension / retirement", "Investment proceeds", "Other (specify)", "If other, specify", "Expected annual inflow (₦)", "Expected transaction frequency"]) {
  assert(draft.includes(text), `Missing Source of Funds field: ${text}`);
}
assert(
  mapping.includes('"Salary / employment": "SALARY_EMPLOYMENT"')
    && mapping.includes('"Other (specify)": "OTHER"')
    && mapping.includes("sourceLabelsToWire"),
  "Source-of-funds labels must map to the supplied canonical values",
);
assert(
  profile.includes("saveIndividualKycSourceOfFunds({")
    && profile.includes("sourceOfFunds,")
    && profile.includes("expectedAnnualInflowMinor")
    && profile.includes("expectedTransactionFrequency:")
    && profile.includes('...(sourceOfFunds.includes("OTHER") ? { otherSource:'),
  "Source of Funds must be saved with mapped IDs, kobo amount, and conditional Other explanation",
);
assert(
  draft.includes("does not trigger AML/CFT screening or verify the information")
    && !draft.includes("current-page-only draft"),
  "Saving source details must not be described as an unsaved draft or imply screening/verification",
);

console.log("PASS — Source of Funds maps canonical selections and kobo amounts to the versioned KYC endpoint without implying AML/CFT screening or verification");
