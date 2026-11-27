/**
 * Notification safety rules — the parts of the notification system that can be
 * correctly specified and tested before any backend exists.
 *
 * These are FRONTEND CONTRACT tests over pure functions. They do not prove a
 * provider delivered anything; they prove the UI cannot misrepresent delivery
 * state, cannot execute injected content, and cannot offer a channel that is not
 * configured.
 */
import {
  CHANNEL_SUPPORT,
  DELIVERY_STATES,
  canRequestRetry,
  canTransition,
  deliveryLabel,
  escapeForPreview,
  isConfirmedDelivered,
  isSafeCallToAction,
  isTerminal,
  readStateApplies,
  sanitizeFailureReason,
  type DeliveryState,
} from "../lib/admin/notifications";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function main(): void {
  // === 1. Accepted is not delivered ======================================
  {
    // The single most important rule: only provider-confirmed state counts.
    const notDelivered: DeliveryState[] = ["draft", "pending-approval", "scheduled", "queued", "sent"];
    for (const state of notDelivered) {
      assert(
        !isConfirmedDelivered(state),
        `"${state}" must never be reported as confirmed delivered`,
      );
    }
    assert(isConfirmedDelivered("delivered"), "only `delivered` is confirmed delivered");
    assert(!isConfirmedDelivered("failed"), "a failed delivery is not delivered");
    assert(!isConfirmedDelivered("cancelled"), "a cancelled notice is not delivered");

    // Wording must not let an operator read `sent` as `delivered`.
    assert(deliveryLabel("sent").includes("not yet confirmed"), `the "sent" label must be unambiguous, got "${deliveryLabel("sent")}"`);
    assert(deliveryLabel("queued").includes("not yet sent"), `the "queued" label must say it is unsent, got "${deliveryLabel("queued")}"`);
    assert(deliveryLabel("delivered") === "Delivered", "the delivered label must be plain");
    // Every state has distinct wording.
    const labels = DELIVERY_STATES.map(deliveryLabel);
    assert(new Set(labels).size === labels.length, "every delivery state needs distinct wording");
  }

  // === 2. Delivery cannot be reversed or faked ===========================
  {
    // Forward only.
    assert(canTransition("queued", "sent"), "queued -> sent must be allowed");
    assert(canTransition("sent", "delivered"), "sent -> delivered must be allowed");
    assert(canTransition("queued", "failed"), "queued -> failed must be allowed");
    // Backwards is refused.
    assert(!canTransition("delivered", "sent"), "a delivered notice must not revert to sent");
    assert(!canTransition("sent", "queued"), "a sent notice must not revert to queued");
    // Terminal is terminal.
    for (const terminal of ["delivered", "failed", "cancelled"] as DeliveryState[]) {
      assert(isTerminal(terminal), `${terminal} must be terminal`);
      for (const target of DELIVERY_STATES) {
        assert(!canTransition(terminal, target), `${terminal} -> ${target} must be refused`);
      }
    }
    // Approval cannot be skipped.
    assert(!canTransition("draft", "sent"), "a draft must not jump straight to sent");
    assert(!canTransition("draft", "queued"), "a draft must not be queued without approval");
    assert(!canTransition("pending-approval", "sent"), "an unapproved notice must not be sent");
    assert(canTransition("pending-approval", "scheduled"), "an approved notice may be scheduled");
    // A failed send cannot be "un-failed": a retry is a new attempt.
    assert(!canTransition("failed", "sent"), "a failed delivery must not be rewound to sent");
  }

  // === 3. Read state is not delivery state ===============================
  {
    assert(readStateApplies("in-app", "delivered"), "a delivered in-app notice can be read/unread");
    assert(!readStateApplies("email", "delivered"), "read state does not apply to email");
    assert(!readStateApplies("in-app", "queued"), "an unqueued notice has no read state");
    assert(!readStateApplies("in-app", "failed"), "a failed in-app notice cannot be unread");
    assert(!readStateApplies("in-app", "draft"), "a draft has no read state");
    // An unread count must therefore be built only from delivered/sent in-app.
    assert(!readStateApplies("sms", "sent") && !readStateApplies("push", "sent"), "read state is in-app only");
  }

  // === 4. Only a failed delivery is retryable ============================
  {
    assert(canRequestRetry("failed"), "a failed delivery may be retried");
    for (const state of ["draft", "pending-approval", "scheduled", "queued", "sent", "delivered", "cancelled"] as DeliveryState[]) {
      assert(!canRequestRetry(state), `"${state}" must not be retryable`);
    }
    // In particular, a "sent but unconfirmed" notice is NOT retryable: retrying
    // could double-send a message that did arrive.
    assert(!canRequestRetry("sent"), "an unconfirmed send must not be retried blindly");
  }

  // === 5. Unconfigured channels are visibly unavailable =================
  {
    for (const [channel, info] of Object.entries(CHANNEL_SUPPORT)) {
      assert(info.configured === false, `${channel} must be reported as unconfigured, not assumed to work`);
      assert(info.note.length > 0, `${channel} must explain why it is unavailable`);
    }
    // SMS and push must never be presented as available.
    assert(!CHANNEL_SUPPORT.sms.configured, "SMS must not be presented as available");
    assert(!CHANNEL_SUPPORT.push.configured, "mobile push must not be presented as available");
  }

  // === 6. Injected content cannot execute ===============================
  {
    assert(escapeForPreview("<script>alert(1)</script>") === "&lt;script&gt;alert(1)&lt;/script&gt;", "script tags must be escaped");
    assert(!escapeForPreview('<img src=x onerror="alert(1)">').includes("<"), "attribute injection must be escaped");
    assert(escapeForPreview("&") === "&amp;", "ampersands must be escaped first");
    assert(escapeForPreview("a & b < c") === "a &amp; b &lt; c", "mixed content must escape correctly");

    // Dangerous link schemes.
    for (const bad of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "//evil.com/path",
      "http://insecure.example.com",
      "not a url",
      "",
      null,
    ]) {
      assert(!isSafeCallToAction(bad), `an unsafe call-to-action must be refused: ${JSON.stringify(bad)}`);
    }
    assert(isSafeCallToAction("https://starfetch.ng/products"), "an https link must be allowed");
    assert(isSafeCallToAction("https://starfetch.ng/login?next=/dashboard"), "an https link with a query must be allowed");
  }

  // === 7. Failure reasons are sanitized =================================
  {
    const withEmail = sanitizeFailureReason("Delivery to ada.okafor@example.com bounced: mailbox full");
    assert(!withEmail.includes("ada.okafor@example.com"), "an email address must be redacted from failure reasons");
    assert(withEmail.includes("[email redacted]"), "the redaction must be visible");
    assert(withEmail.includes("bounced"), "the useful part of the reason must survive");

    const withToken = sanitizeFailureReason("401 Unauthorized: Bearer sk_live_abcdef123456 rejected");
    assert(!withToken.includes("sk_live_abcdef123456"), "a provider secret must be redacted");

    const withLongId = sanitizeFailureReason("message id 4f9a2c7e8b1d3a6f5e4c2b9a8d7f6e5c4b3a2d1f failed");
    assert(!withLongId.includes("4f9a2c7e8b1d3a6f5e4c2b9a8d7f6e5c4b3a2d1f"), "a long opaque identifier must be redacted");

    assert(sanitizeFailureReason(null).includes("No reason reported"), "a missing reason must be stated, not blank");
    assert(sanitizeFailureReason("x".repeat(1000)).length <= 300, "a very long reason must be truncated");
  }

  console.log(
    "PASS — Admin notification safety: only a provider-confirmed state is reported as delivered; " +
      "\"sent\" and \"queued\" are labelled so they cannot be mistaken for delivery; " +
      "delivery cannot move backwards and approval cannot be skipped; " +
      "read state applies only to delivered in-app notices and is never derived from failure; " +
      "only failed deliveries are retryable and an unconfirmed send never is; " +
      "SMS and mobile push are reported unconfigured rather than assumed available; " +
      "notification content is escaped before preview and non-HTTPS call-to-action links are refused; " +
      "and failure reasons redact email addresses, secrets and opaque identifiers.",
  );
}

main();
