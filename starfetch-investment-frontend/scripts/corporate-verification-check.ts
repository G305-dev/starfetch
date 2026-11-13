import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CorporateApplicationHistory, CorporateOnboardingRecord, CorporateSnapshotFreshness } from "../lib/corporate/application";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const applicationContract = read("lib/corporate/application.ts");
const client = read("lib/api/client.ts");
const workspace = read("components/corporate/CorporateApplicationsWorkspace.tsx");
const verification = read("components/corporate/CorporateVerificationProgress.tsx");
const dashboard = read("components/corporate/CorporateDashboardContent.tsx");
const profile = read("components/corporate/CorporateProfileContent.tsx");
const onboarding = read("components/auth/CorporateOnboardingFlow.tsx");
const documents = read("components/corporate/CorporateDocumentsContent.tsx");
const investments = read("components/corporate/CorporateInvestmentsContent.tsx");
const navigation = read("components/corporate/corporate-dashboard-data.ts");

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

const safeO3: CorporateOnboardingRecord = {
  corporateAccountId: "corporate-id", applicationId: "application-id", status: "DRAFT", createdAt: "2026-10-22T00:00:00.000Z", updatedAt: "2026-10-22T00:00:00.000Z",
  details: { institutionName: "Example Holdings Ltd", dateOfIncorporation: "2020-01-02", rcNumber: "RC-1", businessPhoneNumber: "+2348000000000", businessEmail: "accounts@example.test", taxIdentificationNumberMasked: null, version: 1, createdAt: "2026-10-22T00:00:00.000Z", updatedAt: "2026-10-22T00:00:00.000Z" },
};
const safeO11: CorporateApplicationHistory = { corporateAccountId: safeO3.corporateAccountId, applicationId: safeO3.applicationId, history: [{ id: "event-id", event: "CREATED", fromStatus: null, toStatus: "DRAFT", createdAt: safeO3.createdAt }], detailsAmendments: [{ version: 2, changedFieldNames: ["businessEmail"], changedAt: safeO3.updatedAt }] };
const safeFreshness: CorporateSnapshotFreshness = { applicationId: safeO3.applicationId, snapshotId: null, generation: null, isFresh: false, issues: ["SNAPSHOT_MISSING"] };
assert(safeO3.details.taxIdentificationNumberMasked === null && safeO11.detailsAmendments[0].changedFieldNames[0] === "businessEmail" && safeFreshness.issues[0] === "SNAPSHOT_MISSING", "Safe v0.6 projections are invalid");

assert(applicationContract.includes("applicationDiscovery: \"AVAILABLE\"") && applicationContract.includes("draftAmendment: \"AVAILABLE\"") && applicationContract.includes("snapshotGeneration: \"STAGING_NOT_ENABLED_IN_UI\""), "v0.6 contract availability must expose only approved frontend capabilities");
const detailsDeclaration = applicationContract.slice(applicationContract.indexOf("export type CorporateApplicationDetails"), applicationContract.indexOf("export type CorporateOnboardingRecord"));
assert(!detailsDeclaration.includes("taxIdentificationNumber: string"), "O3/O4 browser details must never contain plaintext TIN");
assert(client.includes("getMyCorporateApplications") && client.includes('authenticatedRequest("/me/corporate-accounts")') && client.includes("accessVia !== \"INITIATING_APPLICANT\""), "Authenticated owner-only Corporate discovery is missing or not strict");
assert(client.includes("updateCorporateDraft") && client.includes('"PATCH"));') && client.includes('"If-Match": `"${detailsVersion}"`') && client.includes("Object.keys(body).length === 0"), "O4 must use non-empty PATCH and strong quoted If-Match");
assert(client.includes("getCorporateSnapshotFreshness") && client.includes("normaliseCorporateSnapshotFreshness") && !client.includes("generateVerificationSnapshot"), "Only read-only snapshot freshness may be integrated");
assert(client.includes("detailsAmendments") && client.includes("changedFieldNames"), "O11 safe amendment metadata normalisation is missing");

assert(workspace.includes("getMyCorporateApplications") && workspace.includes("selectedAccountId") && workspace.includes("activeUserId.current") && workspace.includes("setAccounts([])") && workspace.includes("setSelectedAccountId(null)"), "Returning-user discovery, application selection, and session-switch clearing are missing");
assert(workspace.includes("isCorporateDraftEditable") && workspace.includes("updateCorporateDraft") && workspace.includes("changedPatch") && workspace.includes("taxIdentificationNumber: \"\"") && workspace.includes("autoComplete=\"off\""), "O4 editable-state, changed-field or write-only TIN UI boundaries are missing");
assert(workspace.includes("requestError.code === \"CONFLICT\"") && workspace.includes("await onConflict()") && workspace.includes("review them before making a new amendment") && !workspace.includes("localStorage") && !workspace.includes("sessionStorage") && !workspace.includes("console.log"), "O4 stale conflict refresh/review and no-persistence requirements are missing");
assert(workspace.includes("getCorporateSnapshotFreshness") && verification.includes("SnapshotFreshness") && verification.includes("not Mono verification, document completion, submission permission, compliance approval or investment eligibility") && verification.includes("Snapshot regeneration is not offered"), "Read-only technical snapshot freshness must remain accurately bounded");
assert(verification.includes("application lifecycle status does not prove verification evidence") && verification.includes("Corporate investors cannot approve their own applications") && verification.includes("Safe metadata only. Previous values, TIN/envelope data and actor information are not exposed."), "Three-tier independence or safe history boundaries are missing");
assert(!dashboard.includes("Corporate account discovery unavailable") && dashboard.includes("owner-scoped discovery API") && !profile.includes("owner-scoped account-discovery API has not been approved"), "Dashboard/profile must describe approved discovery accurately");
assert(!navigation.includes('label: "Settings"') && !navigation.includes('href: "/corporate/settings"'), "Corporate Settings must not be exposed as a Corporate account navigation tab");
assert(navigation.includes('label: "Products", href: "/corporate/products", icon: PackageOpen') && !navigation.includes('label: "Documents", href: "/corporate/documents"'), "Corporate navigation must expose Products instead of the Documents tab");
assert(!documents.includes('type="file"') && !documents.includes("UploadPanel") && !documents.includes("setTimeout"), "Document upload must remain unavailable without an approved ruleset");
assert(investments.includes("Create investment unavailable") && investments.includes("Investment creation and funding remain restricted"), "Restricted investment actions are not safely unavailable");
assert(onboarding.includes("createCorporateApplication(toCorporateDraftInput(data), requestKey)") && onboarding.includes("setData(initialCorporateApplicationData)") && onboarding.includes("setIdempotencyKey(null)") && onboarding.includes("[status, user?.id]"), "O2 form-sensitive state must continue to clear after success and session changes");
assert(!/(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]|console\.(log|info|debug)/i.test(onboarding + workspace + client), "Corporate values/IDs must not be persisted or logged in browser storage");

console.log("PASS — Corporate v0.6 UI preserves owner-only discovery, O4 conflict safety, safe O11 amendments, read-only snapshot freshness and independent verification tiers");
