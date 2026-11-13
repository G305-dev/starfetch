import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSafeReturnPath } from "../lib/auth/safe-return-path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const registrationEntry = read("components/auth/CorporateRegistrationEntry.tsx");
const signIn = read("components/auth/SignInForm.tsx");
const verificationSuccess = read("components/auth/EmailVerificationSuccess.tsx");
const workspace = read("components/corporate/CorporateApplicationsWorkspace.tsx");
const dashboard = read("components/corporate/CorporateDashboardContent.tsx");

assert(getSafeReturnPath("/corporate/dashboard") === "/corporate/dashboard", "The protected Corporate dashboard must remain a safe same-origin post-login return path");
assert(getSafeReturnPath("/register/corporate") === "/register/corporate", "The legacy Corporate registration return path must remain safe long enough to be normalised by sign-in");

assert(
  registrationEntry.includes('router.replace("/corporate/dashboard")')
    && registrationEntry.includes('if (status === "authenticated")')
    && !registrationEntry.includes("CorporateOnboardingFlow"),
  "Authenticated /register/corporate visitors must be redirected to the protected dashboard, never rendered into O2",
);

assert(
  signIn.includes('safeNextPath === "/corporate/dashboard" || safeNextPath === "/register/corporate"')
    && signIn.includes('accountType === "corporate" ? "/corporate/dashboard"')
    && signIn.includes('router.replace(corporateApplicantLogin ? "/corporate/dashboard" : safeNextPath ?? defaultDestination)')
    && !signIn.includes('accountType === "corporate" ? "/register/corporate"'),
  "Corporate sign-in must default to /corporate/dashboard and normalise the legacy registration return path without a redirect loop",
);

assert(
  verificationSuccess.includes('"/login?next=%2Fcorporate%2Fdashboard"')
    && !verificationSuccess.includes('"/login?next=%2Fregister%2Fcorporate"')
    && verificationSuccess.includes("protected Corporate applicant dashboard"),
  "Verified Corporate applicants must be sent to login with /corporate/dashboard as their return destination",
);

assert(
  !workspace.includes('href="/register/corporate"')
    && workspace.includes("No Corporate application is available yet")
    && workspace.includes("No company details, TIN or documents are required from this dashboard."),
  "An authenticated applicant with no discovered application must see a truthful pending state and no forced O2 entry",
);

assert(
  dashboard.includes("This protected view is available to a signed-in Corporate applicant without an Individual profile.")
    && dashboard.includes("An approved Corporate investment account, verification evidence and portfolio remain separate backend outcomes."),
  "The Corporate dashboard must distinguish an authenticated applicant from an approved Corporate investment account",
);

console.log("PASS — Corporate verified-login, legacy return-path normalisation, authenticated registration entry, and applicant empty-state routing all resolve to the protected dashboard without entering unavailable O2");
