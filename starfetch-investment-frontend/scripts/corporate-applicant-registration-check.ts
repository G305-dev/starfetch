import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loginInvestor, registerCorporateApplicant, registerIndividual } from "../lib/api/client";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const requests: Array<{ url: string; init: RequestInit }> = [];
const originalFetch = globalThis.fetch;
const corporateRegistration = { userId: "corporate-user-id", verificationId: "corporate-verification-id", email: "a***@company.example", emailVerified: false, nextAction: "VERIFY_EMAIL" };

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  requests.push({ url, init });
  if (url === "/api/v1/auth/register") return json({ data: requests.length === 1 ? corporateRegistration : { userId: "individual-user-id", verificationId: "individual-verification-id", email: "i***@example.com", emailVerified: false, nextAction: "VERIFY_EMAIL" } }, 201);
  if (url === "/api/v1/auth/login") return json({ data: { accessToken: "corporate-access-token", expiresInSeconds: 900, user: { id: "corporate-user-id", firstName: "", lastName: "", email: "applicant@company.example", emailVerified: true, role: "INVESTOR" } } });
  throw new Error(`Unexpected request: ${url}`);
};

async function run() {
  const corporate = await registerCorporateApplicant({ email: "applicant@company.example", password: "at-least-8-characters" });
  assert(corporate.verificationId === corporateRegistration.verificationId && corporate.nextAction === "VERIFY_EMAIL", "Corporate registration response normalisation failed");
  const corporateRequest = requests[0];
  const corporateBody = JSON.parse(String(corporateRequest.init.body)) as Record<string, unknown>;
  assert(corporateRequest.url === "/api/v1/auth/register" && corporateRequest.init.method === "POST" && corporateRequest.init.credentials === "include", "Corporate registration must use the existing same-origin registration endpoint");
  assert(JSON.stringify(corporateBody) === JSON.stringify({ registrationType: "CORPORATE", email: "applicant@company.example", password: "at-least-8-characters" }), "Corporate registration must send exactly registrationType, email and password — never names or confirmPassword");

  await registerIndividual({ firstName: "Individual", lastName: "Investor", email: "individual@example.com", password: "at-least-8-characters" });
  const individualBody = JSON.parse(String(requests[1].init.body)) as Record<string, unknown>;
  assert(JSON.stringify(individualBody) === JSON.stringify({ firstName: "Individual", lastName: "Investor", email: "individual@example.com", password: "at-least-8-characters" }) && !("registrationType" in individualBody), "Legacy Individual registration must keep its name-required request without registrationType");

  const login = await loginInvestor({ email: "applicant@company.example", password: "at-least-8-characters" });
  assert(login.user?.role === "INVESTOR" && login.user.firstName === "" && login.user.lastName === "", "Profileless Corporate SafeUser must authenticate with intentional blank names and the existing INVESTOR role");
  assert(requests.length === 3 && !requests.some(({ url }) => url === "/api/v1/me/profile"), "Corporate login must not call the Individual profile endpoint as a prerequisite");

  const client = read("lib/api/client.ts");
  const registrationForm = read("components/auth/CorporateApplicantRegistrationForm.tsx");
  const entry = read("components/auth/CorporateRegistrationEntry.tsx");
  const signIn = read("components/auth/SignInForm.tsx");
  const verificationSuccess = read("components/auth/EmailVerificationSuccess.tsx");
  const verification = read("lib/auth/verification-flow.ts");
  const onboarding = read("components/auth/CorporateOnboardingFlow.tsx");
  const corporateLayout = read("app/corporate/layout.tsx");
  assert(registrationForm.includes("registerCorporateApplicant({ email, password })") && client.includes('const body = { registrationType: "CORPORATE" as const, email: input.email, password: input.password }') && registrationForm.includes('router.push("/register/corporate/verify-email")'), "Corporate registration form must use the exact client payload and begin email verification");
  assert(entry.includes("status === \"authenticated\"") && entry.includes("CorporateApplicantRegistrationForm") && entry.includes('router.replace("/corporate/dashboard")') && !entry.includes("CorporateOnboardingFlow"), "Corporate route must register an unauthenticated visitor and redirect an authenticated applicant to the protected dashboard without forcing O2");
  assert(signIn.includes("corporateApplicantLoginType") && signIn.includes("/register/corporate/verify-email") && signIn.includes('const corporateDestination = safeNextPath?.startsWith("/corporate/") ? safeNextPath : "/corporate/dashboard";') && signIn.includes('router.replace(accountType === "corporate" ? corporateDestination : safeNextPath ?? defaultDestination);') && signIn.includes("Log In to Corporate Applicant Dashboard") && !signIn.includes("Use an existing verified Individual or Joint Investor"), "Corporate login routing must use the normal Investor session, preserve protected Corporate routes, normalise the legacy registration path to the dashboard, and not require an existing Individual/Joint account");
  assert(verificationSuccess.includes('"/login?next=%2Fcorporate%2Fdashboard"') && !verificationSuccess.includes('"/login?next=%2Fregister%2Fcorporate"'), "Corporate verification success must return through login to the protected Corporate dashboard");
  assert(verification.includes('registrationType: RegistrationJourney') && verification.includes("Routing/presentation state only") && onboarding.includes("authenticated owner-scoped Corporate application discovery API") && corporateLayout.includes("RequireInvestorAuth"), "Verification routing, returning Corporate discovery, and authenticated Corporate dashboard boundaries are missing");
  assert(!/(?:window\.)?(?:localStorage)\s*[.[]|console\.(log|info|debug)/i.test(registrationForm + entry + signIn + onboarding), "Corporate credentials and application data must not be logged or persisted in local storage");

  globalThis.fetch = originalFetch;
  console.log("PASS — Corporate applicant registration uses the v0.6.1 exact request, profileless INVESTOR login, verified dashboard continuation and protected applicant/dashboard boundaries while Individual registration remains unchanged");
}

void run().catch((error: unknown) => { globalThis.fetch = originalFetch; throw error; });
