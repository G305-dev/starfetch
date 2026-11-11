/**
 * Corporate O2/O3/O4/O11 client contract.
 *
 * These types mirror the approved OpenAPI v0.6.0 safe browser projections.
 * They contain no plaintext TIN, actor data, evidence, document rules, staff
 * decision, submission, approval, or investment-authorisation projection.
 */

export const corporateApplicationStates = ["DRAFT", "SUBMITTED", "IN_REVIEW", "INFO_REQUESTED", "APPROVED", "REJECTED"] as const;
export type CorporateApplicationState = (typeof corporateApplicationStates)[number];

/** Exact O2 body: only these six fields may be transmitted on create. */
export type CorporateDraftInput = {
  institutionName: string;
  dateOfIncorporation: string;
  rcNumber: string;
  taxIdentificationNumber: string;
  businessPhoneNumber: string;
  businessEmail: string;
};

export const corporateEditableFieldNames = ["institutionName", "dateOfIncorporation", "rcNumber", "taxIdentificationNumber", "businessPhoneNumber", "businessEmail"] as const;
export type CorporateEditableFieldName = (typeof corporateEditableFieldNames)[number];

/** Exact O4 body: non-empty changed subset of the original six fields only. */
export type CorporateDraftPatch = Partial<CorporateDraftInput>;

/** O2 201 receipt. corporateAccountId, never applicationId, addresses O3/O4/O11. */
export type CorporateApplicationReceipt = { corporateAccountId: string; applicationId: string; applicationStatus: "DRAFT"; detailsVersion: 1 };

/** Exact safe O3/O4 details projection. TIN is backend-masked or null, never plaintext. */
export type CorporateApplicationDetails = {
  institutionName: string;
  dateOfIncorporation: string;
  rcNumber: string;
  businessPhoneNumber: string;
  businessEmail: string;
  taxIdentificationNumberMasked: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

/** Exact owner-scoped O3 read projection. This is not an editable form shape. */
export type CorporateOnboardingRecord = {
  corporateAccountId: string;
  applicationId: string;
  status: CorporateApplicationState;
  createdAt: string;
  updatedAt: string;
  details: CorporateApplicationDetails;
};

/** Exact O4 response. The root has no application created/updated timestamps. */
export type CorporateDraftUpdateResult = {
  corporateAccountId: string;
  applicationId: string;
  status: CorporateApplicationState;
  details: CorporateApplicationDetails;
};

/** Exact owner-scoped discovery row. It deliberately contains no business details. */
export type CorporateApplicationDiscoveryItem = {
  corporateAccountId: string;
  applicationId: string;
  status: CorporateApplicationState;
  detailsVersion: number;
  createdAt: string;
  updatedAt: string;
  accessVia: "INITIATING_APPLICANT";
};

/** Exact permitted lifecycle event from O11. */
export type CorporateApplicationHistoryItem = {
  id: string;
  event: "CREATED";
  fromStatus: CorporateApplicationState | null;
  toStatus: CorporateApplicationState;
  createdAt: string;
};

/** O11 safe amendment metadata; prior values, TIN/envelope, and actors are absent. */
export type CorporateDetailsAmendment = {
  version: number;
  changedFieldNames: CorporateEditableFieldName[];
  changedAt: string;
};

/** Exact owner-scoped O11 projection, ordered oldest first by the backend. */
export type CorporateApplicationHistory = {
  corporateAccountId: string;
  applicationId: string;
  history: CorporateApplicationHistoryItem[];
  detailsAmendments: CorporateDetailsAmendment[];
};

export const corporateSnapshotIssueCodes = ["SNAPSHOT_MISSING", "ACCOUNT_KIND_CHANGED", "CORPORATE_DETAILS_VERSION_CHANGED", "JOINT_MEMBERSHIP_VERSION_CHANGED"] as const;
export type CorporateSnapshotIssueCode = (typeof corporateSnapshotIssueCodes)[number];

/** Read-only snapshot source-freshness signal. It is not verification or approval. */
export type CorporateSnapshotFreshness = {
  applicationId: string;
  snapshotId: string | null;
  generation: number | null;
  isFresh: boolean;
  issues: CorporateSnapshotIssueCode[];
};

export type CorporateDocumentStatus = "REQUIRED" | "MISSING" | "SUBMITTED" | "UNDER_REVIEW" | "REJECTED";
/** Reserved for a later approved ruleset; the frontend supplies no defaults. */
export type CorporateDocumentRequirement = { documentId: string; label: string; required: boolean; status: CorporateDocumentStatus; acceptedMimeTypes?: string[]; maxSizeBytes?: number; canReplace?: boolean; rejectionReason?: string | null };

export type CorporateApplicationDisplay = { label: string; detail: string; tone: "neutral" | "pending" | "warning" | "positive" | "negative"; nextAction: string };

export const corporateApplicationStateDisplay: Record<CorporateApplicationState, CorporateApplicationDisplay> = {
  DRAFT: { label: "Application not yet submitted", detail: "Your Corporate application is a draft and has not entered Starfetch review.", tone: "neutral", nextAction: "You may amend approved business fields only while editing remains permitted." },
  SUBMITTED: { label: "Awaiting review", detail: "Starfetch has received the application and it is awaiting review.", tone: "pending", nextAction: "No action is required unless Starfetch requests more information through an approved workflow." },
  IN_REVIEW: { label: "Under review", detail: "Starfetch is reviewing the application.", tone: "pending", nextAction: "Wait for a review update or an approved request for information." },
  INFO_REQUESTED: { label: "Additional information required", detail: "Starfetch needs more information before review can continue.", tone: "warning", nextAction: "You may amend approved business fields only through this secure draft workflow." },
  APPROVED: { label: "Application approved", detail: "The application is approved, subject to any other applicable account-activation restrictions.", tone: "positive", nextAction: "Follow an approved next action for this account when supplied." },
  REJECTED: { label: "Application not approved", detail: "Starfetch has not approved this application.", tone: "negative", nextAction: "Follow approved Starfetch guidance when supplied." },
};

export function getCorporateApplicationDisplay(state: CorporateApplicationState) { return corporateApplicationStateDisplay[state]; }
export function isCorporateDraftEditable(state: CorporateApplicationState) { return state === "DRAFT" || state === "INFO_REQUESTED"; }

export function maskCorporateValue(value: string, visibleCharacters = 4) {
  const compact = value.replace(/\s/g, "");
  if (!compact) return "Not available";
  if (compact.length <= visibleCharacters) return "•".repeat(compact.length);
  return `${"•".repeat(Math.max(4, compact.length - visibleCharacters))}${compact.slice(-visibleCharacters)}`;
}

/** Contract availability, not deployment health. O2 remains server feature-gated. */
export const corporateApiAvailability = {
  draftCreation: "FEATURE_GATED",
  applicationDiscovery: "AVAILABLE",
  applicationRead: "AVAILABLE",
  draftAmendment: "AVAILABLE",
  applicationHistory: "AVAILABLE",
  snapshotFreshness: "AVAILABLE",
  snapshotGeneration: "STAGING_NOT_ENABLED_IN_UI",
  verificationEvidence: "UNAVAILABLE",
  documentRules: "UNAVAILABLE",
  documentUpload: "UNAVAILABLE",
  staffReview: "UNAVAILABLE",
} as const;

export interface CorporateApplicationAdapter {
  createDraft(input: CorporateDraftInput, idempotencyKey: string): Promise<CorporateApplicationReceipt>;
  listOwnApplications(): Promise<CorporateApplicationDiscoveryItem[]>;
  getOnboarding(corporateAccountId: string): Promise<CorporateOnboardingRecord>;
  updateDraft(corporateAccountId: string, detailsVersion: number, patch: CorporateDraftPatch): Promise<CorporateDraftUpdateResult>;
  getOnboardingHistory(corporateAccountId: string): Promise<CorporateApplicationHistory>;
  getSnapshotFreshness(corporateAccountId: string): Promise<CorporateSnapshotFreshness>;
}
