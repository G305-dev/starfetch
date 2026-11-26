import { NextRequest, NextResponse } from "next/server";
import { getSession, liveConfig, upstream } from "@/lib/admin-api/server";
import {
  BFF_AUTH_ROUTES,
  CHALLENGE_TTL_SECONDS,
  MFA_INTEGRATION_NOTE,
  PENDING_CHALLENGE_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  isBffAuthAction,
  classifyMfaCode,
  looksLikeSessionGrant,
  readPasswordResponse,
  type BffAuthAction,
} from "@/lib/admin/mfa";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

/**
 * ADMIN AUTH BFF — the only route that talks to the staff authentication backend.
 *
 * Security properties, and what each one is defending against:
 *
 *  - **Exact-origin.** `origin` must equal `req.nextUrl.origin` and
 *    `sec-fetch-site` must not be `cross-site`. Defends CSRF on an endpoint that
 *    would otherwise accept a form post from anywhere.
 *  - **CSRF token.** Every state-changing action requires a double-submit token
 *    issued at sign-in. Defends against a same-site request forged by another
 *    origin's script.
 *  - **Literal action allowlist.** `BFF_AUTH_ROUTES` is a closed map, not a prefix
 *    match. An unknown name is 405 before any network call. A generic proxy on
 *    the sign-in surface would let a caller reach any upstream auth endpoint.
 *  - **Credential requirement per action.** `login` needs nothing; verification
 *    actions need the pending-challenge cookie; `session` and `logout` need a
 *    full session. Enforced before forwarding.
 *  - **One session-establishing action.** Only `mfa-verify` and `mfa-recovery` may
 *    set the staff cookie. `login` sets a *pending challenge* and nothing else.
 *  - **Host-only cookies.** `__Host-` prefix, `Secure`, `Path=/`, no `Domain`, so
 *    a subdomain cannot overwrite them and they never leave the admin host.
 *  - **Default-deny.** `liveConfig()` null (flags off) is 503 for every action.
 *
 * NOTHING HERE VERIFIES A CREDENTIAL. Codes are forwarded to the backend, which
 * decides. This process has no secret and no way to validate one.
 */

const noStore = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

function deny(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: noStore });
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  return !!origin && origin === req.nextUrl.origin && req.headers.get("sec-fetch-site") !== "cross-site";
}

/** Double-submit CSRF: the header must equal the cookie, and the cookie must exist. */
function csrfValid(req: NextRequest): boolean {
  const token = req.cookies.get("__Host-sf_admin_csrf")?.value;
  const header = req.headers.get("x-csrf-token");
  return !!token && !!header && token === header;
}

function setSessionCookie(res: NextResponse, name: string, value: string) {
  res.cookies.set(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * The pending-challenge cookie: short-lived, host-only, and NOT a session.
 *
 * A different name from the session cookie is deliberate. If both shared a name,
 * a bug that wrote a session-shaped value at the challenge stage would be
 * undetectable, and `getSession()` would accept it. Two cookies means the
 * password step physically cannot produce something `getSession()` reads.
 */
function setChallengeCookie(res: NextResponse, value: string) {
  res.cookies.set(PENDING_CHALLENGE_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: CHALLENGE_TTL_SECONDS,
  });
}

function clearAuthCookies(res: NextResponse, sessionName: string) {
  res.cookies.set(sessionName, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  res.cookies.set(PENDING_CHALLENGE_COOKIE, "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0 });
  res.cookies.set("__Host-sf_admin_csrf", "", { secure: true, sameSite: "strict", path: "/", maxAge: 0 });
}

/** Read the upstream error code without trusting its shape. */
function upstreamCode(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

/** The staff session, verified against the backend. Used only after MFA. */
async function confirmStaffSession(cookie: string): Promise<{ ok: true; session: Record<string, unknown> } | { ok: false }> {
  const res = await upstream("/auth/session", { cookie });
  const payload: unknown = await res.json().catch(() => null);
  const data =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data?: unknown }).data
      : null;
  if (!res.ok || !data || typeof data !== "object") return { ok: false };
  const staff = data as Record<string, unknown>;
  const expires = typeof staff.sessionExpiresAt === "string" ? new Date(staff.sessionExpiresAt).getTime() : NaN;
  const valid =
    (staff.role === "ADMIN" || staff.role === "STAFF") &&
    typeof staff.staffId === "string" &&
    Array.isArray(staff.permissions) &&
    Number.isFinite(expires) &&
    expires > Date.now();
  return valid ? { ok: true, session: staff } : { ok: false };
}

export async function GET(req: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (!isBffAuthAction(action) || BFF_AUTH_ROUTES[action].method !== "GET") {
    return deny(405, "METHOD_NOT_ALLOWED", "Unsupported auth operation");
  }
  const cfg = liveConfig();
  if (!cfg) return deny(503, "FEATURE_UNAVAILABLE", "Staff authentication is not connected");

  if (action === "session") {
    const staff = await getSession();
    return staff ? NextResponse.json({ data: staff }, { headers: noStore }) : deny(401, "UNAUTHENTICATED", "No valid staff session");
  }

  if (action === "mfa-status") {
    // Tells the challenge screen which factor the backend wants. Never a session.
    const challenge = req.cookies.get(PENDING_CHALLENGE_COOKIE)?.value;
    if (!challenge) return deny(401, "CHALLENGE_REQUIRED", "Start sign-in again");
    try {
      const res = await upstream(BFF_AUTH_ROUTES[action].upstream, {
        cookie: `${PENDING_CHALLENGE_COOKIE}=${encodeURIComponent(challenge)}`,
      });
      const payload: unknown = await res.json().catch(() => null);
      if (!res.ok) return deny(res.status, upstreamCode(payload) || "MFA_STATUS_UNAVAILABLE", "Verification status unavailable");
      return NextResponse.json({ data: payload && typeof payload === "object" && "data" in payload ? (payload as { data: unknown }).data : null }, { headers: noStore });
    } catch {
      return deny(503, "FEATURE_UNAVAILABLE", "Staff authentication service unavailable");
    }
  }

  return deny(405, "METHOD_NOT_ALLOWED", "Unsupported auth operation");
}

export async function POST(req: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  const cfg = liveConfig();
  if (!cfg) return deny(503, "FEATURE_UNAVAILABLE", "Staff authentication is not connected");

  // Closed allowlist. Anything else stops here, before origin checks and before
  // any upstream call, so a probe cannot learn which actions exist from timing.
  if (!isBffAuthAction(action) || BFF_AUTH_ROUTES[action].method !== "POST") {
    return deny(405, "METHOD_NOT_ALLOWED", "Unsupported auth operation");
  }
  const spec = BFF_AUTH_ROUTES[action];

  if (!sameOrigin(req)) return deny(403, "ORIGIN_REJECTED", "Invalid request origin");

  // === logout ==============================================================
  if (action === "logout") {
    if (!csrfValid(req)) return deny(403, "CSRF_REJECTED", "Security token required");
    const session = req.cookies.get(cfg.cookie)?.value;
    const token = req.cookies.get("__Host-sf_admin_csrf")?.value ?? "";
    let revoked = false;
    try {
      if (session) {
        const response = await upstream("/auth/logout", {
          method: "POST",
          cookie: `${cfg.cookie}=${encodeURIComponent(session)}`,
          csrf: token,
        });
        revoked = response.ok;
      } else revoked = true;
    } catch {
      revoked = false;
    }
    // The pending challenge is always discarded on logout, even if revocation is
    // unconfirmed — a half-finished sign-in should never survive a sign-out.
    const result = revoked
      ? NextResponse.json({ data: { loggedOut: true } }, { headers: noStore })
      : deny(503, "LOGOUT_REVOCATION_UNCONFIRMED", "Staff session was cleared locally, but remote revocation must be verified");
    clearAuthCookies(result, cfg.cookie);
    return result;
  }

  // === CSRF for every other state-changing action ==========================
  if (spec.csrf && action !== "login" && !csrfValid(req)) {
    return deny(403, "CSRF_REJECTED", "Security token required");
  }

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > 4096) return deny(413, "PAYLOAD_TOO_LARGE", "Request too large");

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return deny(422, "VALIDATION_ERROR", "Malformed request body");

  // === login: password only. Produces a challenge, never a session. ========
  if (action === "login") {
    const { email, password } = body as { email?: unknown; password?: unknown };
    if (
      typeof email !== "string" ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      email.length > 254 ||
      typeof password !== "string" ||
      password.length < 1 ||
      password.length > 256
    ) {
      return deny(422, "VALIDATION_ERROR", "Enter valid staff credentials");
    }

    let upstreamRes: Response;
    try {
      upstreamRes = await upstream("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    } catch {
      return deny(503, "FEATURE_UNAVAILABLE", "Staff authentication service unavailable");
    }

    const payload: unknown = await upstreamRes.json().catch(() => null);

    if (!upstreamRes.ok) {
      const code = upstreamCode(payload);
      // A rejected password is a rejected password. Never offer a challenge on it.
      if (code === "MFA_REQUIRED" || code === "MFA_ENROLMENT_REQUIRED") {
        return deny(upstreamRes.status, code, "Second factor required");
      }
      return deny(
        upstreamRes.status === 429 ? 429 : 401,
        upstreamRes.status === 429 ? "RATE_LIMITED" : "UNAUTHENTICATED",
        upstreamRes.status === 429 ? "Too many login attempts" : "Invalid staff credentials",
      );
    }

    /**
     * THE CRITICAL GUARD.
     *
     * The backend must not grant a session at the password stage. If it returns
     * a session cookie or a session-shaped body here, the contract has been
     * violated — and the old implementation would have forwarded that straight
     * to the browser as a completed sign-in. This refuses the whole response.
     */
    const upstreamCookies = upstreamRes.headers.getSetCookie();
    const sessionCookieIssued = upstreamCookies.some((value) => value.startsWith(cfg.cookie + "="));
    const payloadObject = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const bodyData =
      payloadObject.data && typeof payloadObject.data === "object"
        ? (payloadObject.data as Record<string, unknown>)
        : payloadObject;

    if (sessionCookieIssued || looksLikeSessionGrant(bodyData)) {
      return deny(
        502,
        "MFA_BYPASS_BLOCKED",
        "The authentication service issued a session before a second factor was verified. Sign-in was refused.",
      );
    }

    const accepted = readPasswordResponse(payload, new Date().toISOString());
    if (!accepted) {
      return deny(502, "MFA_CONTRACT_INCOMPLETE", "The authentication service did not request a second factor");
    }

    // The backend may already have minted a pending challenge cookie; forward it
    // under our own host-only name. If it did not, the challenge cannot proceed.
    const challengeSet = upstreamCookies.find((value) => value.startsWith(PENDING_CHALLENGE_COOKIE + "="));
    if (!challengeSet) {
      return deny(503, "MFA_CHALLENGE_CONTRACT_MISSING", "The authentication service did not issue a pending challenge");
    }
    const challengeValue = challengeSet.slice((PENDING_CHALLENGE_COOKIE + "=").length).split(";", 1)[0];
    if (!challengeValue || challengeValue.length > 4096) {
      return deny(503, "INVALID_MFA_CHALLENGE", "Invalid pending challenge");
    }

    /**
     * Deliberately session-shaped-free. No staffId, no permissions, no
     * sessionExpiresAt. The browser is told which factor to demand and nothing
     * about who the user is or what they may do.
     */
    const result = NextResponse.json(
      {
        data: {
          step: accepted.step,
          challengeExpiresAt: accepted.challengeExpiresAt,
          methods: accepted.methods,
          attemptsRemaining: accepted.attemptsRemaining,
        },
      },
      { headers: noStore },
    );
    setChallengeCookie(result, decodeURIComponent(challengeValue));
    // A CSRF token is issued now so the challenge POST can be double-submitted.
    result.cookies.set("__Host-sf_admin_csrf", randomUUID(), {
      httpOnly: false,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: CHALLENGE_TTL_SECONDS,
    });
    return result;
  }

  // === mfa-enrol: begin enrolment. Returns no secret. ======================
  if (action === "mfa-enrol") {
    const challenge = req.cookies.get(PENDING_CHALLENGE_COOKIE)?.value;
    if (!challenge) return deny(401, "CHALLENGE_REQUIRED", "Start sign-in again");
    try {
      const res = await upstream(spec.upstream, {
        method: "POST",
        body: JSON.stringify(body),
        cookie: `${PENDING_CHALLENGE_COOKIE}=${encodeURIComponent(challenge)}`,
        csrf: req.cookies.get("__Host-sf_admin_csrf")?.value,
      });
      const payload: unknown = await res.json().catch(() => null);
      if (!res.ok) return deny(res.status, upstreamCode(payload) || "MFA_ENROL_FAILED", "Enrolment could not be started");
      return NextResponse.json({ data: payload && typeof payload === "object" && "data" in payload ? (payload as { data: unknown }).data : null }, { headers: noStore });
    } catch {
      return deny(503, "FEATURE_UNAVAILABLE", "Staff authentication service unavailable");
    }
  }

  // === mfa-enrol-confirm: second half of enrolment. Still no session. ======
  if (action === "mfa-enrol-confirm") {
    const challenge = req.cookies.get(PENDING_CHALLENGE_COOKIE)?.value;
    if (!challenge) return deny(401, "CHALLENGE_REQUIRED", "Start sign-in again");
    try {
      const res = await upstream(spec.upstream, {
        method: "POST",
        body: JSON.stringify(body),
        cookie: `${PENDING_CHALLENGE_COOKIE}=${encodeURIComponent(challenge)}`,
        csrf: req.cookies.get("__Host-sf_admin_csrf")?.value,
      });
      const payload: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const code = upstreamCode(payload) || "MFA_ENROL_CONFIRM_FAILED";
        return deny(res.status, code, "Enrolment could not be confirmed");
      }
      // Enrolment completing returns to verification; it does not sign anyone in.
      const step = classifyMfaCode("MFA_REQUIRED", 200);
      return NextResponse.json({ data: { step } }, { headers: noStore });
    } catch {
      return deny(503, "FEATURE_UNAVAILABLE", "Staff authentication service unavailable");
    }
  }

  // === mfa-challenge: reissue / rotate the challenge =======================
  if (action === "mfa-challenge") {
    const session = req.cookies.get(cfg.cookie)?.value;
    const challenge = req.cookies.get(PENDING_CHALLENGE_COOKIE)?.value;
    // Step-up reauthentication may come from an existing session; first sign-in
    // comes from a pending challenge. One of the two must exist.
    const credential = challenge ? PENDING_CHALLENGE_COOKIE + "=" + encodeURIComponent(challenge) : session ? cfg.cookie + "=" + encodeURIComponent(session) : null;
    if (!credential) return deny(401, "CHALLENGE_REQUIRED", "Start sign-in again");
    try {
      const res = await upstream(spec.upstream, {
        method: "POST",
        body: JSON.stringify(body),
        cookie: credential,
        csrf: req.cookies.get("__Host-sf_admin_csrf")?.value,
      });
      const payload: unknown = await res.json().catch(() => null);
      if (!res.ok) return deny(res.status, upstreamCode(payload) || "MFA_CHALLENGE_FAILED", "Verification could not be started");
      const result = NextResponse.json({ data: payload && typeof payload === "object" && "data" in payload ? (payload as { data: unknown }).data : null }, { headers: noStore });
      const set = res.headers.getSetCookie().find((v) => v.startsWith(PENDING_CHALLENGE_COOKIE + "="));
      if (set) {
        const value = set.slice((PENDING_CHALLENGE_COOKIE + "=").length).split(";", 1)[0];
        if (value) setChallengeCookie(result, decodeURIComponent(value));
      }
      return result;
    } catch {
      return deny(503, "FEATURE_UNAVAILABLE", "Staff authentication service unavailable");
    }
  }

  // === mfa-verify / mfa-recovery: THE ONLY SESSION-ESTABLISHING ACTIONS ====
  if (action === "mfa-verify" || action === "mfa-recovery") {
    const challenge = req.cookies.get(PENDING_CHALLENGE_COOKIE)?.value;
    if (!challenge) return deny(401, "CHALLENGE_REQUIRED", "Start sign-in again");

    let res: Response;
    try {
      res = await upstream(spec.upstream, {
        method: "POST",
        body: JSON.stringify(body),
        cookie: `${PENDING_CHALLENGE_COOKIE}=${encodeURIComponent(challenge)}`,
        csrf: req.cookies.get("__Host-sf_admin_csrf")?.value,
      });
    } catch {
      return deny(503, "FEATURE_UNAVAILABLE", "Staff authentication service unavailable");
    }

    const payload: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const code = upstreamCode(payload) || "MFA_VERIFICATION_FAILED";
      const step = classifyMfaCode(code, res.status);
      // Every failure path clears nothing but reports the step. Critically, no
      // failure sets the session cookie.
      return NextResponse.json(
        { error: { code, message: "Verification was not accepted" }, data: { step } },
        { status: res.status, headers: noStore },
      );
    }

    /**
     * The backend has confirmed the second factor. Only now may the session
     * cookie be read from the upstream response and forwarded.
     */
    const staffSet = res.headers.getSetCookie().find((value) => value.startsWith(cfg.cookie + "="));
    if (!staffSet) return deny(503, "AUTH_COOKIE_CONTRACT_MISSING", "Staff session cookie contract is not available");
    const encoded = staffSet.slice((cfg.cookie + "=").length).split(";", 1)[0];
    if (!encoded || encoded.length > 4096) return deny(503, "INVALID_STAFF_SESSION", "Invalid staff cookie");

    const confirmed = await confirmStaffSession(`${cfg.cookie}=${encoded}`);
    if (!confirmed.ok) return deny(403, "NOT_STAFF", "Staff authorization not confirmed");

    const session = confirmed.session;
    const result = NextResponse.json(
      {
        data: {
          staffId: session.staffId,
          displayName: session.displayName,
          role: session.role,
          permissions: session.permissions,
          sessionExpiresAt: session.sessionExpiresAt,
        },
      },
      { headers: noStore },
    );
    setSessionCookie(result, cfg.cookie, decodeURIComponent(encoded));
    // The pending challenge has served its purpose and must not be replayable.
    result.cookies.set(PENDING_CHALLENGE_COOKIE, "", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return result;
  }

  // Unreachable while the map and the branches agree; kept so a future action
  // added to the map without a branch fails closed rather than falling through.
  return deny(501, "NOT_IMPLEMENTED", MFA_INTEGRATION_NOTE);
}
