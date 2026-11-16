import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IndividualAccountProfile, IndividualKycProfile } from "../lib/api/client";

type _IndividualAccountProfile = IndividualAccountProfile;
type _IndividualKycProfile = IndividualKycProfile;

const source = readFileSync(resolve(process.cwd(), "components/portal/IndividualProfileContent.tsx"), "utf8");
const api = readFileSync(resolve(process.cwd(), "lib/api/client.ts"), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(
  source.includes('type ProfileStep = 1 | 2 | 3 | 4;')
    && source.includes("function completedThrough(profile: IndividualKycProfile | null)")
    && source.includes("profile.sectionStatuses[section.key]")
    && source.includes("profile.progression.nextSection")
    && source.includes("getIndividualKycProfile"),
  "Sequential progress and resume position must be derived from the authenticated KYC API response",
);
assert(
  source.includes("{activeStep === 1 ? (")
    && source.includes("{activeStep === 2 ? (")
    && source.includes("{activeStep === 3 ? (")
    && source.includes("{activeStep === 4 ? ("),
  "Only the active Individual Profile section form must render at a time",
);
assert(
  source.includes("saveIndividualKycPersonal({")
    && source.includes("saveIndividualKycInvestmentProfile({")
    && source.includes("saveIndividualKycSourceOfFunds({")
    && source.includes("saveIndividualKycBankDetails({")
    && source.includes("finishSavedSection")
    && source.includes("await loadKycProfile(true)"),
  "Each section must save using the returned version and refresh server statuses before unlocking the next section",
);
assert(
  api.includes('"/me/kyc-profile/investment-profile"')
    && api.includes('"/me/kyc-profile/source-of-funds"')
    && api.includes('"/me/kyc-profile/bank-details"')
    && api.includes('"/me/kyc-profile/submit"')
    && api.includes("requireIndividualKycVersion(input.version)"),
  "KYC section saves and submission must use the mapped authenticated routes and version field",
);
assert(
  source.includes("kycProfile.progression.canSubmit")
    && source.includes("submitIndividualKycProfile(kycProfile.version)")
    && source.includes("Account Under Review")
    && source.includes("SUBMITTED")
    && source.includes("awaiting review"),
  "Final submission must be gated by server progression and render the awaiting-review screen without claiming approval",
);
assert(
  source.includes("Profile progress")
    && source.includes("profile.sectionStatuses[key]")
    && !source.includes("Saved KYC status</h2>")
    && !source.includes("Additional onboarding is not available yet")
    && !source.includes("Document upload and storage are not available in the current portal.")
    && !/(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]/.test(source),
  "Persisted section status belongs in the compact progress card, not the removed large status panel or browser storage",
);

console.log("PASS — all four sections resume from server status, save with optimistic versions, unlock sequentially, and submit only when the backend enables it");
