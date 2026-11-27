/**
 * NOTIFICATION DELIVERY SEMANTICS — pure, testable rules.
 *
 * The brief is specific and correct: the portal must not report successful
 * delivery merely because a notification request was accepted, and delivery must
 * be distinguished from read status. That is easy to get wrong in a UI, because
 * an accepted request and a delivered message both look like "done".
 *
 * These functions encode the distinction so the eventual UI cannot collapse it,
 * and so the rules can be tested now against the contract David will implement.
 *
 * PROPOSED — none of this is wired to a backend. See
 * ADMIN_NOTIFICATION_SYSTEM_CONTRACT.md.
 */

/**
 * Delivery lifecycle. Ordered from least to most confirmed, and the order
 * matters: a notice may only move FORWARD through it.
 *
 *  - `draft`     prepared, not submitted.
 *  - `pending-approval` awaiting independent approval (maker-checker).
 *  - `scheduled` approved and waiting for its send time.
 *  - `queued`    accepted by the delivery service. NOT sent.
 *  - `sent`      handed to the provider. NOT delivered.
 *  - `delivered` provider-confirmed delivery. Only a provider may assert this.
 *  - `failed`    delivery failed; reason is sanitized.
 *  - `cancelled` withdrawn before sending.
 */
export const DELIVERY_STATES = [
  "draft",
  "pending-approval",
  "scheduled",
  "queued",
  "sent",
  "delivered",
  "failed",
  "cancelled",
] as const;

export type DeliveryState = (typeof DELIVERY_STATES)[number];

const RANK: Record<DeliveryState, number> = {
  draft: 0,
  "pending-approval": 1,
  scheduled: 2,
  queued: 3,
  sent: 4,
  delivered: 5,
  failed: 5,
  cancelled: 5,
};

/** Terminal states cannot be advanced by anything the frontend does. */
export function isTerminal(state: DeliveryState): boolean {
  return state === "delivered" || state === "failed" || state === "cancelled";
}

/**
 * Whether a state may be shown to an operator as "confirmed delivered".
 *
 * ONLY `delivered`. This is the rule most likely to be eroded under pressure
 * ("just show it as sent, it's basically the same") — it is not the same. A
 * message the provider never confirmed may not have reached anyone.
 */
export function isConfirmedDelivered(state: DeliveryState): boolean {
  return state === "delivered";
}

/**
 * The operator-facing label. Deliberately worded so a non-specialist cannot
 * mistake `sent` for `delivered`.
 */
export function deliveryLabel(state: DeliveryState): string {
  switch (state) {
    case "draft":
      return "Draft";
    case "pending-approval":
      return "Awaiting approval";
    case "scheduled":
      return "Scheduled";
    case "queued":
      return "Queued (not yet sent)";
    case "sent":
      return "Sent (not yet confirmed delivered)";
    case "delivered":
      return "Delivered";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
  }
}

/**
 * Whether a state transition is permitted.
 *
 * Rejects anything that would move a notice backwards, skip the approval gate,
 * or "un-fail" a failed delivery. A retry is a NEW attempt, not a state rewind —
 * which is why `failed -> sent` is refused and a retry request is a separate
 * operation.
 */
export function canTransition(from: DeliveryState, to: DeliveryState): boolean {
  if (from === to) return false;
  if (isTerminal(from)) return false;
  // Approval cannot be skipped: a draft may not jump straight to sending.
  if (from === "draft" && RANK[to] > RANK["pending-approval"]) return false;
  if (from === "pending-approval" && RANK[to] > RANK["scheduled"]) return false;
  // `failed` and `cancelled` are unreachable by forward transition alone.
  if (to === "failed" || to === "cancelled") {
    return from === "queued" || from === "sent" || from === "scheduled";
  }
  return RANK[to] > RANK[from];
}

/**
 * Read status is INDEPENDENT of delivery. A delivered in-app notification may be
 * unread; an unread one may never have been delivered (it doesn't exist to read).
 */
export type ReadState = "unread" | "read" | "not-applicable";

/**
 * Whether read state is meaningful for a given delivery state.
 *
 * Read state applies only to in-app notifications that actually reached the
 * recipient. Claiming "unread" for an email that failed would be nonsense, and
 * an unread count built from undelivered messages is a false signal.
 */
export function readStateApplies(channel: "in-app" | "email" | "sms" | "push", state: DeliveryState): boolean {
  return channel === "in-app" && (state === "delivered" || state === "sent");
}

/** Channels that exist vs channels that are proposed. Unconfigured render as unavailable. */
export const CHANNEL_SUPPORT: Record<
  "in-app" | "email" | "sms" | "push",
  { configured: boolean; note: string }
> = {
  "in-app": { configured: false, note: "Requires the backend notification service." },
  email: { configured: false, note: "Requires an approved email provider; none connected." },
  sms: { configured: false, note: "Not configured. No SMS provider is approved." },
  push: { configured: false, note: "Not configured. No mobile push provider is approved." },
};

/**
 * A retry is an AUTHORIZED REQUEST, never an automatic resend.
 *
 * Only a failed delivery is retryable, and a retry creates a new attempt that
 * begins in `queued` — it does not resurrect the old record.
 */
export function canRequestRetry(state: DeliveryState): boolean {
  return state === "failed";
}

/**
 * Sanitizes a provider failure reason for display.
 *
 * Provider errors routinely embed the destination address, a message id, or an
 * API key fragment. None of that belongs on an operator screen, and an email
 * address is personal data.
 */
export function sanitizeFailureReason(raw: string | null | undefined): string {
  if (!raw) return "No reason reported by the provider.";
  let text = String(raw).slice(0, 500);
  text = text.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email redacted]");
  // Two shapes are common: `Bearer <token>` with only whitespace, and
  // `token: <value>` / `api_key=<value>` with a separator. Both must go — the
  // separator-only form missed the most common one, which is exactly how a
  // sanitizer ends up looking correct and leaking.
  text = text.replace(/\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [redacted]");
  text = text.replace(/\b(token|api[_-]?key|secret|password|passwd)\s*[:=]\s*\S+/gi, "$1 [redacted]");
  text = text.replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]");
  return text.slice(0, 300);
}

/**
 * Escapes text for safe display in notification previews.
 *
 * Notification bodies come from staff and may contain HTML. Rendering them
 * unescaped in a preview is a stored-XSS primitive aimed at the highest-privilege
 * users in the system. The composer shows a TEXT preview; rich content, if ever
 * supported, must be sanitised server-side and rendered in a sandbox.
 */
export function escapeForPreview(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Rejects links that could execute script or use a non-HTTPS scheme.
 *
 * A "call to action" URL in a notification is attacker-influenceable content.
 * Only https is allowed, and `javascript:`, `data:` and protocol-relative URLs
 * are refused outright rather than sanitised into something that half-works.
 */
export function isSafeCallToAction(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^(javascript|data|vbscript|file|blob):/i.test(trimmed)) return false;
  if (trimmed.startsWith("//")) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}
