"use client";

/**
 * THE REMAINING PREPARED SECTIONS.
 *
 * Documents, Support, Products, Maturity & Redemption, Finance & Reconciliation,
 * Reports & Statements, Campaigns, Audit & Security.
 *
 * All eight share one shape: a search/filter toolbar, a table with an honest empty
 * state, a detail panel, and confirmation dialogs for the actions that carry
 * consequence. They differ only in columns and vocabulary, so they are built from
 * the same primitives — which is also what keeps them looking like the seven
 * approved pages rather than like a bolted-on second product.
 *
 * Nothing here fetches. Every "record" collection is an empty array because the
 * backend has returned none, and each empty state explains which endpoint will
 * fill it. No sample row is ever rendered: a fabricated settlement in a finance
 * table is indistinguishable from a real one on a screenshot.
 */

import { useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Download,
  FileText,
  Landmark,
  Mail,
  Megaphone,
  Play,
  Plus,
  Scale,
  ShieldAlert,
  Ticket,
  Upload,
} from "lucide-react";
import { confirmationMatches, type ContractState } from "@/lib/admin/prepared";
import {
  Card,
  ConfirmDialog,
  DataTable,
  EvidenceBlock,
  FieldGrid,
  InertNote,
  IntegrationBadge,
  PreparedAction,
  SectionHeading,
  StatusPill,
  Toolbar,
  button,
  input,
  secondary,
  type Column,
} from "./UI";

// ===========================================================================
// Document Management
// ===========================================================================

export function DocumentManagement({ contract }: { contract: ContractState }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  type Doc = { id: string; name: string; category: string; investor: string; uploaded: string; state: string };
  const rows: Doc[] = [];

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeading
          title="Document Management"
          description="Investor and operational documents with access logging. Every view and download is recorded against a staff identity."
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IntegrationBadge />
          <StatusPill tone="caution">Access history not yet available</StatusPill>
        </div>
      </Card>

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search by document name or investor"
        filters={[
          {
            key: "category",
            label: "Category",
            value: category,
            onChange: setCategory,
            options: [
              { value: "", label: "All categories" },
              { value: "kyc", label: "KYC evidence" },
              { value: "statement", label: "Statements" },
              { value: "agreement", label: "Agreements" },
              { value: "corporate", label: "Corporate filings" },
            ],
          },
        ]}
        actions={
          <PreparedAction contract={contract} variant="secondary">
            <Upload size={14} aria-hidden="true" /> Upload document
          </PreparedAction>
        }
      />

      <Card>
        <DataTable<Doc>
          caption="Documents"
          columns={[
            {
              key: "name",
              header: "Document",
              sortable: true,
              sortValue: (r) => r.name,
              render: (r) => (
                <div className="flex items-center gap-2">
                  <FileText size={14} aria-hidden="true" className="shrink-0 text-star-muted" />
                  <div>
                    <p className="font-bold text-star-900">{r.name}</p>
                    <p className="text-[11px] text-star-muted">{r.category}</p>
                  </div>
                </div>
              ),
            },
            { key: "investor", header: "Investor", render: (r) => r.investor, sortable: true, sortValue: (r) => r.investor },
            { key: "uploaded", header: "Uploaded", render: (r) => r.uploaded, sortable: true, sortValue: (r) => r.uploaded },
            { key: "state", header: "State", render: (r) => <StatusPill tone="neutral">{r.state}</StatusPill> },
            {
              key: "action",
              header: "Action",
              render: (r) => (
                <button type="button" className="font-bold text-star-700 underline" onClick={() => setSelected(r.id)}>
                  Open
                </button>
              ),
            },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          emptyTitle="No documents available"
          emptyDetail="Documents are stored and listed by the backend. Nothing is listed until that endpoint is approved. Permanent public URLs are never generated — access is a short-lived grant so it can be logged."
        />
        <InertNote contract={contract} />
      </Card>

      {selected && (
        <DocumentPanel contract={contract} close={() => setSelected(null)} />
      )}
    </div>
  );
}

function DocumentPanel({ contract, close }: { contract: ContractState; close: () => void }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <SectionHeading title="Document detail" description="Metadata and access controls." />
        <button type="button" className={secondary} onClick={close}>
          Close
        </button>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <FieldGrid
          rows={[
            ["Document", "Not supplied"],
            ["Category", "Not supplied"],
            ["Investor", "Not supplied"],
            ["Uploaded", "Not supplied"],
            ["File size", "Not supplied"],
            ["Classification", "Not supplied"],
          ]}
        />
        <EvidenceBlock
          title="Access controls"
          contract={contract}
          items={[
            { label: "View grant", value: "Short-lived, per staff identity" },
            { label: "Download", value: "Requires an approved request" },
            { label: "Access log", value: "Not available" },
            { label: "Watermarking", value: "Applied by the backend" },
          ]}
        />
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <PreparedAction contract={contract} variant="secondary">
          <BadgeCheck size={13} aria-hidden="true" /> Request download
        </PreparedAction>
        <PreparedAction contract={contract}>Open viewer</PreparedAction>
      </div>
      <InertNote contract={contract} />
    </Card>
  );
}

// ===========================================================================
// Support & Complaints
// ===========================================================================

export function SupportComplaints({ contract }: { contract: ContractState }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  type Ticket = { id: string; reference: string; subject: string; investor: string; opened: string; status: string; priority: string };
  const rows: Ticket[] = [];

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeading
          title="Support & Complaints"
          description="Investor enquiries and formal complaints. Internal notes are kept structurally separate from the investor-visible thread."
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IntegrationBadge />
          <StatusPill tone="caution">Internal notes gated separately</StatusPill>
        </div>
        <p className="mt-3 rounded-lg border border-star-200 bg-star-50 p-3 text-[11px] leading-4 text-star-900">
          Internal notes require their own permission (<code>support.internal-notes.read</code>) and their own
          storage. They are never part of the investor-visible thread.
        </p>
      </Card>

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search by reference, subject or investor"
        filters={[
          {
            key: "status",
            label: "Status",
            value: status,
            onChange: setStatus,
            options: [
              { value: "", label: "All statuses" },
              { value: "open", label: "Open" },
              { value: "assigned", label: "Assigned" },
              { value: "escalated", label: "Escalated" },
              { value: "closed", label: "Closed" },
            ],
          },
        ]}
        actions={
          <PreparedAction contract={contract} variant="secondary">
            <Plus size={14} aria-hidden="true" /> Log enquiry
          </PreparedAction>
        }
      />

      <Card>
        <DataTable<Ticket>
          caption="Support tickets"
          columns={[
            {
              key: "reference",
              header: "Ticket",
              sortable: true,
              sortValue: (r) => r.reference,
              render: (r) => (
                <div className="flex items-center gap-2">
                  <Ticket size={14} aria-hidden="true" className="shrink-0 text-star-muted" />
                  <div>
                    <p className="font-bold text-star-900">{r.reference}</p>
                    <p className="text-[11px] text-star-muted">{r.subject}</p>
                  </div>
                </div>
              ),
            },
            { key: "investor", header: "Investor", render: (r) => r.investor, sortable: true, sortValue: (r) => r.investor },
            { key: "opened", header: "Opened", render: (r) => r.opened, sortable: true, sortValue: (r) => r.opened },
            { key: "priority", header: "Priority", render: (r) => <StatusPill tone="neutral">{r.priority}</StatusPill> },
            { key: "status", header: "Status", render: (r) => <StatusPill tone="caution">{r.status}</StatusPill> },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          emptyTitle="No tickets available"
          emptyDetail="The ticket queue is supplied by the backend. It is empty until the support contract is approved. No example complaints are shown, because a support agent might act on one."
        />
        <InertNote contract={contract} />
      </Card>
    </div>
  );
}

// ===========================================================================
// Products
// ===========================================================================

export function ProductManagement({ contract }: { contract: ContractState }) {
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);

  type Product = { id: string; name: string; type: string; state: string; rate: string; minimum: string; updated: string };
  const rows: Product[] = [];

  const lifecycle = [
    { stage: "Draft", permission: "products.draft", detail: "Authored by an investment manager. Not visible to investors." },
    { stage: "Approved", permission: "products.approve", detail: "Independently approved. Still not published." },
    { stage: "Published", permission: "products.publish", detail: "Visible on the public site. Rates are immutable once published." },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeading
          title="Product Management"
          description="Author, approve and publish investment products. Three distinct stages requiring three distinct permissions."
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IntegrationBadge />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {lifecycle.map((step, index) => (
            <div key={step.stage} className="rounded-lg border border-[#e7ece7] bg-[#f8faf7] p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-star-700 text-[9px] font-extrabold text-white">
                  {index + 1}
                </span>
                <p className="text-xs font-extrabold text-star-900">{step.stage}</p>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-star-muted">{step.detail}</p>
              <code className="mt-1.5 inline-block rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-star-700 ring-1 ring-star-200">
                {step.permission}
              </code>
            </div>
          ))}
        </div>
      </Card>

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search by product name"
        filters={[
          {
            key: "state",
            label: "State",
            value: state,
            onChange: setState,
            options: [
              { value: "", label: "All states" },
              { value: "draft", label: "Draft" },
              { value: "approved", label: "Approved" },
              { value: "published", label: "Published" },
              { value: "withdrawn", label: "Withdrawn" },
            ],
          },
        ]}
        actions={
          <PreparedAction contract={contract} variant="secondary">
            <Plus size={14} aria-hidden="true" /> New product
          </PreparedAction>
        }
      />

      <Card>
        <DataTable<Product>
          caption="Investment products"
          columns={[
            {
              key: "name",
              header: "Product",
              sortable: true,
              sortValue: (r) => r.name,
              render: (r) => (
                <div>
                  <p className="font-bold text-star-900">{r.name}</p>
                  <p className="text-[11px] text-star-muted">{r.type}</p>
                </div>
              ),
            },
            { key: "state", header: "State", render: (r) => <StatusPill tone="neutral">{r.state}</StatusPill>, sortable: true, sortValue: (r) => r.state },
            { key: "rate", header: "Rate", render: (r) => r.rate },
            { key: "minimum", header: "Minimum", render: (r) => r.minimum },
            { key: "updated", header: "Updated", render: (r) => r.updated, sortable: true, sortValue: (r) => r.updated },
            {
              key: "action",
              header: "Action",
              render: (r) => (
                <button type="button" className="font-bold text-star-700 underline" onClick={() => setConfirm(r.id)}>
                  Request rate change
                </button>
              ),
            },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          emptyTitle="No products available"
          emptyDetail="Products are supplied by the backend. A rate is never computed or estimated here — it is displayed exactly as the backend returns it."
        />
        <InertNote contract={contract} />
      </Card>

      {confirm && (
        <ConfirmDialog
          title="Request a rate change"
          reference="RATE-CHANGE"
          consequence="A rate change must be independently approved before it takes effect, and a published product's rate cannot be edited directly. This dialog is a review step."
          confirmLabel="Submit rate change request"
          contract={contract}
          requireRetype={false}
          onConfirm={() => setConfirm(null)}
          close={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ===========================================================================
// Maturity & Redemption
// ===========================================================================

export function MaturityRedemption({ contract }: { contract: ContractState }) {
  const [search, setSearch] = useState("");
  const [window, setWindow] = useState("30");
  const [settle, setSettle] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  type Maturity = { id: string; reference: string; investor: string; product: string; maturesOn: string; amount: string; state: string };
  const rows: Maturity[] = [];

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeading
          title="Maturity & Redemption"
          description="Instruments approaching maturity, settlement verification, redemptions and rollovers."
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IntegrationBadge />
        </div>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900">
            <AlertTriangle size={13} aria-hidden="true" /> Matured is not settled
          </p>
          <p className="mt-1 text-[11px] leading-4 text-amber-900">
            A holding whose maturity date has passed is matured, not settled. Settlement is only recorded once the
            backend confirms funding. This screen never infers one from the other.
          </p>
        </div>
      </Card>

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search by reference, investor or product"
        filters={[
          {
            key: "window",
            label: "Maturity window",
            value: window,
            onChange: setWindow,
            options: [
              { value: "30", label: "Next 30 days" },
              { value: "60", label: "Next 60 days" },
              { value: "90", label: "Next 90 days" },
              { value: "matured", label: "Already matured" },
            ],
          },
        ]}
      />

      <Card>
        <DataTable<Maturity>
          caption="Maturities"
          columns={[
            {
              key: "reference",
              header: "Holding",
              sortable: true,
              sortValue: (r) => r.reference,
              render: (r) => (
                <div>
                  <p className="font-bold text-star-900">{r.reference}</p>
                  <p className="text-[11px] text-star-muted">{r.product}</p>
                </div>
              ),
            },
            { key: "investor", header: "Investor", render: (r) => r.investor, sortable: true, sortValue: (r) => r.investor },
            {
              key: "maturesOn",
              header: "Matures",
              sortable: true,
              sortValue: (r) => r.maturesOn,
              render: (r) => (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock size={12} aria-hidden="true" className="text-star-muted" />
                  {r.maturesOn}
                </span>
              ),
            },
            { key: "amount", header: "Amount", render: (r) => <span className="font-mono text-[11px]">{r.amount}</span> },
            { key: "state", header: "State", render: (r) => <StatusPill tone="caution">{r.state}</StatusPill> },
            {
              key: "action",
              header: "Action",
              render: (r) => (
                <button
                  type="button"
                  className="font-bold text-star-700 underline"
                  onClick={() => {
                    setSettle(r.reference);
                    setTyped("");
                  }}
                >
                  Verify settlement
                </button>
              ),
            },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          emptyTitle="No maturities available"
          emptyDetail="Maturity dates and amounts come from the backend. Amounts are integer minor-unit strings — this screen does not compute a maturity value."
        />
        <InertNote contract={contract} />
      </Card>

      {settle && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3">
          <div role="dialog" aria-modal="true" aria-label="Verify settlement" className="w-full max-w-lg rounded-xl bg-white p-5">
            <h2 className="text-lg font-extrabold text-star-900">Verify settlement</h2>
            <p className="mt-2 text-xs leading-5 text-star-muted">
              Confirming settlement tells the portal that funds have arrived. It must be backed by a funding
              confirmation from the backend, not by a staff member's assertion.
            </p>
            <FieldGrid rows={[["Holding", settle], ["Action", "Record settlement confirmation"]]} />
            <label className="mt-4 block text-xs font-bold">
              Type <code className="rounded bg-[#f4f8f3] px-1">{settle}</code> to confirm
              <input className={input + " mt-1"} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </label>
            <InertNote contract={contract} className="mt-3" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={secondary} onClick={() => setSettle(null)}>
                Cancel
              </button>
              <PreparedAction contract={contract} disabled={!confirmationMatches(typed, settle)}>
                <CheckCircle2 size={14} aria-hidden="true" /> Confirm settlement
              </PreparedAction>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Finance & Reconciliation
// ===========================================================================

export function FinanceReconciliation({ contract }: { contract: ContractState }) {
  const [tab, setTab] = useState<"ledger" | "reconciliation" | "adjustments">("ledger");
  const [search, setSearch] = useState("");

  type Entry = { id: string; reference: string; account: string; debit: string; credit: string; posted: string; state: string };
  const rows: Entry[] = [];

  const TABS = [
    { key: "ledger", label: "Ledger" },
    { key: "reconciliation", label: "Reconciliation" },
    { key: "adjustments", label: "Adjustments" },
  ] as const;

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeading
          title="Finance & Reconciliation"
          description="Ledger entries, reconciliation against statement imports, and adjustment requests. The portal displays these; it does not post to the ledger."
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IntegrationBadge />
          <StatusPill tone="caution">Ledger read-only</StatusPill>
        </div>
      </Card>

      <div className="overflow-x-auto">
        <div role="tablist" aria-label="Finance views" className="flex min-w-max gap-1 border-b border-[#e7ece7] pb-px">
          {TABS.map((item) => (
            <button
              key={item.key}
              role="tab"
              aria-selected={tab === item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={
                "whitespace-nowrap rounded-t-lg px-3 py-2 text-xs font-bold " +
                (tab === item.key ? "border-b-2 border-star-700 text-star-900" : "text-star-muted hover:text-star-900")
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "ledger" && (
        <>
          <Toolbar search={search} onSearch={setSearch} placeholder="Search by reference or account" />
          <Card>
            <DataTable<Entry>
              caption="Ledger entries"
              columns={[
                {
                  key: "reference",
                  header: "Entry",
                  sortable: true,
                  sortValue: (r) => r.reference,
                  render: (r) => (
                    <div className="flex items-center gap-2">
                      <BookOpenCheck size={14} aria-hidden="true" className="shrink-0 text-star-muted" />
                      <span className="font-bold text-star-900">{r.reference}</span>
                    </div>
                  ),
                },
                { key: "account", header: "Account", render: (r) => r.account, sortable: true, sortValue: (r) => r.account },
                { key: "debit", header: "Debit", render: (r) => <span className="font-mono text-[11px]">{r.debit}</span> },
                { key: "credit", header: "Credit", render: (r) => <span className="font-mono text-[11px]">{r.credit}</span> },
                { key: "posted", header: "Posted", render: (r) => r.posted, sortable: true, sortValue: (r) => r.posted },
                { key: "state", header: "State", render: (r) => <StatusPill tone="neutral">{r.state}</StatusPill> },
              ]}
              rows={rows}
              rowKey={(r) => r.id}
              emptyTitle="No ledger entries available"
              emptyDetail="Ledger entries are returned by the backend as exact minor-unit strings. This screen never computes, rounds or reformats a monetary value."
            />
            <InertNote contract={contract} />
          </Card>
        </>
      )}

      {tab === "reconciliation" && (
        <Card>
          <SectionHeading
            title="Reconciliation"
            description="Compare internal records against an imported statement and surface exceptions."
          />
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-[#e7ece7] p-3">
              <p className="text-xs font-extrabold text-star-900">Statement import</p>
              <p className="mt-1 text-[11px] leading-4 text-star-muted">
                Accepts the bank or custodian statement file. Format and encoding are defined by the backend, which
                also enforces the size limit.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <PreparedAction contract={contract} variant="secondary">
                  <Upload size={13} aria-hidden="true" /> Choose file
                </PreparedAction>
                <PreparedAction contract={contract} variant="secondary">
                  <Play size={13} aria-hidden="true" /> Start reconciliation
                </PreparedAction>
              </div>
            </div>
            <EvidenceBlock
              title="Last reconciliation"
              contract={contract}
              items={[
                { label: "Run at", value: "Not run" },
                { label: "Entries matched", value: "Not available" },
                { label: "Exceptions", value: "Not available" },
                { label: "Unreconciled value", value: "Not available" },
              ]}
            />
          </div>
          <InertNote contract={contract} />
        </Card>
      )}

      {tab === "adjustments" && (
        <Card>
          <SectionHeading
            title="Adjustment requests"
            description="A ledger adjustment is requested and independently approved. The person who requests one cannot approve it."
          />
          <div className="mt-3">
            <DataTable<{ id: string; reference: string; reason: string; requested: string; state: string }>
              caption="Adjustment requests"
              columns={[
                { key: "reference", header: "Reference", render: (r) => <span className="font-bold">{r.reference}</span>, sortable: true, sortValue: (r) => r.reference },
                { key: "reason", header: "Reason", render: (r) => r.reason },
                { key: "requested", header: "Requested", render: (r) => r.requested },
                { key: "state", header: "State", render: (r) => <StatusPill tone="caution">{r.state}</StatusPill> },
              ]}
              rows={[]}
              rowKey={(r) => r.id}
              emptyTitle="No adjustment requests"
              emptyDetail="Adjustment requests appear here once submitted. Approval requires a different staff member holding finance.approve."
            />
          </div>
          <div className="mt-3 flex justify-end">
            <PreparedAction contract={contract} variant="secondary">
              <Scale size={13} aria-hidden="true" /> Request adjustment
            </PreparedAction>
          </div>
          <InertNote contract={contract} />
        </Card>
      )}
    </div>
  );
}

// ===========================================================================
// Reports & Statements
// ===========================================================================

export function ReportsStatements({ contract }: { contract: ContractState }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  type Report = { id: string; name: string; category: string; description: string; lastGenerated: string };
  const rows: Report[] = [];

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeading
          title="Reports & Statements"
          description="Operational, regulatory and investor reports. The portal requests a report and displays what the backend returns."
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IntegrationBadge />
        </div>
        <p className="mt-3 rounded-lg border border-[#e7ece7] bg-[#f8faf7] p-3 text-[11px] leading-4 text-star-muted">
          No regulatory figure is computed in the browser. Every number in a report comes from the backend verbatim.
        </p>
      </Card>

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search reports"
        filters={[
          {
            key: "category",
            label: "Category",
            value: category,
            onChange: setCategory,
            options: [
              { value: "", label: "All categories" },
              { value: "operational", label: "Operational" },
              { value: "regulatory", label: "Regulatory" },
              { value: "investor", label: "Investor statements" },
            ],
          },
        ]}
      />

      <Card>
        <DataTable<Report>
          caption="Report catalogue"
          columns={[
            {
              key: "name",
              header: "Report",
              sortable: true,
              sortValue: (r) => r.name,
              render: (r) => (
                <div className="flex items-start gap-2">
                  <FileText size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-star-muted" />
                  <div>
                    <p className="font-bold text-star-900">{r.name}</p>
                    <p className="text-[11px] text-star-muted">{r.description}</p>
                  </div>
                </div>
              ),
            },
            { key: "category", header: "Category", render: (r) => <StatusPill tone="neutral">{r.category}</StatusPill>, sortable: true, sortValue: (r) => r.category },
            { key: "lastGenerated", header: "Last generated", render: (r) => r.lastGenerated },
            {
              key: "action",
              header: "Action",
              render: () => (
                <PreparedAction contract={contract} variant="secondary">
                  <Download size={12} aria-hidden="true" /> Generate
                </PreparedAction>
              ),
            },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          emptyTitle="Report catalogue unavailable"
          emptyDetail="The catalogue is supplied by the backend. Generating a report may be asynchronous; the portal will poll a job status rather than block."
        />
        <InertNote contract={contract} />
      </Card>
    </div>
  );
}

// ===========================================================================
// Campaigns
// ===========================================================================

export function CampaignManagement({ contract }: { contract: ContractState }) {
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");

  type Campaign = { id: string; name: string; audience: string; state: string; scheduled: string; createdBy: string };
  const rows: Campaign[] = [];

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeading
          title="Campaigns"
          description="Investor-facing marketing campaigns. Authoring and approval are separate permissions, because a broadcast carries reputational and regulatory risk."
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IntegrationBadge />
          <StatusPill tone="caution">No campaign sent</StatusPill>
        </div>
      </Card>

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search campaigns"
        filters={[
          {
            key: "state",
            label: "State",
            value: state,
            onChange: setState,
            options: [
              { value: "", label: "All states" },
              { value: "draft", label: "Draft" },
              { value: "in-review", label: "In review" },
              { value: "approved", label: "Approved" },
              { value: "published", label: "Published" },
            ],
          },
        ]}
        actions={
          <PreparedAction contract={contract} variant="secondary">
            <Plus size={14} aria-hidden="true" /> New campaign
          </PreparedAction>
        }
      />

      <Card>
        <DataTable<Campaign>
          caption="Campaigns"
          columns={[
            {
              key: "name",
              header: "Campaign",
              sortable: true,
              sortValue: (r) => r.name,
              render: (r) => (
                <div className="flex items-center gap-2">
                  <Megaphone size={14} aria-hidden="true" className="shrink-0 text-star-muted" />
                  <span className="font-bold text-star-900">{r.name}</span>
                </div>
              ),
            },
            { key: "audience", header: "Audience", render: (r) => r.audience, sortable: true, sortValue: (r) => r.audience },
            { key: "createdBy", header: "Author", render: (r) => r.createdBy },
            { key: "scheduled", header: "Scheduled", render: (r) => r.scheduled, sortable: true, sortValue: (r) => r.scheduled },
            { key: "state", header: "State", render: (r) => <StatusPill tone="neutral">{r.state}</StatusPill> },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          emptyTitle="No campaigns available"
          emptyDetail="Campaigns are stored by the backend. A campaign cannot be published without an independent approval."
        />
        <InertNote contract={contract} />
      </Card>
    </div>
  );
}

// ===========================================================================
// Audit & Security
// ===========================================================================

export function AuditSecurity({ contract }: { contract: ContractState }) {
  const [search, setSearch] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");

  type AuditEntry = { id: string; at: string; actor: string; action: string; target: string; outcome: string; ip: string };
  const rows: AuditEntry[] = [];

  const securityTiles = [
    { label: "Failed sign-ins (24h)", value: null, icon: ShieldAlert, note: "Awaiting backend" },
    { label: "Step-up challenges", value: null, icon: Landmark, note: "Awaiting backend" },
    { label: "Sessions revoked", value: null, icon: AlertTriangle, note: "Awaiting backend" },
    { label: "Self-approval attempts", value: null, icon: ShieldAlert, note: "Awaiting backend" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeading
          title="Audit & Security Monitoring"
          description="An append-only record of who did what, plus security-relevant events. Audit entries can never be edited or deleted."
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IntegrationBadge />
          <StatusPill tone="caution">Append-only</StatusPill>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {securityTiles.map((tile) => (
          <Card key={tile.label}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-star-muted">{tile.label}</p>
                <p className="mt-1 text-2xl font-extrabold text-star-900">—</p>
                <p className="mt-0.5 text-[11px] text-amber-800">{tile.note}</p>
              </div>
              <tile.icon size={18} aria-hidden="true" className="shrink-0 text-star-muted" />
            </div>
          </Card>
        ))}
      </div>

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search audit log by target or reference"
        filters={[
          {
            key: "actor",
            label: "Actor",
            value: actor,
            onChange: setActor,
            options: [
              { value: "", label: "Any actor" },
              { value: "self", label: "Only my actions" },
            ],
          },
          {
            key: "action",
            label: "Action type",
            value: action,
            onChange: setAction,
            options: [
              { value: "", label: "All actions" },
              { value: "approve", label: "Approvals" },
              { value: "reject", label: "Rejections" },
              { value: "login", label: "Sign-in events" },
              { value: "permission", label: "Permission changes" },
            ],
          },
        ]}
        actions={
          <PreparedAction contract={contract} variant="secondary">
            <Download size={14} aria-hidden="true" /> Export audit log
          </PreparedAction>
        }
      />

      <Card>
        <DataTable<AuditEntry>
          caption="Audit log"
          columns={[
            { key: "at", header: "When", render: (r) => r.at, sortable: true, sortValue: (r) => r.at },
            { key: "actor", header: "Actor", render: (r) => <span className="font-bold">{r.actor}</span>, sortable: true, sortValue: (r) => r.actor },
            { key: "action", header: "Action", render: (r) => r.action },
            { key: "target", header: "Target", render: (r) => <code className="text-[11px]">{r.target}</code> },
            {
              key: "outcome",
              header: "Outcome",
              render: (r) => (
                <StatusPill tone={r.outcome === "success" ? "positive" : "danger"}>{r.outcome}</StatusPill>
              ),
            },
            { key: "ip", header: "Source", render: (r) => <span className="font-mono text-[11px]">{r.ip}</span> },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          emptyTitle="No audit entries available"
          emptyDetail="Audit records are written by the backend in the same transaction as the action they describe. None exist until the backend implements them — and no example entries are shown, because an audit log that contains fabricated rows is worthless."
        />
        <p className="mt-3 rounded-lg border border-[#e7ece7] bg-[#f8faf7] p-3 text-[11px] leading-4 text-star-muted">
          This view never offers an edit or delete action. Audit records are append-only, and that must be a database
          constraint rather than a service-layer convention.
        </p>
        <InertNote contract={contract} />
      </Card>
    </div>
  );
}

// ===========================================================================
// Staff & Permissions
// ===========================================================================

export function StaffPermissions({ contract }: { contract: ContractState }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");

  type Staff = { id: string; name: string; email: string; role: string; mfa: string; lastActive: string; state: string };
  const rows: Staff[] = [];

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeading
          title="Staff & Permissions"
          description="Provision staff accounts, assign roles and granular permissions, and manage sessions. There is no public staff registration."
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IntegrationBadge />
          <StatusPill tone="caution">No public registration</StatusPill>
        </div>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-4 text-amber-900">
          <p className="flex items-center gap-1.5 font-extrabold">
            <ShieldAlert size={13} aria-hidden="true" /> The highest-risk section in the portal
          </p>
          <p className="mt-1">
            Granting a permission creates authority. A staff member can never grant themselves a permission, and a
            role change request must be approved by a different staff member holding
            <code className="mx-1 rounded bg-white px-1 font-bold">staff.permissions.approve</code>.
          </p>
        </div>
      </Card>

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search staff by name or email"
        filters={[
          {
            key: "role",
            label: "Role",
            value: role,
            onChange: setRole,
            options: [
              { value: "", label: "All roles" },
              { value: "SUPER_ADMIN", label: "Super Admin" },
              { value: "OPERATIONS", label: "Operations" },
              { value: "COMPLIANCE", label: "Compliance" },
              { value: "FINANCE", label: "Finance" },
              { value: "INVESTMENT_MANAGER", label: "Investment Manager" },
              { value: "MARKETING", label: "Marketing" },
              { value: "AUDITOR", label: "Auditor" },
            ],
          },
        ]}
        actions={
          <PreparedAction contract={contract} variant="secondary">
            <Plus size={14} aria-hidden="true" /> Invite staff member
          </PreparedAction>
        }
      />

      <Card>
        <DataTable<Staff>
          caption="Staff accounts"
          columns={[
            {
              key: "name",
              header: "Staff member",
              sortable: true,
              sortValue: (r) => r.name,
              render: (r) => (
                <div>
                  <p className="font-bold text-star-900">{r.name}</p>
                  <p className="text-[11px] text-star-muted">{r.email}</p>
                </div>
              ),
            },
            { key: "role", header: "Role", render: (r) => <StatusPill tone="neutral">{r.role}</StatusPill>, sortable: true, sortValue: (r) => r.role },
            {
              key: "mfa",
              header: "MFA",
              render: (r) => (
                <StatusPill tone={r.mfa === "enrolled" ? "positive" : "danger"}>{r.mfa}</StatusPill>
              ),
            },
            { key: "lastActive", header: "Last active", render: (r) => r.lastActive, sortable: true, sortValue: (r) => r.lastActive },
            { key: "state", header: "State", render: (r) => <StatusPill tone="neutral">{r.state}</StatusPill> },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          emptyTitle="No staff accounts available"
          emptyDetail="Staff accounts are provisioned by invitation through the backend. None are listed until that contract is approved — no example staff rows are shown."
        />
        <InertNote contract={contract} />
      </Card>

      <Card>
        <SectionHeading
          title="Permission separation requirements"
          description="Pairs that must remain distinct for maker-checker to hold. These are enforced by the backend; the UI reflects them."
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            ["investments.prepare", "investments.approve"],
            ["transactions.prepare", "transactions.approve"],
            ["finance.adjustment.request", "finance.approve"],
            ["staff.role.assign.request", "staff.permissions.approve"],
            ["products.draft", "products.approve"],
            ["campaigns.draft", "campaigns.approve"],
          ].map(([maker, checker]) => (
            <div key={maker} className="flex items-center justify-between gap-2 rounded-lg border border-[#e7ece7] bg-white px-3 py-2">
              <code className="text-[10px] font-bold text-star-muted">{maker}</code>
              <span className="text-[10px] text-star-muted">≠</span>
              <code className="text-[10px] font-bold text-star-700">{checker}</code>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
