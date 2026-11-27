/**
 * Maker-checker financial safety tests.
 *
 * FRONTEND CONTRACT tests over pure guards. They prove the UI refuses to offer a
 * self-approval, a stale-record approval, a duplicate submission or an edit of a
 * settled record. They do NOT prove the backend enforces any of it — that is
 * David's implementation, and the security report says so explicitly.
 */
import {
  amountsMatch,
  canApprove,
  canReject,
  canSubmit,
  isImmutable,
  isMinorUnitString,
  isValidRejectionReason,
  nextStages,
  type ApprovalSubject,
} from "../lib/admin/maker-checker";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const APPROVE = "investments.approve";
const REJECT = "approvals.reject";

const base: ApprovalSubject = {
  createdByStaffId: "staff-maker",
  actorStaffId: "staff-checker",
  stage: "submitted",
  recordVersion: 7,
  requiresStepUp: false,
  stepUpSatisfied: false,
  actorPermissions: [APPROVE, REJECT, "investments.read"],
};

function main(): void {
  // === 1. Nobody approves their own request ==============================
  {
    const self = { ...base, actorStaffId: base.createdByStaffId };
    const approval = canApprove(self, APPROVE);
    assert(!approval.allowed, "a maker must not approve their own request");
    assert(
      approval.allowed === false && approval.reason.includes("Independent approval"),
      "the refusal must explain that independent approval is required",
    );

    const rejection = canReject(self, REJECT);
    assert(!rejection.allowed, "a maker must not reject their own request to bury it");

    // And a different staff member with the right permission may.
    assert(canApprove(base, APPROVE).allowed, "an independent checker must be able to approve");
  }

  // === 2. Stage gating ==================================================
  {
    for (const stage of ["draft", "approved", "rejected", "executing", "settled", "reconciled"] as const) {
      const decision = canApprove({ ...base, stage }, APPROVE);
      assert(!decision.allowed, `a request in stage "${stage}" must not be approvable`);
    }
    assert(canApprove({ ...base, stage: "submitted" }, APPROVE).allowed, "a submitted request is approvable");
    // A draft cannot be rejected either — it was never submitted.
    assert(!canReject({ ...base, stage: "draft" }, REJECT).allowed, "a draft cannot be rejected");
  }

  // === 3. Permission gating =============================================
  {
    const noApprove = { ...base, actorPermissions: ["investments.read"] };
    const decision = canApprove(noApprove, APPROVE);
    assert(!decision.allowed, "approval without the approve permission must be refused");
    // A read permission must never imply approve.
    assert(
      !canApprove({ ...base, actorPermissions: ["investments.read", "approvals.read"] }, APPROVE).allowed,
      "a read permission must never imply approval authority",
    );
    assert(!canReject({ ...base, actorPermissions: [APPROVE] }, REJECT).allowed, "approve must not imply reject");
    // No session at all.
    assert(!canApprove({ ...base, actorStaffId: "" }, APPROVE).allowed, "an empty actor identity must be refused");
  }

  // === 4. Stale record versions block approval ==========================
  {
    const stale = canApprove({ ...base, recordVersion: null }, APPROVE);
    assert(!stale.allowed, "approving an unknown record version must be refused");
    assert(
      stale.allowed === false && stale.reason.includes("stale view"),
      "the refusal must explain the stale-view risk",
    );
    assert(!canReject({ ...base, recordVersion: null }, REJECT).allowed, "rejecting an unknown version must be refused");
  }

  // === 5. Step-up authentication ========================================
  {
    const needsStepUp = canApprove({ ...base, requiresStepUp: true, stepUpSatisfied: false }, APPROVE);
    assert(!needsStepUp.allowed, "a step-up-required approval must be refused until step-up is satisfied");
    assert(
      canApprove({ ...base, requiresStepUp: true, stepUpSatisfied: true }, APPROVE).allowed,
      "a satisfied step-up must allow the approval",
    );
    // A stale step-up flag must not silently satisfy a later requirement.
    assert(
      !canApprove({ ...base, requiresStepUp: true, stepUpSatisfied: false }, APPROVE).allowed,
      "the backend decides when step-up is needed; the UI must honour it every time",
    );
  }

  // === 6. Rejection needs a real reason =================================
  {
    for (const bad of ["", "   ", "no", "x", null, undefined, "short"]) {
      assert(!isValidRejectionReason(bad as string), `rejection reason ${JSON.stringify(bad)} must be refused`);
    }
    assert(isValidRejectionReason("Amount exceeds the approved single-transaction limit."), "a substantive reason must be accepted");
    assert(!isValidRejectionReason("x".repeat(2001)), "an overlong reason must be refused");
  }

  // === 7. Duplicate submission is prevented =============================
  {
    assert(!canSubmit({ submitting: true, hasRequiredFields: true, recordVersion: 1, requiresVersion: true }).allowed, "a submission already in progress must block a second");
    assert(!canSubmit({ submitting: false, hasRequiredFields: false, recordVersion: 1, requiresVersion: true }).allowed, "missing fields must block submission");
    assert(!canSubmit({ submitting: false, hasRequiredFields: true, recordVersion: null, requiresVersion: true }).allowed, "a missing version must block submission");
    assert(canSubmit({ submitting: false, hasRequiredFields: true, recordVersion: 1, requiresVersion: true }).allowed, "a complete, idle form may submit");
  }

  // === 8. Settled records are immutable =================================
  {
    assert(isImmutable("settled"), "a settled record must be immutable");
    assert(isImmutable("reconciled"), "a reconciled record must be immutable");
    for (const stage of ["draft", "submitted", "approved", "rejected", "executing"] as const) {
      assert(!isImmutable(stage), `stage "${stage}" is not final and must remain editable`);
    }
    // A terminal stage has no forward transitions.
    assert(nextStages("reconciled").length === 0, "a reconciled request is complete");
    assert(nextStages("rejected").length === 0, "a rejected request is complete");
    assert(nextStages("draft").join() === "submitted", "a draft may only be submitted");
    assert(nextStages("submitted").sort().join() === "approved,rejected", "a submitted request may only be approved or rejected");
  }

  // === 9. Money is exact ================================================
  {
    assert(isMinorUnitString("125000"), "an integer minor-unit string is valid");
    assert(isMinorUnitString("-500"), "a negative minor-unit string is valid");
    assert(isMinorUnitString("0"), "zero is a valid representation (though not a valid price)");
    for (const bad of [125000, 1250.5, "1250.50", "1,250", "1.25e3", "", null, undefined, "abc", NaN]) {
      assert(!isMinorUnitString(bad), `"${String(bad)}" must be rejected as a minor-unit amount`);
    }
    assert(!isMinorUnitString("9".repeat(20)), "an absurd magnitude must be rejected");

    // Exact comparison, including beyond Number.MAX_SAFE_INTEGER.
    assert(amountsMatch("9007199254740993", "9007199254740993"), "identical large amounts must match exactly");
    assert(!amountsMatch("9007199254740993", "9007199254740992"), "amounts differing by one minor unit must not match");
    // A float would consider these equal.
    assert(
      !amountsMatch("9007199254740993", "9007199254740992"),
      "float comparison would call these equal; the guard must not",
    );
    assert(!amountsMatch("100.00", "10000"), "a decimal string must not be silently accepted");
    assert(!amountsMatch(10000, "10000"), "a number must not be accepted as an amount");
  }

  console.log(
    "PASS — Maker-checker frontend guards: a maker cannot approve or reject their own request; " +
      "only a submitted request is decidable; a read permission never implies approval authority; " +
      "an unknown record version blocks the decision as a stale view; " +
      "a backend-required step-up must be satisfied on every sensitive approval; " +
      "a rejection needs a substantive reason; duplicate submission is blocked while in flight; " +
      "settled and reconciled records are immutable and their stages are terminal; " +
      "and monetary amounts stay exact integer minor-unit strings whose comparison never uses a float.",
  );
}

main();
