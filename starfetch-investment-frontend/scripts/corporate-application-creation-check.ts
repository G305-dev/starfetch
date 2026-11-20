/**
 * Corporate application creation link check.
 *
 * Behavioural part (mocked fetch only, synthetic data): O2 creation through the
 * existing client keeps bearer auth, CSRF and the Idempotency-Key, returns only
 * the server-issued receipt on 201, and never yields a receipt for 400/409/429/
 * 500/503. The memory-only handoff is user-bound.
 *
 * Static part: the protected route exists and reuses CorporateOnboardingFlow,
 * both empty states link to it explicitly, success navigates to the Corporate
 * Profile, and the Profile only uses the created ID when discovery returns it.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ApiError, createCorporateApplication, setAccessToken } from "../lib/api/client";
import { clearCreatedCorporateAccount, getCreatedCorporateAccountId, rememberCreatedCorporateAccount } from "../lib/corporate/application-handoff";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

const input = {
  institutionName: "Synthetic O2 Test Holdings Ltd",
  dateOfIncorporation: "2020-01-02",
  rcNumber: "RC-SYNTHETIC-O2-001",
  taxIdentificationNumber: "SYNTHETIC-TIN-NOT-A-REAL-CUSTOMER",
  businessPhoneNumber: "+2348000000000",
  businessEmail: "synthetic-o2@example.invalid",
};
const corporateAccountId = "7c1d6a52-0000-4000-8000-00000000c001";
const applicationId = "7c1d6a52-0000-4000-8000-00000000a001";

type Scenario = { status: number; body: unknown; headers?: Record<string, string> };
let scenario: Scenario = { status: 201, body: {} };
const requests: Array<{ url: string; init: RequestInit }> = [];
const json = (s: Scenario) => new Response(JSON.stringify(s.body), { status: s.status, headers: { "Content-Type": "application/json", ...s.headers } });
const errorBody = (code: string, message: string, requestId = "req-synthetic-0001") => ({ error: { code, message, requestId } });

Object.defineProperty(globalThis, "document", { configurable: true, value: { cookie: "sf_csrf=synthetic-csrf-token" } });
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  requests.push({ url: String(url), init });
  if (String(url) !== "/api/v1/corporate-accounts/applications") throw new Error(`Unexpected request: ${String(url)}`);
  return json(scenario);
};

async function expectFailure(next: Scenario, expectedCode: string, label: string) {
  scenario = next;
  requests.length = 0;
  let receipt: unknown = null;
  let caught: unknown = null;
  try { receipt = await createCorporateApplication(input, "synthetic-o2-key-0001"); } catch (error) { caught = error; }
  assert(receipt === null, `${label}: a receipt must never be produced`);
  assert(caught instanceof ApiError && caught.code === expectedCode, `${label}: expected ApiError ${expectedCode}, got ${caught instanceof ApiError ? caught.code : String(caught)}`);
  if (next.status >= 400) assert(caught.status === next.status, `${label}: HTTP status must be preserved for the support reference`);
  assert(requests.length === 1, `${label}: O2 must not be retried automatically by the client`);
  return caught;
}

async function run() {
  setAccessToken("synthetic-in-memory-access-token");

  // 201 — the only success path; receipt is server-issued.
  scenario = { status: 201, body: { data: { corporateAccountId, applicationId, applicationStatus: "DRAFT", detailsVersion: 1 }, meta: { requestId: "req-synthetic-201" } } };
  const receipt = await createCorporateApplication(input, "synthetic-o2-key-0001");
  assert(receipt.corporateAccountId === corporateAccountId && receipt.applicationId === applicationId && receipt.applicationStatus === "DRAFT" && receipt.detailsVersion === 1, "201 must return the server-issued receipt");
  const headers = requests[0].init.headers as Record<string, string>;
  assert(requests[0].init.method === "POST" && requests[0].init.credentials === "include", "O2 must POST with credentials");
  assert(headers.Authorization === "Bearer synthetic-in-memory-access-token" && headers["X-CSRF-Token"] === "synthetic-csrf-token" && headers["Idempotency-Key"] === "synthetic-o2-key-0001", "O2 must keep bearer auth, CSRF and the Idempotency-Key");
  assert(JSON.stringify(JSON.parse(String(requests[0].init.body))) === JSON.stringify(input), "O2 body must contain exactly the six DTO fields");

  // A malformed 201 is not success.
  await expectFailure({ status: 201, body: { data: { corporateAccountId, applicationId, applicationStatus: "SUBMITTED", detailsVersion: 1 } } }, "UNEXPECTED_RESPONSE", "malformed 201");

  // 503 gate closed / keyring unavailable — never success.
  const gate = await expectFailure({ status: 503, body: errorBody("FEATURE_UNAVAILABLE", "Corporate registration is currently unavailable.") }, "FEATURE_UNAVAILABLE", "503 FEATURE_UNAVAILABLE");
  assert(gate.serverCode === "FEATURE_UNAVAILABLE" && gate.requestId === "req-synthetic-0001", "503 must keep the backend code and request ID for the support reference");
  await expectFailure({ status: 503, body: errorBody("SERVICE_UNAVAILABLE", "Corporate registration is temporarily unavailable.") }, "SERVICE_UNAVAILABLE", "503 SERVICE_UNAVAILABLE");
  await expectFailure({ status: 409, body: errorBody("CONFLICT", "The request conflicts with an existing draft creation.") }, "CONFLICT", "409 CONFLICT");
  const limited = await expectFailure({ status: 429, body: errorBody("RATE_LIMITED", "Too many requests."), headers: { "Retry-After": "120" } }, "RATE_LIMITED", "429 RATE_LIMITED");
  assert(limited.retryAfterSeconds === 120, "429 must expose Retry-After");
  await expectFailure({ status: 400, body: errorBody("VALIDATION_FAILED", "A valid Idempotency-Key is required.") }, "VALIDATION_FAILED", "400 VALIDATION_FAILED");
  await expectFailure({ status: 500, body: errorBody("INTERNAL_ERROR", "Corporate registration could not be completed.") }, "UNEXPECTED_RESPONSE", "500 INTERNAL_ERROR");
  await expectFailure({ status: 403, body: errorBody("CSRF_VALIDATION_FAILED", "Forbidden.") }, "FORBIDDEN", "403 CSRF");

  // Handoff: memory-only and bound to the creating user.
  rememberCreatedCorporateAccount("user-a", corporateAccountId);
  assert(getCreatedCorporateAccountId("user-a") === corporateAccountId, "The creating user must receive the server-issued ID");
  assert(getCreatedCorporateAccountId("user-b") === null && getCreatedCorporateAccountId("user-a") === null, "Another user must never receive the ID, and the hint must be discarded");
  clearCreatedCorporateAccount();
  const handoff = read("lib/corporate/application-handoff.ts");
  assert(!/localStorage|sessionStorage|document\.cookie|searchParams|URLSearchParams/.test(handoff.replace(/\/\*\*[\s\S]*?\*\//g, "")), "The handoff must stay in memory only");

  // Static wiring.
  const pagePath = "app/corporate/applications/new/page.tsx";
  assert(existsSync(resolve(root, pagePath)), "The protected creation route must exist under app/corporate");
  const page = read(pagePath);
  const layout = read("app/corporate/layout.tsx");
  assert(layout.includes("RequireInvestorAuth"), "All /corporate routes, including creation, must stay behind RequireInvestorAuth");
  assert(page.includes("CorporatePortalLayout") && page.includes("CorporateApplicationStart"), "The creation page must use Emmanuel's Corporate portal layout");

  const start = read("components/corporate/CorporateApplicationStart.tsx");
  assert(start.includes("<CorporateOnboardingFlow />") && start.includes("getMyCorporateApplications()"), "The start page must reuse CorporateOnboardingFlow after owner-scoped discovery");
  assert(start.includes('setState(accounts.length ? "existing" : "empty")') && start.includes('href="/corporate/profile"'), "An applicant who already has an application must be sent to the profile, not into a second O2");

  const flow = read("components/auth/CorporateOnboardingFlow.tsx");
  assert(flow.includes("createCorporateApplication(toCorporateDraftInput(data), requestKey)"), "The flow must keep using the existing client");
  assert(flow.includes("rememberCreatedCorporateAccount(ownerId, created.corporateAccountId)") && flow.includes('router.push("/corporate/profile")'), "Success must hand off the server-issued ID and navigate to the Corporate Profile");
  const successIndex = flow.indexOf('router.push("/corporate/profile")');
  const catchIndex = flow.indexOf("} catch (error) {", flow.indexOf("const created = await createCorporateApplication"));
  assert(successIndex > 0 && catchIndex > successIndex, "Navigation to the Profile must happen only in the success path, never in the error path");
  assert(flow.includes("currently unavailable because the server activation gate is closed. No application was created.") && flow.includes("temporarily unavailable. No application was created"), "503 messages must stay accurate and state that no application was created");
  assert(flow.includes("Reference: ") && flow.includes("error.requestId"), "Errors must show a safe support reference");
  assert(flow.includes('href="/corporate/dashboard"') && !flow.includes('href="/open-account"'), "Cancel must return to the Corporate dashboard");
  const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert(!/localStorage|sessionStorage|console\.(log|info|debug)/.test(stripComments(flow + start + handoff)), "No application data may be logged or persisted");

  const workspace = read("components/corporate/CorporateApplicationsWorkspace.tsx");
  const profile = read("components/corporate/CorporateProfileContent.tsx");
  for (const [name, source] of [["dashboard workspace", workspace], ["Corporate Profile", profile]] as const) {
    assert(source.includes('href="/corporate/applications/new"') && source.includes("Start Corporate application"), `The ${name} empty state must offer a clear start link`);
  }
  assert(!workspace.includes("Corporate onboarding is currently unavailable."), "The dashboard must not claim onboarding is unavailable; the backend decides");
  assert(profile.includes("getCreatedCorporateAccountId(ownerId)") && profile.includes("accounts.find((item) => item.corporateAccountId === createdAccountId)"), "The Profile must use the created ID only when owner-scoped discovery returns it");

  globalThis.fetch = originalFetch;
  console.log("PASS — Corporate application creation: protected route reuses the O2 flow, empty states link to it, 201 hands the server-issued ID to the Profile, and 400/403/409/429/500/503 never produce success");
}

void run().catch((error: unknown) => {
  globalThis.fetch = originalFetch;
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
