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

for (const text of ["Politically Exposed Person (PEP) Declaration", "within the last 12 months", "Yes</label>", "No</label>", "If yes, give details (name, position, country, period held)"]) {
  assert(draft.includes(text), `Missing required PEP declaration content: ${text}`);
}
assert(
  draft.includes('type="radio"')
    && draft.includes("emptyPepDeclarationDraft")
    && !draft.includes("Applicant — Yes")
    && !draft.includes("Applicant — No")
    && !draft.includes("This declaration is not submitted, stored, screened, assessed, or retained after you leave or refresh this page because an approved compliance workflow is not available.")
    && !/(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]|fetch\(|updateMyProfile|console\.(log|info|debug)/i.test(draft),
  "PEP declaration must use the requested Yes/No labels and remove the requested explanatory text without adding persistence, API writes, screening, or logging",
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

console.log("PASS — Individual Profile includes the local PEP declaration inside Personal Information with the requested Yes/No labels and without the removed explanatory text");
