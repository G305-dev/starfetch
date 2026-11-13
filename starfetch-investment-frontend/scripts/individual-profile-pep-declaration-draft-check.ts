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
assert(
  profile.includes("PepDeclarationDraft")
    && profile.includes("setLocalPepDeclarationDraft")
    && !profile.includes('title: "PEP Declaration"'),
  "The PEP declaration form must replace the unavailable PEP Declaration card in Personal Information",
);

console.log("PASS — Individual Profile includes the requested local PEP declaration draft without persisting, transmitting, screening, assessing, or verifying the declaration");
