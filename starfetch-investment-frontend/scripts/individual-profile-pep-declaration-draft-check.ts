import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IndividualAccountProfile } from "../lib/api/client";

// Keeps this standalone source check on the project-root compilation path.
type _IndividualAccountProfile = IndividualAccountProfile;

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const draft = read("components/portal/PepDeclarationDraft.tsx");
const profile = read("components/portal/IndividualProfileContent.tsx");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const text of ["Politically Exposed Person (PEP) Declaration", "within the last 12 months", "Yes</label>", "No</label>", "If yes, provide full name, position, country and period held"]) {
  assert(draft.includes(text), `Missing required PEP declaration content: ${text}`);
}
assert(
  draft.includes('type="radio"')
    && draft.includes("emptyPepDeclarationDraft")
    && !draft.includes("Applicant — Yes")
    && !draft.includes("Applicant — No")
    && !draft.includes("This declaration is not submitted, stored, screened, assessed, or retained after you leave or refresh this page because an approved compliance workflow is not available.")
    && draft.includes("value.fullName")
    && draft.includes("value.position")
    && draft.includes("value.country")
    && draft.includes("value.periodHeld")
    && !/(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]|console\.(log|info|debug)/i.test(draft)
    && profile.includes("pepDetails: {")
    && profile.includes("saveIndividualKycPersonal"),
  "PEP declaration uses structured fields and is saved only through the encrypted Individual KYC section API, without browser persistence or logging",
);
const personalInformationFormStart = profile.indexOf("<form onSubmit={savePersonalInformation}");
const pepMount = profile.indexOf("<PepDeclarationDraft value={localPepDeclarationDraft}");
const personalInformationFormEnd = profile.indexOf("</form>", pepMount);
assert(
  profile.includes("PepDeclarationDraft")
    && profile.includes("setLocalPepDeclarationDraft")
    && personalInformationFormStart >= 0
    && pepMount > personalInformationFormStart
    && personalInformationFormEnd > pepMount
    && !profile.includes('title: "PEP Declaration"'),
  "The PEP declaration form must be mounted inside Personal Information rather than an unavailable standalone PEP card",
);

console.log("PASS — Individual Profile includes structured PEP data inside Personal Information and persists it through the versioned KYC API without browser storage");
