import type { IndividualKycWorkflowStatus } from "./api/client";

/** Show the Individual dashboard reminder only while the backend still reports a draft. */
export function shouldShowIndividualKycPrompt(status: IndividualKycWorkflowStatus | null | undefined): boolean {
  return status === "DRAFT";
}
