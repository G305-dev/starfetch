/**
 * STAFF SESSION VALIDATION — one implementation, used everywhere.
 *
 * Why this file exists
 * --------------------
 * The previous validator lived inline in `lib/admin-api/server.ts` and had a
 * bypass:
 *
 *     typeof d.sessionExpiresAt !== "string" || new Date(d.sessionExpiresAt).getTime() <= Date.now()
 *
 * For an unparseable timestamp, `new Date("banana").getTime()` is `NaN`, and
 * `NaN <= n` is **false** — so the guard that was meant to reject the session
 * passed it instead. An expired-timestamp check written this way fails open on
 * exactly the input an attacker controls. It also never verified that the
 * permission array contained usable strings, or that the timestamp was not
 * already in the past by a hair, or that a staff identity was present at all.
 *
 * The rules below are ordered so that every rejection happens before any value is
 * trusted, and every date goes through `parseExpiry`, which cannot return NaN.
 *
 * This is the frontend's own belief about a session. It is NOT authorization:
 * David's backend authorizes every request independently. A session that passes
 * here only means "the frontend is willing to render staff chrome and forward the
 * cookie"; the backend may still refuse, and is expected to.
 */

import type { Permission, StaffSession } from "./contracts";

/** A reason the session was refused. Never rendered — logged and asserted only. */
export type SessionRejection =
  | "not-an-object"
  | "missing-data"
  | "not-a-staff-object"
  | "missing-staff-id"
  | "missing-display-name"
  | "invalid-role"
  | "invalid-permissions"
  | "empty-permissions"
  | "missing-expiry"
  | "unparseable-expiry"
  | "expired"
  | "implausible-expiry"
  | "missing-mfa-assurance"
  | "invalid-mfa-assurance";

export type SessionValidationResult =
  | { ok: true; session: StaffSession }
  | { ok: false; reason: SessionRejection };

/**
 * Parses a session expiry into epoch milliseconds, or null.
 *
 * Accepts a date-time string that `Date.parse` understands AND that round-trips
 * to a real calendar instant. `Number.isFinite` is the guard that the old code
 * lacked: it is what turns the NaN bypass into a rejection.
 *
 * Numeric strings ("1795000000000") and bare numbers are refused. `Date.parse`
 * tolerates enough odd formats already; accepting an epoch count as well would
 * make "0" and "1" parseable, and a session that expires in 1970 is not a session
 * we want to reason about.
 */
export function parseExpiry(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Reject all-digit strings before Date.parse invents a year from them.
  if (/^-?\d+$/.test(trimmed)) return null;
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

/**
 * Longest session this frontend will believe. A backend that hands back an expiry
 * five years out is either broken or under attack; either way the frontend should
 * not treat it as a valid 5-year staff session. 30 days is generous for an admin
 * portal and comfortably above any plausible configured TTL.
 */
const MAX_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Permissions are opaque strings to the frontend, but they must be USABLE
 * strings: non-empty, bounded, and matching the catalogue's shape. A permission
 * array containing `null`, `""`, `{}` or a 2MB string is a malformed response, not
 * a permissive one.
 *
 * Note the direction of the risk: an unrecognised-but-well-formed permission is
 * harmless here because `can()` checks membership against a known key. It is the
 * malformed element that indicates the response is not what we think it is.
 */
function isUsablePermission(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[a-z0-9][a-z0-9.\-]*$/.test(value)
  );
}

/**
 * MFA assurance.
 *
 * The approved contract makes a second factor mandatory, so a session asserting
 * `mfaVerified === false` or an `amr` list without a second factor is refused
 * outright. The fields are OPTIONAL because the backend contract is still being
 * agreed: if they are absent the frontend does not invent assurance, but it also
 * does not fail — the BFF only ever receives a session cookie after the
 * `mfa-verify` action, and that action is the thing that mints it. What is
 * refused is a session that explicitly reports itself as unverified.
 */
function checkAssurance(record: Record<string, unknown>): SessionRejection | null {
  if ("mfaVerified" in record) {
    if (typeof record.mfaVerified !== "boolean") return "invalid-mfa-assurance";
    if (record.mfaVerified === false) return "missing-mfa-assurance";
  }
  if ("amr" in record && record.amr !== undefined) {
    const amr = record.amr;
    if (!Array.isArray(amr) || amr.some((m) => typeof m !== "string")) return "invalid-mfa-assurance";
    // "pwd" alone is password-only, which the contract forbids for a session.
    const hasSecondFactor = (amr as string[]).some((m) => m === "otp" || m === "mfa" || m === "webauthn");
    if (amr.length > 0 && !hasSecondFactor) return "missing-mfa-assurance";
  }
  return null;
}

/**
 * Validates a raw upstream session response body.
 *
 * Accepts the whole envelope (`{ data: {...} }`) because the backend returns
 * `ApiEnvelope<StaffSession>`, and a bare object too, because tolerating both is
 * how the existing call sites already behaved. Everything else — arrays, strings,
 * `{ data: null }`, deeply nested surprises — is refused.
 */
export function validateStaffSession(
  payload: unknown,
  now: number = Date.now(),
): SessionValidationResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, reason: "not-an-object" };
  }

  const envelope = payload as Record<string, unknown>;
  let record: unknown = envelope;
  if ("data" in envelope) {
    if (!envelope.data || typeof envelope.data !== "object" || Array.isArray(envelope.data)) {
      return { ok: false, reason: "missing-data" };
    }
    record = envelope.data;
  }
  const d = record as Record<string, unknown>;
  if (!d || typeof d !== "object" || Array.isArray(d)) {
    return { ok: false, reason: "not-a-staff-object" };
  }

  // --- Identity -------------------------------------------------------------
  if (typeof d.staffId !== "string" || d.staffId.trim().length === 0) {
    return { ok: false, reason: "missing-staff-id" };
  }
  if (typeof d.displayName !== "string" || d.displayName.trim().length === 0) {
    return { ok: false, reason: "missing-display-name" };
  }
  if (d.role !== "STAFF" && d.role !== "ADMIN") {
    return { ok: false, reason: "invalid-role" };
  }

  // --- Permissions ----------------------------------------------------------
  if (!Array.isArray(d.permissions)) return { ok: false, reason: "invalid-permissions" };
  if (!d.permissions.every(isUsablePermission)) return { ok: false, reason: "invalid-permissions" };
  if (d.permissions.length === 0) {
    // A staff session with no permissions cannot render the portal. Refusing it is
    // more honest than rendering eighteen 403 pages.
    return { ok: false, reason: "empty-permissions" };
  }

  // --- Expiry ---------------------------------------------------------------
  if (!("sessionExpiresAt" in d) || d.sessionExpiresAt === null || d.sessionExpiresAt === undefined) {
    return { ok: false, reason: "missing-expiry" };
  }
  const expiresAt = parseExpiry(d.sessionExpiresAt);
  if (expiresAt === null) {
    // This is the bug the correction fixes: NaN must reject, not pass.
    return { ok: false, reason: "unparseable-expiry" };
  }
  if (expiresAt <= now) return { ok: false, reason: "expired" };
  if (expiresAt - now > MAX_SESSION_LIFETIME_MS) return { ok: false, reason: "implausible-expiry" };

  // --- Assurance ------------------------------------------------------------
  const assurance = checkAssurance(d);
  if (assurance) return { ok: false, reason: assurance };

  // Rebuild rather than cast: only known fields cross the boundary, so an
  // upstream field cannot shadow something the UI trusts.
  const session: StaffSession = {
    staffId: d.staffId,
    displayName: d.displayName,
    role: d.role,
    permissions: d.permissions as Permission[],
    sessionExpiresAt: d.sessionExpiresAt as string,
  };
  return { ok: true, session };
}
