import {
  ApiError,
  clearAccessToken,
  createCorporateApplication,
  getCorporateOnboarding,
  getCorporateOnboardingHistory,
  getCorporateSnapshotFreshness,
  getMyCorporateApplications,
  setAccessToken,
  updateCorporateDraft,
} from "../lib/api/client";

const expectedInput = {
  institutionName: "Example Holdings Ltd",
  dateOfIncorporation: "2020-01-02",
  rcNumber: "RC-EXAMPLE-001",
  taxIdentificationNumber: "TIN-PRIVATE-0001",
  businessPhoneNumber: "+2348000000000",
  businessEmail: "accounts@example.test",
};
const corporateAccountId = "4fb35b06-b380-4ebc-b1e6-0df5c8e0c001";
const secondCorporateAccountId = "4fb35b06-b380-4ebc-b1e6-0df5c8e0c004";
const applicationId = "fc6aa555-1d05-4d76-a244-188ee647c002";
const timestamp = "2026-10-22T00:00:00.000Z";
const requests: Array<{ url: string; init: RequestInit }> = [];

function response(body: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function details(version = 1) {
  return { institutionName: expectedInput.institutionName, dateOfIncorporation: expectedInput.dateOfIncorporation, rcNumber: expectedInput.rcNumber, businessPhoneNumber: expectedInput.businessPhoneNumber, businessEmail: expectedInput.businessEmail, taxIdentificationNumberMasked: null, version, createdAt: timestamp, updatedAt: timestamp };
}
function onboarding(version = 1) { return { corporateAccountId, applicationId, status: "DRAFT", createdAt: timestamp, updatedAt: timestamp, details: details(version) }; }

Object.defineProperty(globalThis, "document", { configurable: true, value: { cookie: "sf_csrf=csrf-token" } });
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  requests.push({ url, init });
  if (url === "/api/v1/corporate-accounts/applications") return response({ data: { corporateAccountId, applicationId, applicationStatus: "DRAFT", detailsVersion: 1 }, meta: { requestId: "request-1" } }, 201);
  if (url === "/api/v1/me/corporate-accounts") return response({ data: [
    { corporateAccountId, applicationId, status: "DRAFT", detailsVersion: 1, createdAt: timestamp, updatedAt: timestamp, accessVia: "INITIATING_APPLICANT" },
    { corporateAccountId: secondCorporateAccountId, applicationId: "fc6aa555-1d05-4d76-a244-188ee647c005", status: "INFO_REQUESTED", detailsVersion: 3, createdAt: timestamp, updatedAt: timestamp, accessVia: "INITIATING_APPLICANT" },
  ], meta: { requestId: "request-discovery" } });
  if (url === `/api/v1/corporate-accounts/${corporateAccountId}/onboarding`) return response({ data: onboarding(), meta: { requestId: "request-o3" } });
  if (url === `/api/v1/corporate-accounts/${corporateAccountId}/onboarding/draft`) return response({ data: { corporateAccountId, applicationId, status: "DRAFT", details: details(2) }, meta: { requestId: "request-o4" } });
  if (url === `/api/v1/corporate-accounts/${corporateAccountId}/onboarding/history`) return response({ data: { corporateAccountId, applicationId, history: [{ id: "4501e77b-6228-45a0-8f3f-d3bd2dc1c003", event: "CREATED", fromStatus: null, toStatus: "DRAFT", createdAt: timestamp }], detailsAmendments: [{ version: 2, changedFieldNames: ["institutionName", "businessEmail"], changedAt: timestamp }] }, meta: { requestId: "request-o11" } });
  if (url === `/api/v1/corporate-accounts/${corporateAccountId}/onboarding/verification-snapshot/freshness`) return response({ data: { applicationId, snapshotId: null, generation: null, isFresh: false, issues: ["SNAPSHOT_MISSING"] }, meta: { requestId: "request-freshness" } });
  throw new Error(`Unexpected request: ${url}`);
};

async function run() {
  setAccessToken("in-memory-access-token");
  const receipt = await createCorporateApplication(expectedInput, "stable-o2-key-for-one-logical-request");
  assert(receipt.corporateAccountId === corporateAccountId && receipt.applicationId === applicationId && receipt.applicationStatus === "DRAFT" && receipt.detailsVersion === 1, "O2 receipt normalisation failed");
  const o2 = requests[0];
  assert(o2.url === "/api/v1/corporate-accounts/applications" && o2.init.method === "POST" && o2.init.credentials === "include" && o2.init.cache === "no-store", "O2 transport settings are incorrect");
  const o2Headers = o2.init.headers as Record<string, string>;
  assert(o2Headers.Authorization === "Bearer in-memory-access-token" && o2Headers["X-CSRF-Token"] === "csrf-token" && o2Headers["Idempotency-Key"] === "stable-o2-key-for-one-logical-request" && o2Headers["Content-Type"] === "application/json", "O2 authentication, CSRF, idempotency, or content headers are incorrect");
  const o2Body = JSON.parse(String(o2.init.body)) as Record<string, unknown>;
  assert(JSON.stringify(Object.keys(o2Body).sort()) === JSON.stringify(Object.keys(expectedInput).sort()) && o2Body.taxIdentificationNumber === expectedInput.taxIdentificationNumber, "O2 body must contain exactly the approved six fields");

  const discovered = await getMyCorporateApplications();
  assert(discovered.length === 2 && discovered[0].corporateAccountId === corporateAccountId && discovered.every((item) => item.accessVia === "INITIATING_APPLICANT") && !("institutionName" in discovered[0]), "Owner-only discovery must return only safe backend items");
  const discoveryRequest = requests.at(-1)!;
  assert(discoveryRequest.url === "/api/v1/me/corporate-accounts" && discoveryRequest.init.method === "GET" && !("X-CSRF-Token" in (discoveryRequest.init.headers as Record<string, string>)), "Discovery must be authenticated owner read without mutation CSRF header");

  const read = await getCorporateOnboarding(corporateAccountId);
  const amended = await updateCorporateDraft(corporateAccountId, read.details.version, { businessEmail: "amended@example.test" });
  const patchRequest = requests.at(-1)!;
  const patchHeaders = patchRequest.init.headers as Record<string, string>;
  assert(amended.details.version === 2 && patchRequest.url.endsWith(`/corporate-accounts/${corporateAccountId}/onboarding/draft`) && patchRequest.init.method === "PATCH", "O4 PATCH path or safe response normalisation failed");
  assert(patchHeaders.Authorization === "Bearer in-memory-access-token" && patchHeaders["X-CSRF-Token"] === "csrf-token" && patchHeaders["If-Match"] === '"1"' && patchRequest.init.credentials === "include", "O4 must send bearer, CSRF and exact strong quoted If-Match");
  assert(JSON.stringify(JSON.parse(String(patchRequest.init.body))) === JSON.stringify({ businessEmail: "amended@example.test" }), "O4 must send only the changed approved field subset");
  let emptyPatchRejected = false;
  try { await updateCorporateDraft(corporateAccountId, 2, {}); } catch (error) { emptyPatchRejected = error instanceof ApiError && error.code === "VALIDATION_FAILED"; }
  assert(emptyPatchRejected, "O4 must reject an empty patch before transport");

  const history = await getCorporateOnboardingHistory(corporateAccountId);
  const freshness = await getCorporateSnapshotFreshness(corporateAccountId);
  assert(history.detailsAmendments.length === 1 && history.detailsAmendments[0].changedFieldNames.join(",") === "institutionName,businessEmail", "O11 must expose safe amendment metadata only");
  assert(freshness.isFresh === false && freshness.snapshotId === null && freshness.issues[0] === "SNAPSHOT_MISSING", "Read-only snapshot freshness normalisation failed");
  assert(!requests.some(({ url }) => url.includes("verification-snapshot") && (url.endsWith("/generate") || url.endsWith("/regenerate"))), "The frontend must never offer snapshot generation/regeneration");

  const conflictRequests: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = async (input, init = {}) => { conflictRequests.push({ url: String(input), init }); return response({ error: { code: "CONFLICT", message: "Stale details version", requestId: "request-conflict" } }, 409); };
  let staleConflict = false;
  try { await updateCorporateDraft(corporateAccountId, 2, { rcNumber: "RC-NEW" }); } catch (error) { staleConflict = error instanceof ApiError && error.code === "CONFLICT"; }
  assert(staleConflict && conflictRequests.length === 1 && conflictRequests[0].init.method === "PATCH", "A 409 O4 stale/non-editable conflict must remain visible and must not retry or overwrite silently");

  const retryRequests: Array<{ url: string; init: RequestInit }> = [];
  let o2Attempts = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input); retryRequests.push({ url, init });
    if (url === "/api/v1/corporate-accounts/applications") { o2Attempts += 1; if (o2Attempts === 1) return response({ error: { code: "UNAUTHENTICATED", message: "Session expired", requestId: "request-retry-1" } }, 401); return response({ data: { corporateAccountId, applicationId, applicationStatus: "DRAFT", detailsVersion: 1 } }, 201); }
    if (url === "/api/v1/auth/refresh") { (globalThis.document as { cookie: string }).cookie = "sf_csrf=rotated-csrf-token"; return response({ data: { accessToken: "refreshed-access-token" } }); }
    throw new Error(`Unexpected retry request: ${url}`);
  };
  setAccessToken("expiring-access-token");
  await createCorporateApplication(expectedInput, "stable-retry-key");
  const retryFirst = retryRequests[0].init.headers as Record<string, string>; const retrySecond = retryRequests[2].init.headers as Record<string, string>;
  assert(retryRequests.map(({ url }) => url).join(",") === "/api/v1/corporate-accounts/applications,/api/v1/auth/refresh,/api/v1/corporate-accounts/applications" && retryFirst["Idempotency-Key"] === "stable-retry-key" && retrySecond["Idempotency-Key"] === "stable-retry-key" && retrySecond.Authorization === "Bearer refreshed-access-token" && retrySecond["X-CSRF-Token"] === "rotated-csrf-token", "Authenticated bounded refresh must retain O2 safety headers");

  clearAccessToken(); globalThis.fetch = originalFetch;
  console.log("PASS — Corporate v0.6 owner discovery, O4 changed-field PATCH/quoted If-Match/conflict behavior, safe O11 amendments, read-only freshness, and retained O2/O3 session transport checks passed");
}
void run().catch((error: unknown) => { globalThis.fetch = originalFetch; clearAccessToken(); throw error; });
