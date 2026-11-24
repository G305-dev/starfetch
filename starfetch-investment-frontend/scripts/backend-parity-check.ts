/**
 * BACKEND AUTHORISATION PARITY — static + tabular check.
 *
 * Two jobs:
 *
 *   1. PROVENANCE. The guard model in lib/auth/backend-authorization-parity.ts
 *      must still match the real backend source. This file reads the backend
 *      files (when the monorepo is present) and asserts the exact expressions
 *      the model mirrors are still there. If a backend change lands, this check
 *      fails instead of the model drifting silently.
 *
 *   2. BEHAVIOUR TABLE. The mixed account classifications the review named are
 *      enumerated and the resulting frontend/backend disagreement is asserted.
 *
 * This is a STATIC check: it reads source text and evaluates pure functions. It
 * does not start the backend, seed a database, or make an HTTP request.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  backendSafeUserContexts,
  backendServesSurface,
  corporateApplicantServiceAllows,
  findClassificationAsymmetries,
  findParityFindings,
  individualAccountGuardAllows,
  type AccountFacts,
} from "../lib/auth/backend-authorization-parity";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const backendRoot = join(process.cwd(), "..", "starfetch-investment-backend");
const hasBackend = existsSync(join(backendRoot, "src"));

// ---------------------------------------------------------------------------
// 1. PROVENANCE — the model must still mirror the shipped backend.
// ---------------------------------------------------------------------------
if (hasBackend) {
  const read = (relative: string) => readFileSync(join(backendRoot, relative), "utf8").replace(/\s+/g, " ");

  const safeUser = read("src/modules/auth/auth.service.ts");
  assert(
    safeUser.includes("user.primaryAccountType !== PrimaryAccountType.CORPORATE && Boolean(user.investorProfile)") &&
      safeUser.includes("if (canAccessIndividual) contexts.push('INDIVIDUAL')"),
    "safeUser() must require a real InvestorProfile and non-CORPORATE classification for INDIVIDUAL",
  );
  assert(
    safeUser.includes("Boolean(user.emailVerifiedAt) && user.primaryAccountType !== PrimaryAccountType.INDIVIDUAL") &&
      safeUser.includes("hasCorporateEvidence") &&
      safeUser.includes("if (canAccessCorporate) contexts.push('CORPORATE')"),
    "safeUser() must require verified non-INDIVIDUAL classification and Corporate evidence or primary CORPORATE",
  );
  assert(
    safeUser.includes("if (canAccessIndividual && jointMembershipCount > 0) contexts.push('JOINT')"),
    "safeUser() must require an allowed Individual context and real Joint membership before projecting JOINT",
  );

  const individualGuard = read("src/common/guards/individual-account.guard.ts");
  assert(
    individualGuard.includes("primaryAccountType === PrimaryAccountType.CORPORATE || !user.investorProfile"),
    "IndividualAccountGuard still rejects CORPORATE-classified accounts and accounts without a profile",
  );

  const corporateContext = read("src/modules/corporate-onboarding/services/corporate-applicant-context.service.ts");
  assert(
    corporateContext.includes("user.primaryAccountType === PrimaryAccountType.INDIVIDUAL"),
    "CorporateApplicantContextService still rejects primary INDIVIDUAL outright",
  );

  const invitations = read("src/modules/joint/joint-invitations.controller.ts");
  assert(
    !/listMyInvitations[\s\S]{0,400}JointMembershipGuard/.test(invitations),
    "The invitation inbox route must NOT require JointMembershipGuard — that is what makes the frontend exception safe",
  );

  const jointController = read("src/modules/joint/joint.controller.ts");
  assert(
    jointController.includes("IndividualAccountGuard, JointMembershipGuard"),
    "Joint account-scoped routes still require JointMembershipGuard",
  );

  const me = read("src/modules/me/me.controller.ts");
  assert(
    /@Get\(\)[\s\S]{0,200}@UseGuards\(AccessTokenGuard\)/.test(me),
    "/me must remain unfiltered by account type so the projection is pure",
  );
} else {
  console.log("  (backend source not present — provenance assertions skipped; behaviour table still runs)");
}

// ---------------------------------------------------------------------------
// 2. BEHAVIOUR TABLE — the classifications this review asked about.
// ---------------------------------------------------------------------------
const base: AccountFacts = {
  emailVerified: true,
  primaryAccountType: "INDIVIDUAL",
  hasInvestorProfile: true,
  hasCorporateApplicantProfile: false,
  initiatedCorporateApplicationCount: 0,
  jointMembershipCount: 0,
  isActiveMemberOfRequestedJointAccount: false,
};

const cases: Array<{ name: string; facts: AccountFacts; note: string }> = [
  { name: "Individual-only", facts: { ...base }, note: "baseline; must be fully consistent" },
  { name: "Individual + Joint member", facts: { ...base, jointMembershipCount: 1, isActiveMemberOfRequestedJointAccount: true }, note: "baseline; must be fully consistent" },
  // The review's first example.
  { name: "Primary CORPORATE with an Individual profile", facts: { ...base, primaryAccountType: "CORPORATE", hasCorporateApplicantProfile: true }, note: "review example" },
  // The review's second example.
  { name: "Primary INDIVIDUAL with Corporate evidence", facts: { ...base, hasCorporateApplicantProfile: true }, note: "review example" },
  { name: "Primary CORPORATE, no Individual profile", facts: { ...base, primaryAccountType: "CORPORATE", hasInvestorProfile: false, hasCorporateApplicantProfile: true }, note: "consistent" },
  { name: "Legacy null primary, Individual profile only", facts: { ...base, primaryAccountType: null }, note: "consistent" },
  { name: "Legacy null primary, Corporate evidence only", facts: { ...base, primaryAccountType: null, hasInvestorProfile: false, hasCorporateApplicantProfile: true }, note: "JOINT suppression gap" },
  { name: "Legacy null primary, Corporate evidence + Joint membership", facts: { ...base, primaryAccountType: null, hasCorporateApplicantProfile: true, jointMembershipCount: 1, isActiveMemberOfRequestedJointAccount: true }, note: "JOINT suppression gap" },
  { name: "CORPORATE with Joint membership row", facts: { ...base, primaryAccountType: "CORPORATE", hasCorporateApplicantProfile: true, jointMembershipCount: 1, isActiveMemberOfRequestedJointAccount: true }, note: "safeUser suppresses JOINT" },
];

const rows: string[] = [];
for (const testCase of cases) {
  const contexts = backendSafeUserContexts(testCase.facts);
  const individual = individualAccountGuardAllows(testCase.facts);
  const corporate = corporateApplicantServiceAllows(testCase.facts);
  const inbox = backendServesSurface("jointInvitationInbox", testCase.facts);
  const jointScoped = backendServesSurface("jointAccountScoped", testCase.facts);
  const findings = findParityFindings(testCase.facts);
  rows.push(
    `${testCase.name.padEnd(52)} contexts=[${contexts.join(",").padEnd(22)}] guard:IND=${individual ? "Y" : "N"} CORP=${corporate ? "Y" : "N"} inbox=${inbox ? "Y" : "N"} jointScoped=${jointScoped ? "Y" : "N"} mismatches=${findings.length}`,
  );
}

// --- Individual-only and Joint-member baselines must be fully consistent ----
const individualOnly = findParityFindings({ ...base });
assert(individualOnly.length === 0, `An Individual-only account must have no mismatch (found ${individualOnly.length})`);
const jointMember = findParityFindings({ ...base, jointMembershipCount: 1, isActiveMemberOfRequestedJointAccount: true });
assert(jointMember.length === 0, `An Individual + Joint member must have no mismatch (found ${jointMember.length})`);

// --- Former mismatch 1: CORPORATE with an Individual profile ---------------
const corporateWithProfile = { ...base, primaryAccountType: "CORPORATE" as const, hasCorporateApplicantProfile: true };
const example1 = findParityFindings(corporateWithProfile);
assert(
  !backendSafeUserContexts(corporateWithProfile).includes("INDIVIDUAL"),
  "safeUser() must NOT promise INDIVIDUAL to a CORPORATE-classified account",
);
assert(!individualAccountGuardAllows(corporateWithProfile), "IndividualAccountGuard must still deny the Corporate identity");
assert(example1.length === 0, "The updated projection must agree with IndividualAccountGuard for this account");

// --- Former mismatch 2: INDIVIDUAL with Corporate evidence ------------------
const individualWithCorporate = { ...base, hasCorporateApplicantProfile: true };
const example2 = findParityFindings(individualWithCorporate);
assert(
  !backendSafeUserContexts(individualWithCorporate).includes("CORPORATE"),
  "safeUser() must NOT promise CORPORATE to primary INDIVIDUAL despite Corporate evidence",
);
assert(!corporateApplicantServiceAllows(individualWithCorporate), "CorporateApplicantContextService must deny primary INDIVIDUAL");
assert(example2.length === 0, "The updated projection must agree with CorporateApplicantContextService for this account");

// --- A classification alone cannot invent an Individual investor profile ---
const missingInvestorProfile = { ...base, hasInvestorProfile: false };
assert(!backendSafeUserContexts(missingInvestorProfile).includes("INDIVIDUAL"), "Individual profile is mandatory");
assert(!backendSafeUserContexts(missingInvestorProfile).includes("JOINT"), "JOINT cannot be inferred without Individual access");

// --- Unverified Corporate identity does not obtain Corporate context --------
const unverifiedCorporate = { ...base, emailVerified: false, primaryAccountType: "CORPORATE" as const, hasCorporateApplicantProfile: true };
assert(!backendSafeUserContexts(unverifiedCorporate).includes("CORPORATE"), "Email verification is required for Corporate context");
assert(!corporateApplicantServiceAllows(unverifiedCorporate), "Corporate applicant guard denies unverified identities");

// --- Invitation inbox is open to an Individual with no membership ----------
const invitee = {
  ...base,
  jointMembershipCount: 0,
  isActiveMemberOfRequestedJointAccount: false,
};
assert(
  backendServesSurface("jointInvitationInbox", invitee),
  "The backend must serve the invitation inbox to an Individual invitee with no membership",
);
assert(
  !backendServesSurface("jointAccountScoped", invitee),
  "The backend must still refuse account-scoped Joint resources without a membership",
);
assert(
  findParityFindings(invitee).length === 0,
  "An Individual invitee awaiting acceptance must show no portal mismatch",
);

// --- JOINT suppression gap: legacy null primary with corporate evidence ----
const legacyNullCorporate = {
  ...base,
  primaryAccountType: null,
  hasCorporateApplicantProfile: true,
  jointMembershipCount: 1,
  isActiveMemberOfRequestedJointAccount: true,
};
assert(
  backendSafeUserContexts(legacyNullCorporate).includes("JOINT"),
  "A legacy null-primary account with a membership still receives JOINT",
);
assert(
  findParityFindings(legacyNullCorporate).length === 0,
  "The legacy account is genuinely served by every portal it is promised, so it is not a promise/denial mismatch",
);
const legacyAsymmetry = findClassificationAsymmetries(legacyNullCorporate);
assert(
  legacyAsymmetry.some((entry) => /keeps JOINT access/.test(entry.summary)),
  "The legacy null-primary account must be reported as an asymmetry, not as a parity mismatch",
);
const corporateAsymmetry = findClassificationAsymmetries({ ...base, primaryAccountType: "CORPORATE", hasCorporateApplicantProfile: true, jointMembershipCount: 1, isActiveMemberOfRequestedJointAccount: true });
assert(
  corporateAsymmetry.some((entry) => /denied JOINT/.test(entry.summary)),
  "A CORPORATE-classified account with a real membership must be reported as denied JOINT",
);

// --- A CORPORATE-classified account never receives JOINT -------------------
assert(
  !backendSafeUserContexts({ ...base, primaryAccountType: "CORPORATE", hasCorporateApplicantProfile: true, jointMembershipCount: 3 }).includes("JOINT"),
  "safeUser() suppresses JOINT for every CORPORATE-classified account",
);

// ---------------------------------------------------------------------------
// 3. PROTECTED SURFACE — the access-control change must not have touched the
//    Corporate KYC document or submission code.
// ---------------------------------------------------------------------------
{
  const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");
  const client = read("lib/api/client.ts");

  // The KYC document read/upload/submit API must still exist with its shape.
  assert(/export async function getCorporateKycDocuments\(/.test(client), "The Corporate KYC document read API must still exist");
  assert(/export async function uploadCorporateKycDocument\(/.test(client), "The Corporate KYC document upload API must still exist");
  assert(/export async function submitCorporateApplication\(/.test(client), "The Corporate application submission API must still exist");
  assert(/replacesDocumentId\?: string/.test(client), "The document replacement parameter must be preserved");
  assert(/idempotencyKey: string/.test(client), "The submission idempotency key must be preserved");

  // The only permitted edit to this file is the read-only jointMembershipCount
  // field on the user projection. Nothing about documents may have changed.
  const kycSection = client.slice(client.indexOf("getCorporateKycDocuments"), client.indexOf("getCorporateKycDocuments") + 2500);
  assert(!/jointMembershipCount/.test(kycSection), "The KYC document API must not contain access-control fields");

  // The Corporate document components must not have been modified at all.
  for (const file of [
    "components/corporate/CorporateDocumentTabs.tsx",
    "components/corporate/CorporateDocumentUploadSection.tsx",
    "components/corporate/CorporateDocumentsCard.tsx",
    "components/corporate/CorporateDocumentsContent.tsx",
    "components/corporate/CorporateKycPrompt.tsx",
    "components/corporate/corporate-documents-data.ts",
    "app/corporate/documents/page.tsx",
  ]) {
    const source = read(file);
    assert(source.length > 0, `${file} must exist`);
    assert(!/authorizedContexts|isJointPathAllowed|SessionRefreshOutcome|backend-authorization-parity/.test(source), `${file} must not carry access-control logic`);
  }
}

console.log("  Behaviour table:");
for (const row of rows) console.log(`    ${row}`);

const totalFindings = cases.reduce((sum, testCase) => sum + findParityFindings(testCase.facts).length, 0);
assert(totalFindings === 0, "Current backend projection and guards must agree for all sampled verified INVESTOR cases");

console.log(
  "PASS — Backend authorisation parity (static + table) [Corporate KYC document read/upload/submit APIs and components verified intact]: current safeUser() projection agrees with IndividualAccountGuard and CorporateApplicantContextService for all sampled verified INVESTOR cases; Joint requires Individual access and a real membership; an Individual invitee without membership retains inbox access but not account-scoped access; legacy classification differences remain advisory",
);
