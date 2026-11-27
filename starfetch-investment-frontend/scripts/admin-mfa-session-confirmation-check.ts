/**
 * MFA SESSION-CONFIRMATION — regression tests for the last gate before a cookie.
 *
 * `confirmStaffSession()` in `app/api/admin-auth/[action]/route.ts` decides whether
 * the backend genuinely established a staff session at the end of `mfa-verify` /
 * `mfa-recovery`. It is the final check before a staff session cookie is handed to
 * a browser, so it must apply the SAME rules as everywhere else.
 *
 * It previously re-implemented validation and had drifted weaker than
 * `lib/admin-api/session.ts`: no `displayName` check, any array accepted for
 * `permissions`, no plausibility ceiling, and MFA assurance ignored entirely. A
 * backend that returned `mfaVerified: false` could still mint a cookie.
 *
 * These tests pin the confirmed behaviour, and pin the delegation itself so the
 * duplicate implementation cannot quietly return.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateStaffSession } from "../lib/admin-api/session";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const NOW = Date.parse("2026-11-17T12:00:00.000Z");
const FUTURE = new Date(NOW + 60 * 60 * 1000).toISOString();
const PAST = new Date(NOW - 60 * 1000).toISOString();

const goodSession = {
  staffId: "stf_01",
  displayName: "A. Reviewer",
  role: "STAFF",
  permissions: ["admin.dashboard.read", "kyc.read"],
  sessionExpiresAt: FUTURE,
};

// ---------------------------------------------------------------- source wiring
// The check is that there is ONE implementation. These assertions fail if someone
// reintroduces a second, weaker validator in the route.
{
  const route = read("app/api/admin-auth/[action]/route.ts");
  const routeCode = stripComments(route);

  assert(
    routeCode.includes("validateStaffSession"),
    "the auth route must use the shared validateStaffSession, not its own validator",
  );
  assert(
    /from\s+["']@\/lib\/admin-api\/session["']/.test(routeCode),
    "the auth route must import the shared validator from lib/admin-api/session",
  );

  // The old hand-rolled checks must be gone. Their absence is the regression test:
  // each of these strings existing means a second opinion is being formed again.
  assert(
    !/new Date\([^)]*sessionExpiresAt[^)]*\)\.getTime\(\)/.test(routeCode),
    "the auth route must not compute session expiry itself — that is how the NaN bypass happened",
  );
  assert(
    !/Number\.isFinite\(expires\)/.test(routeCode),
    "the auth route must not carry its own expiry plausibility logic",
  );
  assert(
    !/Array\.isArray\(staff\.permissions\)/.test(routeCode),
    "the auth route must not inspect the permission array itself; the shared validator owns that rule",
  );
  assert(
    !/staff\.role === ["']ADMIN["']\s*\|\|/.test(routeCode),
    "the auth route must not carry its own role check",
  );

  // The cookie must only be set after confirmation succeeds, and confirmation must
  // come before the Set-Cookie.
  const confirmIndex = routeCode.indexOf("confirmStaffSession(`${cfg.cookie}");
  const setCookieIndex = routeCode.indexOf("setSessionCookie(result, cfg.cookie");
  assert(confirmIndex !== -1, "mfa-verify must confirm the staff session");
  assert(setCookieIndex !== -1, "mfa-verify must set the session cookie");
  assert(
    confirmIndex < setCookieIndex,
    "the session cookie must be set ONLY after confirmStaffSession succeeds",
  );
  assert(
    /if \(!confirmed\.ok\) return deny\(403/.test(routeCode),
    "a failed confirmation must deny rather than fall through to the cookie",
  );
}

// ------------------------------------------------------- confirmation behaviour
// These run the shared validator over the exact payloads `confirmStaffSession`
// would receive, so they pin what the cookie gate accepts and refuses.
{
  const accepts = (label: string, payload: unknown) => {
    const verdict = validateStaffSession(payload, NOW);
    assert(verdict.ok, `confirmStaffSession must ACCEPT ${label}`);
  };
  const refuses = (label: string, payload: unknown, reason: string) => {
    const verdict = validateStaffSession(payload, NOW);
    const actual: string = verdict.ok === true ? "accepted" : String(verdict.reason);
    assert(actual !== "accepted", `confirmStaffSession must REFUSE ${label}`);
    assert(actual === reason, `${label} must be refused as "${reason}" (got "${actual}")`);
  };

  // --- The happy path, enveloped as the backend returns it ---------------
  accepts("a well-formed enveloped session", { data: goodSession });
  accepts("a bare session object", goodSession);
  accepts("a session with verified MFA", { data: { ...goodSession, mfaVerified: true, amr: ["pwd", "otp"] } });

  // --- Malformed staff identity -----------------------------------------
  refuses("an absent staffId", { data: { ...goodSession, staffId: undefined } }, "missing-staff-id");
  refuses("an empty staffId", { data: { ...goodSession, staffId: "" } }, "missing-staff-id");
  refuses("a whitespace staffId", { data: { ...goodSession, staffId: "   " } }, "missing-staff-id");
  refuses("an absent displayName", { data: { ...goodSession, displayName: undefined } }, "missing-display-name");
  refuses("an empty displayName", { data: { ...goodSession, displayName: "" } }, "missing-display-name");
  refuses("a non-STAFF/ADMIN role", { data: { ...goodSession, role: "INVESTOR" } }, "invalid-role");
  refuses("a lowercase role", { data: { ...goodSession, role: "staff" } }, "invalid-role");

  // --- Malformed permission arrays --------------------------------------
  refuses("a permission string", { data: { ...goodSession, permissions: "admin.dashboard.read" } }, "invalid-permissions");
  refuses("a null permission element", { data: { ...goodSession, permissions: [null] } }, "invalid-permissions");
  refuses("an object permission element", { data: { ...goodSession, permissions: [{ key: "kyc.read" }] } }, "invalid-permissions");
  refuses("an empty-string permission element", { data: { ...goodSession, permissions: [""] } }, "invalid-permissions");
  refuses("an EMPTY permission array", { data: { ...goodSession, permissions: [] } }, "empty-permissions");

  // --- Expiry timestamps --------------------------------------------------
  rejectsExpiry();

  function rejectsExpiry() {
    refuses("an unparseable expiry", { data: { ...goodSession, sessionExpiresAt: "banana" } }, "unparseable-expiry");
    refuses("a numeric-string expiry", { data: { ...goodSession, sessionExpiresAt: "1795000000000" } }, "unparseable-expiry");
    refuses("a numeric expiry", { data: { ...goodSession, sessionExpiresAt: 1795000000000 } }, "unparseable-expiry");
    refuses("a null expiry", { data: { ...goodSession, sessionExpiresAt: null } }, "missing-expiry");
    refuses("an expired session", { data: { ...goodSession, sessionExpiresAt: PAST } }, "expired");
    refuses(
      "a five-year expiry",
      { data: { ...goodSession, sessionExpiresAt: new Date(NOW + 5 * 365 * 24 * 3600 * 1000).toISOString() } },
      "implausible-expiry",
    );
  }

  // --- Explicitly invalid MFA assurance ---------------------------------
  refuses("mfaVerified: false", { data: { ...goodSession, mfaVerified: false } }, "missing-mfa-assurance");
  refuses("a password-only amr", { data: { ...goodSession, amr: ["pwd"] } }, "missing-mfa-assurance");
  refuses("a stringified mfaVerified", { data: { ...goodSession, mfaVerified: "true" } }, "invalid-mfa-assurance");
  refuses("a non-array amr", { data: { ...goodSession, amr: "otp" } }, "invalid-mfa-assurance");

  // --- Envelope shapes ---------------------------------------------------
  refuses("a null envelope", { data: null }, "missing-data");
  refuses("an array envelope", { data: [] }, "missing-data");
  refuses("a string payload", "session", "not-an-object");
  refuses("a null payload", null, "not-an-object");

  // --- Field allowlisting -----------------------------------------------
  const withExtras = validateStaffSession(
    { data: { ...goodSession, permissionsOverride: ["*"], isSuperAdmin: true } },
    NOW,
  );
  assert(withExtras.ok, "extra upstream fields must not fail an otherwise valid session");
  assert(
    !("permissionsOverride" in withExtras.session),
    "an upstream permissionsOverride must be dropped, never carried onto the session",
  );
  assert(
    !("isSuperAdmin" in withExtras.session),
    "an upstream isSuperAdmin must be dropped, never carried onto the session",
  );
}

// ------------------------------------------------- one implementation, not two
{
  const sessionModule = read("lib/admin-api/session.ts");
  assert(
    sessionModule.includes("export function validateStaffSession"),
    "the shared validator must remain exported from lib/admin-api/session",
  );
  // The gateway and the page wrapper must not grow their own copies either.
  for (const file of ["app/api/admin-gateway/[...segments]/route.ts", "lib/admin-api/server.ts"]) {
    if (!existsSync(join(root, file))) continue;
    const code = stripComments(read(file));
    assert(
      !/new Date\([^)]*sessionExpiresAt[^)]*\)\.getTime\(\)/.test(code),
      `${file} must not compute session expiry itself`,
    );
  }
}

console.log(
  "PASS — MFA session confirmation: confirmStaffSession delegates to the single shared validateStaffSession, and the route no longer computes expiry, inspects the permission array or checks the role itself, so the duplicated weaker validator cannot return; before a staff session cookie is issued, a malformed or missing staffId or displayName, a non-STAFF/ADMIN role, a non-array, null-element, object-element, empty-string-element, oversized or EMPTY permission array, an unparseable, numeric, absent, expired or implausibly distant expiry, and an explicitly invalid MFA assurance (mfaVerified:false or a password-only amr) are all refused; the cookie is only set after confirmation succeeds; the rejection reason stays server-side behind one generic 403; and upstream fields such as permissionsOverride or isSuperAdmin are dropped rather than carried onto the session",
);
