/**
 * HOSTNAME ROUTING POLICY — single source of truth.
 *
 * Starfetch approved one Next.js frontend serving two hostnames:
 *
 *   public host  -> website + investor portal
 *   admin host   -> staff portal only
 *
 * This module is deliberately pure: it takes plain data and returns a decision,
 * so every rule can be unit-tested without a server, a DOM or a network. The
 * middleware is a thin adapter over `resolveHostPolicy`.
 *
 * ---------------------------------------------------------------------------
 * THREAT MODEL
 * ---------------------------------------------------------------------------
 * The whole point is that "which host did the browser ask for" must not be
 * attacker-controlled. `Host` and `X-Forwarded-Host` are request headers; a
 * client can send anything. Consequences, all enforced below:
 *
 *  1. Hostnames are matched against an EXPLICIT allowlist. Never a suffix or
 *     substring test — `admin.starfetch.ng.evil.com` ends with nothing we allow,
 *     but `*.starfetch.ng` style suffixes are where these bugs live.
 *  2. `X-Forwarded-Host` is ignored entirely. On Vercel the platform sets `Host`
 *     to the verified incoming hostname; trusting a forwarded header lets a
 *     request claim to be the admin host from the public one.
 *  3. Ports are stripped only from a well-formed `host:port` form. A malformed
 *     authority (multiple colons, bracketed IPv6, userinfo) is rejected rather
 *     than guessed at.
 *  4. Unknown host -> deny. Missing/empty configuration -> deny. This is
 *     fail-closed by default: a deployment that forgets to set the hostname env
 *     serves an error, not an open admin portal.
 *  5. Preview hostnames are denied unless the operator has listed them. Vercel
 *     preview URLs are public-by-obscurity and must never expose the staff
 *     portal.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS NOT
 * ---------------------------------------------------------------------------
 * Hostname routing is a DEFENCE IN DEPTH layer, not the authorization boundary.
 * It stops the public host serving staff pages and stops the staff host serving
 * investor pages. It does NOT authenticate anyone. Every admin request is still
 * independently authorized by the backend, and every protected page still
 * verifies the staff session server-side. If this module were fully bypassed,
 * an attacker would reach a login page and nothing more.
 */

/** Why a request was allowed or denied. Surfaced in tests and 404 pages. */
export type HostDecisionReason =
  | "admin-host-admin-route"
  | "public-host-public-route"
  | "admin-root-redirect"
  | "public-host-admin-blocked"
  | "admin-host-public-blocked"
  | "admin-host-investor-api-blocked"
  | "admin-host-unclassified-blocked"
  | "admin-host-raw-api-blocked"
  | "admin-host-admin-login-blocked"
  | "unknown-host"
  | "malformed-host"
  | "configuration-missing"
  | "configuration-invalid"
  | "preview-not-allowed";

export type HostDecision =
  /** Serve the request as-is. */
  | { action: "allow"; host: "public" | "admin"; reason: HostDecisionReason }
  /** Redirect to a canonical path on the same host. */
  | { action: "redirect"; to: string; reason: HostDecisionReason }
  /** Refuse: 404 for unknown/malformed hosts, 503 for missing configuration. */
  | { action: "deny"; status: 404 | 503; reason: HostDecisionReason };

export type HostPolicyConfig = {
  /** Exact public hostnames, e.g. ["starfetchinvestltd.com.ng"]. */
  publicHosts: string[];
  /** Exact admin hostnames, e.g. ["admin.starfetch.ng"]. */
  adminHosts: string[];
  /**
   * Additional hostnames that are allowed but treated as PUBLIC only, such as
   * Vercel preview URLs the operator has explicitly approved for investor
   * testing. Admin access is never granted on these.
   */
  allowedPreviewHosts?: string[];
  /**
   * Local development hostname, only honoured when `allowLocalDevHost` is true.
   * Defaults to "localhost". Never honoured in production.
   */
  localDevHost?: string;
  allowLocalDevHost?: boolean;
};

/**
 * Route prefixes that only belong to the staff portal.
 *
 * `/api/v1/admin` is here because of the generic rewrite in next.config.ts:
 * `/api/v1/:path*` forwards to the NestJS backend, so once David builds
 * `/api/v1/admin/*` on that backend, the rewrite alone would expose the raw staff
 * API on EVERY hostname that can reach the app — a complete bypass of the BFF.
 * The rewrite has its own narrower guard (see `isGenericRewritePath` below), but
 * classifying it here means the hostname policy also refuses it, so the two layers
 * fail independently. Belt and braces on purpose: this is the one gap where a
 * single missed check hands out the whole admin surface.
 */
const ADMIN_ONLY_PREFIXES = ["/admin", "/api/admin-auth", "/api/admin-gateway", "/api/v1/admin"] as const;

/**
 * Route prefixes served by the investor/public API through the generic
 * `/api/v1/:path*` rewrite. The admin hostname must never forward these: staff
 * pages have no business calling investor business operations, and allowing them
 * would put investor tokens and staff requests on the same origin.
 *
 * This is the mirror of ADMIN_ONLY_PREFIXES. Anything classified "admin" is
 * refused on the public host; anything classified "investor api" is refused on the
 * admin host.
 */
/**
 * NOTHING ELSE IS LISTED BELOW, DELIBERATELY.
 *
 * The first version of this file enumerated fifteen "investor API prefixes" and
 * classified everything else as "other". That is a denylist wearing an allowlist's
 * clothes: `/api/v1/me/profile` and `/api/v1/corporate-accounts/*` were not on the
 * list, so they fell through to "other", and "other" is served on the admin host.
 * Both are investor endpoints. The admin hostname could therefore drive investor
 * API simply because nobody had typed its prefix into a list.
 *
 * The fix is not to add two more strings — that just moves the hole. The rule is
 * now inverted: the admin hostname serves only the staff surface, and EVERY
 * `/api/v1/*` path is refused there by construction, whether or not anybody has
 * named it. See `classifyPath`.
 */

/**
 * Route prefixes that belong to the investor portal or public site and must
 * never be served on the staff hostname. `/` is handled separately because the
 * admin host redirects its root to the staff entry point.
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/open-account",
  "/dashboard",
  "/joint",
  "/corporate",
  "/investments",
  "/transactions",
  "/profile",
  "/products",
  "/about",
  "/services",
  "/tools",
  "/complaints",
  "/privacy",
  "/terms-of-service",
] as const;

/**
 * The staff entry point the admin host's root redirects to.
 *
 * This is the LOGIN page, not the dashboard, and the distinction is not cosmetic.
 * While the admin release flags are disabled — which is the only approved
 * production state until David's backend is verified — every protected page
 * answers 503. Pointing the root at the dashboard therefore means "/" lands on a
 * wall of "unavailable", which reads as a broken deployment rather than a
 * deliberately disabled one. The login page always renders, so it can honestly say
 * "not connected yet". Once authenticated, the login page sends staff onward to
 * the dashboard.
 */
export const ADMIN_ENTRY_PATH = "/admin/login";

/**
 * Normalises an authority (`Host` header value) to a bare lowercase hostname, or
 * returns null if it cannot be parsed safely.
 *
 * Rejects rather than guesses:
 *  - empty values
 *  - userinfo (`a@b`)
 *  - anything with more than one colon that is not a well-formed `host:port`
 *  - bracketed IPv6 literals, which have no meaning for this application
 *  - ports outside 1-65535
 */
export function normaliseHost(authority: string | null | undefined): string | null {
  if (typeof authority !== "string") return null;
  const value = authority.trim().toLowerCase();
  if (!value) return null;
  if (value.includes("@")) return null;
  if (value.startsWith("[")) return null;

  let host = value;
  const firstColon = value.indexOf(":");
  if (firstColon !== -1) {
    // Exactly one colon, and only as host:port.
    if (value.indexOf(":", firstColon + 1) !== -1) return null;
    host = value.slice(0, firstColon);
    const port = value.slice(firstColon + 1);
    if (!/^\d{1,5}$/.test(port)) return null;
    const numeric = Number(port);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 65535) return null;
  }

  if (!host) return null;
  // Hostname grammar only. NO wildcards, no leading/trailing dots, no underscores.
  if (host.length > 253) return null;
  const labels = host.split(".");
  if (labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return host;
}

/**
 * Classifies a request path. Path only — no query, no fragment.
 *
 * Kinds:
 *  - "admin"        staff pages and BFF endpoints, plus raw /api/v1/admin/*
 *  - "investor-api" the public API surface reachable through the generic rewrite
 *  - "public"       investor/public pages
 *  - "other"        everything else (assets, favicon, unknown paths)
 */
export function classifyPath(rawPath: string): "admin" | "investor-api" | "public" | "other" {
  // Normalise first so `//admin//login`, `/ADMIN/login` and a trailing slash
  // cannot slip past a prefix test.
  let path = rawPath.split("?")[0].split("#")[0];
  try {
    // Decode once: catches `%2fadmin`, `%2e%2e`, and friends.
    path = decodeURIComponent(path);
  } catch {
    // A malformed escape is not a path we can trust; treat as public so it can
    // never reach the staff surface.
    return "public";
  }
  path = path.toLowerCase().replace(/\/{2,}/g, "/");
  if (!path.startsWith("/")) path = "/" + path;
  // Strip any trailing slash except the root.
  if (path.length > 1) path = path.replace(/\/+$/, "");
  // Windows-style and dot segments: refuse to treat them as admin.
  if (path.includes("..") || path.includes("\\") || path.includes("\0")) return "public";

  // Admin is tested FIRST, so `/api/v1/admin` classifies as admin rather than as a
  // generic API path.
  if (ADMIN_ONLY_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + "/"))) {
    return "admin";
  }
  // EVERY other /api/v1 path is the investor/public API. No list, no exceptions:
  // if it starts with /api/v1 it belongs to the product, not to staff. This is what
  // makes `/api/v1/me/profile`, `/api/v1/corporate-accounts/x` and any route David
  // adds next month safe without anybody remembering to update this file.
  if (path === "/api/v1" || path.startsWith("/api/v1/")) {
    return "investor-api";
  }
  if (PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + "/"))) {
    return "public";
  }
  return "other";
}

/**
 * Validation severity.
 *
 * The distinction here is the whole point of the availability correction. A
 * statement about the PUBLIC side that is wrong must take the deployment down —
 * serving the investor portal on a hostname nobody approved is a security fault,
 * not an inconvenience. A statement about the ADMIN side that is wrong must only
 * close the admin portal, because the overwhelming majority of the time the public
 * site is fine and only the (disabled) staff portal is misconfigured.
 *
 * So: "fatal" kills everything, "admin-only" removes admin access and leaves the
 * public product running.
 */
type ConfigProblem = { severity: "fatal" | "admin-only"; message: string };

function validateConfig(config: HostPolicyConfig): ConfigProblem | null {
  if (!Array.isArray(config.publicHosts) || !Array.isArray(config.adminHosts)) {
    return { severity: "fatal", message: "publicHosts and adminHosts must be arrays" };
  }
  if (config.publicHosts.length === 0) {
    // No public hostname at all. Nothing can be safely served, because we cannot
    // tell an approved host from an arbitrary one.
    return { severity: "fatal", message: "publicHosts must contain at least one hostname" };
  }

  // --- Public side: any defect here is fatal -------------------------------
  const publicNormalised = new Set<string>();
  for (const entry of config.publicHosts) {
    const normalised = normaliseHost(entry);
    if (!normalised) return { severity: "fatal", message: `invalid public hostname: ${String(entry)}` };
    if (publicNormalised.has(normalised)) {
      return { severity: "fatal", message: `duplicate public hostname: ${normalised}` };
    }
    publicNormalised.add(normalised);
  }
  for (const entry of config.allowedPreviewHosts ?? []) {
    const normalised = normaliseHost(entry);
    if (!normalised) return { severity: "fatal", message: `invalid preview hostname: ${String(entry)}` };
    if (publicNormalised.has(normalised)) {
      // A preview host doubling as a public host is not dangerous, just untidy,
      // but a preview host equal to AN ADMIN host would be — caught below.
      continue;
    }
    publicNormalised.add(normalised);
  }

  // --- Admin side: a defect here closes only the portal --------------------
  const adminNormalised = new Set<string>();
  for (const entry of config.adminHosts) {
    const normalised = normaliseHost(entry);
    if (!normalised) {
      return { severity: "admin-only", message: `invalid admin hostname: ${String(entry)}` };
    }
    if (adminNormalised.has(normalised)) {
      return { severity: "admin-only", message: `duplicate admin hostname: ${normalised}` };
    }
    if (publicNormalised.has(normalised)) {
      // Ambiguous: one hostname claiming to be both. Fail the ADMIN side, not the
      // public site — the safer reading is "staff is misconfigured", and refusing
      // the whole website over it is the outage we are fixing.
      return { severity: "admin-only", message: `a hostname cannot be both public and admin: ${normalised}` };
    }
    adminNormalised.add(normalised);
  }
  return null;
}

/**
 * Reads the hostname policy from the server environment.
 *
 * All variables are server-only (`ADMIN_`/`PUBLIC_` prefixed, never
 * `NEXT_PUBLIC_`). Returns a config or a reason it is unusable; callers must
 * treat a null config as "deny everything except an error page".
 */
export function readHostPolicyConfig(env: NodeJS.ProcessEnv = process.env): {
  config: HostPolicyConfig | null;
  /** Why the admin surface is unusable, when it is. Null when admin is ready. */
  problem: string | null;
  /** True when the whole deployment must fail closed, including the public site. */
  fatal: boolean;
} {
  const split = (value: string | undefined): string[] =>
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const publicHosts = split(env.PUBLIC_HOSTNAMES);
  const adminHosts = split(env.ADMIN_HOSTNAMES);

  const isProduction = env.NODE_ENV === "production";
  const allowLocalDevHost = !isProduction && env.ADMIN_ALLOW_LOCALHOST === "true";

  // PUBLIC_HOSTNAMES unset is still fatal. Without it we cannot tell an approved
  // hostname from an arbitrary one, and guessing is how the public portal ends up
  // served on a hostname nobody vetted.
  if (publicHosts.length === 0) {
    return {
      config: null,
      problem: adminHosts.length === 0
        ? "missing: PUBLIC_HOSTNAMES and ADMIN_HOSTNAMES are both unset"
        : "missing: PUBLIC_HOSTNAMES is unset, so no public hostname can be trusted",
      fatal: true,
    };
  }

  const config: HostPolicyConfig = {
    publicHosts,
    // An unset ADMIN_HOSTNAMES is NOT fatal any more. The admin portal simply has
    // no hostname to live on, which is the safe outcome: with no admin host,
    // `resolveHostPolicy` can never classify a request as admin, so the staff
    // surface is unreachable everywhere while the public site keeps running.
    adminHosts,
    allowedPreviewHosts: split(env.ALLOWED_PREVIEW_HOSTNAMES),
    localDevHost: (env.ADMIN_LOCAL_DEV_HOST ?? "localhost").trim().toLowerCase(),
    allowLocalDevHost,
  };

  const invalid = validateConfig(config);
  if (invalid) {
    if (invalid.severity === "fatal") {
      return { config: null, problem: `invalid: ${invalid.message}`, fatal: true };
    }
    // Admin-only defect: keep the public allowlist, drop the admin allowlist.
    // Dropping it is what makes the failure safe — a malformed or conflicting
    // admin hostname must never stay in the list while we "carry on".
    return {
      config: { ...config, adminHosts: [], allowLocalDevHost: false },
      problem: `invalid: ${invalid.message} (admin portal disabled; public site unaffected)`,
      fatal: false,
    };
  }

  return { config, problem: adminHosts.length === 0 ? "missing: ADMIN_HOSTNAMES is unset, so the admin portal is unreachable" : null, fatal: false };
}

/**
 * The routing decision for one request.
 *
 * `host` must already be the normalised `Host` header. Callers must NOT pass
 * `X-Forwarded-Host` — see the threat model above.
 */
export function resolveHostPolicy(
  config: HostPolicyConfig | null,
  host: string | null,
  pathname: string,
): HostDecision {
  if (!config) return { action: "deny", status: 503, reason: "configuration-missing" };

  const invalid = validateConfig(config);
  if (invalid) {
    // A fatal defect denies everything. An admin-only defect that reaches here
    // means the caller passed a hand-built config rather than the one from
    // `readHostPolicyConfig`; deny rather than serve, because the admin list may
    // still contain the conflicting hostname.
    return { action: "deny", status: 503, reason: "configuration-invalid" };
  }

  const normalised = normaliseHost(host);
  if (!normalised) return { action: "deny", status: 404, reason: "malformed-host" };

  const publicHosts = config.publicHosts.map((h) => normaliseHost(h)!);
  const adminHosts = config.adminHosts.map((h) => normaliseHost(h)!);
  const previewHosts = (config.allowedPreviewHosts ?? []).map((h) => normaliseHost(h)!);
  const localDev = config.allowLocalDevHost ? normaliseHost(config.localDevHost ?? "localhost") : null;

  const isAdminHost = adminHosts.includes(normalised) || (localDev !== null && normalised === localDev);
  const isPublicHost = publicHosts.includes(normalised) || previewHosts.includes(normalised);

  if (!isAdminHost && !isPublicHost) {
    // Includes Vercel preview URLs that were not explicitly approved.
    return { action: "deny", status: 404, reason: "unknown-host" };
  }

  const kind = classifyPath(pathname);

  if (isAdminHost) {
    if (pathname === "/" || pathname === "") {
      return { action: "redirect", to: ADMIN_ENTRY_PATH, reason: "admin-root-redirect" };
    }
    // The RAW staff API is refused on the staff host as well as the public one.
    // Staff browsers must go through /api/admin-auth/* and /api/admin-gateway/*,
    // which add the trusted backend origin server-side and re-verify the session.
    // Allowing the raw family here would let a browser talk to the backend directly
    // and skip the BFF entirely — the BFF would be decorative.
    //
    // This check exists because classification alone does not cover it: the raw
    // family classifies as "admin" (it must, so the PUBLIC host denies it), and
    // "admin" is the kind this branch would otherwise allow.
    if (isRawAdminApiPath(pathname)) {
      return { action: "deny", status: 404, reason: "admin-host-raw-api-blocked" };
    }
    if (kind === "public") {
      return { action: "deny", status: 404, reason: "admin-host-public-blocked" };
    }
    // The admin hostname must not reach investor business API. Every /api/v1 path
    // is classified investor-api, so this covers routes nobody has enumerated —
    // `/api/v1/me/profile`, `/api/v1/corporate-accounts/*`, and whatever David adds
    // next month.
    if (kind === "investor-api") {
      return { action: "deny", status: 404, reason: "admin-host-investor-api-blocked" };
    }
    // Anything unclassified is refused too. "other" is not a safe default on the
    // staff origin: it is whatever has not been named yet, and unnamed is exactly
    // what the previous denylist got wrong. Staff pages, the BFF and Next's own
    // assets are matched explicitly above/by the matcher, so nothing legitimate
    // relies on "other" here.
    if (kind === "other") {
      return { action: "deny", status: 404, reason: "admin-host-unclassified-blocked" };
    }
    // Only classified staff routes reach this point.
    return { action: "allow", host: "admin", reason: "admin-host-admin-route" };
  }

  // Public host (including approved previews) — never serves staff pages or the
  // admin auth/gateway endpoints.
  if (kind === "admin") {
    return { action: "deny", status: 404, reason: "public-host-admin-blocked" };
  }
  return { action: "allow", host: "public", reason: "public-host-public-route" };
}

/**
 * The headers a denied response carries.
 *
 * A 404 rather than a 403 so an unauthenticated visitor cannot distinguish
 * "this host exists but staff pages are blocked" from "no such page". The body is
 * empty; no admin content, no hints.
 */
export function denyHeaders(): Record<string, string> {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  };
}

/**
 * True when a path falls inside the raw staff API family `/api/v1/admin/*`.
 *
 * This exists as a standalone predicate because TWO layers need the same answer
 * and must not drift apart:
 *
 *   - `next.config.ts`, which decides whether to install the generic
 *     `/api/v1/:path*` rewrite at all;
 *   - `middleware.ts`, which refuses the path before it is routed.
 *
 * `classifyPath` also returns "admin" for it, but `next.config.ts` cannot import a
 * Next request-time module in a way that keeps the config pure, so the rule is
 * expressed once here and imported by both. Deliberately over-broad: it matches
 * with and without a trailing slash, any casing, and any number of path segments.
 */
export function isRawAdminApiPath(rawPath: string): boolean {
  let path = rawPath.split("?")[0].split("#")[0];
  try {
    path = decodeURIComponent(path);
  } catch {
    // An undecodable path cannot be proven safe, so treat it as the admin family.
    return true;
  }
  path = path.toLowerCase().replace(/\/{2,}/g, "/");
  if (!path.startsWith("/")) path = "/" + path;
  if (path.length > 1) path = path.replace(/\/+$/, "");
  // A backslash or NUL cannot appear in a legitimate path; refuse rather than guess.
  if (path.includes("\\") || path.includes("\0")) return true;

  // RESOLVE dot segments before matching. `/api/v1/./admin/users` is not "the
  // admin family" as a string, but a server that normalises it will read exactly
  // that. Deciding on the string while the server decides on the resolved path is
  // the classic way a guard is bypassed, so the guard resolves the same way the
  // server will — including popping on `..`.
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      // Climbing above the root cannot be represented. Treat as admin: it is an
      // attempt to normalise into somewhere it was not invited.
      if (segments.length === 0) return true;
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  const resolved = "/" + segments.join("/");
  return resolved === "/api/v1/admin" || resolved.startsWith("/api/v1/admin/");
}

/**
 * THE STAFF CSRF HEADER NAME — one constant, one answer.
 *
 * The proposed backend contract said `X-SF-CSRF`; the shipped BFF reads and
 * forwards `X-CSRF-Token`. Both are defensible names and neither is wrong on its
 * own — but only one can be the contract, and a header name that appears in three
 * files and two documents is how a CSRF check silently stops working: the browser
 * sends one name, the gateway looks for the other, and a rejected request looks
 * identical to a missing token. That failure mode is a 403 nobody can reproduce.
 *
 * `X-CSRF-Token` is the surviving name because it is what the code already does
 * and what the double-submit cookie pattern conventionally uses in browser
 * clients. The contract document was updated to match the code, not the reverse,
 * because changing the code to chase a document would mean re-testing every
 * mutating action for a purely cosmetic gain.
 *
 * The webhook/backend-to-backend case is NOT covered here: David's server-side
 * calls use their own credentials and never carry a browser CSRF token.
 */
export const STAFF_CSRF_HEADER = "x-csrf-token";

/** The cookie holding the double-submit token. Host-only by construction. */
export const STAFF_CSRF_COOKIE = "__Host-sf_admin_csrf";

/**
 * Reads the CSRF token a browser sent, accepting the canonical header and the
 * legacy spelling so a client built against the old document does not fail
 * silently. The canonical name wins if both are present.
 */
export function readCsrfHeader(headers: { get(name: string): string | null }): string | null {
  return headers.get(STAFF_CSRF_HEADER) ?? headers.get("x-sf-csrf") ?? null;
}
