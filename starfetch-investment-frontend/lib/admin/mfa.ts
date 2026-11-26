/**
 * STAFF MFA POLICY — pure logic, no React, no I/O, no network.
 *
 * This module is the single source of truth for the staff sign-in state machine
 * and the allowlisted BFF surface that serves it. It exists because the two most
 * important properties of this correction are *structural*, not stylistic:
 *
 *   1. A password response alone must never produce a staff session.
 *   2. A staff member's own MFA must never depend on a portal permission.
 *
 * Both are encoded here as data and as functions, so the test suites can assert
 * them without rendering anything or reading prose. `AdminLoginForm` is not
 * trusted to remember the rule; it asks this module.
 *
 * NOTHING HERE AUTHENTICATES ANYONE. It decides which screen to show and which
 * upstream call is permitted. The backend issues and validates every credential.
 */

import { MFA_METHODS, type MfaMethod } from "./prepared";

// ---------------------------------------------------------------------------
// Sign-in state machine
// ---------------------------------------------------------------------------

/**
 * The steps a staff sign-in can occupy.
 *
 * `credentials` is the only step where a password is on screen. `authenticated`
 * is the only step where a staff session exists. The gap between them is the
 * whole point of this correction: previously the code jumped straight from a
 * successful password POST to `/admin/dashboard`, which meant one factor was
 * being treated as two.
 */
export type LoginStep =
  | "credentials"
  | "mfa-enrolment-required"
  | "mfa-verification-required"
  | "mfa-expired"
  | "mfa-locked"
  | "unavailable"
  | "authenticated";

export const LOGIN_STEPS: readonly LoginStep[] = [
  "credentials",
  "mfa-enrolment-required",
  "mfa-verification-required",
  "mfa-expired",
  "mfa-locked",
  "unavailable",
  "authenticated",
] as const;

/** Steps that render a second-factor challenge rather than the password form. */
export const CHALLENGE_STEPS: readonly LoginStep[] = [
  "mfa-enrolment-required",
  "mfa-verification-required",
  "mfa-expired",
  "mfa-locked",
] as const;

/**
 * THE INVARIANT. True only for `authenticated`.
 *
 * Every other step — including anything a password alone produced — is false.
 * The logic suite asserts this over the entire enum, so a future edit that makes
 * `mfa-verification-required` count as signed-in fails the build rather than
 * shipping.
 */
export function sessionEstablishedAfter(step: LoginStep): boolean {
  return step === "authenticated";
}

/** Whether the password form should still be reachable from this step. */
export function canReturnToCredentials(step: LoginStep): boolean {
  return step === "mfa-expired" || step === "mfa-locked" || step === "unavailable";
}

/**
 * Whether a step can be left only by completing MFA.
 *
 * `mfa-verification-required` and `mfa-enrolment-required` are inescapable except
 * by verifying, abandoning the attempt (which returns to `credentials` through
 * `signOutIncomplete`), or the challenge expiring.
 */
export function requiresSecondFactor(step: LoginStep): boolean {
  return step === "mfa-verification-required" || step === "mfa-enrolment-required";
}

/**
 * The backend codes this portal understands, and what each maps to.
 *
 * Unknown codes deliberately fall through to `unavailable` rather than to a
 * success state. A new backend error must never be interpreted as progress.
 */
export type MfaErrorCode =
  | "MFA_REQUIRED"
  | "MFA_ENROLMENT_REQUIRED"
  | "MFA_INVALID_CODE"
  | "MFA_CHALLENGE_EXPIRED"
  | "MFA_CHALLENGE_LOCKED"
  | "MFA_CHALLENGE_INVALID"
  | "MFA_METHOD_UNSUPPORTED"
  | "MFA_RECOVERY_CODE_INVALID"
  | "MFA_NOT_ENROLLED";

export function classifyMfaCode(code: string, status: number): LoginStep {
  switch (code) {
    case "MFA_REQUIRED":
      return "mfa-verification-required";
    case "MFA_ENROLMENT_REQUIRED":
    case "MFA_NOT_ENROLLED":
      return "mfa-enrolment-required";
    case "MFA_CHALLENGE_EXPIRED":
      return "mfa-expired";
    case "MFA_CHALLENGE_LOCKED":
      return "mfa-locked";
    case "MFA_INVALID_CODE":
    case "MFA_RECOVERY_CODE_INVALID":
    case "MFA_METHOD_UNSUPPORTED":
    case "MFA_CHALLENGE_INVALID":
      return "mfa-verification-required";
    default:
      // Unrecognised code: fall back on the status class, never on optimism.
      if (status === 503) return "unavailable";
      if (status === 423 || status === 429) return "mfa-locked";
      if (status === 401 || status === 403) return "credentials";
      return "unavailable";
  }
}

/** Operator-facing text for each step. Never claims work that has not happened. */
export function stepMessage(step: LoginStep): { title: string; body: string } {
  switch (step) {
    case "credentials":
      return { title: "Staff sign in", body: "Only individually provisioned Starfetch staff accounts may sign in." };
    case "mfa-enrolment-required":
      return {
        title: "Set up a second factor",
        body: "Your account has no second factor enrolled. Staff access requires one before a session can be issued.",
      };
    case "mfa-verification-required":
      return {
        title: "Confirm it is you",
        body: "Your password was accepted. A second factor is still required — no staff session exists until it is verified.",
      };
    case "mfa-expired":
      return {
        title: "Verification timed out",
        body: "The verification window closed before it was completed. Start again from the beginning.",
      };
    case "mfa-locked":
      return {
        title: "Too many verification attempts",
        body: "This challenge is locked. No session was issued. Wait for the lock to clear, then sign in again.",
      };
    case "unavailable":
      return {
        title: "Verification unavailable",
        body: "The staff authentication service did not confirm the attempt. No session was issued.",
      };
    case "authenticated":
      return { title: "Signed in", body: "Staff session established after backend-confirmed verification." };
  }
}

// ---------------------------------------------------------------------------
// Challenge lifetime
// ---------------------------------------------------------------------------

/**
 * A pending challenge is short-lived and is not a session.
 *
 * 300 seconds is deliberately shorter than any staff session. The backend is the
 * authority on expiry; these values exist so the UI can warn before the backend
 * has to refuse, and so a replayed pending token is useless.
 */
export const CHALLENGE_TTL_SECONDS = 300;
export const CHALLENGE_MAX_ATTEMPTS = 5;

/** The pending-challenge cookie. Distinct from the staff session cookie. */
export const PENDING_CHALLENGE_COOKIE = "__Host-sf_admin_mfa";

/** Absolute session lifetime, mirroring the BFF cookie. Never shorter than a challenge. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export type ClockState = "valid" | "expiring" | "expired" | "unknown";

/**
 * How much of the challenge window is left.
 *
 * An unparseable timestamp is treated as expired, not valid — the same rule the
 * session clock already uses. A clock we cannot read is not evidence of anything.
 */
export function challengeClock(
  expiresAtIso: string | null | undefined,
  nowIso: string,
): { state: ClockState; secondsRemaining: number } {
  if (!expiresAtIso) return { state: "unknown", secondsRemaining: 0 };
  const expires = new Date(expiresAtIso).getTime();
  const now = new Date(nowIso).getTime();
  if (!Number.isFinite(expires) || !Number.isFinite(now)) return { state: "expired", secondsRemaining: 0 };
  const secondsRemaining = Math.floor((expires - now) / 1000);
  if (secondsRemaining <= 0) return { state: "expired", secondsRemaining: 0 };
  if (secondsRemaining <= 60) return { state: "expiring", secondsRemaining };
  return { state: "valid", secondsRemaining };
}

/** Attempts left before the backend locks the challenge. */
export function attemptsRemaining(attempts: number): number {
  if (!Number.isFinite(attempts) || attempts < 0) return 0;
  return Math.max(0, CHALLENGE_MAX_ATTEMPTS - Math.floor(attempts));
}

// ---------------------------------------------------------------------------
// The allowlisted BFF surface
// ---------------------------------------------------------------------------

/**
 * Every auth action the portal will forward, and exactly what it is allowed to do.
 *
 * This is a literal allowlist, not a prefix match. An action absent from this map
 * is a 405 — there is no dynamic path that reaches the backend. That matters more
 * for auth than anywhere else in the portal: a generic proxy on the sign-in
 * surface would let an attacker reach any upstream auth endpoint by name.
 *
 * `establishesSession` is the load-bearing column. Exactly one action may set the
 * staff session cookie, and it is `mfa-verify`. `login` is false: a password
 * response can create a *pending challenge*, never a session.
 *
 * `credential` states what the caller must already hold:
 *   - "none"              — public, rate-limited by the backend
 *   - "pending-challenge" — the short-lived cookie issued after a password
 *   - "staff-session"     — a full session, for session read and logout only
 *
 * Note what is absent from every row: a portal permission. A staff member must be
 * able to enrol their own second factor during sign-in, which happens *before*
 * any session — and therefore before any permission — exists. Requiring
 * `staff.read` here would make enrolment impossible for a locked-out staff
 * member, which is precisely when it is needed.
 */
export type BffAuthAction =
  | "login"
  | "logout"
  | "session"
  | "mfa-challenge"
  | "mfa-verify"
  | "mfa-enrol"
  | "mfa-enrol-confirm"
  | "mfa-recovery"
  | "mfa-status";

export type AuthCredential = "none" | "pending-challenge" | "staff-session";

export type BffRouteSpec = {
  method: "GET" | "POST";
  /** Upstream path on the admin API, appended to the configured base. */
  upstream: string;
  /** Exact-origin + CSRF enforced before the request is forwarded. */
  csrf: boolean;
  /** Caller must present a pending-challenge cookie. */
  credential: AuthCredential;
  /** May set the full staff session cookie. */
  establishesSession: boolean;
  /** May mint or rotate the pending-challenge cookie. */
  issuesChallenge: boolean;
};

export const BFF_AUTH_ROUTES: Record<BffAuthAction, BffRouteSpec> = {
  login: {
    method: "POST",
    upstream: "/auth/login",
    csrf: true,
    credential: "none",
    establishesSession: false,
    issuesChallenge: true,
  },
  logout: {
    method: "POST",
    upstream: "/auth/logout",
    csrf: true,
    credential: "staff-session",
    establishesSession: false,
    issuesChallenge: false,
  },
  session: {
    method: "GET",
    upstream: "/auth/session",
    csrf: false,
    credential: "staff-session",
    establishesSession: false,
    issuesChallenge: false,
  },
  "mfa-challenge": {
    method: "POST",
    upstream: "/auth/mfa/challenge",
    csrf: true,
    credential: "pending-challenge",
    establishesSession: false,
    issuesChallenge: true,
  },
  "mfa-verify": {
    method: "POST",
    upstream: "/auth/mfa/verify",
    csrf: true,
    credential: "pending-challenge",
    establishesSession: true,
    issuesChallenge: false,
  },
  "mfa-enrol": {
    method: "POST",
    upstream: "/auth/mfa/enrol",
    csrf: true,
    credential: "pending-challenge",
    establishesSession: false,
    issuesChallenge: false,
  },
  "mfa-enrol-confirm": {
    method: "POST",
    upstream: "/auth/mfa/enrol/confirm",
    csrf: true,
    credential: "pending-challenge",
    establishesSession: false,
    issuesChallenge: false,
  },
  "mfa-recovery": {
    method: "POST",
    upstream: "/auth/mfa/recovery",
    csrf: true,
    credential: "pending-challenge",
    establishesSession: true,
    issuesChallenge: false,
  },
  "mfa-status": {
    method: "GET",
    upstream: "/auth/mfa/status",
    csrf: false,
    credential: "pending-challenge",
    establishesSession: false,
    issuesChallenge: false,
  },
};

export const BFF_AUTH_ACTIONS = Object.keys(BFF_AUTH_ROUTES) as BffAuthAction[];

export function isBffAuthAction(value: string): value is BffAuthAction {
  return Object.prototype.hasOwnProperty.call(BFF_AUTH_ROUTES, value);
}

/** The actions that may set the staff session cookie. Must be exactly one. */
export function sessionEstablishingActions(): BffAuthAction[] {
  return BFF_AUTH_ACTIONS.filter((action) => BFF_AUTH_ROUTES[action].establishesSession);
}

// ---------------------------------------------------------------------------
// Response shaping
// ---------------------------------------------------------------------------

/**
 * What the browser is told after a password POST.
 *
 * Note the shape: there is no `staffId`, no `permissions`, no `sessionExpiresAt`.
 * Even a compromised or confused client has nothing session-shaped to hold onto.
 * If the backend returns a session cookie at this stage, that is a contract
 * violation and the BFF refuses it — see `looksLikeSessionGrant`.
 */
export type PasswordAccepted = {
  step: "mfa-enrolment-required" | "mfa-verification-required";
  challengeExpiresAt: string | null;
  methods: MfaMethod[];
  attemptsRemaining: number;
};

/** Anything that would make a password response look like a completed sign-in. */
export function looksLikeSessionGrant(payload: Record<string, unknown>): boolean {
  return (
    typeof payload.staffId === "string" ||
    Array.isArray(payload.permissions) ||
    typeof payload.sessionExpiresAt === "string"
  );
}

/**
 * Shape the login response. Returns `null` when the backend has not told us what
 * factor to demand — an omission the portal must not paper over.
 */
export function readPasswordResponse(
  payload: unknown,
  nowIso: string,
): PasswordAccepted | null {
  if (!payload || typeof payload !== "object") return null;
  const envelope = payload as Record<string, unknown>;
  // Accept both a bare body and the `{ data: … }` envelope the API uses.
  const data =
    envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)
      ? (envelope.data as Record<string, unknown>)
      : envelope;
  const raw = typeof data.step === "string" ? data.step : typeof data.mfaState === "string" ? data.mfaState : "";
  const step = classifyMfaCode(raw.toUpperCase().replace(/-/g, "_"), 200);
  if (step !== "mfa-enrolment-required" && step !== "mfa-verification-required") return null;
  const expiresRaw = typeof data.challengeExpiresAt === "string" ? data.challengeExpiresAt : null;
  const clock = challengeClock(expiresRaw, nowIso);
  const methods = Array.isArray(data.methods)
    ? (data.methods.filter((m): m is MfaMethod => typeof m === "string" && (MFA_METHODS as readonly string[]).includes(m)))
    : [];
  const attempts = typeof data.attemptsRemaining === "number" ? data.attemptsRemaining : CHALLENGE_MAX_ATTEMPTS;
  return {
    step,
    // An expired or unreadable window is reported as null, which the form renders
    // as "unknown" rather than as a countdown that would be a lie.
    challengeExpiresAt: clock.state === "valid" || clock.state === "expiring" ? expiresRaw : null,
    methods,
    attemptsRemaining: Math.max(0, Math.min(CHALLENGE_MAX_ATTEMPTS, attempts)),
  };
}

// ---------------------------------------------------------------------------
// Client-side shape checks
// ---------------------------------------------------------------------------

/**
 * Shape checks only. A six-digit code is a *format*, not a credential.
 *
 * The distinction is the reason these live apart from anything that talks to the
 * backend: passing one of these says nothing about whether the code is correct,
 * and no function in this file claims otherwise.
 */
export function isVerificationCodeShaped(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

export function isRecoveryCodeShaped(value: string): boolean {
  const normalised = value.trim().replace(/[\s-]/g, "");
  return /^[A-Za-z0-9]{8,32}$/.test(normalised);
}

export type ChallengeInput = {
  method: MfaMethod | "";
  code: string;
};

/** Whether the verify control may be enabled. Purely a shape gate. */
export function canAttemptVerification(input: ChallengeInput): { enabled: boolean; reason: string } {
  if (!input.method) return { enabled: false, reason: "Choose a verification method." };
  const shaped =
    input.method === "recovery-code" ? isRecoveryCodeShaped(input.code) : isVerificationCodeShaped(input.code);
  if (!shaped) {
    return {
      enabled: false,
      reason:
        input.method === "recovery-code"
          ? "Recovery codes are 8–32 letters and digits."
          : "Enter the six-digit code from your authenticator.",
    };
  }
  return { enabled: true, reason: "" };
}

/** Methods offered at each step. Enrolment offers all four; verification offers the practical two. */
export function methodsForStep(step: LoginStep): readonly MfaMethod[] {
  if (step === "mfa-enrolment-required") return MFA_METHODS;
  return ["totp", "recovery-code"] as const;
}

/**
 * The portal cannot enrol a staff member by itself, and saying so is part of the
 * deliverable. This is the reason shown on every inert control in this flow.
 */
export const MFA_INTEGRATION_NOTE =
  "Prepared against a proposed contract. The backend must implement and David must approve these endpoints before this flow can issue a session.";

/** Where a completed sign-in lands. One place, so it cannot drift. */
export const POST_LOGIN_PATH = "/admin/dashboard";

/** Where an incomplete or failed sign-in returns to. */
export const LOGIN_PATH = "/admin/login";

/** Where a signed-in staff member manages their own second factor. */
export const STAFF_SECURITY_PATH = "/admin/security";
