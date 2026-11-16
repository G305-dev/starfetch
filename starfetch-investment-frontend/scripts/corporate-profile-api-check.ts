import {
  ApiError,
  clearAccessToken,
  getMyCorporateProfile,
  saveCorporateBankDetails,
  saveCorporateCompanyDetails,
  saveCorporateInvestmentProfile,
  saveCorporateSourceOfFunds,
  setAccessToken,
} from "../lib/api/client";

const timestamp = "2026-10-22T12:00:00.000Z";
const requests: Array<{ url: string; init: RequestInit }> = [];
const corporateProfileIdFreeProjection = {
  applicant: { companyName: "Example Holdings Limited", companyPhoneNumber: "+234 800 000 0000", email: "applicant@example.test" },
  sections: { companyDetails: "COMPLETE", investmentProfile: "DRAFT", sourceOfFunds: "NOT_STARTED", bankDetails: "NOT_STARTED" },
  companyDetails: { rcNumber: "RC-123456", dateOfIncorporation: "2020-01-02", taxIdentificationNumberMasked: "••••5678", registeredAddress: "10 Example Road", city: "Lagos", state: "Lagos" },
  investmentProfile: { primaryObjective: "Balanced", riskTolerance: "Moderate", investmentHorizon: "1–3 years", expectedWithdrawals: "₦500,000", withdrawalFrequency: "Quarterly", restrictionsOrExclusions: "" },
  sourceOfFunds: { selectedSources: ["Business income / operating cash"], otherSource: "", expectedAnnualInflow: "1000000", expectedTransactionFrequency: "Quarterly" },
  bankDetails: { bankName: "Example Bank", accountNumberMasked: "******6789", accountName: "Example Holdings Limited", accountType: "Current", bvnLinkedToAccount: true },
  version: 7,
  updatedAt: timestamp,
};

function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

Object.defineProperty(globalThis, "document", { configurable: true, value: { cookie: "sf_csrf=corporate-csrf-token" } });
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  requests.push({ url, init });
  if (url === "/api/v1/me/corporate-profile") return response({ data: corporateProfileIdFreeProjection, meta: { requestId: "profile-read" } });
  if (url === "/api/v1/me/corporate-profile/company-details") return response({ data: { ...corporateProfileIdFreeProjection, version: 8, sections: { ...corporateProfileIdFreeProjection.sections, companyDetails: "COMPLETE", investmentProfile: "NOT_STARTED", sourceOfFunds: "NOT_STARTED", bankDetails: "NOT_STARTED" } } });
  if (url === "/api/v1/me/corporate-profile/investment-profile") return response({ data: { ...corporateProfileIdFreeProjection, version: 9, sections: { ...corporateProfileIdFreeProjection.sections, investmentProfile: "COMPLETE" } } });
  if (url === "/api/v1/me/corporate-profile/source-of-funds") return response({ data: { ...corporateProfileIdFreeProjection, version: 10, sections: { ...corporateProfileIdFreeProjection.sections, investmentProfile: "COMPLETE", sourceOfFunds: "COMPLETE" } } });
  if (url === "/api/v1/me/corporate-profile/bank-details") return response({ data: { ...corporateProfileIdFreeProjection, version: 11, sections: { companyDetails: "COMPLETE", investmentProfile: "COMPLETE", sourceOfFunds: "COMPLETE", bankDetails: "COMPLETE" }, bankDetails: { ...corporateProfileIdFreeProjection.bankDetails, accountNumberMasked: "******4321" } } });
  throw new Error(`Unexpected request: ${url}`);
};

async function run() {
  setAccessToken("corporate-profile-access-token");
  const profile = await getMyCorporateProfile();
  assert(profile.applicant.companyName === "Example Holdings Limited" && profile.applicant.companyPhoneNumber === "+234 800 000 0000" && profile.applicant.email === "applicant@example.test", "Read-only account-managed applicant details were not normalised");
  assert(profile.sections.companyDetails === "COMPLETE" && profile.sections.investmentProfile === "DRAFT" && profile.companyDetails.taxIdentificationNumberMasked === "••••5678" && profile.bankDetails.accountNumberMasked === "******6789", "Corporate Profile section states or masked values were not normalised");
  const getRequest = requests[0];
  const getHeaders = getRequest.init.headers as Record<string, string>;
  assert(getRequest.url === "/api/v1/me/corporate-profile" && getRequest.init.method === "GET" && getRequest.init.credentials === "include" && getRequest.init.cache === "no-store" && getHeaders.Authorization === "Bearer corporate-profile-access-token", "Corporate Profile must use an authenticated owner-scoped same-origin GET");

  await saveCorporateCompanyDetails({ rcNumber: "RC-123456", dateOfIncorporation: "2020-01-02", taxIdentificationNumber: "TIN-SECRET-456", registeredAddress: "10 Example Road", city: "Lagos", state: "Lagos" }, 7);
  await saveCorporateInvestmentProfile({ primaryObjective: "Balanced", riskTolerance: "Moderate", investmentHorizon: "1–3 years", expectedWithdrawals: "₦500,000", withdrawalFrequency: "Quarterly", restrictionsOrExclusions: "" }, 8);
  await saveCorporateSourceOfFunds({ selectedSources: ["Business income / operating cash"], otherSource: "", expectedAnnualInflow: "1000000", expectedTransactionFrequency: "Quarterly" }, 9);
  await saveCorporateBankDetails({ bankName: "Example Bank", accountNumber: "1234567890", accountName: "Example Holdings Limited", accountType: "Current", bvnLinkedToAccount: true }, 10);

  const paths = [
    "/api/v1/me/corporate-profile/company-details",
    "/api/v1/me/corporate-profile/investment-profile",
    "/api/v1/me/corporate-profile/source-of-funds",
    "/api/v1/me/corporate-profile/bank-details",
  ];
  const mutations = requests.slice(1);
  assert(mutations.length === 4 && mutations.every((item, index) => item.url === paths[index] && item.init.method === "PUT" && item.init.credentials === "include"), "Each section must save using its authenticated owner-scoped PUT route");
  for (const [index, mutation] of mutations.entries()) {
    const headers = mutation.init.headers as Record<string, string>;
    assert(headers.Authorization === "Bearer corporate-profile-access-token" && headers["X-CSRF-Token"] === "corporate-csrf-token" && headers["If-Match"] === `\"${index + 7}\"`, "Each Corporate Profile mutation must include bearer, CSRF and current quoted If-Match headers");
    const body = JSON.parse(String(mutation.init.body)) as Record<string, unknown>;
    assert(!("userId" in body) && !("investorId" in body), "The frontend must not choose an owner ID in a Corporate Profile request");
  }
  const companyBody = JSON.parse(String(mutations[0].init.body)) as Record<string, unknown>;
  const bankBody = JSON.parse(String(mutations[3].init.body)) as Record<string, unknown>;
  assert(companyBody.taxIdentificationNumber === "TIN-SECRET-456" && !("branch" in companyBody) && !("sortCode" in companyBody), "TIN may be sent only as a write-only company-detail field and no branch/sort fields are accepted");
  assert(bankBody.accountNumber === "1234567890" && bankBody.bvnLinkedToAccount === true && !("bvn" in bankBody) && !("branch" in bankBody) && !("sortCode" in bankBody), "Bank Details must send a one-time account number and declaration only, never raw BVN or branch/sort code");
  const retainedAccountResult = await saveCorporateBankDetails({ bankName: "Example Bank", accountName: "Example Holdings Limited", accountType: "Current", bvnLinkedToAccount: false }, 11);
  const retainedAccountBody = JSON.parse(String(requests.at(-1)?.init.body)) as Record<string, unknown>;
  assert(retainedAccountResult.sections.bankDetails === "COMPLETE" && !("accountNumber" in retainedAccountBody), "An existing masked account number should be retained without resending its plaintext value");

  const requestCount = requests.length;
  let badVersionRejected = false;
  try { await saveCorporateInvestmentProfile({ primaryObjective: "", riskTolerance: "", investmentHorizon: "", expectedWithdrawals: "", withdrawalFrequency: "", restrictionsOrExclusions: "" }, 0); } catch (error) { badVersionRejected = error instanceof ApiError && error.code === "VALIDATION_FAILED"; }
  assert(badVersionRejected && requests.length === requestCount, "Invalid optimistic-lock versions must be rejected before transport");

  clearAccessToken();
  globalThis.fetch = originalFetch;
  console.log("PASS — Corporate Profile API uses authenticated owner-scoped reads, four CSRF-protected versioned section saves, masked readbacks, write-only TIN/account-number values, and excludes owner IDs, raw BVN, branch and sort code");
}

void run().catch((error: unknown) => { globalThis.fetch = originalFetch; clearAccessToken(); throw error; });
