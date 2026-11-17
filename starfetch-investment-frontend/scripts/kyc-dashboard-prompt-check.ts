import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AuthUser, IndividualKycWorkflowStatus } from "../lib/api/client";
import { shouldShowIndividualKycPrompt } from "../lib/kyc-completion-prompt";

// Keeps this standalone source check on the project-root compilation path.
type _AuthUserContract = AuthUser;
type _KycStatusContract = IndividualKycWorkflowStatus;

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const prompt = read("components/auth/KycCompletionPrompt.tsx");
const individualDashboard = read("app/dashboard/page.tsx");
const corporateDashboard = read("app/corporate/dashboard/page.tsx");
const authGate = read("components/auth/RequireIndividualAuth.tsx");

assert(
  prompt.includes('role="dialog"')
    && prompt.includes('aria-modal="true"')
    && prompt.includes("Complete your KYC")
    && prompt.includes('href={profileHref}')
    && prompt.includes('const profileHref = isCorporate ? "/corporate/profile" : "/profile";'),
  "The KYC prompt must be an accessible modal with the approved individual and Corporate profile destinations",
);
assert(
  prompt.includes("getIndividualKycProfile()")
    && prompt.includes("shouldShowIndividualKycPrompt(profile.status)")
    && prompt.includes('setPromptState("hide")')
    && prompt.includes("Maybe later")
    && prompt.includes("setIsDismissed(true)")
    && !prompt.includes("localStorage")
    && !prompt.includes("sessionStorage"),
  "Individual prompt visibility must be backend-status-driven; dismissal stays component-local and is not persisted",
);
assert(
  shouldShowIndividualKycPrompt("DRAFT"),
  "A draft Individual KYC profile must still receive the completion reminder",
);
for (const status of ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUIRED", "INFO_REQUESTED", "APPROVED", "COMPLETE", "REJECTED"] as const) {
  assert(!shouldShowIndividualKycPrompt(status), `A ${status} Individual KYC profile must not receive the completion reminder`);
}
assert(
  prompt.includes("Completion status is determined only by Starfetch")
    && prompt.includes("approved backend process"),
  "The KYC prompt must not claim local completion, verification, or approval",
);
assert(
  individualDashboard.includes('KycCompletionPrompt accountType="individual"')
    && corporateDashboard.includes('KycCompletionPrompt accountType="corporate"')
    && authGate.includes("RequireInvestorAuth"),
  "KYC reminders must render only inside the existing protected Individual and Corporate dashboard boundaries",
);

console.log("PASS — Individual KYC reminder appears only for backend DRAFT status and stays hidden after backend submission; Corporate routing and temporary dismissal are preserved");
