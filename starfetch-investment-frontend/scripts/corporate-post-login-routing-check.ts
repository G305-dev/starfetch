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
  signIn.includes('safeNextPath?.startsWith("/corporate/") || safeNextPath === "/register/corporate"')
    && signIn.includes('const corporateDestination = safeNextPath?.startsWith("/corporate/") ? safeNextPath : "/corporate/dashboard";')
    && signIn.includes('router.replace(accountType === "corporate" ? corporateDestination : safeNextPath ?? defaultDestination);')
    && !signIn.includes('accountType === "corporate" ? "/register/corporate"'),
  "Corporate sign-in must default to /corporate/dashboard, preserve protected Corporate return routes, and normalise the legacy registration path without a redirect loop",
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
    && workspace.includes('href="/corporate/applications/new"')
    && workspace.includes("Start Corporate application")
    && !/router\.(?:push|replace)\(["'`]\/corporate\/applications\/new/.test(workspace + dashboard),
  "An authenticated applicant with no discovered application must see a truthful empty state with an explicit (never automatic) protected start link",
);

assert(
  dashboard.includes("getCorporateDashboardHeading")
    && dashboard.includes("isCorporateVerified")
    && dashboard.includes("Verified Applicant")
    && !dashboard.includes("Your corporate investment dashboard"),
  "The Corporate dashboard must use the first-timer/time greeting with company name, show Verified Applicant only when approved, and omit the removed subtitle",
);

console.log("PASS — Corporate verified-login, legacy return-path normalisation and authenticated registration entry resolve to the protected dashboard; the empty state offers an explicit protected start link and never forces O2");
