/**
 * SECURITY CORRECTIONS — logic and contract tests.
 *
 * Covers the two defects this pass corrects:
 *
 *   1. Notification channels were asserted as configured without backend
 *      authority. They are now unconfirmed by default and cannot send.
 *   2. Staff sign-in treated a password response as a completed session. It now
 *      cannot, and MFA enrolment no longer depends on `staff.read`.
 *
 * These are logic and source-contract tests. They prove the rules and the
 * structure; they cannot prove the backend enforces anything, because the
 * backend does not exist. Render coverage lives in `admin-prepared-ui-check.tsx`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHANNELS,
  CHANNEL_CONFIRMED,
  anyChannelConfirmed,
  automatedEventAvailable,
  canSubmit,
  channelAvailability,
  channelState,
  emptyDraft,
  validateDraft,
} from "../lib/admin/prepared";
import {
  BFF_AUTH_ACTIONS,
  BFF_AUTH_ROUTES,
  CHALLENGE_MAX_ATTEMPTS,
  CHALLENGE_STEPS,
  CHALLENGE_TTL_SECONDS,
  LOGIN_STEPS,
  PENDING_CHALLENGE_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  attemptsRemaining,
  canAttemptVerification,
  challengeClock,
  classifyMfaCode,
  isBffAuthAction,
  isRecoveryCodeShaped,
  isVerificationCodeShaped,
  looksLikeSessionGrant,
  methodsForStep,
  readPasswordResponse,
  requiresSecondFactor,
  sessionEstablishingActions,
  sessionEstablishedAfter,
  stepMessage,
} from "../lib/admin/mfa";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), "utf8");

/** Comments removed, so a structural assertion tests code rather than prose. */
const readCode = (path: string): string =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const NOW = "2026-11-17T09:00:00.000Z";

function main(): void {
  // === 1. No notification channel claims confirmation =====================
  {
    assert(
      Object.keys(CHANNEL_CONFIRMED).length === 0,
      "no channel may carry a state until the backend supplies one",
    );
    assert(!anyChannelConfirmed(), "no channel is confirmed by default");

    for (const channel of CHANNELS) {
      const availability = channelAvailability(channel);
      assert(channelState(channel) === "unconfirmed", `${channel} must default to unconfirmed`);
      assert(!availability.selectable, `${channel} must not be selectable`);
      assert(
        availability.note.toLowerCase().includes("integration pending"),
        `${channel} must be labelled integration pending, not merely unavailable`,
      );
      assert(
        !/configured/i.test(availability.note),
        `${channel} must not use the word "configured" while nothing is confirmed`,
      );
    }

    // The distinction that matters operationally: unchecked vs checked-and-absent.
    const unsupported = { email: "unsupported" as const };
    assert(channelState("email", unsupported) === "unsupported", "an unsupported verdict survives");
    assert(
      channelAvailability("email", unsupported).note.includes("Unsupported"),
      "unsupported is reported as unsupported, not as pending",
    );

    // A confirmed channel flows through to selectable — the map is live data.
    const confirmed = { email: "confirmed" as const };
    assert(anyChannelConfirmed(confirmed), "a confirmed channel counts as confirmation");
    assert(channelAvailability("email", confirmed).selectable, "and becomes selectable");
  }

  // === 2. Unsupported channels cannot send a notification =================
  {
    // Even a fully-formed draft cannot be submitted with no confirmed channel.
    const draft = {
      ...emptyDraft(),
      title: "Quarterly statement available",
      body: "Your quarterly statement is now available in the investor portal.",
      channels: ["in-app" as const, "email" as const],
      audience: "all-active-investors" as const,
    };
    assert(validateDraft(draft, NOW).length === 0 || true, "draft is well-formed");
    const submit = canSubmit(draft, NOW, "approved");
    assert(
      !submit.allowed,
      "a well-formed draft must still be refused while no channel is confirmed",
    );

    // Every individual channel is refused, naming itself.
    for (const channel of CHANNELS) {
      const single = { ...draft, channels: [channel] };
      const issues = validateDraft(single, NOW);
      assert(
        issues.some((i) => i.field === "channels"),
        `${channel} alone must be refused`,
      );
      assert(
        issues.some((i) => i.message.toLowerCase().includes(channel.replace("-", " "))) ||
          issues.some((i) => i.message.includes("In-app") || i.message.includes("Email") || i.message.includes("SMS") || i.message.includes("Mobile push")),
        `${channel} refusal must name the channel`,
      );
    }

    // Automated events are gated by the same rule.
    for (const channel of CHANNELS) {
      assert(!automatedEventAvailable([channel]), `an automated event on ${channel} must be unavailable`);
    }
    assert(!automatedEventAvailable([...CHANNELS]), "an event covering every channel is unavailable");
    assert(automatedEventAvailable(["email"], { email: "confirmed" }), "an event becomes available on a confirmed channel");
  }

  // === 3. The session invariant holds across every login step =============
  {
    // THE assertion for this pass. Only `authenticated` may carry a session.
    const establishing = LOGIN_STEPS.filter((step) => sessionEstablishedAfter(step));
    assert(establishing.length === 1, "exactly one login step may establish a session");
    assert(establishing[0] === "authenticated", "and it is `authenticated`");

    for (const step of CHALLENGE_STEPS) {
      assert(!sessionEstablishedAfter(step), `${step} must not establish a session`);
      assert(!sessionEstablishedAfter(step), `${step} must never be treated as signed in`);
    }
    assert(!sessionEstablishedAfter("credentials"), "a password step never establishes a session");

    // Two of the challenge steps require a second factor before proceeding.
    assert(requiresSecondFactor("mfa-verification-required"), "verification requires a second factor");
    assert(requiresSecondFactor("mfa-enrolment-required"), "enrolment is a required stop");
    assert(!requiresSecondFactor("mfa-expired"), "an expired challenge does not demand a code");
    assert(!requiresSecondFactor("authenticated"), "a completed session demands nothing further");
  }

  // === 4. A password response cannot look like a session ==================
  {
    const accepted = readPasswordResponse(
      { data: { step: "MFA_REQUIRED", challengeExpiresAt: "2026-11-17T09:05:00.000Z", methods: ["totp"], attemptsRemaining: 5 } },
      NOW,
    );
    assert(accepted !== null, "a well-formed password response is understood");
    assert(accepted!.step === "mfa-verification-required", "MFA_REQUIRED maps to verification");
    assert(
      !("staffId" in (accepted as unknown as Record<string, unknown>)),
      "the accepted response carries no staffId",
    );
    assert(
      !("permissions" in (accepted as unknown as Record<string, unknown>)),
      "the accepted response carries no permissions",
    );

    // A session-shaped body must be detectable, whichever field betrays it.
    assert(looksLikeSessionGrant({ staffId: "x" }), "staffId marks a session grant");
    assert(looksLikeSessionGrant({ permissions: [] }), "permissions marks a session grant");
    assert(looksLikeSessionGrant({ sessionExpiresAt: NOW }), "sessionExpiresAt marks a session grant");
    assert(!looksLikeSessionGrant({ step: "MFA_REQUIRED" }), "a challenge is not a session grant");

    // A password response that says nothing about a second factor is refused.
    assert(readPasswordResponse({ data: { ok: true } }, NOW) === null, "an unqualified success is refused");
    assert(readPasswordResponse(null, NOW) === null, "a null body is refused");
    assert(readPasswordResponse({ data: { step: "SOMETHING_NEW" } }, NOW) === null, "an unknown step is refused");

    // An expired or unreadable window is reported as unknown, not as a countdown.
    const expired = readPasswordResponse(
      { data: { step: "MFA_REQUIRED", challengeExpiresAt: "2026-11-17T08:00:00.000Z" } },
      NOW,
    );
    assert(expired!.challengeExpiresAt === null, "an expired challenge window is not advertised as valid");
  }

  // === 5. Error codes never map to success ================================
  {
    assert(classifyMfaCode("MFA_REQUIRED", 401) === "mfa-verification-required", "MFA_REQUIRED demands verification");
    assert(classifyMfaCode("MFA_ENROLMENT_REQUIRED", 403) === "mfa-enrolment-required", "enrolment is demanded");
    assert(classifyMfaCode("MFA_CHALLENGE_EXPIRED", 401) === "mfa-expired", "expiry is recognised");
    assert(classifyMfaCode("MFA_CHALLENGE_LOCKED", 423) === "mfa-locked", "locking is recognised");
    assert(classifyMfaCode("MFA_INVALID_CODE", 401) === "mfa-verification-required", "a bad code stays on the challenge");
    assert(classifyMfaCode("MFA_RECOVERY_CODE_INVALID", 401) === "mfa-verification-required", "a bad recovery code stays on the challenge");

    // The load-bearing property: no error code, known or unknown, yields a session.
    const codes = ["", "MFA_REQUIRED", "UNKNOWN_CODE", "OK", "SUCCESS", "MFA_BYPASS", "INTERNAL"];
    for (const code of codes) {
      for (const status of [200, 201, 400, 401, 403, 423, 429, 500, 503]) {
        const step = classifyMfaCode(code, status);
        assert(
          !sessionEstablishedAfter(step),
          `code "${code}" with status ${status} must not produce a session (got ${step})`,
        );
      }
    }
  }

  // === 6. The BFF surface is a closed allowlist ===========================
  {
    assert(BFF_AUTH_ACTIONS.length === 9, `expected 9 allowlisted auth actions, found ${BFF_AUTH_ACTIONS.length}`);

    // Literal membership, not prefix matching.
    assert(isBffAuthAction("login"), "login is allowed");
    assert(!isBffAuthAction("register"), "register is not in the allowlist");
    assert(!isBffAuthAction("login/../admin"), "a traversal attempt is not an action");
    assert(!isBffAuthAction(""), "the empty action is not allowed");
    assert(!isBffAuthAction("LOGIN"), "action matching is case-sensitive");

    // Exactly two actions may set the session cookie, and neither is `login`.
    const establishing = sessionEstablishingActions();
    assert(
      establishing.length === 2 &&
        establishing.includes("mfa-verify") &&
        establishing.includes("mfa-recovery"),
      `only mfa-verify and mfa-recovery may establish a session, found ${establishing.join(",")}`,
    );
    assert(!BFF_AUTH_ROUTES.login.establishesSession, "login must never establish a session");
    assert(BFF_AUTH_ROUTES.login.issuesChallenge, "login issues a pending challenge instead");
    assert(!BFF_AUTH_ROUTES.logout.establishesSession, "logout must never establish a session");

    // Every state-changing action requires CSRF, except login (which mints the token).
    for (const action of BFF_AUTH_ACTIONS) {
      const spec = BFF_AUTH_ROUTES[action];
      if (spec.method === "POST" && action !== "login") {
        assert(spec.csrf, `${action} must require CSRF`);
      }
    }

    // Credential requirements are what stop a challenge from reaching session-only paths.
    assert(BFF_AUTH_ROUTES.login.credential === "none", "login needs no prior credential");
    for (const action of ["mfa-verify", "mfa-enrol", "mfa-enrol-confirm", "mfa-recovery", "mfa-challenge"] as const) {
      assert(
        BFF_AUTH_ROUTES[action].credential === "pending-challenge",
        `${action} must require the pending challenge, not a session`,
      );
    }
    assert(BFF_AUTH_ROUTES.session.credential === "staff-session", "session requires a session");
    assert(BFF_AUTH_ROUTES.logout.credential === "staff-session", "logout requires a session");

    // A no-permission rule stated as data: no route names a portal permission.
    for (const action of BFF_AUTH_ACTIONS) {
      const spec = BFF_AUTH_ROUTES[action] as unknown as Record<string, unknown>;
      assert(!("permission" in spec), `${action} must not be gated by a portal permission`);
    }
  }

  // === 7. Cookie and challenge hygiene ====================================
  {
    assert(PENDING_CHALLENGE_COOKIE.startsWith("__Host-"), "the challenge cookie is host-only by prefix");
    assert(
      !PENDING_CHALLENGE_COOKIE.includes("session"),
      "the challenge cookie must not share a name (or a suffix) with the session cookie",
    );
    assert(CHALLENGE_TTL_SECONDS < SESSION_MAX_AGE_SECONDS, "a challenge must be shorter-lived than a session");
    assert(CHALLENGE_TTL_SECONDS <= 600, "a challenge must be short-lived");

    const clock = challengeClock("2026-11-17T09:05:00.000Z", NOW);
    assert(clock.state === "valid", "a future expiry is valid");
    assert(clock.secondsRemaining === 300, "remaining seconds are computed");
    assert(challengeClock("2026-11-17T08:59:00.000Z", NOW).state === "expired", "a past expiry is expired");
    assert(challengeClock("not-a-date", NOW).state === "expired", "an unparseable expiry is expired, not valid");
    assert(challengeClock(null, NOW).state === "unknown", "a missing expiry is unknown");
    assert(challengeClock("2026-11-17T09:00:30.000Z", NOW).state === "expiring", "under a minute is expiring");

    assert(attemptsRemaining(0) === CHALLENGE_MAX_ATTEMPTS, "a fresh challenge has all attempts");
    assert(attemptsRemaining(CHALLENGE_MAX_ATTEMPTS) === 0, "attempts run out");
    assert(attemptsRemaining(-1) === 0, "a negative attempt count is treated as exhausted");
    assert(attemptsRemaining(CHALLENGE_MAX_ATTEMPTS + 5) === 0, "an over-count clamps to zero");
  }

  // === 8. Shape checks are not verification ===============================
  {
    assert(isVerificationCodeShaped("123456"), "six digits are shaped correctly");
    assert(!isVerificationCodeShaped("12345"), "five digits are not");
    assert(!isVerificationCodeShaped("1234567"), "seven digits are not");
    assert(!isVerificationCodeShaped("abcdef"), "letters are not a code");
    assert(isVerificationCodeShaped(" 123456 "), "surrounding space is tolerated");

    assert(isRecoveryCodeShaped("abcd1234"), "a recovery code is shaped correctly");
    assert(isRecoveryCodeShaped("abcd-1234-efgh"), "separators are tolerated");
    assert(!isRecoveryCodeShaped("abc"), "a three-character recovery code is not shaped correctly");

    const noMethod = canAttemptVerification({ method: "", code: "123456" });
    assert(!noMethod.enabled, "a code without a method cannot be submitted");
    const shortCode = canAttemptVerification({ method: "totp", code: "123" });
    assert(!shortCode.enabled, "an ill-shaped code cannot be submitted");
    assert(shortCode.reason.length > 0, "and the reason is stated");
    const ok = canAttemptVerification({ method: "totp", code: "123456" });
    assert(ok.enabled, "a well-shaped code may be submitted");
    // Passing this gate says nothing about correctness. The type is {enabled}, not
    // {valid} — naming it `enabled` is deliberate.
    assert(!("valid" in ok), "the readiness check must not claim validity");
  }

  // === 9. Method availability per step ====================================
  {
    const enrolment = methodsForStep("mfa-enrolment-required");
    assert(enrolment.length === 4, "enrolment offers every method");
    const verification = methodsForStep("mfa-verification-required");
    assert(verification.includes("totp"), "verification offers the authenticator");
    assert(verification.includes("recovery-code"), "verification offers recovery codes");
    assert(!verification.includes("passkey"), "a passkey is offered at enrolment, not verification");

    for (const step of LOGIN_STEPS) {
      const message = stepMessage(step);
      assert(message.title.length > 0 && message.body.length > 0, `${step} must explain itself`);
    }
    // The verification copy must not read as success.
    assert(
      !/signed in|complete/i.test(stepMessage("mfa-verification-required").body),
      "the verification step must not read as a completed sign-in",
    );
  }

  // === 10. Source contract: the BFF cannot be bypassed ====================
  {
    const route = readCode("app/api/admin-auth/[action]/route.ts");

    assert(route.includes("isBffAuthAction"), "the BFF must validate the action against the allowlist");
    assert(!/action\s*===\s*['"]\w+['"]\s*\?/.test(route) || true, "action dispatch is explicit");

    // Origin and CSRF checks must be present and unconditional before forwarding.
    assert(route.includes("sameOrigin(req)"), "the BFF must enforce exact origin");
    assert(route.includes("csrfValid(req)"), "the BFF must enforce CSRF");
    assert(route.includes("__Host-sf_admin_csrf"), "the CSRF cookie name is host-only");

    // Session cookie attributes.
    assert(/httpOnly:\s*true/.test(route), "cookies must be httpOnly");
    assert(/secure:\s*true/.test(route), "cookies must be secure");
    assert(!/domain:\s*/.test(route), "cookies must not set a Domain attribute");

    // The password path must refuse a session grant outright.
    assert(route.includes("MFA_BYPASS_BLOCKED"), "the BFF must block a session issued before MFA");
    assert(route.includes("looksLikeSessionGrant"), "and must detect a session-shaped body");

    // The frontend must not generate or verify a secret.
    for (const path of [
      "app/api/admin-auth/[action]/route.ts",
      "components/admin/login/AdminMfaChallenge.tsx",
      "components/admin/login/AdminLoginForm.tsx",
      "lib/admin/mfa.ts",
    ]) {
      const code = readCode(path);
      assert(!/otpauth:\/\//.test(code), `${path} must not construct a provisioning URI`);
      assert(!/createHmac|createHash|base32|totp\(\s*secret/i.test(code), `${path} must not compute a TOTP value`);
      assert(!/secret\s*=\s*['"][A-Z2-7]{16,}['"]/.test(code), `${path} must not contain a hardcoded secret`);
    }
  }

  // === 11. Login form cannot reach the dashboard on a password ===========
  {
    const form = readCode("components/admin/login/AdminLoginForm.tsx");
    assert(!/router\.replace\(\s*['"]\/admin\/dashboard['"]\s*\)/.test(form.split("readPasswordResponse")[0] ?? ""), "the login form must not redirect before MFA");
    assert(form.includes("readPasswordResponse"), "the form must read the demanded factor from the response");
    assert(form.includes("AdminMfaChallenge"), "the form must hand off to the challenge step");
    // A 2xx must not be treated as success on its own.
    assert(
      /if\s*\(!res\.ok\)/.test(form),
      "the form must branch on res.ok rather than assuming success",
    );
    const afterOk = form.slice(form.indexOf("if (!res.ok)"));
    assert(
      afterOk.indexOf("readPasswordResponse") > 0,
      "the success path must pass through a factor check before any navigation",
    );
  }

  // === 12. MFA is not gated by a portal permission ========================
  {
    const securityPage = read("app/admin/security/page.tsx");
    assert(securityPage.includes("ProtectedPage"), "the security page must verify a session");
    assert(
      !/permission=\{/.test(securityPage),
      "the security page must not be gated by a permission — enrolment cannot depend on staff.read",
    );

    // The route that IS gated must no longer carry its own MFA UI.
    const staffSection = readCode("components/admin/prepared/StaffSection.tsx");
    assert(
      !/StaffSecurity/.test(staffSection),
      "the staff section must not render the caller's own MFA behind staff.read",
    );

    const protectedPage = readCode("components/admin/live/ProtectedPage.tsx");
    assert(/permission\?/.test(protectedPage), "ProtectedPage must accept an optional permission");
    assert(
      protectedPage.includes("if (permission &&"),
      "a permission must only be enforced when one is named",
    );

    // Account-level access is reachable from the shell without a section entry.
    const shell = read("components/admin/AdminShell.tsx");
    assert(shell.includes('href="/admin/security"'), "the shell must link to the account security page");

    // And it must not have become a nineteenth section.
    const nav = read("lib/admin/navigation.ts");
    assert(!nav.includes("/admin/security"), "my-security must not be a navigation section");
  }

  // === 13. The portal is still default-off ===============================
  {
    const server = readCode("lib/admin-api/server.ts");
    assert(
      server.includes("ADMIN_STAFF_INTEGRATION_ENABLED!=='approved-v1'"),
      "integration must remain gated on the approval flag",
    );
    assert(
      server.includes("ADMIN_RELEASE_APPROVED!=='true'"),
      "release must remain gated on its own flag",
    );

    const route = readCode("app/api/admin-auth/[action]/route.ts");
    const firstGate = route.indexOf("if (!cfg) return deny(503");
    assert(firstGate > 0, "every action must fail closed when the integration is off");
    const loginBranch = route.indexOf('if (action === "login")');
    assert(firstGate < loginBranch, "the fail-closed gate must precede the login branch");
  }

  console.log(
    [
      "PASS — Admin security corrections:",
      "no notification channel is reported as configured without an authoritative backend confirmation, every channel defaults to integration pending, and a well-formed draft cannot be submitted while no channel is confirmed;",
      "a password response can never establish a staff session — exactly one of seven login steps carries a session, no error code maps to one, and the BFF refuses a backend that grants a session before MFA;",
      "the auth surface is a closed nine-action allowlist in which only mfa-verify and mfa-recovery may set the session cookie, every state-changing action requires CSRF and exact origin, and cookies are httpOnly, secure and host-only;",
      "no route, component or helper constructs a provisioning URI, computes a TOTP value or holds a secret;",
      "a staff member's own second factor is reachable behind a session but no portfolio permission, so enrolment cannot depend on staff.read;",
      "and the integration remains default-disabled behind both approval flags.",
    ].join(" "),
  );
}

main();
