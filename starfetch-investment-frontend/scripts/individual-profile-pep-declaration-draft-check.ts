import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IndividualKycPepDetails, SaveIndividualKycPersonalInput } from "../lib/api/client";

type _IndividualKycPepDetails = IndividualKycPepDetails;
type _SaveIndividualKycPersonalInput = SaveIndividualKycPersonalInput;

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const draft = read("components/portal/PepDeclarationDraft.tsx");
const profile = read("components/portal/IndividualProfileContent.tsx");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const text of ["Politically Exposed Person (PEP) Declaration", "within the last 12 months", "Yes", "No", "Name", "Position", "Country", "Period held"]) {
  assert(draft.includes(text), `Missing PEP declaration content: ${text}`);
}
assert(
  draft.includes('value="yes"')
    && draft.includes('value="no"')
    && draft.includes('value.applicantPepStatus === "yes"')
    && draft.includes("Saving it does not screen or independently verify the information"),
  "PEP must retain Yes/No and conditionally collect the mapped PEP details without claiming screening",
);
assert(
  profile.includes("saveIndividualKycPersonal({")
    && profile.includes('pepStatus: pep.applicantPepStatus.toUpperCase() as "YES" | "NO"')
    && profile.includes("pepDetails: pep.applicantPepStatus === \"yes\" ? {")
    && profile.includes("fullName: pep.fullName.trim()")
    && profile.includes("periodHeld: pep.periodHeld.trim()"),
  "Personal save must send the canonical PEP status and structured details only when Yes is selected",
);

console.log("PASS — PEP declaration stays within Personal Information and saves Yes/No plus conditional structured details without claiming screening or verification");
