import {
  clearAccessToken,
  completeIndividualKycDocument,
  createIndividualKycUploadIntent,
  getIndividualKycProfile,
  isApiError,
  saveIndividualKycBankDetails,
  saveIndividualKycInvestmentProfile,
  saveIndividualKycPersonal,
  saveIndividualKycSourceOfFunds,
  setAccessToken,
  submitIndividualKycProfile,
} from "../lib/api/client";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type CapturedRequest = { url: string; method: string; headers: Headers; body: Record<string, unknown> | null };

async function run() {
  const originalFetch = globalThis.fetch;
  const requests: CapturedRequest[] = [];
  let returnConflict = false;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : null;
    requests.push({ url, method, headers, body });

    if (returnConflict) {
      return new Response(JSON.stringify({ error: { code: "CONFLICT" } }), { status: 409, headers: { "Content-Type": "application/json" } });
    }
    if (url === "/api/v1/me/kyc-profile" && method === "GET") {
      return new Response(JSON.stringify({ data: {
        status: "DRAFT",
        version: 4,
        sectionStatuses: { personal: "COMPLETE", investmentProfile: "DRAFT", sourceOfFunds: "NOT_STARTED", bankDetails: "NOT_STARTED" },
        progression: { nextSection: "investmentProfile", canSubmit: false },
        sections: {
          personal: { dateOfBirth: "1990-01-01", gender: "FEMALE", nationality: "NG", idDocumentType: "PASSPORT", pepStatus: "NO", pepDetails: null },
          investmentProfile: { primaryInvestmentObjective: "GROWTH", riskTolerance: "MODERATE", investmentHorizon: "DAYS_180", financialCurrency: "NGN", investmentKnowledgeExperience: "GOOD", expectedWithdrawalsMinor: "25000000", withdrawalFrequency: "Every six months", annualIncomeMinor: "12500000000", estimatedNetWorthMinor: "25000000000", investmentRestrictions: null },
          sourceOfFunds: { sourceOfFunds: ["SALARY_EMPLOYMENT"], otherSource: null, expectedAnnualInflowMinor: "6000000000", expectedTransactionFrequency: "About monthly" },
          bankDetails: { bankName: "Synthetic Bank", accountNumberMasked: "******6789", accountName: "Synthetic Applicant", accountType: "Current account", bvnLinkedToAccount: true, accountNumber: "must-not-be-hydrated" },
        },
        documents: [{ id: "doc-1", documentType: "PASSPORT", status: "UNDER_REVIEW", manualReviewStatus: "PENDING" }],
      } }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/id-document/upload-intent")) {
      return new Response(JSON.stringify({ data: { documentId: "doc-2", uploadUrl: "https://uploads.example.test/signed", requiredHeaders: { "Content-Type": "application/pdf" }, version: 9 } }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/submit")) {
      return new Response(JSON.stringify({ data: { status: "SUBMITTED", version: 11, timestamp: "2026-10-22T12:00:00.000Z" } }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ data: { version: 8 } }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof globalThis.fetch;

  setAccessToken("synthetic-test-token");
  try {
    const current = await getIndividualKycProfile();
    assert(current.version === 4 && current.progression.nextSection === "investmentProfile", "GET must restore version and next section");
    assert(current.sectionStatuses.personal === "COMPLETE" && current.sections.investmentProfile.expectedWithdrawalsMinor === "25000000", "GET must normalize saved sections");
    assert(current.sections.bankDetails.accountNumberMasked === "******6789", "GET must expose the masked account value");
    assert(!("accountNumber" in current.sections.bankDetails), "GET normalizer must never hydrate a raw bank account number");
    assert(current.documents[0]?.status === "UNDER_REVIEW", "GET must keep manual document review distinct from KYC approval");

    await saveIndividualKycPersonal({ version: 4, dateOfBirth: "1990-01-01", gender: "FEMALE", nationality: "NG", residentialAddress: "Synthetic address", stateOfResidence: "Lagos", idDocumentType: "PASSPORT", occupation: "Analyst", pepStatus: "NO", pepDetails: null });
    await saveIndividualKycInvestmentProfile({ version: 5, primaryInvestmentObjective: "GROWTH", riskTolerance: "MODERATE", investmentHorizon: "DAYS_180", financialCurrency: "NGN", investmentKnowledgeExperience: "GOOD", expectedWithdrawalsMinor: "25000000", withdrawalFrequency: "Every six months", annualIncomeMinor: "12500000000", estimatedNetWorthMinor: "25000000000", investmentRestrictions: null });
    await saveIndividualKycSourceOfFunds({ version: 6, sourceOfFunds: ["SALARY_EMPLOYMENT", "OTHER"], otherSource: "Synthetic source", expectedAnnualInflowMinor: "6000000000", expectedTransactionFrequency: "About monthly" });
    await saveIndividualKycBankDetails({ version: 7, bankName: "Synthetic Bank", accountNumber: "0123456789", accountName: "Synthetic Applicant", accountType: "Current account", bvnLinkedToAccount: true });
    const intent = await createIndividualKycUploadIntent({ version: 8, documentType: "PASSPORT", originalFilename: "synthetic.pdf", contentType: "application/pdf", sizeBytes: 10, checksumSha256: "synthetic-checksum" });
    assert(intent.documentId === "doc-2" && intent.version === 9 && intent.uploadUrl.startsWith("https://"), "Upload intent must return a signed URL and current version");
    await completeIndividualKycDocument(intent.documentId, intent.version);
    const receipt = await submitIndividualKycProfile(10);
    assert(receipt.status === "SUBMITTED" && receipt.version === 11, "Submission must return a SUBMITTED receipt");

    const expectedRoutes = [
      ["GET", "/api/v1/me/kyc-profile"],
      ["PUT", "/api/v1/me/kyc-profile/personal"],
      ["PUT", "/api/v1/me/kyc-profile/investment-profile"],
      ["PUT", "/api/v1/me/kyc-profile/source-of-funds"],
      ["PUT", "/api/v1/me/kyc-profile/bank-details"],
      ["POST", "/api/v1/me/kyc-profile/id-document/upload-intent"],
      ["POST", "/api/v1/me/kyc-profile/id-document/doc-2/complete"],
      ["POST", "/api/v1/me/kyc-profile/submit"],
    ];
    for (const [method, url] of expectedRoutes) {
      assert(requests.some((request) => request.method === method && request.url === url), `Missing mapped route ${method} ${url}`);
    }
    for (const request of requests.filter((item) => item.url.startsWith("/api/v1/me/kyc-profile") && item.method !== "GET")) {
      assert(request.headers.get("Authorization") === "Bearer synthetic-test-token", "Mutations must use the authenticated Investor token");
      assert(!request.body || !("userId" in request.body) && !("investorId" in request.body), "No owner ID may be supplied by the browser");
    }
    const bankRequest = requests.find((request) => request.url.endsWith("/bank-details"));
    assert(bankRequest?.body?.accountNumber === "0123456789" && bankRequest.body.bvnLinkedToAccount === true, "Bank request must send NUBAN plus boolean linkage declaration");
    assert(bankRequest?.body && !("bvn" in bankRequest.body) && !("branch" in bankRequest.body) && !("sortCode" in bankRequest.body), "Bank request must not send raw BVN or routing codes");
    const submitRequest = requests.find((request) => request.url.endsWith("/submit"));
    assert(JSON.stringify(submitRequest?.body) === JSON.stringify({ version: 10 }), "Submit body must contain only the current version");

    returnConflict = true;
    let conflictReceived = false;
    try {
      await saveIndividualKycBankDetails({ version: 11, bankName: "Synthetic Bank", accountNumber: "0123456789", accountName: "Synthetic Applicant", accountType: "Current account", bvnLinkedToAccount: true });
    } catch (error) {
      conflictReceived = isApiError(error) && error.code === "CONFLICT";
    }
    assert(conflictReceived, "Stale-version API conflicts must remain distinguishable for client reload handling");
  } finally {
    clearAccessToken();
    globalThis.fetch = originalFetch;
  }
}

void run().then(() => console.log("PASS — KYC client uses mapped authenticated routes, versioned writes, masked reads, secure uploads, and SUBMITTED receipts"));
