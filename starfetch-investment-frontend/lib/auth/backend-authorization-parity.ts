/**
 * Frontend ↔ backend authorisation parity.
 *
 * The frontend derives portal access from `authorizedContexts` in the backend
 * `safeUser()` projection (auth.service.ts). Routes independently recheck
 * database facts. The model below reflects the updated backend on main:
 * the Individual and Corporate projection predicates are aligned with their
 * corresponding service guards. It alerts when future drift creates a gap.
 *
 * This module is the single place that models those real guards, so the
 * disagreement is provable rather than assumed. It is READ-ONLY: it never grants
 * access, never changes a decision, and is not imported by any route guard. It
 * exists so the mismatch can be detected in tests and explained to users.
 *
 * Mirrors, line for line:
 *   - backend `src/modules/auth/auth.service.ts#safeUser`
 *   - backend `src/common/guards/individual-account.guard.ts`
 *   - backend `src/modules/corporate-onboarding/services/corporate-applicant-context.service.ts`
 *   - backend `src/modules/joint/guards/joint-membership.guard.ts`
 *
 * IMPORTANT: no backend file was modified. This is a frontend model of behaviour
 * that already exists in the repository.
 */

export type PortalContext = "INDIVIDUAL" | "JOINT" | "CORPORATE";
export type PrimaryAccountType = "INDIVIDUAL" | "CORPORATE" | null;

/** The projection fields the parity check needs, all server-derived. */
export type ParityProjection = {
  primaryAccountType?: PrimaryAccountType;
  authorizedContexts?: PortalContext[] | null;
  jointMembershipCount?: number;
  companyName?: string;
  companyPhoneNumber?: string;
};

/** The minimal facts both sides read. Names follow the Prisma relations. */
export type AccountFacts = {
  emailVerified: boolean;
  primaryAccountType: PrimaryAccountType;
  /** `investorProfile != null` */
  hasInvestorProfile: boolean;
  /** `corporateApplicantProfile != null` */
  hasCorporateApplicantProfile: boolean;
  /** initiator-owned CORPORATE onboarding applications, any status */
  initiatedCorporateApplicationCount: number;
  /** `jointMemberships.length` */
  jointMembershipCount: number;
  /**
   * Whether an ACTIVE Joint membership row exists for the specific account the
   * route names. Only `JointMembershipGuard` reads this.
   */
  isActiveMemberOfRequestedJointAccount: boolean;
};

/**
 * Current backend `auth.service.ts#safeUser` rule, for authenticated
 * INVESTOR-role users (the enclosing test table assumes that role):
 *   INDIVIDUAL: non-CORPORATE classification AND actual InvestorProfile
 *   CORPORATE: verified AND non-INDIVIDUAL classification AND
 *              (CORPORATE primary OR a corporate applicant/evidence record)
 *   JOINT: INDIVIDUAL is permitted AND jointMembershipCount > 0
 */
export function backendSafeUserContexts(facts: AccountFacts): PortalContext[] {
  const contexts: PortalContext[] = [];
  const canAccessIndividual =
    facts.primaryAccountType !== "CORPORATE" && facts.hasInvestorProfile;
  const hasCorporateEvidence =
    facts.hasCorporateApplicantProfile || facts.initiatedCorporateApplicationCount > 0;
  const canAccessCorporate =
    facts.emailVerified &&
    facts.primaryAccountType !== "INDIVIDUAL" &&
    (facts.primaryAccountType === "CORPORATE" || hasCorporateEvidence);

  if (canAccessIndividual) contexts.push("INDIVIDUAL");
  if (canAccessCorporate) contexts.push("CORPORATE");
  if (canAccessIndividual && facts.jointMembershipCount > 0) contexts.push("JOINT");
  return contexts;
}

/** `IndividualAccountGuard.canActivate` — 403 unless NOT corporate AND has a profile. */
export function individualAccountGuardAllows(facts: AccountFacts): boolean {
  return !(facts.primaryAccountType === "CORPORATE" || !facts.hasInvestorProfile);
}

/**
 * `CorporateApplicantContextService#requireVerifiedInvestor`, read-only subset.
 * Denies when not verified, when primary === INDIVIDUAL, or when primary
 * is not CORPORATE and there is no corporate evidence. INVESTOR role is
 * assumed throughout the behaviour table; production guard also checks role.
 */
export function corporateApplicantServiceAllows(facts: AccountFacts): boolean {
  const hasCorporateEvidence = facts.hasCorporateApplicantProfile || facts.initiatedCorporateApplicationCount > 0;
  if (!facts.emailVerified || facts.primaryAccountType === "INDIVIDUAL") return false;
  if (facts.primaryAccountType !== "CORPORATE" && !hasCorporateEvidence) return false;
  return true;
}

/** `JointMembershipGuard` — requires an ACTIVE membership row for the named account. */
export function jointMembershipGuardAllows(facts: AccountFacts): boolean {
  return facts.isActiveMemberOfRequestedJointAccount;
}

/**
 * Which guards protect a given frontend surface, mirroring the controllers:
 *
 *   /me/joint-invitations (GET)      AccessToken + Roles + IndividualAccountGuard
 *                                    (no JointMembershipGuard — invitation inbox)
 *   /me/joint-accounts (GET)         AccessToken + Roles + IndividualAccountGuard
 *   /joint-accounts/:id(+children)   ... + JointMembershipGuard
 *   /me, /me/dashboard, /me/profile,
 *   individual KYC                   AccessToken + Roles + IndividualAccountGuard
 *   corporate applicant routes       CorporateApplicantGuard
 */
export type BackendSurface =
  | "jointInvitationInbox"
  | "jointAccountList"
  | "jointAccountScoped"
  | "individualProfile"
  | "corporateApplicant";

/** Does the backend actually serve data for this surface, given these facts? */
export function backendServesSurface(surface: BackendSurface, facts: AccountFacts): boolean {
  switch (surface) {
    case "jointInvitationInbox":
      // The inbox deliberately omits JointMembershipGuard: an invited investor
      // has no membership yet. This is why the frontend inbox exception is safe.
      return individualAccountGuardAllows(facts);
    case "jointAccountList":
      return individualAccountGuardAllows(facts);
    case "jointAccountScoped":
      return individualAccountGuardAllows(facts) && jointMembershipGuardAllows(facts);
    case "individualProfile":
      return individualAccountGuardAllows(facts);
    case "corporateApplicant":
      return corporateApplicantServiceAllows(facts);
  }
}

export type MismatchKind =
  /** The projection promises a portal whose entry calls the backend rejects. */
  | "portal-promised-but-entry-denied"
  /** The portal is not promised although the backend would serve it. */
  | "portal-hidden-but-served";

export type ParityFinding = {
  kind: MismatchKind;
  context: PortalContext;
  /** The frontend surface a user lands on when they pick this portal. */
  surface: BackendSurface;
  summary: string;
  /** Consequence the user actually experiences. */
  impact: string;
  backendReference: string;
};

/**
 * Compares the projection the frontend authorises against with what the
 * backend guards will allow for the same account.
 */
export function findParityFindings(facts: AccountFacts): ParityFinding[] {
  const findings: ParityFinding[] = [];
  const contexts = backendSafeUserContexts(facts);

  if (contexts.includes("INDIVIDUAL") && !backendServesSurface("individualProfile", facts)) {
    findings.push({
      kind: "portal-promised-but-entry-denied",
      context: "INDIVIDUAL",
      surface: "individualProfile",
      summary: "safeUser() grants INDIVIDUAL but IndividualAccountGuard rejects the account.",
      impact: "The Individual dashboard opens, then every data call returns 403 and the user sees an empty or failed portal.",
      backendReference: "auth.service.ts#safeUser vs individual-account.guard.ts",
    });
  }

  if (contexts.includes("CORPORATE") && !backendServesSurface("corporateApplicant", facts)) {
    findings.push({
      kind: "portal-promised-but-entry-denied",
      context: "CORPORATE",
      surface: "corporateApplicant",
      summary: "safeUser() grants CORPORATE but CorporateApplicantContextService rejects the account.",
      impact: "The Corporate portal opens, then Corporate application and KYC document calls return 403.",
      backendReference: "auth.service.ts#safeUser vs corporate-applicant-context.service.ts",
    });
  }

  if (contexts.includes("JOINT") && !backendServesSurface("jointAccountScoped", facts)) {
    findings.push({
      kind: "portal-promised-but-entry-denied",
      context: "JOINT",
      surface: "jointAccountScoped",
      summary: "safeUser() grants JOINT but JointMembershipGuard finds no active membership for the requested account.",
      impact: "The Joint shell opens but account detail, portfolio and transactions return 404 by design (anti-enumeration).",
      backendReference: "auth.service.ts#safeUser vs joint-membership.guard.ts",
    });
  }

  // The inverse: the backend would serve it, but the projection never says so,
  // so the frontend refuses to open a portal the user could legitimately use.
  if (!contexts.includes("INDIVIDUAL") && backendServesSurface("individualProfile", facts)) {
    findings.push({
      kind: "portal-hidden-but-served",
      context: "INDIVIDUAL",
      surface: "individualProfile",
      summary: "IndividualAccountGuard would allow this account but safeUser() omits INDIVIDUAL.",
      impact: "An account the backend would serve is refused by the frontend. Fail-closed, so no disclosure — but the user is wrongly blocked.",
      backendReference: "individual-account.guard.ts vs auth.service.ts#safeUser",
    });
  }

  if (!contexts.includes("CORPORATE") && backendServesSurface("corporateApplicant", facts)) {
    findings.push({
      kind: "portal-hidden-but-served",
      context: "CORPORATE",
      surface: "corporateApplicant",
      summary: "CorporateApplicantContextService would allow this account but safeUser() omits CORPORATE.",
      impact: "A verified Corporate applicant is refused the Corporate portal by the frontend.",
      backendReference: "corporate-applicant-context.service.ts vs auth.service.ts#safeUser",
    });
  }

  return findings;
}

/**
 * Classification difference, reported separately from guard mismatches.
 * A legacy null-primary account WITH an Individual profile AND Corporate
 * evidence can be admitted to JOINT; a primary-CORPORATE account cannot,
 * even with an active membership row, since the Individual guard denies it.
 * Both outcomes now match the backend guards. No UI-side override is safe.
 */
export type ClassificationAsymmetry = {
  summary: string;
  impact: string;
  backendReference: string;
};

export function findClassificationAsymmetries(facts: AccountFacts): ClassificationAsymmetry[] {
  const findings: ClassificationAsymmetry[] = [];
  const hasCorporateEvidence = Boolean(facts.hasCorporateApplicantProfile) || facts.initiatedCorporateApplicationCount > 0;
  const jointEarned = facts.jointMembershipCount > 0 && facts.isActiveMemberOfRequestedJointAccount;

  // Same corporate evidence, different JOINT outcome, purely because of the
  // primary classification column.
  if (hasCorporateEvidence && jointEarned && facts.primaryAccountType === null && facts.hasInvestorProfile) {
    findings.push({
      summary: "A legacy account with no primary classification keeps JOINT access, while an otherwise identical CORPORATE-classified account loses it.",
      impact: "Two accounts with the same Corporate standing can see different Joint portals. The frontend cannot normalise this without second-guessing the backend projection.",
      backendReference: "auth.service.ts#safeUser (JOINT requires canAccessIndividual)",
    });
  }
  if (hasCorporateEvidence && jointEarned && facts.primaryAccountType === "CORPORATE") {
    findings.push({
      summary: "A CORPORATE-classified account with an ACTIVE Joint membership is denied JOINT in the projection.",
      impact: "The membership exists in the database but no Joint portal entry is offered; the user must contact support. Reclassifying the account is the only remedy.",
      backendReference: "auth.service.ts#safeUser vs jointMembershipGuard",
    });
  }
  return findings;
}

/**
 * A diagnostic for any future projection/guard mismatch. The two mixed
 * classification cases from the original V5 review are now aligned on main.
 */
export function describeAccountClassificationMismatch(facts: AccountFacts): string | null {
  const findings = findParityFindings(facts);
  if (findings.length === 0) return null;
  const promised = findings.filter((finding) => finding.kind === "portal-promised-but-entry-denied");
  if (promised.length > 0) {
    const labels = promised.map((finding) => finding.context).join(" and ");
    return `This account is shown as having ${labels} access, but the backend will refuse those requests. This is a backend classification inconsistency, not something you can fix here. Contact Starfetch support so the account record can be reviewed.`;
  }
  return null;
}

/**
 * Builds the fact set from the SafeUser projection alone.
 *
 * Inferences based on the current backend:
 *   - INDIVIDUAL present => an InvestorProfile exists and primary is not CORPORATE.
 *   - CORPORATE present => primary is CORPORATE or corporate evidence exists.
 *
 * `isActiveMemberOfRequestedJointAccount` is deliberately left false: the
 * projection only carries a count, and JointMembershipGuard proves membership
 * per account. Assuming true would invent access; assuming false can only
 * under-report, which is why the Joint finding is advisory only.
 */
export function factsFromProjection(projection: ParityProjection | null | undefined): AccountFacts | null {
  if (!projection || !Array.isArray(projection.authorizedContexts)) return null;
  const contexts = projection.authorizedContexts;
  const hasCompanyDetails = Boolean(projection.companyName || projection.companyPhoneNumber);
  const isCorporatePrimary = projection.primaryAccountType === "CORPORATE";
  return {
    emailVerified: true,
    primaryAccountType: projection.primaryAccountType ?? null,
    // Only the backend-proven INDIVIDUAL context establishes profile presence;
    // an INDIVIDUAL primary classification alone no longer grants access.
    hasInvestorProfile: contexts.includes("INDIVIDUAL"),
    hasCorporateApplicantProfile: hasCompanyDetails || (isCorporatePrimary && contexts.includes("CORPORATE")),
    initiatedCorporateApplicationCount: contexts.includes("CORPORATE") ? 1 : 0,
    jointMembershipCount: projection.jointMembershipCount ?? 0,
    isActiveMemberOfRequestedJointAccount: false,
  };
}

/**
 * Defensive notice for a future inconsistent projection in which a Corporate
 * context is advertised but the known applicant classification would deny it.
 * The current backend no longer advertises this for primary INDIVIDUAL users.
 */
export const CORPORATE_CLASSIFICATION_NOTICE =
  "This account is recorded with Corporate details, but the Corporate portal is not available for its current classification. Corporate application and KYC document requests will be refused until the account record is reviewed. Contact Starfetch support — no documents were submitted or changed.";

export function shouldShowCorporateClassificationNotice(projection: ParityProjection | null | undefined): boolean {
  const facts = factsFromProjection(projection);
  if (!facts) return false;
  if (!facts.primaryAccountType && !facts.hasCorporateApplicantProfile) return false;
  return !backendServesSurface("corporateApplicant", facts);
}
