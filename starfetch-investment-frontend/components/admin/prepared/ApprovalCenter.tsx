"use client";

/**
 * APPROVAL CENTER — prepared interface.
 *
 * The queue, the request detail, the evidence a checker inspects, the decision
 * dialogs and the step-up states.
 *
 * This is the section where a frontend can most easily lie: an "Approve" button
 * that appears to succeed when nothing happened would be catastrophic, because the
 * staff member would stop chasing the request. So every decision path here ends in
 * a control that is disabled until the contract is live, and the dialog says why.
 *
 * The maker-checker rules are NOT re-implemented in this component. They live in
 * `lib/admin/maker-checker.ts` and `decisionReadiness` in `lib/admin/prepared.ts`,
 * both tested. This file only renders their verdict.
 */

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Filter,
  GitCompareArrows,
  HelpCircle,
  Inbox,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import {
  APPROVAL_TYPES,
  approvalTypeLabel,
  decisionReadiness,
  emptyApprovalFilter,
  matchesApprovalFilter,
  requiresStepUp,
  stepUpState,
  type ApprovalType,
  type ContractState,
} from "@/lib/admin/prepared";
import { canApprove, canReject, type ApprovalSubject, type WorkflowStage } from "@/lib/admin/maker-checker";
import { PERMISSIONS } from "@/lib/admin-api/contracts";
import {
  Card,
  DataTable,
  EvidenceBlock,
  FieldGrid,
  InertNote,
  IntegrationBadge,
  Modal,
  PreparedAction,
  SectionHeading,
  StatusPill,
  StepUpPanel,
  Toolbar,
  button,
  input,
  secondary,
  type Column,
} from "./UI";

const NOW = "2026-11-17T09:00:00.000Z";

/** A queued approval as the backend will return it. None exist yet. */
type ApprovalRow = {
  id: string;
  reference: string;
  type: ApprovalType;
  stage: WorkflowStage;
  submittedBy: string;
  submittedAt: string;
  recordVersion: number;
  amountMinor: string | null;
  currency: string | null;
};

const STAGE_TONE = {
  draft: "neutral",
  submitted: "caution",
  approved: "positive",
  rejected: "danger",
  executing: "info",
  settled: "positive",
  reconciled: "positive",
} as const;

export function ApprovalCenter({
  contract,
  permissions,
  actorStaffId,
  initialDecision = null,
}: {
  contract: ContractState;
  permissions: string[];
  /** The signed-in staff member. Used by the maker-checker guards, never trusted alone. */
  actorStaffId: string;
  /** Pre-opened request, so a render test can inspect the decision dialog. */
  initialDecision?: ApprovalRow | null;
}) {
  const [filter, setFilter] = useState(emptyApprovalFilter());
  const [selected, setSelected] = useState<ApprovalRow | null>(initialDecision);

  // The backend has returned no records, so there are none. No samples.
  const rows: ApprovalRow[] = [];

  const visible = useMemo(() => rows.filter((row) => matchesApprovalFilter(row, filter)), [rows, filter]);

  const columns: Column<ApprovalRow>[] = [
    {
      key: "reference",
      header: "Reference",
      sortable: true,
      sortValue: (r) => r.reference,
      render: (r) => (
        <div>
          <p className="font-bold text-star-900">{r.reference}</p>
          <p className="text-[11px] text-star-muted">{approvalTypeLabel(r.type)}</p>
        </div>
      ),
    },
    {
      key: "submittedBy",
      header: "Submitted by",
      sortable: true,
      sortValue: (r) => r.submittedBy,
      render: (r) => (
        <div>
          <p>{r.submittedBy}</p>
          <p className="text-[11px] text-star-muted">{r.submittedAt}</p>
        </div>
      ),
    },
    {
      key: "stage",
      header: "Stage",
      sortable: true,
      sortValue: (r) => r.stage,
      render: (r) => <StatusPill tone={STAGE_TONE[r.stage]}>{r.stage}</StatusPill>,
    },
    {
      key: "stepUp",
      header: "Reauth",
      render: (r) =>
        requiresStepUp(r.type) ? <StatusPill tone="caution">Required</StatusPill> : <span className="text-[11px] text-star-muted">Not required</span>,
    },
    {
      key: "action",
      header: "Action",
      render: (r) => (
        <button type="button" className="font-bold text-star-700 underline" onClick={() => setSelected(r)}>
          Review
        </button>
      ),
    },
  ];

  const submittedCount = rows.filter((r) => r.stage === "submitted").length;

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeading
          title="Approval Center"
          description="Every request awaiting an independent decision, in one queue. A request you submitted yourself cannot be approved or rejected by you, regardless of your permissions."
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IntegrationBadge />
          <StatusPill tone="neutral">{submittedCount} awaiting decision</StatusPill>
        </div>
        <p className="mt-3 rounded-lg border border-star-200 bg-star-50 p-3 text-[11px] leading-4 text-star-900">
          The queue is empty because the approvals endpoint has not been approved. No example requests are shown:
          a checker must never see a fabricated request alongside real ones.
        </p>
      </Card>

      <Toolbar
        search={filter.search}
        onSearch={(search) => setFilter({ ...filter, search })}
        placeholder="Search by reference, submitter or type"
        filters={[
          {
            key: "type",
            label: "Request type",
            value: filter.type,
            onChange: (type) => setFilter({ ...filter, type: type as ApprovalType | "" }),
            options: [{ value: "", label: "All request types" }, ...APPROVAL_TYPES.map((t) => ({ value: t, label: approvalTypeLabel(t) }))],
          },
          {
            key: "stage",
            label: "Stage",
            value: filter.stage,
            onChange: (stage) => setFilter({ ...filter, stage }),
            options: [
              { value: "", label: "All stages" },
              { value: "submitted", label: "Awaiting decision" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
              { value: "settled", label: "Settled" },
            ],
          },
        ]}
      />

      <Card>
        <DataTable<ApprovalRow>
          caption="Approval queue"
          columns={columns}
          rows={visible}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelected(r)}
          emptyTitle={rows.length === 0 ? "No approvals to review" : "No records match your filters"}
          emptyDetail={
            rows.length === 0
              ? "Requests appear here once the backend approvals contract is approved and makers begin submitting. Nothing is invented to fill the queue."
              : "Adjust the search or filters to see more requests."
          }
        />
      </Card>

      {selected && (
        <DecisionDialog
          row={selected}
          contract={contract}
          permissions={permissions}
          actorStaffId={actorStaffId}
          close={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * The decision dialog.
 *
 * Order of truth:
 *   1. maker-checker guards decide whether this staff member may act at all
 *   2. record readiness decides whether the dialog is complete
 *   3. the contract decides whether the action can be sent
 *
 * The first two produce a reason that is shown to the user. The third is stated
 * separately, because "you are not allowed to decide this" and "the system cannot
 * accept decisions yet" are different problems with different remedies.
 */
function DecisionDialog({
  row,
  contract,
  permissions,
  actorStaffId,
  close,
}: {
  row: ApprovalRow;
  contract: ContractState;
  permissions: string[];
  actorStaffId: string;
  close: () => void;
}) {
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [reason, setReason] = useState("");
  const [stepUpSatisfied, setStepUpSatisfied] = useState(false);

  const subject: ApprovalSubject = {
    createdByStaffId: row.submittedBy,
    actorStaffId,
    stage: row.stage,
    recordVersion: row.recordVersion,
    requiresStepUp: requiresStepUp(row.type),
    stepUpSatisfied,
    actorPermissions: permissions,
  };

  const guard =
    action === "approve" ? canApprove(subject, PERMISSIONS.approvalsApprove) : canReject(subject, PERMISSIONS.approvalsReject);

  const readiness = decisionReadiness({
    action,
    type: row.type,
    reason,
    stepUpSatisfied,
    contract,
  });

  const stepUp = stepUpState(requiresStepUp(row.type), stepUpSatisfied, contract);

  // The guard refuses for several different reasons, and they are not the same
  // problem. A missing step-up is resolved by reauthenticating; a maker trying to
  // decide their own request, or a staff member without the permission, is not
  // resolvable from this dialog at all. Treating them identically would tell a
  // legitimate checker "you cannot decide this" when they merely need to
  // reauthenticate.
  // The guard reports a missing step-up with "Re-authenticate to continue…". Match
  // that specific refusal so it is routed to the step-up panel instead of the red
  // authority block, which would otherwise tell a legitimate checker they have no
  // authority when they simply need to reauthenticate.
  const needsStepUpOnly =
    requiresStepUp(row.type) &&
    !stepUpSatisfied &&
    guard.allowed === false &&
    /re-?authenticate|identity check/i.test(guard.reason);
  const blockedByAuthority = !guard.allowed && !needsStepUpOnly;

  return (
    <Modal title="Review request" close={close}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={STAGE_TONE[row.stage]}>{row.stage}</StatusPill>
          <StatusPill tone="neutral">{approvalTypeLabel(row.type)}</StatusPill>
          {requiresStepUp(row.type) && <StatusPill tone="caution">Reauthentication required</StatusPill>}
        </div>

        <FieldGrid
          rows={[
            ["Reference", <code key="r" className="text-xs">{row.reference}</code>],
            ["Submitted by", row.submittedBy],
            ["Submitted at", row.submittedAt],
            ["Record version", String(row.recordVersion)],
            ["Amount", row.amountMinor != null ? `${row.amountMinor} minor units ${row.currency ?? ""}`.trim() : "No monetary value"],
            ["Stage", row.stage],
          ]}
        />

        <EvidenceBlock
          title="Evidence supplied by the backend"
          contract={contract}
          items={[
            { label: "Supporting documents", value: "Not supplied" },
            { label: "Funding confirmation", value: "Not supplied" },
            { label: "Change history", value: "Not supplied" },
            { label: "Maker’s note", value: "Not supplied" },
          ]}
        />

        {/* Step 1 — authority. Distinct from step-up, which has its own panel. */}
        {blockedByAuthority && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <ShieldAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-red-700" />
            <div>
              <p className="text-xs font-extrabold text-red-900">You cannot decide this request</p>
              <p className="mt-0.5 text-[11px] leading-4 text-red-800">
                {guard.allowed === false ? guard.reason : "This decision is not available to your account."}
              </p>
            </div>
          </div>
        )}

        {/* Step 2 — step-up. */}
        {!blockedByAuthority && stepUp.show && (
          <StepUpPanel
            satisfied={stepUpSatisfied}
            contract={contract}
            method={requiresStepUp(row.type) ? "passkey" : "totp"}
            onVerify={() => setStepUpSatisfied(true)}
          />
        )}

        {/* Step 3 — the decision itself. */}
        <div className="rounded-lg border border-[#e7ece7] p-3">
          <p className="text-xs font-extrabold text-star-900">Your decision</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAction("approve")}
              aria-pressed={action === "approve"}
              className={
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold " +
                (action === "approve" ? "border-star-700 bg-star-50 text-star-900" : "border-star-200 bg-white text-star-muted")
              }
              disabled={blockedByAuthority}
            >
              <ThumbsUp size={13} aria-hidden="true" /> Approve
            </button>
            <button
              type="button"
              onClick={() => setAction("reject")}
              aria-pressed={action === "reject"}
              className={
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold " +
                (action === "reject" ? "border-red-300 bg-red-50 text-red-900" : "border-star-200 bg-white text-star-muted")
              }
              disabled={blockedByAuthority}
            >
              <ThumbsDown size={13} aria-hidden="true" /> Reject
            </button>
          </div>

          {action === "reject" && (
            <label className="mt-3 block text-xs font-bold">
              Reason for rejection <span className="text-red-700">(required)</span>
              <textarea
                className={input + " mt-1 font-normal"}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={2000}
                placeholder="Explain why this request is being refused. This is recorded in the audit log."
                disabled={blockedByAuthority}
              />
              <span className="mt-1 block text-[11px] font-normal text-star-muted">
                {reason.trim().length}/2000 · minimum 8 characters
              </span>
            </label>
          )}

          {!blockedByAuthority && action === "approve" && (
            <p className="mt-3 rounded-lg border border-[#e7ece7] bg-[#f8faf7] p-2 text-[11px] leading-4 text-star-muted">
              Approving records an independent decision. It does not execute the request — execution is a separate
              backend action with its own funding verification.
            </p>
          )}
        </div>

        {!blockedByAuthority && !readiness.allowed && readiness.reason && (
          <p className="text-[11px] leading-4 text-amber-800">{readiness.reason}</p>
        )}

        <InertNote contract={contract} />

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#e7ece7] pt-4">
          <button type="button" className={secondary} onClick={close}>
            <XCircle size={14} aria-hidden="true" /> Close
          </button>
          <PreparedAction
            contract={contract}
            variant={action === "reject" ? "secondary" : "primary"}
            disabled={blockedByAuthority || !readiness.allowed}
            reason={!readiness.allowed ? readiness.reason : guard.allowed === false ? guard.reason : undefined}
          >
            {action === "approve" ? (
              <>
                <CheckCircle2 size={14} aria-hidden="true" /> Record approval
              </>
            ) : (
              <>
                <ThumbsDown size={14} aria-hidden="true" /> Record rejection
              </>
            )}
          </PreparedAction>
        </div>
      </div>
    </Modal>
  );
}
