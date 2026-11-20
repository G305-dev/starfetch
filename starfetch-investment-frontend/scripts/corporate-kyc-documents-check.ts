import { readFileSync } from "node:fs";
import { join } from "node:path";
import { corporateApplicationStates } from "../lib/corporate/application";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

// Strip block comments so boundary comments do not trip assertions.
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const client = stripComments(read("lib/api/client.ts"));
const section = stripComments(read("components/corporate/CorporateDocumentUploadSection.tsx"));
const profile = stripComments(read("components/corporate/CorporateProfileContent.tsx"));
const profilePage = read("app/corporate/profile/page.tsx");

// --- The application lifecycle the section honours ---
assert(
  corporateApplicationStates.join(",") === "DRAFT,SUBMITTED,IN_REVIEW,INFO_REQUESTED,APPROVED,REJECTED",
  "Section 5 must honour the existing Corporate application lifecycle",
);

// --- Exactly three approved mandatory Corporate KYC documents ---
assert(
  client.includes('export type CorporateKycDocumentCategory = "CERTIFICATE_OF_INCORPORATION" | "MEMART" | "TIN_CERTIFICATE";'),
  "The client must accept exactly the three approved Corporate KYC document categories",
);
assert(
  client.includes('const corporateKycDocumentCategories: readonly CorporateKycDocumentCategory[] = ["CERTIFICATE_OF_INCORPORATION", "MEMART", "TIN_CERTIFICATE"];'),
  "The runtime category list must be limited to the three approved documents",
);
assert(
  !section.includes("CAC Status") && !section.includes("board resolution") && !section.includes("SCUML") && !section.includes("BVN") && !section.includes("Investment Policy Statement"),
  "Section 5 must not request any additional, optional or conditional documents",
);
assert(section.includes("Mandatory"), "Section 5 must mark every requirement as mandatory");
assert(!section.includes("optional") && !section.includes("Optional"), "Section 5 must not offer optional document categories");

// --- Section 5 is backend-backed and uses David's real endpoints ---
assert(
  client.includes("`/corporate-accounts/${corporateAccountPathSegment(corporateAccountId)}/kyc-documents`"),
  "The client must read Corporate KYC documents from the documented GET endpoint",
);
assert(
  client.includes("`/corporate-accounts/${corporateAccountPathSegment(corporateAccountId)}/kyc-documents/${category}`"),
  "The client must upload to the documented category endpoint",
);
assert(
  client.includes("/kyc-documents/${encodeURIComponent(documentId)}/view-authorization"),
  "The client must request a short-lived view authorization for saved documents",
);
assert(
  client.includes("`/corporate-accounts/${corporateAccountPathSegment(corporateAccountId)}/submission`"),
  "Submission must use the documented Corporate submission endpoint",
);
assert(client.includes('"Idempotency-Key": idempotencyKey'), "Submission must send an Idempotency-Key header");
assert(!client.includes("putObject") && !client.includes("s3.") && !client.includes("AWS"), "The frontend must never upload directly to storage");

// --- Multipart upload uses FormData without a manual Content-Type ---
assert(client.includes("rawBody: formData"), "Uploads must send the multipart FormData body");
assert(client.includes('formData.append("file", file)'), "Uploads must send the single required file field");
assert(client.includes('formData.append("replacesDocumentId", replacesDocumentId)'), "Replacement uploads must send the current documentId");
assert(
  client.includes("...(options.rawBody === undefined && options.body !== undefined ? { \"Content-Type\": \"application/json\" } : {})"),
  "The API client must not set Content-Type for multipart bodies",
);

// --- Truthful status only: no fabricated submission or scanning states ---
assert(section.includes("data.submission.canSubmit"), "Submit must be gated on the backend canSubmit flag");
assert(
  section.includes("disabled={!data.submission.canSubmit || submitting}"),
  "The Submit button must be disabled unless the backend allows submission",
);
assert(section.includes("Submitted for Starfetch review"), "Genuine submission must show the awaiting-review confirmation");
assert(!section.includes("scanStatus === \"CLEAN\"") && !section.includes("virus-free"), "Section 5 must never claim a clean or virus-free scan");
assert(!section.includes('"Approved"') && !section.includes('"Verified"'), "Section 5 must never show Approved or Verified");
assert(!section.includes("setReceipt({"), "Section 5 must never fabricate a submission receipt");
assert(section.includes("submitCorporateApplication("), "Section 5 must submit through the real backend operation");
assert(section.includes("receipt?.submissionId"), "The submission reference must come from the backend response");

// --- Persistence and privacy ---
assert(section.includes("getCorporateKycDocuments("), "Section 5 must reload saved document records when the applicant returns");
assert(section.includes("getMyCorporateApplications("), "The account must be resolved through the existing discovery endpoint");
assert(!section.includes("localStorage.") && !section.includes("sessionStorage."), "Document state must never be written to browser storage");
assert(!client.includes("localStorage.setItem") && !client.includes("sessionStorage.setItem"), "The client must not persist document data in browser storage");
assert(section.includes("window.location.assign(grant.viewUrl)"), "Signed view URLs must be opened immediately");

// --- Replacement only where the backend permits ---
assert(section.includes("requirement.canReplace"), "Replacement must be gated on the backend canReplace flag");
assert(section.includes("requirement.canUpload"), "First upload must be gated on the backend canUpload flag");
assert(section.includes('requirement.blockedReason === "APPLICATION_NOT_EDITABLE"'), "Read-only applications must be detected from the backend blockedReason");

// --- Errors map to the documented codes ---
for (const code of ["FEATURE_UNAVAILABLE", "FILE_TOO_LARGE", "UNSUPPORTED_FILE_TYPE", "CONFLICT", "RATE_LIMITED"]) {
  assert(section.includes(`"${code}"`), `Section 5 must handle the documented ${code} error`);
}
assert(section.includes("Document upload is temporarily unavailable"), "A 503 must show the documented unavailable message");

// --- The original four sections stay local-only ---
assert(profile.includes("<CorporateDocumentUploadSection"), "The fifth section must render inside the Corporate Profile journey");
assert(profile.includes('title: "Corporate Document Upload"'), "The fifth section must be titled Corporate Document Upload");
assert(profile.includes("Section 5"), "The journey must present five sections");
assert(profile.includes("Company Details") || profile.includes("sections"), "The existing section list must remain intact");
assert(!profile.includes("fetch("), "The existing local-only Corporate Profile form must not gain direct fetch calls");
assert(profile.includes("continueLocally"), "The existing local-only section flow must be preserved");
assert(!profile.includes("localStorage.") && !profile.includes("sessionStorage."), "The Corporate Profile must not use browser storage");
assert(profilePage.includes("CorporateProfileContent"), "The Corporate Profile page must keep rendering CorporateProfileContent");
assert(section.includes('from "@/lib/api/client"'), "Section 5 must use the central API client");
assert(!section.includes("/api/v1/"), "Section 5 must never bypass the central API client");

console.log("PASS — Corporate KYC Section 5 uploads exactly the three approved documents through the real backend endpoints, reloads saved records, shows truthful status, submits only when allowed, and leaves the first four local-only sections unchanged");
