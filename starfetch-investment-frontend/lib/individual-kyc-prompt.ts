import type { IndividualKycProfile, IndividualKycWorkflowStatus } from "./api/client";

/**
 * Individual KYC prompt rules (frontend only).
 *
 * The backend remains the sole authority for KYC state. The dashboard reads
 * the authenticated `GET /api/v1/me/kyc-profile` response via
 * `getIndividualKycProfile()` and uses these helpers to decide whether the
 * "Complete your KYC" popup should appear after login.
 *
 * Rule:
 * - KYC submitted (SUBMITTED / UNDER_REVIEW / APPROVED / COMPLETE) -> no popup
 * - Anything else (DRAFT / REJECTED / INFO_REQUIRED / INFO_REQUESTED) -> popup
 * - Unknown / missing profile -> popup (fail-closed, handled by the component)
 */

export type KycPromptProfile = Pick<IndividualKycProfile, "status" | "submittedAt" | "sectionStatuses">;

/** Workflow states that mean the user has already submitted KYC. */
export const SUBMITTED_KYC_STATUSES: readonly IndividualKycWorkflowStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "COMPLETE",
];

/** Workflow states that mean a previously submitted KYC needs attention. */
export const KYC_NEEDS_ATTENTION_STATUSES: readonly IndividualKycWorkflowStatus[] = [
  "INFO_REQUIRED",
  "INFO_REQUESTED",
  "REJECTED",
];

/**
 * Returns true only when the backend confirms KYC has been submitted.
 * A null/undefined profile (not loaded yet, or load failed) is NOT submitted,
 * so the caller can fail closed and show the prompt.
 */
export function hasSubmittedIndividualKyc(profile: KycPromptProfile | null | undefined): boolean {
  if (!profile) return false;
  return SUBMITTED_KYC_STATUSES.includes(profile.status);
}

/** Returns true when the "Complete your KYC" popup should be shown. */
export function shouldShowIndividualKycPrompt(profile: KycPromptProfile | null | undefined): boolean {
  return !hasSubmittedIndividualKyc(profile);
}

/** Returns true when KYC was submitted before but now needs the user to act. */
export function isKycNeedsAttention(profile: KycPromptProfile | null | undefined): boolean {
  if (!profile) return false;
  return KYC_NEEDS_ATTENTION_STATUSES.includes(profile.status);
}

/** Counts KYC sections saved as COMPLETE (0-4). Used for the progress hint. */
export function completedKycSectionCount(profile: KycPromptProfile | null | undefined): number {
  if (!profile) return 0;
  const statuses = profile.sectionStatuses;
  return [statuses.personal, statuses.investmentProfile, statuses.sourceOfFunds, statuses.bankDetails].filter(
    (status) => status === "COMPLETE",
  ).length;
}
