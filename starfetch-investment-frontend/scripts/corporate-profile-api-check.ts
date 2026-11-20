/**
 * Corporate Profile HTTP contract check (synthetic, mocked fetch only).
 *
 * Exercises the real lib/api/client.ts functions against an in-process fetch
 * mock that mirrors the backend contract in
 * starfetch-investment-backend/docs/CORPORATE-PROFILE-API-HANDOFF.md.
 * No network, database, KMS or live backend is used. All values are synthetic.
 */
import {
  clearAccessToken,
  completeCorporateApplicantIdentity,
  getCorporateProfile,
  getCurrentUser,
  getMyCorporateApplications,
  isApiError,
  saveCorporateProfileBankDetails,
  saveCorporateProfileCompanyDetails,
  saveCorporateProfileInvestmentProfile,
  saveCorporateProfileSourceOfFunds,
  setAccessToken,
} from "../lib/api/client";
import { corporateProfileIfMatch, isAmbiguousCorporateWithdrawalAmount } from "../lib/corporate/profile";

const corporateAccountId = "4fb35b06-b380-4ebc-b1e6-0df5c8e0c001";
const applicationId = "fc6aa555-1d05-4d76-a244-188ee647c002";
const timestamp = "2026-10-22T00:00:00.000Z";
const syntheticTin = "TIN-SYNTHETIC-98765";
const syntheticAccountNumber = "0123456789";
const base = `/api/v1/corporate-accounts/${corporateAccountId}/profile`;

type Recorded = { url: string; method: string; headers: Record<string, string>; body: unknown };
type Handler = (request: Recorded) => Response;
const requests: Recorded[] = [];
let handler: Handler = () => { throw new Error("No handler configured"); };

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}
function errorBody(code: string, message: string, requestId: string, extra: Record<string, unknown> = {}) {
  return { error: { code, message, requestId, ...extra } };
}

function view(overrides: { profileVersion?: number; detailsVersion?: number; statuses?: Partial<Record<string, string>>; percentage?: number; nextSection?: string | null; tinMasked?: string | null; accountMasked?: string | null } = {}) {
  const statuses = { companyDetails: "NOT_STARTED", investmentProfile: "NOT_STARTED", sourceOfFunds: "NOT_STARTED", bankDetails: "NOT_STARTED", ...overrides.statuses };
  return {
    corporateAccountId,
    applicationId,
    applicant: { companyName: "Synthetic Holdings Ltd", companyPhoneNumber: "+2348000000000", email: "applicant@example.test" },
    canonicalDetails: { institutionName: "Synthetic Holdings Ltd", dateOfIncorporation: "2020-01-02", rcNumber: "RC-SYN-001", businessPhoneNumber: "+2348000000001", businessEmail: "ops@example.test", taxIdentificationNumberMasked: overrides.tinMasked === undefined ? null : overrides.tinMasked },
    companyDetails: { registeredAddress: null, city: null, state: null },
    investmentProfile: { primaryObjective: null, riskTolerance: null, investmentHorizon: null, expectedWithdrawals: null, withdrawalFrequency: null, restrictionsOrExclusions: null },
    sourceOfFunds: { selectedSources: [], otherSource: null, expectedAnnualInflow: null, expectedTransactionFrequency: null },
    bankDetails: { bankName: null, accountNumberMasked: overrides.accountMasked === undefined ? null : overrides.accountMasked, accountName: null, accountType: null, bvnLinkedToAccount: null },
    profileVersion: overrides.profileVersion ?? 0,
    detailsVersion: overrides.detailsVersion ?? 1,
    sectionStatuses: statuses,
    progress: { percentage: overrides.percentage ?? 0, nextSection: overrides.nextSection === undefined ? "companyDetails" : overrides.nextSection, canSubmit: false, meaning: "SAVED_FORM_COMPLETION_ONLY" },
    updatedAt: overrides.profileVersion ? timestamp : null,
  };
}
const envelope = (data: unknown, requestId = "req-synthetic-0001") => ({ data, meta: { requestId } });

const storageWrites: string[] = [];
const storageSpy = { setItem: (key: string) => { storageWrites.push(key); }, getItem: () => null, removeItem: () => undefined, clear: () => undefined, key: () => null, length: 0 };
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storageSpy });
Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storageSpy });
Object.defineProperty(globalThis, "document", { configurable: true, value: { cookie: "__Host-sf_csrf=csrf-synthetic-token" } });

const logged: string[] = [];
for (const level of ["log", "info", "warn", "error", "debug"] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => { logged.push(args.map(String).join(" ")); if (level === "log") original(...args); };
}

globalThis.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const headers = { ...(init.headers as Record<string, string> | undefined) };
  const recorded: Recorded = { url: String(input), method: init.method ?? "GET", headers, body: typeof init.body === "string" ? JSON.parse(init.body) : undefined };
  assert(init.credentials === "include" && init.cache === "no-store", `Transport settings changed for ${recorded.url}`);
  requests.push(recorded);
  return handler(recorded);
};

async function expectApiError(promise: Promise<unknown>, check: (error: { code: string; status?: number; serverCode?: string; requestId?: string; fieldNames?: string[]; retryAfterSeconds?: number; message: string }) => void, label: string) {
  try {
    await promise;
  } catch (error) {
    assert(isApiError(error), `${label}: expected ApiError`);
    check(error);
    return;
  }
  throw new Error(`${label}: expected the call to fail, but it reported success`);
}

async function run() {
  setAccessToken("in-memory-access-token");

  // 1. If-Match builder: exact quoted formats.
  assert(corporateProfileIfMatch(0) === '"profile-0"', "Section If-Match format must be \"profile-N\"");
  assert(corporateProfileIfMatch(3, 7) === '"profile-3;details-7"', "Company Details If-Match must be \"profile-N;details-M\"");
  assert(!isAmbiguousCorporateWithdrawalAmount("₦500,000") && !isAmbiguousCorporateWithdrawalAmount("No withdrawals planned") && isAmbiguousCorporateWithdrawalAmount("about 5m"), "Withdrawal ambiguity mirror must match the backend rule");

  // 2. Discovery -> profile GET, with owner-scoped account ID and auth headers.
  handler = (request) => {
    if (request.url === "/api/v1/me/corporate-accounts") return json(envelope([{ corporateAccountId, applicationId, status: "DRAFT", detailsVersion: 1, createdAt: timestamp, updatedAt: timestamp, accessVia: "INITIATING_APPLICANT" }]));
    if (request.url === base && request.method === "GET") return json(envelope(view()));
    throw new Error(`Unexpected request ${request.method} ${request.url}`);
  };
  const accounts = await getMyCorporateApplications();
  assert(accounts.length === 1 && accounts[0].corporateAccountId === corporateAccountId, "Discovery must return the owner-scoped account");
  const loaded = await getCorporateProfile(accounts[0].corporateAccountId);
  const getRequest = requests.at(-1)!;
  assert(getRequest.url === base && getRequest.method === "GET" && getRequest.headers.Authorization === "Bearer in-memory-access-token", "Profile GET must use the same-origin /api/v1 path with the in-memory bearer token");
  assert(!("X-CSRF-Token" in getRequest.headers) && !("If-Match" in getRequest.headers), "Profile GET must not send mutation headers");
  assert(loaded.profileVersion === 0 && loaded.detailsVersion === 1 && loaded.sectionStatuses.companyDetails === "NOT_STARTED" && loaded.progress.percentage === 0 && loaded.progress.meaning === "SAVED_FORM_COMPLETION_ONLY", "Profile GET must expose versions, statuses and saved-form progress");

  // 3. Company Details PATCH: If-Match with both versions, CSRF, exact body, blank TIN omitted.
  handler = (request) => json(envelope(view({ profileVersion: 1, detailsVersion: 2, statuses: { companyDetails: "COMPLETE" }, percentage: 25, nextSection: "investmentProfile", tinMasked: "•••••••••••••8765" })));
  const companyInput = { rcNumber: "RC-SYN-001", dateOfIncorporation: "2020-01-02", registeredAddress: "1 Synthetic Way", city: "Ikeja", state: "Lagos" };
  const afterCompany = await saveCorporateProfileCompanyDetails(corporateAccountId, { profileVersion: 0, detailsVersion: 1 }, { ...companyInput, taxIdentificationNumber: "   " });
  let patch = requests.at(-1)!;
  assert(patch.url === `${base}/company-details` && patch.method === "PATCH", "Company Details must PATCH /profile/company-details");
  assert(patch.headers["If-Match"] === '"profile-0;details-1"', "Company Details must send If-Match \"profile-N;details-M\"");
  assert(patch.headers["X-CSRF-Token"] === "csrf-synthetic-token" && patch.headers.Authorization === "Bearer in-memory-access-token" && patch.headers["Content-Type"] === "application/json", "Profile PATCH must send CSRF, bearer and JSON headers");
  assert(JSON.stringify(Object.keys(patch.body as object).sort()) === JSON.stringify(Object.keys(companyInput).sort()), "A blank TIN must be omitted so the backend retains the stored TIN");
  assert(afterCompany.canonicalDetails.taxIdentificationNumberMasked === "•••••••••••••8765" && afterCompany.profileVersion === 1 && afterCompany.detailsVersion === 2, "PATCH response must be normalised as the refreshed persisted view");

  await saveCorporateProfileCompanyDetails(corporateAccountId, { profileVersion: 1, detailsVersion: 2 }, { ...companyInput, taxIdentificationNumber: ` ${syntheticTin} ` });
  patch = requests.at(-1)!;
  assert((patch.body as Record<string, unknown>).taxIdentificationNumber === syntheticTin && patch.headers["If-Match"] === '"profile-1;details-2"', "An entered TIN must be sent trimmed with the latest versions");

  // 4. Investment Profile / Source of Funds / Bank Details: If-Match "profile-N", no extra fields.
  handler = () => json(envelope(view({ profileVersion: 2, statuses: { companyDetails: "COMPLETE", investmentProfile: "COMPLETE" }, percentage: 50, nextSection: "sourceOfFunds" })));
  await saveCorporateProfileInvestmentProfile(corporateAccountId, 1, { primaryObjective: "Income", riskTolerance: "Moderate", investmentHorizon: "1–3 years", expectedWithdrawals: "No withdrawals planned", withdrawalFrequency: "Annually", restrictionsOrExclusions: "" });
  patch = requests.at(-1)!;
  assert(patch.url === `${base}/investment-profile` && patch.headers["If-Match"] === '"profile-1"', "Investment Profile must PATCH with If-Match \"profile-N\"");
  assert(!("restrictionsOrExclusions" in (patch.body as object)), "An empty optional restrictions value must not be sent");

  handler = () => json(envelope(view({ profileVersion: 3, statuses: { companyDetails: "COMPLETE", investmentProfile: "COMPLETE", sourceOfFunds: "COMPLETE" }, percentage: 75, nextSection: "bankDetails" })));
  await saveCorporateProfileSourceOfFunds(corporateAccountId, 2, { selectedSources: ["Sale of assets"], otherSource: "stale text", expectedAnnualInflow: "1000000.50", expectedTransactionFrequency: "Quarterly" });
  patch = requests.at(-1)!;
  assert(patch.url === `${base}/source-of-funds` && patch.headers["If-Match"] === '"profile-2"', "Source of Funds must PATCH with If-Match \"profile-N\"");
  assert(!("otherSource" in (patch.body as object)), "otherSource must only be sent with “Other (specify)”");

  handler = () => json(envelope(view({ profileVersion: 4, statuses: { companyDetails: "COMPLETE", investmentProfile: "COMPLETE", sourceOfFunds: "COMPLETE", bankDetails: "COMPLETE" }, percentage: 100, nextSection: null, accountMasked: "••••••6789" })));
  const afterBank = await saveCorporateProfileBankDetails(corporateAccountId, 3, { bankName: "Synthetic Bank", accountNumber: syntheticAccountNumber, accountName: "Synthetic Holdings Ltd", accountType: "Current", bvnLinkedToAccount: true });
  patch = requests.at(-1)!;
  assert(patch.url === `${base}/bank-details` && patch.headers["If-Match"] === '"profile-3"', "Bank Details must PATCH with If-Match \"profile-N\"");
  assert(JSON.stringify(Object.keys(patch.body as object).sort()) === JSON.stringify(["accountName", "accountNumber", "accountType", "bankName", "bvnLinkedToAccount"]), "Bank Details body must contain only DTO fields");
  assert(afterBank.bankDetails.accountNumberMasked === "••••••6789" && afterBank.progress.percentage === 100 && afterBank.progress.canSubmit === false, "Bank response must expose only the masked account number and saved-form progress");

  // 5. The normaliser never surfaces plaintext sensitive values, even if a response contained them.
  handler = () => {
    const leaky = view({ tinMasked: "••••" }) as Record<string, any>;
    leaky.canonicalDetails.taxIdentificationNumber = syntheticTin;
    leaky.bankDetails.accountNumber = syntheticAccountNumber;
    return json(envelope(leaky));
  };
  const scrubbed = await getCorporateProfile(corporateAccountId);
  const serialised = JSON.stringify(scrubbed);
  assert(!serialised.includes(syntheticTin) && !serialised.includes(syntheticAccountNumber), "Plaintext TIN/account number must never pass through the profile normaliser");

  // 6. Malformed responses fail closed.
  handler = () => json(envelope({ ...view(), progress: { percentage: 50, nextSection: null, canSubmit: true, meaning: "SAVED_FORM_COMPLETION_ONLY" } }));
  await expectApiError(getCorporateProfile(corporateAccountId), (error) => assert(error.code === "UNEXPECTED_RESPONSE", "canSubmit:true must be rejected"), "malformed progress");
  handler = () => json(envelope({ ...view(), sectionStatuses: { companyDetails: "APPROVED", investmentProfile: "DRAFT", sourceOfFunds: "DRAFT", bankDetails: "DRAFT" } }));
  await expectApiError(getCorporateProfile(corporateAccountId), (error) => assert(error.code === "UNEXPECTED_RESPONSE", "Unknown section status must be rejected"), "malformed statuses");

  // 7. Error mapping keeps status, backend code and requestId; KMS/API failures never report success.
  const cases: Array<{ status: number; code: string; expectCode: string; headers?: Record<string, string>; extra?: Record<string, unknown> }> = [
    { status: 409, code: "CONFLICT", expectCode: "CONFLICT" },
    { status: 403, code: "CSRF_VALIDATION_FAILED", expectCode: "FORBIDDEN" },
    { status: 403, code: "FORBIDDEN", expectCode: "FORBIDDEN" },
    { status: 403, code: "EMAIL_NOT_VERIFIED", expectCode: "EMAIL_NOT_VERIFIED" },
    { status: 404, code: "NOT_FOUND", expectCode: "NOT_FOUND" },
    { status: 429, code: "RATE_LIMITED", expectCode: "RATE_LIMITED", headers: { "Retry-After": "120" } },
    { status: 503, code: "SERVICE_UNAVAILABLE", expectCode: "SERVICE_UNAVAILABLE" },
    { status: 400, code: "VALIDATION_FAILED", expectCode: "VALIDATION_FAILED", extra: { fields: { accountNumber: ["Account number must be 10 digits."] } } },
    { status: 500, code: "INTERNAL_ERROR", expectCode: "UNEXPECTED_RESPONSE" },
  ];
  for (const testCase of cases) {
    const requestId = `req-${testCase.code.toLowerCase().replace(/_/g, "-")}-01`;
    handler = () => json(errorBody(testCase.code, "Backend message that must not be echoed verbatim.", requestId, testCase.extra), testCase.status, testCase.headers);
    await expectApiError(saveCorporateProfileBankDetails(corporateAccountId, 3, { bankName: "Synthetic Bank", accountNumber: syntheticAccountNumber, accountName: "Synthetic", accountType: "Current", bvnLinkedToAccount: false }), (error) => {
      assert(error.code === testCase.expectCode, `${testCase.status} ${testCase.code} must map to ${testCase.expectCode}, got ${error.code}`);
      assert(error.status === testCase.status && error.serverCode === testCase.code && error.requestId === requestId, `${testCase.code} must keep status, backend code and requestId for support`);
      assert(!error.message.includes("Backend message"), "Backend error messages must not be surfaced verbatim");
      if (testCase.code === "RATE_LIMITED") assert(error.retryAfterSeconds === 120, "429 must expose Retry-After");
      if (testCase.code === "VALIDATION_FAILED") assert(error.fieldNames?.join() === "accountNumber", "400 must expose only rejected field names");
    }, `${testCase.status} ${testCase.code}`);
  }

  // 8. Discovery 403 keeps the request ID for David's triage.
  handler = () => json(errorBody("FORBIDDEN", "Corporate applications are not available for this account.", "req-discovery-forbidden-01"), 403);
  await expectApiError(getMyCorporateApplications(), (error) => assert(error.code === "FORBIDDEN" && error.requestId === "req-discovery-forbidden-01" && error.message === "You do not have permission to perform this action.", "Discovery 403 must keep the safe message and request ID"), "discovery 403");

  // 9. Request ID falls back to the x-request-id header; unsafe IDs are dropped.
  handler = () => json({ error: { code: "NOT_FOUND", message: "x" } }, 404, { "x-request-id": "hdr-request-id-0001" });
  await expectApiError(getCorporateProfile(corporateAccountId), (error) => assert(error.requestId === "hdr-request-id-0001", "x-request-id header fallback failed"), "header request id");
  handler = () => json({ error: { code: "NOT_FOUND", message: "x", requestId: "<script>bad</script>" } }, 404);
  await expectApiError(getCorporateProfile(corporateAccountId), (error) => assert(error.requestId === undefined, "Unsafe request IDs must be dropped"), "unsafe request id");

  // 10. 401 -> one shared refresh -> retry PATCH with fresh token, CSRF and same If-Match.
  let calls = 0;
  handler = (request) => {
    calls += 1;
    if (request.url === "/api/v1/auth/refresh") {
      Object.defineProperty(globalThis, "document", { configurable: true, value: { cookie: "__Host-sf_csrf=csrf-rotated-token" } });
      return json(envelope({ accessToken: "rotated-access-token" }));
    }
    if (request.headers.Authorization === "Bearer in-memory-access-token") return json(errorBody("UNAUTHENTICATED", "Authentication required.", "req-unauth-0001"), 401);
    return json(envelope(view({ profileVersion: 2, statuses: { companyDetails: "COMPLETE", investmentProfile: "COMPLETE" }, percentage: 50, nextSection: "sourceOfFunds" })));
  };
  await saveCorporateProfileInvestmentProfile(corporateAccountId, 1, { primaryObjective: "Growth", riskTolerance: "Aggressive", investmentHorizon: "5 years +", expectedWithdrawals: "₦500,000", withdrawalFrequency: "Monthly" });
  const retried = requests.at(-1)!;
  assert(calls === 3 && retried.headers.Authorization === "Bearer rotated-access-token" && retried.headers["X-CSRF-Token"] === "csrf-rotated-token" && retried.headers["If-Match"] === '"profile-1"', "401 must refresh once and retry with the rotated token, rotated CSRF and unchanged If-Match");

  // 11. Legacy identity completion PATCH.
  handler = () => json(envelope({ companyName: "Synthetic Holdings Ltd", companyPhoneNumber: "+2348000000000" }));
  const identity = await completeCorporateApplicantIdentity({ companyName: "Synthetic Holdings Ltd", companyPhoneNumber: "+2348000000000" });
  patch = requests.at(-1)!;
  assert(patch.url === "/api/v1/me/corporate-applicant-profile" && patch.method === "PATCH" && patch.headers["X-CSRF-Token"] === "csrf-rotated-token" && !("If-Match" in patch.headers), "Legacy identity must PATCH /me/corporate-applicant-profile with CSRF");
  assert(identity.companyName === "Synthetic Holdings Ltd", "Legacy identity response must be normalised");

  // 12. /me classification is read-only metadata.
  handler = () => json(envelope({ id: "user-synthetic-1", firstName: "", lastName: "", email: "applicant@example.test", emailVerified: true, role: "INVESTOR", primaryAccountType: null, authorizedContexts: ["INDIVIDUAL", "BOGUS"], jointMembershipCount: 0 }));
  const me = await getCurrentUser();
  assert(me.primaryAccountType === null && me.authorizedContexts?.join() === "INDIVIDUAL", "/me classification must be normalised strictly (null kept, unknown contexts dropped)");

  // 13. No storage writes and no sensitive values in console output.
  assert(storageWrites.length === 0, "Corporate Profile API calls must never write browser storage");
  assert(!logged.some((line) => line.includes(syntheticTin) || line.includes(syntheticAccountNumber)), "Sensitive values must never be logged");

  clearAccessToken();
  console.log("PASS — Corporate Profile client: discovery→GET, four section PATCHes with exact If-Match/CSRF/bodies, blank-TIN retention, masked-only projections, fail-closed normaliser, 401 refresh-retry, 403/404/409/429/503 mapping with requestId, legacy identity PATCH (mocked fetch only)");
}

void run().catch((error) => {
  // console.* is captured above, so report failures directly on stderr.
  process.stderr.write(`FAIL — ${error instanceof Error ? error.message : "Corporate Profile API check failed"}\n`);
  process.exit(1);
});
