/**
 * Tests for the prepared-UI logic layer.
 *
 * These are logic tests, not render tests. They pin the rules that decide what
 * the expanded sections may offer, so that the interface cannot drift into
 * implying an operation succeeded. Render coverage lives in
 * `admin-prepared-ui-check.ts`.
 */
import {
  ABSOLUTE_SESSION_HOURS,
  AUDIENCES,
  CHANNELS,
  CHANNEL_CONFIRMED,
  channelState,
  anyChannelConfirmed,
  INACTIVITY_TIMEOUT_MINUTES,
  LIMITS,
  SUPPORTED_PLACEHOLDERS,
  automatedEventAvailable,
  canSubmit,
  channelAvailability,
  confirmationMatches,
  decisionReadiness,
  describeCount,
  emptyDraft,
  enrolmentComplete,
  filterRows,
  inertReason,
  isContractLive,
  isValidRecoveryShape,
  isValidReauthShape,
  isValidTotpShape,
  matchesApprovalFilter,
  mfaMethodLabel,
  missingPlaceholders,
  nextEnrolmentStep,
  pageRows,
  requiresStepUp,
  sessionClock,
  sortRows,
  stepUpState,
  templatePlaceholders,
  unknownPlaceholders,
  validateCallToAction,
  validateDraft,
  validateSchedule,
  validateTemplate,
  type ApprovalType,
  type EnrolmentStep,
  type NotificationDraft,
} from "../lib/admin/prepared";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const NOW = "2026-11-17T09:00:00.000Z";
const LATER = "2026-11-18T09:00:00.000Z";

function validDraft(): NotificationDraft {
  return {
    ...emptyDraft(),
    title: "Your statement is ready",
    body: "Your account statement for the period is now available to view.",
    channels: ["in-app", "email"],
    audience: "verified-investors",
    scheduleAt: LATER,
  };
}

function main(): void {
  // === 1. Nothing is live until the contract is approved ==================
  {
    assert(isContractLive("approved"), "an approved contract is live");
    assert(!isContractLive("not-approved"), "a pending contract is not live");
    assert(!isContractLive("unavailable"), "an unavailable service is not live");

    // The message must say what is happening, not just "disabled".
    assert(
      inertReason("not-approved").includes("Awaiting backend integration"),
      "the inert reason must state that integration is pending",
    );
    assert(
      inertReason("unavailable").includes("nothing changed"),
      "the unavailable reason must reassure that nothing changed",
    );
    assert(inertReason("approved") === "", "a live contract has no inert reason");

    // A complete, valid draft STILL cannot submit without an approved contract.
    const blocked = canSubmit(validDraft(), NOW, "not-approved");
    assert(!blocked.allowed, "a perfect draft must not submit while the contract is pending");
    assert(blocked.reason.includes("Awaiting backend integration"), "and it must say why");
  }

  // === 2. Draft validation ==============================================
  {
    // A complete draft still reports the channel gap, because no channel is
    // confirmed. With confirmation supplied it validates clean — proving the
    // refusal is about delivery, not about the draft being malformed.
    const onlyChannels = validateDraft(validDraft(), NOW);
    assert(
      onlyChannels.length > 0 && onlyChannels.every((i) => i.field === "channels"),
      "a complete draft reports only the channel-confirmation gap",
    );
    assert(
      validateDraft(validDraft(), NOW, { "in-app": "confirmed", email: "confirmed" }).length === 0,
      "a complete draft is valid once its channels are confirmed",
    );

    const noTitle = { ...validDraft(), title: "" };
    assert(
      validateDraft(noTitle, NOW).some((i) => i.field === "title"),
      "a missing title is reported against the title field",
    );

    const shortTitle = { ...validDraft(), title: "ab" };
    assert(
      validateDraft(shortTitle, NOW).some((i) => i.field === "title"),
      `a title shorter than ${LIMITS.titleMin} is refused`,
    );

    const longTitle = { ...validDraft(), title: "x".repeat(LIMITS.titleMax + 1) };
    assert(
      validateDraft(longTitle, NOW).some((i) => i.field === "title"),
      "an overlong title is refused",
    );

    const noBody = { ...validDraft(), body: "short" };
    assert(validateDraft(noBody, NOW).some((i) => i.field === "body"), "a too-short body is refused");

    const noChannels = { ...validDraft(), channels: [] as ("in-app" | "email")[] };
    assert(
      validateDraft(noChannels as NotificationDraft, NOW).some((i) => i.field === "channels"),
      "at least one channel is required",
    );

    const noAudience = { ...validDraft(), audience: "" as const };
    assert(
      validateDraft(noAudience, NOW).some((i) => i.field === "audience"),
      "an audience must be chosen",
    );

    const selectedButEmpty = { ...validDraft(), audience: "selected-investors" as const, selectedInvestorIds: [] };
    assert(
      validateDraft(selectedButEmpty, NOW).some((i) => i.field === "audience"),
      "a manual list with no members is refused",
    );
  }

  // === 3. Unconfigured channels cannot be used ==========================
  {
    // No channel is confirmed by the backend. This is the correction: the portal
    // previously asserted in-app and email were configured without authority.
    assert(!anyChannelConfirmed(), "no channel may be reported as confirmed without a backend response");
    for (const channel of CHANNELS) {
      assert(channelState(channel) === "unconfirmed", `${channel} must default to unconfirmed`);
      assert(!channelAvailability(channel).selectable, `${channel} must not be selectable while unconfirmed`);
      assert(
        channelAvailability(channel).note.includes("Integration pending"),
        `${channel} must state that it is integration pending, not merely unavailable`,
      );
    }

    // "We checked and found nothing" must remain distinguishable from "nobody checked".
    const unsupported = { sms: "unsupported" as const };
    assert(channelState("sms", unsupported) === "unsupported", "an explicit unsupported verdict is preserved");
    assert(
      channelAvailability("sms", unsupported).note.includes("Unsupported"),
      "an unsupported channel says so, rather than reusing the pending copy",
    );
    assert(!channelAvailability("sms", unsupported).selectable, "an unsupported channel is still not selectable");

    // A confirmed channel becomes selectable — the map is live data, not a dead end.
    const confirmedEmail = { email: "confirmed" as const };
    assert(channelAvailability("email", confirmedEmail).selectable, "a confirmed channel is selectable");
    assert(anyChannelConfirmed(confirmedEmail), "one confirmed channel is enough to enable submission");
    assert(!anyChannelConfirmed(unsupported), "an unsupported verdict never counts as confirmed");

    // A draft that includes an unconfigured channel is refused with that reason.
    const withSms = { ...validDraft(), channels: ["sms"] as ("sms")[] };
    const issues = validateDraft(withSms as NotificationDraft, NOW);
    assert(
      issues.some((i) => i.field === "channels" && i.message.includes("SMS")),
      "including SMS must be refused, naming the channel",
    );

    // Any channel — including in-app — is refused while unconfirmed.
    const withInApp = { ...validDraft(), channels: ["in-app"] as ("in-app")[] };
    assert(
      validateDraft(withInApp, NOW).some((i) => i.field === "channels" && i.message.includes("In-app")),
      "in-app must be refused too while no delivery provider is confirmed",
    );

    assert(!automatedEventAvailable(["sms"]), "an automated event on SMS is unavailable");
    assert(
      !automatedEventAvailable(["in-app", "email"]),
      "an automated event on unconfirmed channels is unavailable, even for in-app and email",
    );
    assert(!automatedEventAvailable([]), "an automated event with no channel is unavailable");
    assert(
      automatedEventAvailable(["email"], confirmedEmail),
      "an automated event becomes available once a channel it uses is confirmed",
    );

    // Even a fully valid draft cannot submit, because no channel can deliver it.
    const blocked = canSubmit(validDraft(), NOW, "approved");
    assert(!blocked.allowed, "a valid draft is still refused while no channel is confirmed");
  }

  // === 4. Recipient counts are never invented ===========================
  {
    assert(
      describeCount(null).includes("unavailable"),
      "a null count must say unavailable, not zero",
    );
    assert(
      describeCount(undefined).includes("unavailable"),
      "an undefined count must say unavailable",
    );
    assert(
      !describeCount(null).includes("0 recipient"),
      "an unknown count must never render as zero recipients",
    );
    assert(describeCount(0) === "0 recipients", "a real zero from the backend is shown as zero");
    assert(describeCount(1) === "1 recipient", "singular is handled");
    assert(describeCount(1234).includes("1,234"), "counts are grouped for readability");
    assert(describeCount(-5).includes("unavailable"), "a nonsense negative count is not displayed");
  }

  // === 5. Scheduling ====================================================
  {
    assert(validateSchedule(null, NOW) === null, "no schedule means send now, which is valid");

    const past = validateSchedule("2026-11-16T09:00:00.000Z", NOW);
    assert(past !== null && past.message.includes("future"), "a past schedule is refused");

    const nowExact = validateSchedule(NOW, NOW);
    assert(nowExact !== null, "scheduling for exactly now is refused — it would send immediately");

    assert(validateSchedule(LATER, NOW) === null, "a future schedule is accepted");

    const tooFar = validateSchedule("2028-11-18T09:00:00.000Z", NOW);
    assert(tooFar !== null && tooFar.message.includes("365"), "a schedule beyond a year is refused");

    assert(validateSchedule("not-a-date", NOW) !== null, "an unparseable date is refused");
  }

  // === 6. Call-to-action links must be HTTPS ============================
  {
    assert(validateCallToAction(null) === null, "no link is acceptable");
    assert(validateCallToAction("") === null, "an empty link is acceptable");
    assert(validateCallToAction("https://starfetch.ng/products") === null, "a full https link is accepted");

    for (const bad of ["http://starfetch.ng/x", "javascript:alert(1)", "data:text/html,<b>x", "//evil.com/x", "/relative", "ftp://x"]) {
      assert(validateCallToAction(bad) !== null, `the link "${bad}" must be refused`);
    }
    assert(validateCallToAction("https://x.ng/a b") !== null, "a link containing a space is refused");
  }

  // === 7. Templates and placeholders ====================================
  {
    const body = "Hi {{firstName}}, your {{ productName }} matures on {{maturityDate}}.";
    assert(
      templatePlaceholders(body).join(",") === "firstName,maturityDate,productName",
      "placeholders are extracted and sorted, tolerating inner spaces",
    );

    assert(
      missingPlaceholders(body, ["firstName"]).join(",") === "maturityDate,productName",
      "placeholders not yet supplied are reported",
    );
    assert(missingPlaceholders(body, ["firstName", "productName", "maturityDate"]).length === 0, "all supplied means none missing");

    const unknown = unknownPlaceholders("Hi {{firstName}}, ref {{secretBalance}}", [...SUPPORTED_PLACEHOLDERS]);
    assert(unknown.join() === "secretBalance", "an unsupported placeholder is detected");

    const templateIssues = validateTemplate("Hi {{firstName}} {{mysteryField}}");
    assert(
      templateIssues.some((i) => i.message.includes("mysteryField")),
      "template validation names the unsupported placeholder",
    );
    assert(templateIssues.every((i) => i.field === "templateBody"), "template issues are attributed to the body field");
  }

  // === 8. Maker-checker is preserved in the decision dialog =============
  {
    // A rejection with a real reason is ready.
    assert(
      decisionReadiness({ action: "reject", type: "transaction", reason: "Amount exceeds the approved limit.", stepUpSatisfied: true, contract: "approved" }).allowed,
      "a reasoned rejection is ready",
    );

    // A rejection with no reason is not.
    const bare = decisionReadiness({ action: "reject", type: "transaction", reason: "", stepUpSatisfied: true, contract: "approved" });
    assert(!bare.allowed, "a rejection without a reason is refused");

    const tooShort = decisionReadiness({ action: "reject", type: "transaction", reason: "no", stepUpSatisfied: true, contract: "approved" });
    assert(!tooShort.allowed, `a reason under ${LIMITS.reasonMin} characters is refused`);

    // Step-up is required for money-moving and authority-creating types.
    for (const type of ["investment", "transaction", "finance-adjustment", "bank-details", "staff-permission"] as ApprovalType[]) {
      assert(requiresStepUp(type), `${type} must require step-up`);
      const blocked = decisionReadiness({ action: "approve", type, reason: "", stepUpSatisfied: false, contract: "approved" });
      assert(!blocked.allowed, `${type} must not be approvable without step-up`);
      assert(blocked.reason.includes("Reauthenticate"), `${type} must ask for reauthentication`);
    }

    // Read-mostly types do not require step-up.
    for (const type of ["kyc-final", "product", "campaign"] as ApprovalType[]) {
      assert(!requiresStepUp(type), `${type} does not require step-up`);
      assert(
        decisionReadiness({ action: "approve", type, reason: "", stepUpSatisfied: false, contract: "approved" }).allowed,
        `${type} may be approved without step-up`,
      );
    }

    // Even a fully-prepared approval is inert without an approved contract.
    const pending = decisionReadiness({ action: "approve", type: "kyc-final", reason: "", stepUpSatisfied: true, contract: "not-approved" });
    assert(!pending.allowed, "no approval is possible while the contract is pending");
  }

  // === 9. Step-up panel states ==========================================
  {
    assert(!stepUpState(false, false, "approved").show, "no panel when step-up is not required");

    const needed = stepUpState(true, false, "approved");
    assert(needed.show && needed.canVerify, "the panel offers verification when the backend is live");

    const pending = stepUpState(true, false, "not-approved");
    assert(pending.show && !pending.canVerify, "the panel is shown but cannot verify while the contract is pending");
    assert(pending.note.includes("not available"), "and it explains why");

    const done = stepUpState(true, true, "approved");
    assert(done.show && !done.canVerify && done.note.includes("satisfied"), "a satisfied step-up is reported");
  }

  // === 10. MFA shapes, never values =====================================
  {
    assert(isValidTotpShape("123456"), "a six-digit code has a valid shape");
    for (const bad of ["12345", "1234567", "abcdef", "12 34 56", "", "12345a"]) {
      assert(!isValidTotpShape(bad), `"${bad}" is not a valid TOTP shape`);
    }
    assert(isValidTotpShape(" 123456 "), "surrounding whitespace is tolerated");

    assert(isValidRecoveryShape("ABCD-EFGH-IJKL"), "a recovery code shape is accepted");
    assert(!isValidRecoveryShape("has space"), "a recovery code with a space is refused");
    assert(!isValidRecoveryShape("short"), "an implausibly short recovery code is refused");

    assert(isValidReauthShape("correct horse battery"), "a plausible password is accepted");
    assert(!isValidReauthShape("short"), "a password under 8 characters is refused");

    // Enrolment is ordered and terminal.
    assert(nextEnrolmentStep("choose-method") === "confirm-identity", "enrolment advances in order");
    assert(nextEnrolmentStep("recovery-codes") === "complete", "the last step before completion is recovery codes");
    assert(nextEnrolmentStep("complete") === null, "completion is terminal");

    const allDone = Object.fromEntries(
      ["choose-method", "confirm-identity", "register-factor", "verify-factor", "recovery-codes", "complete"].map((s) => [s, true]),
    ) as Record<EnrolmentStep, boolean>;
    assert(enrolmentComplete(allDone), "every step done means enrolment is complete");

    const missingVerify = { ...allDone, "verify-factor": false };
    assert(!enrolmentComplete(missingVerify), "a registered but unverified factor is not enrolment");

    assert(mfaMethodLabel("passkey") === "Passkey", "method labels are human readable");
  }

  // === 11. Session clock is a courtesy, not a control ===================
  {
    assert(sessionClock(null, NOW).expired, "no session is expired");
    assert(sessionClock("2026-11-17T08:00:00.000Z", NOW).expired, "a past expiry is expired");

    const fresh = sessionClock("2026-11-17T17:00:00.000Z", NOW);
    assert(!fresh.expired, "a future expiry is live");
    assert(fresh.display === "8h 0m remaining", "remaining time is displayed in hours and minutes");
    assert(!fresh.warning, "eight hours out is not a warning");

    const soon = sessionClock("2026-11-17T09:03:00.000Z", NOW);
    assert(soon.warning, "under five minutes raises the expiry warning");
    assert(soon.display.includes("3m"), "the warning shows the minutes left");

    assert(sessionClock("nonsense", NOW).expired, "an unparseable expiry is treated as expired, not valid");
    assert(INACTIVITY_TIMEOUT_MINUTES === 15, "the inactivity timeout matches the staff auth contract");
    assert(ABSOLUTE_SESSION_HOURS === 8, "the absolute lifetime matches the staff auth contract");
  }

  // === 12. Queue filtering ==============================================
  {
    const item = { type: "transaction" as ApprovalType, reference: "TX-1001", submittedBy: "staff-maker", stage: "submitted" };
    const other = { type: "kyc-final" as ApprovalType, reference: "KYC-2002", submittedBy: "staff-other", stage: "approved" };

    assert(matchesApprovalFilter(item, { type: "", search: "", stage: "" }), "an empty filter matches everything");
    assert(!matchesApprovalFilter(item, { type: "kyc-final", search: "", stage: "" }), "a type filter excludes other types");
    assert(matchesApprovalFilter(item, { type: "transaction", search: "", stage: "" }), "a type filter includes the matching type");
    assert(!matchesApprovalFilter(item, { type: "", search: "", stage: "approved" }), "a stage filter excludes other stages");
    assert(matchesApprovalFilter(item, { type: "", search: "tx-1001", stage: "" }), "search is case-insensitive on reference");
    assert(matchesApprovalFilter(item, { type: "", search: "maker", stage: "" }), "search matches the submitter");
    assert(matchesApprovalFilter(item, { type: "", search: "transaction", stage: "" }), "search matches the type label");
    assert(!matchesApprovalFilter(other, { type: "", search: "tx-1001", stage: "" }), "search does not match an unrelated row");
    assert(matchesApprovalFilter(item, { type: "", search: "   ", stage: "" }), "whitespace-only search matches everything");
  }

  // === 13. Generic list controls ========================================
  {
    const rows = [
      { name: "beta", amount: 20 },
      { name: "Alpha", amount: 100 },
      { name: "gamma", amount: 5 },
    ];

    assert(filterRows(rows, "alp", ["name"]).length === 1, "filter is case-insensitive");
    assert(filterRows(rows, "", ["name"]).length === 3, "an empty query returns everything");
    assert(filterRows(rows, "zzz", ["name"]).length === 0, "a non-matching query returns nothing");
    assert(filterRows(rows, "1", ["name", "amount"]).length === 0, "non-string fields are not matched by text search");
    assert(rows.length === 3, "filtering does not mutate the input");

    const asc = sortRows(rows, "amount", "asc");
    assert(asc.map((r) => r.amount).join() === "5,20,100", "numeric ascending sort");
    assert(rows[0].amount === 20, "sorting does not mutate the input");

    const byName = sortRows(rows, "name", "desc");
    assert(byName[0].name === "gamma", "string descending sort");

    const paged = pageRows(rows, 2, 2);
    assert(paged.items.length === 1 && paged.totalPages === 2 && paged.total === 3, "paging reports and slices correctly");
    assert(pageRows(rows, 99, 2).page === 2, "an out-of-range page is clamped to the last page");
    assert(pageRows(rows, 0, 2).page === 1, "a page below one is clamped to the first");
    assert(pageRows([], 1, 20).totalPages === 1, "an empty list still reports one page");
  }

  // === 14. Destructive confirmation =====================================
  {
    assert(confirmationMatches("TX-1001", "TX-1001"), "an exact retype confirms");
    assert(confirmationMatches("  TX-1001  ", "TX-1001"), "surrounding whitespace is tolerated");
    assert(!confirmationMatches("", "TX-1001"), "an empty retype does not confirm");
    assert(!confirmationMatches("tx-1001", "TX-1001"), "confirmation is case-sensitive");
    assert(!confirmationMatches("TX-100", "TX-1001"), "a partial retype does not confirm");
  }

  // === 15. Enumerations stay in sync with the UI ========================
  {
    assert(CHANNELS.length === 4, "four channels are declared");
    assert(AUDIENCES.length === 6, "six audiences are declared");
    assert(AUDIENCES.includes("selected-investors"), "the manual list audience exists");
    assert(SUPPORTED_PLACEHOLDERS.includes("firstName"), "the placeholder set includes the common fields");
  }

  console.log(
    "PASS — Prepared-UI logic: no draft, approval, template or enrolment is actionable while its contract is " +
      "pending, and a complete valid draft still cannot submit; unconfigured SMS and push are refused with the " +
      "reason stated; an unknown recipient count reports unavailable rather than zero; past and over-horizon " +
      "schedules are refused; call-to-action links are HTTPS-only; unsupported template placeholders are named; " +
      "step-up is required for every money-moving or authority-creating approval and is inert until the auth " +
      "contract is live; MFA validates shape and never a value; the session clock treats an unparseable expiry " +
      "as expired; and search, sort, paging and destructive confirmation behave without mutating their input.",
  );
}

main();
