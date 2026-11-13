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

for (const text of ["Politically Exposed Person (PEP) Declaration", "within the last 12 months", "Applicant — Yes", "Applicant — No", "If yes, give details (name, position, country, period held)"]) {
  assert(draft.includes(text), `Missing required PEP declaration content: ${text}`);
}
assert(
  draft.includes('type="radio"')
    && draft.includes("emptyPepDeclarationDraft")
    && draft.includes("not submitted, stored, screened, assessed, or retained")
    && !/(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]|fetch\(|updateMyProfile|console\.(log|info|debug)/i.test(draft),
  "PEP declaration must remain a current-page-only draft with no browser persistence, API write, screening, or logging",
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

console.log("PASS — Individual Profile includes the requested local PEP declaration inside Personal Information without persisting, transmitting, screening, assessing, or verifying the declaration");
