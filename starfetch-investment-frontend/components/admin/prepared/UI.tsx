"use client";

/**
 * PREPARED-UI PRIMITIVES.
 *
 * Building blocks for the expanded sections. Everything here composes the
 * existing `components/admin/live/UI` primitives and the `star` palette, so the
 * new screens are visually indistinguishable from the seven pages that were
 * already approved. No new colour, spacing, radius or shadow value is introduced.
 *
 * The one thing these add is a vocabulary for being honest about readiness:
 * `IntegrationBadge`, `PreparedBanner`, `InertNote` and `PreparedAction`. A
 * control that cannot work yet must look deliberately inert and say so, not look
 * broken and not look functional.
 */

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ClockAlert,
  Lock,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { button, secondary, input, Card, Th, Td, Modal, State } from "../live/UI";
import type { ContractState } from "@/lib/admin/prepared";
import { inertReason, isContractLive } from "@/lib/admin/prepared";

export { button, secondary, input, Card, Th, Td, Modal, State };

// ---------------------------------------------------------------------------
// Readiness vocabulary
// ---------------------------------------------------------------------------

/** Amber pill marking a section whose backend contract is not yet approved. */
export function IntegrationBadge({ label = "Integration pending" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">
      <ClockAlert size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Green pill for a live, working state. Used sparingly and only when true. */
export function LiveBadge({ label = "Live" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-star-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-star-700 ring-1 ring-star-200">
      <Check size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * The standing explanation at the top of a prepared section.
 *
 * Says three things: what is built, what is missing, and that nothing on the page
 * is a real record. Wording is deliberately concrete — "prepared but cannot send
 * requests" is more useful than "coming soon".
 */
export function PreparedBanner({
  contract,
  whatIsBuilt,
  whatIsMissing,
}: {
  contract: ContractState;
  whatIsBuilt: string;
  whatIsMissing: string;
}) {
  if (isContractLive(contract)) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <IntegrationBadge />
      </div>
      <p className="mt-3 text-sm leading-6 text-star-900">
        <strong className="font-extrabold">This screen is prepared but cannot send requests yet.</strong>{" "}
        {whatIsBuilt}
      </p>
      <p className="mt-2 text-xs leading-5 text-star-muted">{whatIsMissing}</p>
      <p className="mt-3 rounded-lg border border-amber-200 bg-white p-3 text-xs leading-5 text-star-900">
        Controls below accept input so the workflow can be reviewed. Nothing is submitted, nothing is stored and
        nothing is sent. No record, count, balance or outcome on this page is real.
      </p>
    </div>
  );
}

/** Small inline note explaining why a specific control is inert. */
export function InertNote({ contract, className = "" }: { contract: ContractState; className?: string }) {
  if (isContractLive(contract)) return null;
  return (
    <p className={`mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-amber-800 ${className}`}>
      <Lock size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{inertReason(contract)}</span>
    </p>
  );
}

/**
 * A primary action in a prepared section.
 *
 * Renders as a real button so keyboard and focus behaviour is genuine, but is
 * disabled while the contract is pending. `reason` is surfaced through
 * `aria-describedby` so a screen-reader user learns why, not just that it is off.
 */
export function PreparedAction({
  children,
  contract,
  onClick,
  variant = "primary",
  reason,
  disabled,
  ...rest
}: {
  children: ReactNode;
  contract: ContractState;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  reason?: string;
  disabled?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "disabled">) {
  const inert = !isContractLive(contract);
  const id = useRef(`inert-${Math.random().toString(36).slice(2, 9)}`).current;
  return (
    <>
      <button
        type="button"
        className={variant === "primary" ? button : secondary}
        disabled={inert || disabled}
        onClick={inert ? undefined : onClick}
        aria-describedby={inert ? id : undefined}
        {...rest}
      >
        {children}
      </button>
      {inert && (
        <span id={id} className="sr-only">
          {reason ?? inertReason(contract)}
        </span>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Status pills
// ---------------------------------------------------------------------------

const TONES = {
  neutral: "bg-[#f4f8f3] text-[#526157] ring-[#e0e8de]",
  positive: "bg-star-50 text-star-700 ring-star-200",
  caution: "bg-amber-50 text-amber-800 ring-amber-200",
  warning: "bg-orange-50 text-orange-800 ring-orange-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
} as const;

export type Tone = keyof typeof TONES;

export function StatusPill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ring-1 ${TONES[tone]}`}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Toolbar: search + filters
// ---------------------------------------------------------------------------

export type SelectFilter = { key: string; label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void };

/**
 * Search and filter bar.
 *
 * Mirrors the existing table toolbar exactly (the shape already used on the
 * Investor and KYC pages) so a staff member does not have to relearn it.
 */
export function Toolbar({
  search,
  onSearch,
  placeholder = "Search",
  filters = [],
  actions,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  filters?: SelectFilter[];
  actions?: ReactNode;
}) {
  return (
    <Card>
      <form
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-wrap items-end gap-3"
        role="search"
        aria-label="Search and filter"
      >
        <label className="min-w-[230px] flex-1 text-xs font-bold">
          {placeholder}
          <div className="relative mt-1">
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-star-muted" />
            <input
              className={input + " pl-9"}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              maxLength={120}
            />
          </div>
        </label>
        {filters.map((filter) => (
          <label key={filter.key} className="text-xs font-bold">
            {filter.label}
            <select
              className={input + " mt-1"}
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              aria-label={filter.label}
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Generic table
// ---------------------------------------------------------------------------

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  /** Sortable columns must return a string or number from `sortValue`. */
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
};

/**
 * Table with an honest empty state.
 *
 * When there are no rows it renders `State status="empty"` rather than a fake row.
 * The empty message distinguishes "no records match your filters" from "the
 * backend has not been connected", because those mean different things to a staff
 * member and only one of them is worth acting on.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyTitle = "No records match your filters",
  emptyDetail,
  onRowClick,
  minWidth = 780,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDetail?: string;
  onRowClick?: (row: T) => void;
  minWidth?: number;
  caption?: string;
}) {
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    const get = column.sortValue;
    return [...rows].sort((a, b) => {
      const left = get(a);
      const right = get(b);
      if (typeof left === "number" && typeof right === "number") return (left - right) * factor;
      return String(left).localeCompare(String(right)) * factor;
    });
  }, [rows, sort, columns]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[#e7ece7] bg-white">
        <div className="px-4 pt-4">
          <p className="text-sm font-extrabold text-star-900">{emptyTitle}</p>
          {emptyDetail && <p className="mt-1 max-w-2xl text-xs leading-5 text-star-muted">{emptyDetail}</p>}
        </div>
        <State status="empty" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ minWidth }} aria-label={caption}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key;
              return (
                <Th key={column.key} className={column.className}>
                  {column.sortable && column.sortValue ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort((prev) =>
                          prev?.key === column.key
                            ? { key: column.key, direction: prev.direction === "asc" ? "desc" : "asc" }
                            : { key: column.key, direction: "asc" },
                        )
                      }
                      className="inline-flex items-center gap-1 hover:text-star-700"
                      aria-sort={active ? (sort?.direction === "asc" ? "ascending" : "descending") : "none"}
                    >
                      {column.header}
                      <ChevronDown
                        size={12}
                        aria-hidden="true"
                        className={active && sort?.direction === "asc" ? "rotate-180" : ""}
                      />
                    </button>
                  ) : (
                    column.header
                  )}
                </Th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-star-200">
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? "cursor-pointer hover:bg-star-50/60" : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
            >
              {columns.map((column) => (
                <Td key={column.key} className={column.className}>
                  {column.render(row)}
                </Td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

/** Labelled value grid, matching the existing `KV` component's appearance. */
export function FieldGrid({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-[#f6f9f4] p-3">
          <dt className="text-[11px] text-star-muted">{label}</dt>
          <dd className="mt-1 break-words text-sm font-bold text-star-900">{value ?? "Not available"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A read-only evidence block: what a checker inspects before deciding. */
export function EvidenceBlock({
  title,
  items,
  contract,
}: {
  title: string;
  items: { label: string; value: ReactNode; note?: string }[];
  contract: ContractState;
}) {
  return (
    <div className="rounded-lg border border-[#e7ece7] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e7ece7] px-3 py-2">
        <h4 className="text-xs font-extrabold text-star-900">{title}</h4>
        {!isContractLive(contract) && (
          <StatusPill tone="caution">Evidence unavailable</StatusPill>
        )}
      </div>
      <ul className="divide-y divide-star-200">
        {items.map((item) => (
          <li key={item.label} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
            <span className="text-[11px] text-star-muted">{item.label}</span>
            <span className="text-right text-xs font-bold text-star-900">{item.value}</span>
          </li>
        ))}
      </ul>
      {!isContractLive(contract) && (
        <p className="border-t border-[#e7ece7] px-3 py-2 text-[11px] leading-4 text-amber-800">
          Evidence is supplied by the backend when the request is fetched. It is not reconstructed here.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmation dialog
// ---------------------------------------------------------------------------

/**
 * Confirmation dialog for an irreversible or high-consequence action.
 *
 * Requires the operator to retype an identifying reference, matching
 * `confirmationMatches` in the logic layer. The confirm button stays disabled
 * until the retype is exact, so a stray click cannot settle or suspend anything.
 */
export function ConfirmDialog({
  title,
  reference,
  consequence,
  confirmLabel,
  onConfirm,
  close,
  contract,
  requireRetype = true,
  tone = "danger",
}: {
  title: string;
  reference: string;
  consequence: string;
  confirmLabel: string;
  onConfirm: () => void;
  close: () => void;
  contract: ContractState;
  requireRetype?: boolean;
  tone?: Tone;
}) {
  const [typed, setTyped] = useState("");
  const matches = !requireRetype || typed.trim() === reference.trim();
  return (
    <Modal title={title} close={close}>
      <div className={`mb-4 rounded-lg border p-3 text-xs leading-5 ${tone === "danger" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        <AlertTriangle size={14} aria-hidden="true" className="mb-1" />
        <p>{consequence}</p>
      </div>
      <FieldGrid
        rows={[
          ["Reference", <code key="r" className="text-xs">{reference}</code>],
          ["Action", confirmLabel],
        ]}
      />
      {requireRetype && (
        <label className="mt-4 block text-xs font-bold">
          Type <code className="rounded bg-[#f4f8f3] px-1 py-0.5">{reference}</code> to confirm
          <input
            className={input + " mt-1"}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            aria-describedby="confirm-hint"
          />
          <span id="confirm-hint" className="mt-1 block text-[11px] font-normal text-star-muted">
            This step exists so that a mis-click cannot complete the action.
          </span>
        </label>
      )}
      <InertNote contract={contract} className="mt-3" />
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={secondary} onClick={close}>
          Cancel
        </button>
        <button
          type="button"
          className={button + (tone === "danger" ? " !bg-red-700 hover:!bg-red-800" : "")}
          disabled={!matches || !isContractLive(contract)}
          onClick={onConfirm}
          aria-describedby={!isContractLive(contract) ? "confirm-inert" : undefined}
        >
          {confirmLabel}
        </button>
      </div>
      {!isContractLive(contract) && (
        <span id="confirm-inert" className="sr-only">
          {inertReason(contract)}
        </span>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Step-up authentication panel
// ---------------------------------------------------------------------------

/**
 * Reauthentication panel required before a sensitive decision.
 *
 * The backend verifies the credential. This panel collects it and shows state; it
 * never decides that a step-up succeeded. When the auth contract is not live the
 * panel is visible (so the workflow can be reviewed) but cannot verify.
 */
export function StepUpPanel({
  satisfied,
  contract,
  onVerify,
  method = "passkey",
}: {
  satisfied: boolean;
  contract: ContractState;
  onVerify?: () => void;
  method?: "passkey" | "totp";
}) {
  const [code, setCode] = useState("");
  const canVerify = isContractLive(contract);

  if (satisfied) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-star-200 bg-star-50 p-3">
        <ShieldCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-star-700" />
        <div>
          <p className="text-xs font-extrabold text-star-900">Reauthenticated</p>
          <p className="mt-0.5 text-[11px] leading-4 text-star-muted">
            This decision may proceed. The backend re-checks the step-up window on submit.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <div className="flex items-start gap-2">
        <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-800" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-star-900">Reauthentication required</p>
          <p className="mt-0.5 text-[11px] leading-4 text-star-muted">
            {method === "passkey"
              ? "Confirm with your passkey or security key."
              : "Enter the six-digit code from your authenticator app."}
          </p>

          {method === "totp" && (
            <label className="mt-2 block text-[11px] font-bold">
              Authentication code
              <input
                className={input + " mt-1 max-w-[10rem] tracking-[0.3em]"}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                aria-label="Six digit authentication code"
              />
            </label>
          )}

          <button
            type="button"
            className={secondary + " mt-2"}
            disabled={!canVerify || (method === "totp" && code.length !== 6)}
            onClick={canVerify ? onVerify : undefined}
          >
            <ShieldCheck size={14} aria-hidden="true" />
            {method === "passkey" ? "Confirm with passkey" : "Verify code"}
          </button>

          {!canVerify && (
            <p className="mt-2 text-[11px] leading-4 text-amber-800">
              Reauthentication runs on the backend. It is not available until the staff authentication contract is
              approved, so this control cannot succeed yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-navigation
// ---------------------------------------------------------------------------

/** Tab strip for sections with several subviews (Notification Center, Staff). */
export function SubTabs({
  tabs,
  active,
  onChange,
  disabledReason,
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (key: string) => void;
  disabledReason?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <div role="tablist" aria-label="Section views" className="flex min-w-max gap-1 border-b border-[#e7ece7] pb-px">
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${tab.key}`}
              id={`tab-${tab.key}`}
              type="button"
              onClick={() => onChange(tab.key)}
              className={
                "flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3 py-2 text-xs font-bold transition " +
                (selected ? "border-b-2 border-star-700 text-star-900" : "text-star-muted hover:text-star-900")
              }
              title={disabledReason}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="rounded-full bg-star-50 px-1.5 py-0.5 text-[10px] font-extrabold text-star-700">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Renders one tab panel with the correct ARIA wiring. */
export function TabPanel({ id, active, children }: { id: string; active: string; children: ReactNode }) {
  if (id !== active) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="space-y-4">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** Section heading used inside a prepared page. */
export function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-extrabold text-star-900">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-xs leading-5 text-star-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Inline error that never leaks a backend message verbatim. */
export function InlineError({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="my-3 flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
      <p className="text-xs font-bold text-red-800">{message}</p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss error" className="rounded p-0.5 text-red-800 hover:bg-red-100">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
