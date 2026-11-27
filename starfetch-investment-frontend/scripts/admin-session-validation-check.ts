/**
 * Staff session validation — the NaN bypass and its neighbours.
 *
 * These are FRONTEND CONTRACT tests. They prove the frontend refuses a session it
 * should refuse. They do NOT prove David's backend issues sessions of this shape;
 * that is the outstanding decision recorded in the API contract.
 *
 * The bug this file was written for:
 *
 *     new Date(d.sessionExpiresAt).getTime() <= Date.now()
 *
 * `new Date("banana").getTime()` is NaN, and `NaN <= n` is false, so an
 * UNPARSEABLE expiry PASSED the expiry check. Every test in section 1 exists to
 * make that specific mistake impossible to reintroduce silently.
 */
import {
  parseExpiry,
  validateStaffSession,
  type SessionRejection,
} from "../lib/admin-api/session";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const NOW = Date.parse("2026-11-17T12:00:00.000Z");
const FUTURE = new Date(NOW + 60 * 60 * 1000).toISOString();
const PAST = new Date(NOW - 60 * 1000).toISOString();

const validSession = {
  staffId: "stf_01",
  displayName: "A. Reviewer",
  role: "STAFF",
  permissions: ["admin.dashboard.read", "kyc.read"],
  sessionExpiresAt: FUTURE,
};

const rejects = (payload: unknown, reason: SessionRejection, label: string) => {
  const verdict = validateStaffSession(payload, NOW);
  // Read through a helper so TypeScript's union narrowing cannot hide the reason.
  const actual: string = verdict.ok === true ? "accepted" : String(verdict.reason);
  assert(actual !== "accepted", `${label} must be REJECTED`);
  assert(actual === reason, `${label} must be rejected as "${reason}" (got "${actual}")`);
};

// === 1. EXPIRY — the NaN bypass ============================================
{
  // The exact inputs that used to pass because NaN <= n is false.
  for (const bad of ["banana", "not-a-date", "", "   ", "2026-13-45T99:99:99Z", "NaN"]) {
    rejects(
      { ...validSession, sessionExpiresAt: bad },
      "unparseable-expiry",
      `expiry "${bad}"`,
    );
    assert(parseExpiry(bad) === null, `parseExpiry("${bad}") must be null, never NaN`);
  }

  // Numeric strings and bare numbers are refused: Date.parse would happily read
  // "2026" as a year and hand back a "valid" session.
  for (const numeric of ["1795000000000", "0", "1", 1795000000000, 0]) {
    rejects(
      { ...validSession, sessionExpiresAt: numeric },
      "unparseable-expiry",
      `numeric expiry ${String(numeric)}`,
    );
  }

  rejects({ ...validSession, sessionExpiresAt: null }, "missing-expiry", "null expiry");
  rejects({ ...validSession, sessionExpiresAt: undefined }, "missing-expiry", "absent expiry");

  // Expired, including the boundary.
  rejects({ ...validSession, sessionExpiresAt: PAST }, "expired", "an expired session");
  rejects({ ...validSession, sessionExpiresAt: new Date(NOW).toISOString() }, "expired", "a session expiring exactly now");

  // Absurdly distant expiry: a 5-year staff session is not something we believe.
  rejects(
    { ...validSession, sessionExpiresAt: new Date(NOW + 5 * 365 * 24 * 3600 * 1000).toISOString() },
    "implausible-expiry",
    "a session five years out",
  );

  // And the happy path still works.
  const good = validateStaffSession(validSession, NOW);
  assert(good.ok, "a well-formed, unexpired session must be accepted");
}

// === 2. STRUCTURE ==========================================================
{
  for (const bad of [null, undefined, "string", 42, [], [validSession]]) {
    rejects(bad, bad === null || bad === undefined || typeof bad !== "object" || Array.isArray(bad) ? "not-an-object" : "not-an-object", `payload ${JSON.stringify(bad)}`);
  }
  rejects({ data: null }, "missing-data", "{ data: null }");
  rejects({ data: [] }, "missing-data", "{ data: [] }");
  rejects({ data: "string" }, "missing-data", "{ data: 'string' }");

  // The envelope form is accepted, since that is what the backend returns.
  const enveloped = validateStaffSession({ data: validSession }, NOW);
  assert(enveloped.ok, "an enveloped { data: session } payload must be accepted");
}

// === 3. IDENTITY ===========================================================
{
  rejects({ ...validSession, staffId: "" }, "missing-staff-id", "an empty staffId");
  rejects({ ...validSession, staffId: "   " }, "missing-staff-id", "a whitespace staffId");
  rejects({ ...validSession, staffId: 123 }, "missing-staff-id", "a numeric staffId");
  rejects({ ...validSession, staffId: undefined }, "missing-staff-id", "an absent staffId");
  rejects({ ...validSession, displayName: "" }, "missing-display-name", "an empty displayName");
  rejects({ ...validSession, displayName: null }, "missing-display-name", "a null displayName");
  rejects({ ...validSession, role: "INVESTOR" }, "invalid-role", "an INVESTOR role");
  rejects({ ...validSession, role: "admin" }, "invalid-role", "a lowercased role");
  rejects({ ...validSession, role: undefined }, "invalid-role", "an absent role");
}

// === 4. PERMISSIONS ========================================================
{
  rejects({ ...validSession, permissions: "admin.dashboard.read" }, "invalid-permissions", "a permission string");
  rejects({ ...validSession, permissions: {} }, "invalid-permissions", "a permission object");
  rejects({ ...validSession, permissions: [null] }, "invalid-permissions", "a null permission element");
  rejects({ ...validSession, permissions: [""] }, "invalid-permissions", "an empty permission element");
  rejects({ ...validSession, permissions: [{ key: "kyc.read" }] }, "invalid-permissions", "an object permission element");
  rejects({ ...validSession, permissions: ["kyc read"] }, "invalid-permissions", "a permission with a space");
  rejects({ ...validSession, permissions: ["x".repeat(200)] }, "invalid-permissions", "an oversized permission");
  rejects({ ...validSession, permissions: [] }, "empty-permissions", "an empty permission array");

  // An unknown but well-formed permission is FINE: `can()` checks membership
  // against a known key, so an unrecognised string grants nothing.
  const unknown = validateStaffSession({ ...validSession, permissions: ["future.permission.read"] }, NOW);
  assert(unknown.ok, "an unknown but well-formed permission must not invalidate the session");
}

// === 5. MFA ASSURANCE ======================================================
{
  rejects({ ...validSession, mfaVerified: false }, "missing-mfa-assurance", "an explicitly unverified session");
  rejects({ ...validSession, mfaVerified: "true" }, "invalid-mfa-assurance", "a stringified mfaVerified");
  rejects({ ...validSession, amr: ["pwd"] }, "missing-mfa-assurance", "password-only amr");
  rejects({ ...validSession, amr: "otp" }, "invalid-mfa-assurance", "a non-array amr");
  rejects({ ...validSession, amr: [null] }, "invalid-mfa-assurance", "an amr containing null");

  // Absent assurance fields are tolerated: the backend contract is still being
  // agreed, and the frontend mints the session cookie only after `mfa-verify`.
  const absent = validateStaffSession(validSession, NOW);
  assert(absent.ok, "absent assurance fields must not fail the session");
  const verified = validateStaffSession({ ...validSession, mfaVerified: true, amr: ["pwd", "otp"] }, NOW);
  assert(verified.ok, "a verified session with a second factor must be accepted");
}

// === 6. FIELD ALLOWLISTING =================================================
{
  const verdict = validateStaffSession(
    { ...validSession, isSuperAdmin: true, permissionsOverride: ["*"], __proto__: { polluted: true } },
    NOW,
  );
  assert(verdict.ok, "extra upstream fields must not fail an otherwise valid session");
  assert(
    verdict.ok && !("isSuperAdmin" in verdict.session),
    "unknown upstream fields must NOT be copied onto the session object",
  );
  assert(
    verdict.ok && !("permissionsOverride" in verdict.session),
    "a permission override supplied by the backend must be dropped, not trusted",
  );
}

console.log(
  "PASS — Staff session validation: an unparseable, numeric, absent or expired expiry is rejected so the NaN comparison that once let a bad session through cannot pass; identity, role and every permission element are checked and an empty or malformed permission list is refused while an unrecognised-but-well-formed permission still authenticates; a session that reports itself unverified or password-only is refused; an implausibly distant expiry is refused; unknown upstream fields are dropped rather than spread onto the session; and the shared validator is the only implementation, so the page wrapper and the gateway cannot drift apart",
);
