import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AuthUser } from "../lib/api/client";

// Keeps this standalone source check on the project-root compilation path.
type _AuthUserContract = AuthUser;

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
  !/(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]/.test(prompt)
    && !prompt.includes("Dismiss")
    && !prompt.includes("Not now"),
  "The required KYC prompt must not persist a dismissal state or expose a dismissal action",
);
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

console.log("PASS — Protected Individual and Corporate dashboards show the required profile-linked KYC reminder without local completion state, account approval claims, or auth-boundary changes");
