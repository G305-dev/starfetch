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
  /** Exact public hostnames, e.g. ["starfetch.ng", "www.starfetch.ng"]. */
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

/** Route prefixes that only belong to the staff portal. */
const ADMIN_ONLY_PREFIXES = ["/admin", "/api/admin-auth", "/api/admin-gateway"] as const;

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

/** The staff entry point the admin host's root redirects to. */
export const ADMIN_ENTRY_PATH = "/admin/dashboard";

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

/** Classifies a request path. Path only — no query, no fragment. */
export function classifyPath(rawPath: string): "admin" | "public" | "other" {
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

  if (ADMIN_ONLY_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + "/"))) {
    return "admin";
  }
  if (PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + "/"))) {
    return "public";
  }
  return "other";
}

function validateConfig(config: HostPolicyConfig): string | null {
  if (!Array.isArray(config.publicHosts) || !Array.isArray(config.adminHosts)) {
    return "publicHosts and adminHosts must be arrays";
  }
  if (config.publicHosts.length === 0) return "publicHosts must contain at least one hostname";

  const seen = new Set<string>();
  for (const entry of [...config.publicHosts, ...config.adminHosts, ...(config.allowedPreviewHosts ?? [])]) {
    const normalised = normaliseHost(entry);
    if (!normalised) return `invalid hostname in configuration: ${String(entry)}`;
    // A host may not be both public and admin, and duplicates are ambiguous.
    if (seen.has(normalised)) return `duplicate hostname in configuration: ${normalised}`;
    seen.add(normalised);
  }

  for (const adminHost of config.adminHosts) {
    const normalised = normaliseHost(adminHost)!;
    if (config.publicHosts.map((h) => normaliseHost(h)).includes(normalised)) {
      return `a hostname cannot be both public and admin: ${normalised}`;
    }
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
  problem: string | null;
} {
  const split = (value: string | undefined): string[] =>
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const publicHosts = split(env.PUBLIC_HOSTNAMES);
  const adminHosts = split(env.ADMIN_HOSTNAMES);

  if (publicHosts.length === 0 && adminHosts.length === 0) {
    return { config: null, problem: "missing: PUBLIC_HOSTNAMES and ADMIN_HOSTNAMES are both unset" };
  }
  if (adminHosts.length === 0) {
    return { config: null, problem: "missing: ADMIN_HOSTNAMES is unset, so no staff hostname can be trusted" };
  }

  const isProduction = env.NODE_ENV === "production";
  const allowLocalDevHost = !isProduction && env.ADMIN_ALLOW_LOCALHOST === "true";

  const config: HostPolicyConfig = {
    publicHosts,
    adminHosts,
    allowedPreviewHosts: split(env.ALLOWED_PREVIEW_HOSTNAMES),
    localDevHost: (env.ADMIN_LOCAL_DEV_HOST ?? "localhost").trim().toLowerCase(),
    allowLocalDevHost,
  };

  const invalid = validateConfig(config);
  if (invalid) return { config: null, problem: `invalid: ${invalid}` };
  return { config, problem: null };
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
  if (invalid) return { action: "deny", status: 503, reason: "configuration-invalid" };

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
    if (kind === "public") {
      return { action: "deny", status: 404, reason: "admin-host-public-blocked" };
    }
    // Admin routes and static/other assets are served.
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
