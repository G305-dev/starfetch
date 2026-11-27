/**
 * MAKER-CHECKER RULES — pure, testable frontend guards.
 *
 * The frontend cannot enforce maker-checker. David's backend must, and it must do
 * so independently of anything the browser sends. What the frontend CAN do is
 * refuse to offer an action it knows is invalid, so an operator is never invited
 * to do something the backend will reject — and, more importantly, so the UI
 * never implies a self-approval succeeded.
 *
 * These rules are deliberately conservative. Where the frontend is unsure of a
 * backend fact (whether a step-up is required, whether a record version matches)
 * it treats the action as unavailable rather than assuming it is fine.
 *
 * PROPOSED — see ADMIN_MAKER_CHECKER_WORKFLOWS.md.
 */

/**
 * The stages every sensitive financial workflow passes through. The brief names
 * seven; they are modelled explicitly so no UI can skip one.
 */
export const WORKFLOW_STAGES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "executing",
  "settled",
  "reconciled",
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

/** A request as the frontend understands it. All identity fields are backend-supplied. */
export type ApprovalSubject = {
  /** Who created the request. Backend-supplied; never inferred from the browser. */
  createdByStaffId: string;
  /** Who would be recording this decision. From the verified staff session. */
  actorStaffId: string;
  stage: WorkflowStage;
  /** Record version for optimistic concurrency. */
  recordVersion: number | null;
  /** Whether the backend says a step-up authentication is required. */
  requiresStepUp: boolean;
  /** Set when the operator has completed a fresh step-up in this session. */
  stepUpSatisfied: boolean;
  /** Permissions the actor actually holds (backend-confirmed). */
  actorPermissions: readonly string[];
};

export type Decision = { allowed: true } | { allowed: false; reason: string };

const DENY = (reason: string): Decision => ({ allowed: false, reason });
const ALLOW: Decision = { allowed: true };

/**
 * Whether the actor may APPROVE this request.
 *
 * Checks, in order of how badly each failure would matter:
 *  1. Self-approval — the single most important rule.
 *  2. Stage — only a submitted request can be approved.
 *  3. Permission — a granular approve key, not a broad read key.
 *  4. Record version — approving a stale view is approving the wrong thing.
 *  5. Step-up — required when the backend says so.
 */
export function canApprove(subject: ApprovalSubject, approvePermission: string): Decision {
  if (!subject.actorStaffId) return DENY("No verified staff session.");
  if (subject.createdByStaffId === subject.actorStaffId) {
    return DENY("You created this request. Independent approval by another officer is required.");
  }
  if (subject.stage !== "submitted") {
    return DENY(
      subject.stage === "draft"
        ? "This request has not been submitted for approval yet."
        : `This request is ${subject.stage} and cannot be approved again.`,
    );
  }
  if (!subject.actorPermissions.includes(approvePermission)) {
    return DENY("Your staff role does not include approval authority for this operation.");
  }
  if (subject.recordVersion === null) {
    return DENY("The record version is unknown. Reload the request before deciding — approving a stale view could approve the wrong amount.");
  }
  if (subject.requiresStepUp && !subject.stepUpSatisfied) {
    return DENY("Re-authenticate to continue. This approval requires a fresh identity check.");
  }
  return ALLOW;
}

/**
 * Whether the actor may REJECT.
 *
 * A rejection is a decision with consequence, so it needs the same independence
 * rule: an operator who created a request should not be able to destroy it to
 * hide an error. A backend administrator may need a controlled path to withdraw
 * their own draft — that belongs in a separate, audited operation, not here.
 */
export function canReject(subject: ApprovalSubject, rejectPermission: string): Decision {
  if (!subject.actorStaffId) return DENY("No verified staff session.");
  if (subject.createdByStaffId === subject.actorStaffId) {
    return DENY("You created this request. Withdrawal is a separate audited operation, not a rejection.");
  }
  if (subject.stage !== "submitted") return DENY("Only a submitted request can be rejected.");
  if (!subject.actorPermissions.includes(rejectPermission)) {
    return DENY("Your staff role does not include rejection authority for this operation.");
  }
  if (subject.recordVersion === null) return DENY("The record version is unknown. Reload before deciding.");
  return ALLOW;
}

/**
 * A rejection requires a reason. An empty or trivially short reason makes the
 * audit trail useless, which is the whole point of recording it.
 */
export function isValidRejectionReason(reason: string | null | undefined): boolean {
  if (typeof reason !== "string") return false;
  const trimmed = reason.trim();
  // Not a real editorial standard — a floor that stops "no", "x" and "".
  return trimmed.length >= 10 && trimmed.length <= 2000;
}

/**
 * Whether the UI may submit a request at all.
 *
 * Duplicate submission is a genuine money risk: a double-click on "request
 * withdrawal" that creates two requests is not a cosmetic bug. The frontend
 * disables the control while pending; the backend must additionally enforce
 * idempotency, because the frontend cannot be trusted to have done so.
 */
export function canSubmit(precondition: {
  submitting: boolean;
  hasRequiredFields: boolean;
  recordVersion: number | null;
  requiresVersion: boolean;
}): Decision {
  if (precondition.submitting) return DENY("A submission is already in progress.");
  if (!precondition.hasRequiredFields) return DENY("Complete the required fields before submitting.");
  if (precondition.requiresVersion && precondition.recordVersion === null) {
    return DENY("The record has not been loaded. Reload before submitting.");
  }
  return ALLOW;
}

/**
 * Whether a settled or reconciled record may still be edited.
 *
 * It may not. Corrections go through a controlled reversal that creates a new
 * record and preserves the original — never an in-place edit of something that
 * has already moved money.
 */
export function isImmutable(stage: WorkflowStage): boolean {
  return stage === "settled" || stage === "reconciled";
}

/** The stages a maker-checker request may move to from here. */
export function nextStages(from: WorkflowStage): WorkflowStage[] {
  switch (from) {
    case "draft":
      return ["submitted"];
    case "submitted":
      return ["approved", "rejected"];
    case "approved":
      return ["executing"];
    case "executing":
      return ["settled"];
    case "settled":
      return ["reconciled"];
    case "rejected":
    case "reconciled":
      return [];
  }
}

/**
 * A money amount must never be coerced through a float.
 *
 * The portal receives minor-unit integer strings. Anything else — a float, a
 * number, a string with a decimal point — is rejected rather than rounded,
 * because a rounding error here is a real financial misstatement.
 */
export function isMinorUnitString(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (!/^-?\d+$/.test(value)) return false;
  // Reject absurd magnitudes rather than letting BigInt arithmetic on a typo.
  return value.replace("-", "").length <= 19;
}

/**
 * Whether two amounts are equal, exactly. Used by confirmation dialogs to verify
 * the amount the operator typed matches the amount being approved.
 */
export function amountsMatch(typed: unknown, expectedMinor: unknown): boolean {
  if (!isMinorUnitString(typed) || !isMinorUnitString(expectedMinor)) return false;
  try {
    return BigInt(typed as string) === BigInt(expectedMinor as string);
  } catch {
    return false;
  }
}
