/**
 * PREPARED-UI LOGIC.
 *
 * Pure functions behind the eleven expanded admin sections. No React, no DOM, no
 * I/O — so every rule that decides what the interface may offer is testable in
 * Node without a browser.
 *
 * The distinction this module draws, and which the whole prepared-UI layer rests
 * on: there are two different questions.
 *
 *   1. "Is this control allowed to be interactive?"  → UI question, answered here.
 *   2. "Did the backend perform the operation?"      → backend question, never
 *                                                      assumed here.
 *
 * A staff member may type in the compose form, pick an audience, choose a send
 * time and open the confirmation dialog. Those are UI capabilities. None of them
 * is evidence that anything was sent. `canSubmit` is false until the contract is
 * approved, and even then the only proof of success is a backend response.
 */

// ---------------------------------------------------------------------------
// Backend readiness
// ---------------------------------------------------------------------------

/**
 * Whether a section's backend contract has been approved for activation.
 *
 * Deliberately a plain argument rather than an env read: tests must be able to
 * exercise both branches, and a component must not be able to discover a flag the
 * operator did not intend to expose. In the shipped app this is always `false`
 * until David signs the contract off.
 */
export type ContractState = "not-approved" | "approved" | "unavailable";

export function isContractLive(state: ContractState): boolean {
  return state === "approved";
}

/** Why an action is inert, in staff-facing language. */
export function inertReason(state: ContractState): string {
  switch (state) {
    case "approved":
      return "";
    case "unavailable":
      return "The admin service is unavailable. No action was taken and nothing changed.";
    case "not-approved":
    default:
      return "Awaiting backend integration — this control is prepared but cannot send requests yet.";
  }
}

// ---------------------------------------------------------------------------
// Form validation
// ---------------------------------------------------------------------------

export type Issue = { field: string; message: string };

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Field length bounds, mirrored from the proposed contract. */
export const LIMITS = {
  titleMin: 3,
  titleMax: 140,
  bodyMin: 10,
  bodyMax: 5000,
  reasonMin: 8,
  reasonMax: 2000,
  subjectMax: 200,
  searchMax: 120,
} as const;

export function withinBounds(value: string, field: string, min: number, max: number): Issue | null {
  const length = value.trim().length;
  if (length < min) return { field, message: `Enter at least ${min} characters.` };
  if (length > max) return { field, message: `Use ${max} characters or fewer.` };
  return null;
}

// ---------------------------------------------------------------------------
// Notification Center
// ---------------------------------------------------------------------------

/** Channels the portal can offer. */
export const CHANNELS = ["in-app", "email", "sms", "push"] as const;
export type Channel = (typeof CHANNELS)[number];

/**
 * What the backend has actually confirmed about a channel.
 *
 * `unconfirmed` is the ONLY correct default. An earlier revision of this file
 * hardcoded in-app and email as configured, which was a claim the portal had no
 * authority to make: no notification backend or delivery provider had been
 * confirmed for any channel. A channel is "configured" only when an authoritative
 * backend response says so, and that response does not exist yet.
 *
 * `unsupported` is distinct from `unconfirmed` on purpose. "We checked and there
 * is no provider" is a different statement from "nobody has checked", and the
 * first one is what the operator needs when a channel silently delivers nothing.
 */
export type ChannelState = "confirmed" | "unconfirmed" | "unsupported";

/**
 * Backend-confirmed availability, keyed by channel.
 *
 * Empty. This is not an oversight and it is not a placeholder to be filled in
 * later with `true` — it is the honest answer today, and the UI derives every
 * badge, checkbox and submit gate from it. When David implements
 * `GET /notifications/channels`, the response populates this map and the
 * interface becomes dynamic without any other change.
 */
export const CHANNEL_CONFIRMED: Partial<Record<Channel, ChannelState>> = {};

/** Resolve a channel's state from a confirmation map, defaulting to unconfirmed. */
export function channelState(
  channel: Channel,
  confirmed: Partial<Record<Channel, ChannelState>> = CHANNEL_CONFIRMED,
): ChannelState {
  return confirmed[channel] ?? "unconfirmed";
}

/** Whether any channel at all has been confirmed. False until the backend says otherwise. */
export function anyChannelConfirmed(
  confirmed: Partial<Record<Channel, ChannelState>> = CHANNEL_CONFIRMED,
): boolean {
  return CHANNELS.some((channel) => channelState(channel, confirmed) === "confirmed");
}

export function channelLabel(channel: Channel): string {
  return channel === "in-app" ? "In-app" : channel === "email" ? "Email" : channel === "sms" ? "SMS" : "Mobile push";
}

/**
 * Whether a channel may be selected, and — when it may not — why.
 *
 * Only `confirmed` is selectable. An unconfirmed channel is shown disabled with
 * the reason attached, because hiding it would let an operator assume the portal
 * simply does not support the channel rather than that its delivery is unproven.
 */
export function channelAvailability(
  channel: Channel,
  confirmed: Partial<Record<Channel, ChannelState>> = CHANNEL_CONFIRMED,
): { state: ChannelState; selectable: boolean; note: string } {
  const state = channelState(channel, confirmed);
  if (state === "confirmed") return { state, selectable: true, note: "" };
  if (state === "unsupported") {
    return { state, selectable: false, note: "Unsupported — the backend confirms no delivery provider for this channel." };
  }
  return {
    state,
    selectable: false,
    note: "Integration pending — no delivery provider has been confirmed by the backend.",
  };
}

/** A short label for the channel state, for pills and tables. */
export function channelStateLabel(state: ChannelState): string {
  if (state === "confirmed") return "Confirmed";
  if (state === "unsupported") return "Unsupported";
  return "Integration pending";
}

/** Audiences the portal can target. Counts must come from the backend. */
export const AUDIENCES = [
  "all-active-investors",
  "verified-investors",
  "investors-with-maturing-holdings",
  "investors-contactable-by-email",
  "selected-investors",
  "staff-operations",
] as const;
export type Audience = (typeof AUDIENCES)[number];

export function audienceLabel(audience: Audience): string {
  switch (audience) {
    case "all-active-investors":
      return "All active investors";
    case "verified-investors":
      return "Verified investors only";
    case "investors-with-maturing-holdings":
      return "Investors with holdings maturing in 30 days";
    case "investors-contactable-by-email":
      return "Investors contactable by email";
    case "selected-investors":
      return "A manually selected list";
    case "staff-operations":
      return "Operations staff";
    default:
      return audience;
  }
}

/**
 * A recipient count can only come from the backend. This helper exists so the UI
 * has one place that refuses to guess: given no count it reports unknown rather
 * than rendering `0`, because `0` reads as "this audience is empty" and that is a
 * different claim from "nobody has checked".
 */
export function describeCount(count: number | null | undefined): string {
  if (count == null || !Number.isFinite(count) || count < 0) return "Recipient count unavailable until the backend returns it";
  return `${count.toLocaleString()} recipient${count === 1 ? "" : "s"}`;
}

export type NotificationDraft = {
  title: string;
  body: string;
  channels: Channel[];
  audience: Audience | "";
  selectedInvestorIds: string[];
  scheduleAt: string | null;
  templateId: string | null;
  ctaUrl: string | null;
};

export function emptyDraft(): NotificationDraft {
  return {
    title: "",
    body: "",
    channels: [],
    audience: "",
    selectedInvestorIds: [],
    scheduleAt: null,
    templateId: null,
    ctaUrl: null,
  };
}

/**
 * Everything wrong with a draft, in the order a person would fix it.
 *
 * This validates the draft the operator is composing. It does NOT validate that
 * the send succeeded, and passing it is not permission to send — `canSubmit`
 * decides that separately.
 */
export function validateDraft(
  draft: NotificationDraft,
  nowIso: string,
  confirmed: Partial<Record<Channel, ChannelState>> = CHANNEL_CONFIRMED,
): Issue[] {
  const issues: Issue[] = [];

  const title = withinBounds(draft.title, "title", LIMITS.titleMin, LIMITS.titleMax);
  if (title) issues.push(title);

  const body = withinBounds(draft.body, "body", LIMITS.bodyMin, LIMITS.bodyMax);
  if (body) issues.push(body);

  if (draft.channels.length === 0) {
    issues.push({ field: "channels", message: "Select at least one delivery channel." });
  }
  // Any channel the backend has not confirmed is refused, naming each one. The
  // default state is `unconfirmed`, so a draft with any channel selected fails
  // here today — which is correct, because no channel has been confirmed.
  const unconfirmed = draft.channels.filter((c) => channelState(c, confirmed) !== "confirmed");
  if (unconfirmed.length > 0) {
    issues.push({
      field: "channels",
      message: `${unconfirmed.map(channelLabel).join(" and ")} cannot be used — delivery is not confirmed by the backend.`,
    });
  }

  if (!nonEmpty(draft.audience)) {
    issues.push({ field: "audience", message: "Choose who should receive this notification." });
  }
  if (draft.audience === "selected-investors" && draft.selectedInvestorIds.length === 0) {
    issues.push({ field: "audience", message: "Select at least one investor for a manually selected list." });
  }

  const schedule = validateSchedule(draft.scheduleAt, nowIso);
  if (schedule) issues.push(schedule);

  const cta = validateCallToAction(draft.ctaUrl);
  if (cta) issues.push(cta);

  return issues;
}

/** How far ahead a schedule may be set. */
export const MAX_SCHEDULE_DAYS = 365;

/**
 * Scheduling rules. A past time is refused because it would silently send
 * immediately — an operator who picked "yesterday" meant to schedule, not to
 * broadcast instantly.
 */
export function validateSchedule(scheduleAt: string | null, nowIso: string): Issue | null {
  if (scheduleAt == null) return null; // send-now is expressed by a null schedule
  const at = Date.parse(scheduleAt);
  if (Number.isNaN(at)) return { field: "scheduleAt", message: "Enter a valid send date and time." };
  const now = Date.parse(nowIso);
  if (Number.isNaN(now)) return { field: "scheduleAt", message: "The current time could not be determined." };
  if (at <= now) return { field: "scheduleAt", message: "Choose a time in the future. A past time would send immediately." };
  const horizon = now + MAX_SCHEDULE_DAYS * 86_400_000;
  if (at > horizon) return { field: "scheduleAt", message: `Choose a time within ${MAX_SCHEDULE_DAYS} days.` };
  return null;
}

/**
 * Call-to-action links go to investors in an email, so they must be unambiguous
 * HTTPS. A protocol-relative or relative URL has an ambiguous origin in a mail
 * client; `javascript:` and `data:` are injection.
 */
export function validateCallToAction(url: string | null): Issue | null {
  if (url == null || url.trim() === "") return null;
  const value = url.trim();
  if (!/^https:\/\/[^\s]+$/i.test(value)) {
    return { field: "ctaUrl", message: "Use a full https:// link. Other schemes are not allowed in a notification." };
  }
  if (/[\s<>"]/.test(value)) {
    return { field: "ctaUrl", message: "The link contains characters that are not allowed." };
  }
  return null;
}

/**
 * Whether the draft may be submitted.
 *
 * Requires a clean draft AND a live contract. Even when both hold, the only proof
 * of success is the backend response — this function gates the button, it does not
 * predict the outcome.
 */
export function canSubmit(
  draft: NotificationDraft,
  nowIso: string,
  contract: ContractState,
  confirmed: Partial<Record<Channel, ChannelState>> = CHANNEL_CONFIRMED,
): { allowed: boolean; reason: string } {
  if (!isContractLive(contract)) return { allowed: false, reason: inertReason(contract) };
  const issues = validateDraft(draft, nowIso, confirmed);
  if (issues.length > 0) return { allowed: false, reason: issues[0].message };
  return { allowed: true, reason: "" };
}

/** Placeholder tokens in a template body, e.g. `{{firstName}}`. */
export function templatePlaceholders(body: string): string[] {
  const found = new Set<string>();
  const pattern = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) found.add(match[1]);
  return [...found].sort();
}

/** Placeholders a template needs that the caller has not supplied. */
export function missingPlaceholders(body: string, supplied: string[]): string[] {
  const have = new Set(supplied);
  return templatePlaceholders(body).filter((name) => !have.has(name));
}

/** Unknown placeholders will render literally to an investor, so they are an error. */
export function unknownPlaceholders(body: string, allowed: string[]): string[] {
  const permitted = new Set(allowed);
  return templatePlaceholders(body).filter((name) => !permitted.has(name));
}

/** The variables the notification engine can populate. */
export const SUPPORTED_PLACEHOLDERS = ["firstName", "surname", "accountReference", "productName", "maturityDate", "amountFormatted"] as const;

export function validateTemplate(body: string): Issue[] {
  const issues: Issue[] = [];
  const bounds = withinBounds(body, "templateBody", LIMITS.bodyMin, LIMITS.bodyMax);
  if (bounds) issues.push(bounds);
  const unknown = unknownPlaceholders(body, [...SUPPORTED_PLACEHOLDERS]);
  if (unknown.length > 0) {
    issues.push({
      field: "templateBody",
      message: `Unsupported placeholder${unknown.length === 1 ? "" : "s"}: ${unknown.map((n) => `{{${n}}}`).join(", ")}.`,
    });
  }
  return issues;
}

/** Automated (event-driven) notifications and the event each fires on. */
export const AUTOMATED_EVENTS = [
  { key: "investment-booked", label: "Investment booked", description: "Fires after funding verification and booking complete." },
  { key: "funding-received", label: "Funding received", description: "Fires when Finance verifies an inbound payment." },
  { key: "maturity-approaching", label: "Maturity approaching", description: "Fires 30 days before a holding matures." },
  { key: "maturity-settled", label: "Maturity settled", description: "Fires only after settlement is confirmed by the backend." },
  { key: "kyc-decision", label: "KYC decision recorded", description: "Fires on an approve or reject decision, never on submission." },
  { key: "statement-ready", label: "Statement ready", description: "Fires when a statement export completes." },
  { key: "password-changed", label: "Password changed", description: "Security notice to the investor." },
] as const;

/**
 * An automated event is only enabled when every channel it uses is confirmed.
 *
 * With no channel confirmed this is false for every event, including an event
 * that lists only in-app. That is the intended behaviour after this correction:
 * the portal cannot vouch for a delivery path it has not been told about.
 */
export function automatedEventAvailable(
  channels: Channel[],
  confirmed: Partial<Record<Channel, ChannelState>> = CHANNEL_CONFIRMED,
): boolean {
  return channels.length > 0 && channels.every((c) => channelState(c, confirmed) === "confirmed");
}

// ---------------------------------------------------------------------------
// Approval Center
// ---------------------------------------------------------------------------

export const APPROVAL_TYPES = [
  "investment",
  "transaction",
  "kyc-final",
  "product",
  "campaign",
  "finance-adjustment",
  "bank-details",
  "staff-permission",
] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export function approvalTypeLabel(type: ApprovalType): string {
  switch (type) {
    case "investment":
      return "Investment instruction";
    case "transaction":
      return "Transaction";
    case "kyc-final":
      return "KYC final decision";
    case "product":
      return "Product publication";
    case "campaign":
      return "Campaign publication";
    case "finance-adjustment":
      return "Finance adjustment";
    case "bank-details":
      return "Bank detail change";
    case "staff-permission":
      return "Staff permission grant";
    default:
      return type;
  }
}

/** Types that move money or create authority, and therefore require step-up. */
export function requiresStepUp(type: ApprovalType): boolean {
  return (
    type === "investment" ||
    type === "transaction" ||
    type === "finance-adjustment" ||
    type === "bank-details" ||
    type === "staff-permission"
  );
}

export type ApprovalFilter = { type: ApprovalType | ""; search: string; stage: string };

export function emptyApprovalFilter(): ApprovalFilter {
  return { type: "", search: "", stage: "" };
}

/** Filter predicate used by the queue table. Pure so it can be tested. */
export function matchesApprovalFilter(
  item: { type: ApprovalType; reference: string; submittedBy: string; stage: string },
  filter: ApprovalFilter,
): boolean {
  if (filter.type && item.type !== filter.type) return false;
  if (filter.stage && item.stage !== filter.stage) return false;
  const q = filter.search.trim().toLowerCase();
  if (!q) return true;
  return (
    item.reference.toLowerCase().includes(q) ||
    item.submittedBy.toLowerCase().includes(q) ||
    approvalTypeLabel(item.type).toLowerCase().includes(q)
  );
}

/**
 * What the approval dialog must collect before it can be submitted.
 *
 * A rejection needs a substantive reason. An approval of a step-up type needs a
 * satisfied step-up. Both are checked here so the dialog and the test agree.
 */
export function decisionReadiness(input: {
  action: "approve" | "reject";
  type: ApprovalType;
  reason: string;
  stepUpSatisfied: boolean;
  contract: ContractState;
}): { allowed: boolean; reason: string } {
  if (!isContractLive(input.contract)) return { allowed: false, reason: inertReason(input.contract) };

  if (input.action === "reject") {
    const bounds = withinBounds(input.reason, "reason", LIMITS.reasonMin, LIMITS.reasonMax);
    if (bounds) return { allowed: false, reason: bounds.message };
  }

  if (requiresStepUp(input.type) && !input.stepUpSatisfied) {
    return { allowed: false, reason: "Reauthenticate before deciding this request. It moves money or creates authority." };
  }

  return { allowed: true, reason: "" };
}

/** The step-up panel's state, derived rather than stored twice. */
export function stepUpState(required: boolean, satisfied: boolean, contract: ContractState): { show: boolean; canVerify: boolean; note: string } {
  if (!required) return { show: false, canVerify: false, note: "" };
  if (satisfied) return { show: true, canVerify: false, note: "Reauthentication satisfied for this decision." };
  return {
    show: true,
    canVerify: isContractLive(contract),
    note: isContractLive(contract)
      ? "Confirm your identity to continue."
      : "Reauthentication runs on the backend. It is not available until the staff auth contract is approved.",
  };
}

// ---------------------------------------------------------------------------
// Staff MFA and sessions
// ---------------------------------------------------------------------------

export const MFA_METHODS = ["passkey", "security-key", "totp", "recovery-code"] as const;
export type MfaMethod = (typeof MFA_METHODS)[number];

export function mfaMethodLabel(method: MfaMethod): string {
  switch (method) {
    case "passkey":
      return "Passkey";
    case "security-key":
      return "Security key";
    case "totp":
      return "Authenticator app";
    case "recovery-code":
      return "Recovery code";
    default:
      return method;
  }
}

/** TOTP codes are exactly six digits. Shape only — the backend verifies the value. */
export function isValidTotpShape(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

/** Recovery codes are single-use opaque strings; shape check only. */
export function isValidRecoveryShape(code: string): boolean {
  return /^[A-Za-z0-9-]{8,64}$/.test(code.trim()) && !/\s/.test(code.trim());
}

/** Password for reauthentication. Presence and a sane bound only — never validated client-side. */
export function isValidReauthShape(password: string): boolean {
  return password.length >= 8 && password.length <= 200;
}

/** Enrolment is a sequence, and every step must complete in order. */
export const ENROLMENT_STEPS = ["choose-method", "confirm-identity", "register-factor", "verify-factor", "recovery-codes", "complete"] as const;
export type EnrolmentStep = (typeof ENROLMENT_STEPS)[number];

export function nextEnrolmentStep(current: EnrolmentStep): EnrolmentStep | null {
  const index = ENROLMENT_STEPS.indexOf(current);
  if (index < 0 || index === ENROLMENT_STEPS.length - 1) return null;
  return ENROLMENT_STEPS[index + 1];
}

export function enrolmentStepLabel(step: EnrolmentStep): string {
  switch (step) {
    case "choose-method":
      return "Choose a second factor";
    case "confirm-identity":
      return "Confirm your identity";
    case "register-factor":
      return "Register the factor";
    case "verify-factor":
      return "Verify the factor";
    case "recovery-codes":
      return "Save recovery codes";
    case "complete":
      return "Enrolment complete";
    default:
      return step;
  }
}

/**
 * A factor is only enrolled once the backend confirms verification. Registering
 * a passkey in the browser is not enrolment — an unverified factor can lock a
 * staff member out.
 */
export function enrolmentComplete(steps: Record<EnrolmentStep, boolean>): boolean {
  return ENROLMENT_STEPS.every((step) => steps[step] === true);
}

/** Session countdown for the expiry warning. */
export type SessionClock = { expired: boolean; msRemaining: number; display: string; warning: boolean };

/**
 * Absolute time remaining, as text.
 *
 * The backend enforces expiry. This is a courtesy countdown so a staff member is
 * not surprised mid-task — it is never treated as authorisation, and a session is
 * not considered valid because this says so.
 */
export function sessionClock(expiresAtIso: string | null, nowIso: string): SessionClock {
  if (!expiresAtIso) return { expired: true, msRemaining: 0, display: "No active session", warning: false };
  const expires = Date.parse(expiresAtIso);
  const now = Date.parse(nowIso);
  if (Number.isNaN(expires) || Number.isNaN(now)) return { expired: true, msRemaining: 0, display: "Session time unknown", warning: false };
  const msRemaining = expires - now;
  if (msRemaining <= 0) return { expired: true, msRemaining: 0, display: "Session expired", warning: false };
  const totalMinutes = Math.floor(msRemaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const display = hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`;
  return { expired: false, msRemaining, display, warning: msRemaining <= 5 * 60_000 };
}

/** Inactivity timeout and absolute lifetime from the staff auth contract. */
export const INACTIVITY_TIMEOUT_MINUTES = 15;
export const ABSOLUTE_SESSION_HOURS = 8;

// ---------------------------------------------------------------------------
// Generic list controls shared by the remaining sections
// ---------------------------------------------------------------------------

/**
 * Case-insensitive search across named fields.
 *
 * Returns a new array; never mutates. Fields are read defensively because rows
 * come from a backend that may omit optional properties.
 */
export function filterRows<T extends Record<string, unknown>>(rows: T[], query: string, fields: (keyof T | string)[]): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    fields.some((field) => {
      const value = row[field as keyof T];
      return typeof value === "string" && value.toLowerCase().includes(q);
    }),
  );
}

/** Sort by a string or number field, without mutating the input. */
export function sortRows<T extends Record<string, unknown>>(rows: T[], field: keyof T | string, direction: "asc" | "desc"): T[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a[field as keyof T];
    const right = b[field as keyof T];
    if (typeof left === "number" && typeof right === "number") return (left - right) * factor;
    return String(left ?? "").localeCompare(String(right ?? "")) * factor;
  });
}

/** Page a list for the pager control. */
export function pageRows<T>(rows: T[], page: number, pageSize: number): { items: T[]; page: number; totalPages: number; total: number } {
  const safeSize = Math.max(1, Math.floor(pageSize) || 1);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (safePage - 1) * safeSize;
  return { items: rows.slice(start, start + safeSize), page: safePage, totalPages, total };
}

/**
 * A destructive action needs the operator to retype its reference. Prevents a
 * mis-click on a settle or suspend control from being the last step.
 */
export function confirmationMatches(typed: string, expected: string): boolean {
  return typed.trim().length > 0 && typed.trim() === expected.trim();
}
