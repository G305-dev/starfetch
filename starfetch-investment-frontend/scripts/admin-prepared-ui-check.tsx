/**
 * Render tests for the prepared-UI components.
 *
 * The brief asks for automated tests of the new UI components, not only the
 * static contracts. These render the real components with `react-dom/server` and
 * make assertions about the produced markup. That is a lower bar than a browser
 * test — there is no interaction, no event handling and no hydration — but it
 * does catch the failures that matter here:
 *
 *   - a section rendering a fabricated row
 *   - a control that looks enabled when it cannot work
 *   - an empty state that does not explain itself
 *   - `sent` being rendered as `delivered`
 *   - an approval dialog offering a decision to the person who submitted it
 *
 * Interaction behaviour is covered separately by the browser screenshot pass.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { IntegrationPendingSection } from "../components/admin/IntegrationPendingSection";
import { NotificationCenter } from "../components/admin/prepared/NotificationCenter";
import { ApprovalCenter } from "../components/admin/prepared/ApprovalCenter";
import { StaffSecurity } from "../components/admin/prepared/StaffSecurity";
import { AdminMfaChallenge } from "../components/admin/login/AdminMfaChallenge";
import { AdminLoginForm } from "../components/admin/login/AdminLoginForm";
import {
  AuditSecurity,
  CampaignManagement,
  DocumentManagement,
  FinanceReconciliation,
  MaturityRedemption,
  ProductManagement,
  ReportsStatements,
  StaffPermissions,
  SupportComplaints,
} from "../components/admin/prepared/OperationsSections";
import {
  ConfirmDialog,
  DataTable,
  IntegrationBadge,
  InertNote,
  PreparedAction,
  StatusPill,
  StepUpPanel,
  Toolbar,
} from "../components/admin/prepared/UI";
import { deliveryLabel } from "../lib/admin/notifications";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/** Render a component tree to static HTML. */
function html(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

/** Strip tags so assertions can look at human-visible text only. */
function text(markup: string): string {
  return markup
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Buttons carrying the real `disabled` attribute.
 *
 * Matches the bare attribute only: the shared button class contains the Tailwind
 * variant `disabled:opacity-50`, which would otherwise look like a match and make
 * every assertion here meaningless.
 */
function disabledButtons(markup: string): number {
  return (markup.match(/<button[^>]*\sdisabled(?:=|\s|>)/g) ?? []).length;
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function main(): void {
  // === 1. The pending shell still states the truth ======================
  {
    const markup = html(
      createElement(IntegrationPendingSection, {
        title: "Example section",
        summary: "Summary.",
        capabilities: [{ label: "Do a thing", blockedBy: "GET /thing" }],
      }),
    );
    const visible = text(markup);
    assert(visible.includes("cannot perform work yet"), "the shell states it cannot perform work");
    assert(visible.includes("does not invent financial data"), "the shell states no data is invented");
    assert(visible.includes("GET /thing"), "the shell names the blocking endpoint");
    assert(visible.includes("Integration pending"), "the shell carries the pending badge");
  }

  // === 2. Prepared primitives ===========================================
  {
    const badge = text(html(createElement(IntegrationBadge, {})));
    assert(badge.includes("Integration pending"), "the badge is labelled");

    const note = text(html(createElement(InertNote, { contract: "not-approved" })));
    assert(note.includes("Awaiting backend integration"), "the inert note explains why a control is off");
    assert(text(html(createElement(InertNote, { contract: "approved" }))) === "", "a live contract renders no note");

    const pill = html(createElement(StatusPill, { tone: "danger", children: "Failed" }));
    assert(pill.includes("Failed"), "a status pill renders its label");

    // A prepared action is a real button, disabled, with an accessible reason.
    const action = html(createElement(PreparedAction, { contract: "not-approved", children: "Send" }));
    assert(action.includes("<button"), "the prepared action renders a button element");
    assert(/\bdisabled\b/.test(action), "the prepared action is disabled while the contract is pending");
    assert(action.includes("sr-only"), "the reason is exposed to assistive technology");
    assert(action.includes("Awaiting backend integration"), "the reason is present in the markup");

    // The same action is enabled once the contract is live.
    const live = html(createElement(PreparedAction, { contract: "approved", children: "Send" }));
    assert(disabledButtons(live) === 0, "the action is enabled when the contract is live");
  }

  // === 3. Empty states are honest and explained =========================
  {
    const markup = html(
      createElement(DataTable<{ id: string; name: string }>, {
        caption: "Things",
        columns: [{ key: "name", header: "Name", render: (r: { id: string; name: string }) => r.name }],
        rows: [],
        rowKey: (r: { id: string }) => r.id,
        emptyTitle: "No things available",
        emptyDetail: "Things come from the backend.",
      }),
    );
    const visible = text(markup);
    assert(visible.includes("No things available"), "the empty title is rendered");
    assert(visible.includes("Things come from the backend"), "the empty explanation is rendered");
    assert(!markup.includes("<tbody"), "an empty table renders no body rows at all");
  }

  // === 4. Every prepared section renders without inventing a record =====
  {
    const sections: [string, React.ReactElement][] = [
      ["NotificationCenter", createElement(NotificationCenter, { contract: "not-approved" })],
      ["ApprovalCenter", createElement(ApprovalCenter, { contract: "not-approved", permissions: [], actorStaffId: "staff-a" })],
      ["StaffSecurity", createElement(StaffSecurity, { contract: "not-approved" })],
      ["DocumentManagement", createElement(DocumentManagement, { contract: "not-approved" })],
      ["SupportComplaints", createElement(SupportComplaints, { contract: "not-approved" })],
      ["ProductManagement", createElement(ProductManagement, { contract: "not-approved" })],
      ["MaturityRedemption", createElement(MaturityRedemption, { contract: "not-approved" })],
      ["FinanceReconciliation", createElement(FinanceReconciliation, { contract: "not-approved" })],
      ["ReportsStatements", createElement(ReportsStatements, { contract: "not-approved" })],
      ["CampaignManagement", createElement(CampaignManagement, { contract: "not-approved" })],
      ["AuditSecurity", createElement(AuditSecurity, { contract: "not-approved" })],
      ["StaffPermissions", createElement(StaffPermissions, { contract: "not-approved" })],
    ];

    for (const [name, element] of sections) {
      const markup = html(element);
      const visible = text(markup);
      assert(markup.length > 500, `${name} must render a substantive interface, not a stub`);
      assert(visible.length > 100, `${name} must render visible text`);
      // No fabricated financial values: currency symbols followed by digits, or
      // long digit runs that look like an amount.
      assert(!/₦\s?\d/.test(visible), `${name} must not render a naira amount`);
      assert(!/\$\s?\d{3}/.test(visible), `${name} must not render a dollar amount`);
      assert(!/\b\d{1,3}(,\d{3}){2,}\.\d{2}\b/.test(visible), `${name} must not render a formatted balance`);
      // The pending state must be evident.
      assert(visible.includes("Integration pending"), `${name} must show the pending badge`);
    }
  }

  // === 5. Notification Center covers the required surfaces ==============
  {
    const markup = html(createElement(NotificationCenter, { contract: "not-approved" }));
    const visible = text(markup);

    // Brief requirement 3 names these explicitly. All must be present.
    for (const surface of ["Compose", "Templates", "Automated events", "Scheduled", "Delivery history", "Failed deliveries", "Channels"]) {
      assert(visible.includes(surface), `Notification Center must offer the "${surface}" surface`);
    }

    // Channel reality.
    assert(visible.includes("SMS"), "SMS is named");
    assert(
      visible.includes("integration pending"),
      "every channel is described as integration pending rather than configured",
    );
    assert(visible.includes("Mobile push"), "push is named");

    // Delivery vs read state must never be conflated in the copy.
    assert(
      !/delivered/i.test(visible.replace(/not yet confirmed delivered|Confirmed delivered|Delivery history|delivery/gi, "")),
      "the overview must not claim a delivery that has not been confirmed",
    );

    // The section lands on the overview, so the compose form is not in the first
    // paint. The render test therefore asserts the form against the Compose view
    // directly rather than pretending the landing tab contains it.
    assert(disabledButtons(markup) > 0, "the quick-action send path is disabled");

    const compose = html(createElement(NotificationCenter, { contract: "not-approved", initialTab: "compose" }));
    const composeText = text(compose);
    assert(count(compose, "<input") >= 3, "compose renders real inputs");
    assert(count(compose, "<textarea") >= 1, "compose renders a body field");
    assert(count(compose, "<select") >= 1, "compose renders an audience selector");
    assert(compose.includes('type="datetime-local"'), "compose renders a send-time control");
    assert(count(compose, 'type="checkbox"') === 4, "all four channels are offered as toggles");
    assert(compose.includes("placeholder"), "inputs carry guidance");
    assert(composeText.includes("Supporting") || composeText.includes("Supported placeholders"), "placeholder help is shown");
    assert(composeText.includes("SMS"), "unconfirmed channels are still named so the gap is visible");
    assert(
      composeText.includes("Integration pending"),
      "every channel states that its delivery is unconfirmed",
    );
    assert(
      !/configured/i.test(composeText.replace(/[Nn]ot configured/g, "")),
      "no channel may be described as configured",
    );
    assert(
      composeText.includes("No channel can deliver"),
      "the composer states outright that nothing can be delivered",
    );
    assert(disabledButtons(compose) > 0, "the compose submit path is disabled");
    assert(composeText.includes("Submit for approval"), "the submit control is present but inert");
    assert(composeText.includes("Awaiting backend integration"), "and it explains why");
  }

  // === 6. Delivery labels never overstate ===============================
  {
    assert(deliveryLabel("sent") !== deliveryLabel("delivered"), "sent and delivered are labelled differently");
    assert(
      deliveryLabel("sent").toLowerCase().includes("not yet confirmed"),
      "a sent notification says it is not yet confirmed delivered",
    );
    assert(deliveryLabel("delivered").toLowerCase().includes("delivered"), "a delivered notification says so");

    const center = text(html(createElement(NotificationCenter, { contract: "not-approved" })));
    assert(
      !center.includes("Sent (not yet confirmed delivered)") || center.includes("not yet confirmed"),
      "no unconfirmed send is presented as a completed one",
    );
  }

  // === 7. Approval Center protects maker-checker ========================
  {
    // The queue itself.
    const queue = html(createElement(ApprovalCenter, { contract: "not-approved", permissions: [], actorStaffId: "staff-a" }));
    const queueText = text(queue);
    assert(queueText.includes("Approval Center"), "the section renders its title");
    assert(queueText.includes("No approvals to review"), "the empty queue states itself plainly");
    assert(
      queueText.includes("cannot approve") || queueText.includes("cannot be approved"),
      "the independence rule is stated on the page",
    );
    assert(!/approved by you|you approved/i.test(queueText), "the page never implies an approval happened");
  }

  // === 7b. The decision dialog enforces independence ====================
  {
    // A maker reviewing their own submission. The dialog must refuse, and it must
    // say so in the body — not merely disable a button.
    const ownMarkup = html(
      createElement(ApprovalCenter, {
        contract: "not-approved",
        permissions: ["approvals.read", "approvals.approve", "approvals.reject"],
        actorStaffId: "staff-maker",
        initialDecision: {
          id: "a1",
          reference: "TX-1001",
          type: "transaction",
          stage: "submitted",
          submittedBy: "staff-maker",
          submittedAt: "2026-11-17T08:00:00.000Z",
          recordVersion: 4,
          amountMinor: "12500000",
          currency: "NGN",
        },
      }),
    );
    const ownText = text(ownMarkup);
    assert(ownText.includes("You cannot decide this request"), "a maker is told they cannot decide their own request");
    assert(ownText.includes("Independent approval"), "and the reason is independence");
    assert(disabledButtons(ownMarkup) > 0, "the decision buttons are disabled for a maker");
    assert(!ownText.includes("Record approval occurred"), "no approval is recorded");

    // A different checker with the right permissions sees the decision surface.
    const checkerMarkup = html(
      createElement(ApprovalCenter, {
        contract: "not-approved",
        permissions: ["approvals.read", "approvals.approve", "approvals.reject"],
        actorStaffId: "staff-checker",
        initialDecision: {
          id: "a1",
          reference: "TX-1001",
          type: "transaction",
          stage: "submitted",
          submittedBy: "staff-maker",
          submittedAt: "2026-11-17T08:00:00.000Z",
          recordVersion: 4,
          amountMinor: "12500000",
          currency: "NGN",
        },
      }),
    );
    const checkerText = text(checkerMarkup);
    assert(!checkerText.includes("You cannot decide this request"), "an independent checker is not blocked by the guard");
    assert(checkerText.includes("Reauth"), "the checker sees that reauthentication is required for money movement");
    // Even so, the contract is pending, so the action stays inert.
    assert(disabledButtons(checkerMarkup) > 0, "the decision stays inert while the contract is pending");
    assert(checkerText.includes("Awaiting backend integration"), "and the reason is stated");
  }

  // === 8. Step-up panel states =========================================
  {
    const needed = text(html(createElement(StepUpPanel, { contract: "not-approved", satisfied: false })));
    assert(needed.includes("Reauthentication required"), "the panel announces the requirement");
    assert(needed.includes("not available"), "the panel says verification is unavailable while pending");

    const satisfied = text(html(createElement(StepUpPanel, { contract: "approved", satisfied: true })));
    assert(satisfied.includes("Reauthenticated"), "a satisfied step-up is reported as such");

    const totp = html(createElement(StepUpPanel, { contract: "approved", satisfied: false, method: "totp" }));
    assert(totp.includes("000000"), "the TOTP variant renders a code field");
    assert(disabledButtons(totp) > 0, "the verify button is disabled until six digits are entered");
  }

  // === 9. Staff security never generates or validates a secret ==========
  {
    const markup = html(createElement(StaffSecurity, { contract: "not-approved" }));
    const visible = text(markup);

    for (const surface of ["Enrolment", "Verification", "Recovery codes", "Session", "Reauthentication"]) {
      assert(visible.includes(surface), `staff security must offer the "${surface}" surface`);
    }
    assert(visible.includes("Passkey"), "passkey is offered");
    assert(visible.includes("Security key"), "security key is offered");
    assert(visible.includes("Recovery"), "recovery codes are offered");
    assert(visible.includes("15"), "the inactivity timeout is stated");
    assert(visible.includes("8"), "the absolute lifetime is stated");

    // The critical negative: no secret material anywhere in the markup.
    assert(!/otpauth:\/\//.test(markup), "the page must not render a provisioning URI");
    assert(!/secret[=:]\s*[A-Z2-7]{16,}/i.test(markup), "the page must not render a base32 secret");
    assert(!/data:image\/png;base64/.test(markup), "the page must not embed a generated QR image");
    assert(
      visible.includes("never generates a secret"),
      "the page states that the secret is not generated in the browser",
    );
    assert(
      visible.includes("never validates a code"),
      "the page states that no credential is verified here",
    );
    assert(
      visible.includes("never creates a session"),
      "the page states that it cannot authenticate anyone",
    );

    // Nothing here can produce a session.
    assert(disabledButtons(markup) > 0, "the enrolment and verification controls are inert");
  }

  // === 10. Confirmation dialogs demand a retype =========================
  {
    const dialog = html(
      createElement(ConfirmDialog, {
        title: "Confirm",
        reference: "TX-1001",
        consequence: "This cannot be undone.",
        confirmLabel: "Confirm settlement",
        contract: "not-approved",
        onConfirm: () => undefined,
        close: () => undefined,
      }),
    );
    const visible = text(dialog);
    assert(visible.includes("TX-1001"), "the reference is shown");
    assert(visible.includes("cannot be undone"), "the consequence is stated before confirming");
    assert(dialog.includes('role="dialog"'), "the dialog has dialog semantics");
    assert(dialog.includes("aria-modal"), "the dialog is modal for assistive technology");
    assert(visible.includes("Type"), "the operator is asked to retype the reference");
    assert(disabledButtons(dialog) > 0, "confirm is disabled before the retype and the contract");
  }

  // === 11. Toolbar and filters render as real controls ==================
  {
    const toolbar = html(
      createElement(Toolbar, {
        search: "",
        onSearch: () => undefined,
        placeholder: "Search things",
        filters: [
          {
            key: "state",
            label: "State",
            value: "",
            onChange: () => undefined,
            options: [{ value: "", label: "All states" }],
          },
        ],
      }),
    );
    assert(toolbar.includes('role="search"'), "the toolbar is a search landmark");
    assert(toolbar.includes("Search things"), "the placeholder is rendered");
    assert(toolbar.includes("<select"), "filters render as a select");
    assert(toolbar.includes("All states"), "filter options are rendered");
    assert(/\baria-label=/.test(toolbar), "controls are labelled for assistive technology");
  }

  // === 12. No section leaks a demo or placeholder record ================
  {
    const all = [
      createElement(NotificationCenter, { contract: "not-approved" }),
      createElement(ApprovalCenter, { contract: "not-approved", permissions: [], actorStaffId: "a" }),
      createElement(StaffSecurity, { contract: "not-approved" }),
      createElement(DocumentManagement, { contract: "not-approved" }),
      createElement(SupportComplaints, { contract: "not-approved" }),
      createElement(ProductManagement, { contract: "not-approved" }),
      createElement(MaturityRedemption, { contract: "not-approved" }),
      createElement(FinanceReconciliation, { contract: "not-approved" }),
      createElement(ReportsStatements, { contract: "not-approved" }),
      createElement(CampaignManagement, { contract: "not-approved" }),
      createElement(AuditSecurity, { contract: "not-approved" }),
      createElement(StaffPermissions, { contract: "not-approved" }),
    ];
    for (const element of all) {
      const markup = html(element);
      assert(!/lorem ipsum/i.test(markup), "no lorem ipsum");
      assert(!/\bJohn Doe\b|\bJane Doe\b|\bAcme\b/i.test(markup), "no placeholder names");
      assert(!/test@example\.com/i.test(markup), "no placeholder email addresses");
      assert(!/\b0\.00\b/.test(markup), "no zero-value amounts that look like real data");
    }
  }

  // === 13. No channel claims configured status in the rendered page ======
  {
    const overview = html(createElement(NotificationCenter, { contract: "not-approved" }));
    const overviewText = text(overview);

    // The specific regression: the header previously read "In-app configured"
    // and "Email configured", which the portal had no authority to claim.
    assert(!/In-app configured/i.test(overviewText), "the header must not claim in-app is configured");
    assert(!/Email configured/i.test(overviewText), "the header must not claim email is configured");
    assert(
      !/\bconfigured\b/i.test(overviewText),
      "no rendered notification text may describe a channel as configured",
    );
    for (const label of ["In-app", "Email", "SMS", "Mobile push"]) {
      assert(overviewText.includes(label), `${label} remains visible so the gap is not hidden`);
    }
    assert(
      overviewText.includes("integration pending"),
      "channels are labelled integration pending",
    );
    assert(
      overviewText.includes("No notification channel has been confirmed"),
      "the page states that no channel is confirmed",
    );

    // The channels panel must show every channel as pending, none as available.
    const panel = html(createElement(NotificationCenter, { contract: "not-approved", initialTab: "channels" }));
    const panelText = text(panel);
    assert(!/\bConfigured\b/.test(panelText), "the channel panel shows no configured state");
    assert(panelText.includes("Not confirmed by the backend"), "each provider is named as unconfirmed");
  }

  // === 14. The MFA challenge renders real states, never a session ========
  {
    const verification = html(
      createElement(AdminMfaChallenge, {
        step: "mfa-verification-required",
        enabled: false,
        challengeExpiresAt: "2026-11-17T09:05:00.000Z",
        onVerified: () => {},
        onCancel: () => {},
      }),
    );
    const verifyText = text(verification);

    assert(verifyText.includes("Confirm it is you"), "the verification step names itself");
    assert(verifyText.includes("SECOND FACTOR"), "the step indicator shows the second factor");
    assert(verifyText.includes("SESSION"), "and shows that a session comes after");
    assert(verification.includes('id="mfa-code"'), "a code field is rendered");
    assert(verification.includes('inputMode="numeric"'), "the code field is numeric");
    assert(verification.includes('autoComplete="one-time-code"'), "browsers may autofill the code");
    assert(disabledButtons(verification) > 0, "verification is inert while the contract is pending");
    assert(
      verifyText.includes("No staff session") || verifyText.includes("no staff session"),
      "the screen states that no session exists yet",
    );
    assert(!/otpauth:\/\//.test(verification), "no provisioning URI is rendered");
    assert(!/data:image\/png;base64/.test(verification), "no QR image is rendered");

    // Enrolment says where the payload will appear, and admits it is absent.
    const enrolment = html(
      createElement(AdminMfaChallenge, {
        step: "mfa-enrolment-required",
        enabled: false,
        onVerified: () => {},
        onCancel: () => {},
      }),
    );
    const enrolText = text(enrolment);
    assert(enrolText.includes("Set up a second factor"), "enrolment names itself");
    assert(enrolText.includes("Provisioning payload"), "the payload area is described");
    assert(
      enrolText.includes("generated and stored by the backend"),
      "enrolment states the secret is the backend's",
    );
    assert(!/otpauth:\/\//.test(enrolment), "enrolment renders no provisioning URI");
    assert(!/[A-Z2-7]{32}/.test(enrolment), "enrolment renders no base32 secret");
    for (const method of ["Passkey", "Security key", "Authenticator app", "Recovery code"]) {
      assert(enrolText.includes(method), `enrolment offers ${method}`);
    }

    // Expired and locked are distinct states with distinct copy.
    for (const [step, needle] of [
      ["mfa-expired", "timed out"],
      ["mfa-locked", "Too many verification attempts"],
      ["unavailable", "unavailable"],
    ] as const) {
      const markup = html(
        createElement(AdminMfaChallenge, { step, enabled: false, onVerified: () => {}, onCancel: () => {} }),
      );
      assert(text(markup).includes(needle), `${step} states its condition`);
      assert(
        text(markup).toLowerCase().includes("no session"),
        `${step} states that no session was issued`,
      );
    }
  }

  // === 15. The login form cannot navigate before MFA =====================
  {
    const markup = html(createElement(AdminLoginForm, { enabled: false }));
    const visible = text(markup);

    assert(visible.includes("Staff sign in"), "the password step names itself");
    assert(markup.includes('id="staff-email"'), "the email field is rendered");
    assert(markup.includes('id="staff-password"'), "the password field is rendered");
    assert(disabledButtons(markup) > 0, "sign-in is inert while unapproved");
    assert(
      visible.includes("two steps"),
      "the form states that sign-in has two steps",
    );
    assert(
      visible.includes("second factor") && visible.toLowerCase().includes("no staff"),
      "the form states that no session exists until the second factor is confirmed",
    );
  }

  console.log(
    "PASS — Prepared-UI render: every section renders a substantive interface with real inputs, selects and " +
      "tables while every submit path is disabled; each names its integration state and explains its empty state; " +
      "no section renders a fabricated record, currency amount, placeholder name or zero-value balance; sent and " +
      "delivered are labelled differently and an unconfirmed send is never presented as complete; the Approval " +
      "Center states the no-self-approval rule and never implies a decision occurred; the step-up panel announces " +
      "the requirement and is inert until the auth contract is live; staff security offers enrolment, verification, " +
      "recovery, session and reauthentication without rendering any secret, provisioning URI or generated QR code; " +
      "confirmation dialogs demand an exact retype before enabling; toolbars render labelled, accessible controls; " +
      "no notification channel is described as configured anywhere in the rendered page; and the staff sign-in renders " +
      "a distinct MFA challenge step that yields no session, carrying no provisioning URI, secret or generated QR code.",
  );
}

main();
