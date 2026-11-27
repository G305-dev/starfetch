/**
 * Hostname isolation tests — the security boundary between the public product
 * and the staff portal.
 *
 * These are FRONTEND CONTRACT tests: they exercise the routing policy as a pure
 * function. They prove the decision logic is correct. They do NOT prove the
 * deployed infrastructure sets `Host` the way we expect, nor that Vercel's
 * routing does what this configures — those need a real deployment and are listed
 * as outstanding blockers in the security report.
 */
import {
  ADMIN_ENTRY_PATH,
  classifyPath,
  denyHeaders,
  normaliseHost,
  isRawAdminApiPath,
  readHostPolicyConfig,
  resolveHostPolicy,
  STAFF_CSRF_COOKIE,
  STAFF_CSRF_HEADER,
  type HostPolicyConfig,
} from "../lib/admin/host-policy";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const PUBLIC = "starfetch.ng";
const ADMIN = "admin.starfetch.ng";

const config: HostPolicyConfig = {
  publicHosts: [PUBLIC, "www.starfetch.ng"],
  adminHosts: [ADMIN],
  allowedPreviewHosts: [],
};

/** Convenience: the decision for a host + path. */
const decide = (host: string | null, path: string, cfg: HostPolicyConfig | null = config) =>
  resolveHostPolicy(cfg, host, path);

function main(): void {
  // === 1. Normalisation: the Host header is attacker-controlled ============
  {
    // Must parse.
    for (const [input, expected] of [
      ["starfetch.ng", "starfetch.ng"],
      ["STARFETCH.NG", "starfetch.ng"],
      ["  starfetch.ng  ", "starfetch.ng"],
      ["admin.starfetch.ng:443", "admin.starfetch.ng"],
      ["starfetch.ng:3000", "starfetch.ng"],
    ] as Array<[string, string]>) {
      assert(normaliseHost(input) === expected, `normaliseHost(${JSON.stringify(input)}) should be ${expected}, got ${normaliseHost(input)}`);
    }

    // Must reject rather than guess.
    const rejected: Array<[string, string | null | undefined]> = [
      ["empty", ""],
      ["whitespace only", "   "],
      ["null", null],
      ["undefined", undefined],
      ["userinfo", "admin.starfetch.ng@evil.com"],
      ["userinfo with port", "a@b.com:443"],
      ["two colons", "admin.starfetch.ng:443:80"],
      ["bracketed IPv6", "[::1]"],
      ["non-numeric port", "starfetch.ng:http"],
      ["port 0", "starfetch.ng:0"],
      ["port too high", "starfetch.ng:70000"],
      ["leading dot", ".starfetch.ng"],
      ["trailing dot", "starfetch.ng."],
      ["double dot", "starfetch..ng"],
      ["underscore label", "star_admin.starfetch.ng"],
      ["empty label", "starfetch..ng"],
      ["slash in host", "starfetch.ng/path"],
      ["space in host", "star fetch.ng"],
      ["overlong", "a".repeat(300) + ".com"],
    ];
    for (const [label, input] of rejected) {
      assert(normaliseHost(input) === null, `normaliseHost must reject ${label} (${JSON.stringify(input)})`);
    }
  }

  // === 2. Path classification cannot be tricked ===========================
  {
    const adminPaths = [
      "/admin",
      "/admin/",
      "/admin/login",
      "/admin/dashboard",
      "/admin//login",
      "/ADMIN/login",
      "/Admin/Dashboard",
      "/%61dmin/login", // percent-encoded 'a'
      "/admin/login/",
      "/api/admin-auth/login",
      "/api/admin-gateway/dashboard/summary",
      "/api/admin-auth/session",
    ];
    for (const path of adminPaths) {
      assert(classifyPath(path) === "admin", `${path} must classify as admin, got ${classifyPath(path)}`);
    }

    const publicPaths = [
      "/",
      "/login",
      "/register/individual",
      "/dashboard",
      "/joint/dashboard",
      "/corporate/dashboard",
      "/investments",
      "/products",
      "/about",
      "/complaints",
      "/tools/budget",
      // Traversal and malformed escapes must never become "admin".
      "/admin/../login",
      "/%2e%2e/admin",
      "/admin\\login",
      "/admin%00/login",
      "/%zz/admin",
    ];
    for (const path of publicPaths) {
      assert(
        classifyPath(path) !== "admin",
        `${path} must NOT classify as admin, got ${classifyPath(path)}`,
      );
    }
  }

  // === 3. Public host cannot reach the staff surface ======================
  {
    for (const path of ["/admin", "/admin/login", "/admin/dashboard", "/api/admin-auth/login", "/api/admin-gateway/dashboard/summary"]) {
      const decision = decide(PUBLIC, path);
      assert(decision.action === "deny", `public host ${path} must be denied, got ${decision.action}`);
      assert(
        decision.action === "deny" && decision.status === 404,
        `public host ${path} must 404`,
      );
    }
    // And it must not redirect a public visitor to the staff portal.
    assert(
      decide(PUBLIC, "/admin").action !== "redirect",
      "a public visitor must never be redirected to the staff portal",
    );
  }

  // === 4. Public host still serves the website and investor portal ========
  {
    for (const path of ["/", "/login", "/register/joint", "/dashboard", "/corporate/dashboard", "/complaints", "/tools/budget"]) {
      const decision = decide(PUBLIC, path);
      assert(decision.action === "allow" && decision.host === "public", `public host ${path} must be allowed as public, got ${decision.action}`);
    }
    // www is also a public host.
    assert(decide("www.starfetch.ng", "/dashboard").action === "allow", "www host must serve the investor portal");
  }

  // === 5. Admin host serves staff routes only =============================
  {
    for (const path of ["/admin/dashboard", "/admin/kyc", "/admin/login", "/api/admin-auth/session", "/api/admin-gateway/dashboard/summary"]) {
      const decision = decide(ADMIN, path);
      assert(decision.action === "allow" && decision.host === "admin", `admin host ${path} must be allowed as admin, got ${decision.action}`);
    }

    // Public investor routes are refused on the staff host.
    for (const path of ["/login", "/register/individual", "/dashboard", "/joint/dashboard", "/corporate/dashboard", "/products", "/about", "/complaints"]) {
      const decision = decide(ADMIN, path);
      assert(decision.action === "deny", `admin host ${path} must be denied, got ${decision.action}`);
    }

    // Root redirects to the staff entry point rather than a public page.
    const root = decide(ADMIN, "/");
    assert(root.action === "redirect", "admin host root must redirect");
    assert(
      root.action === "redirect" && root.to === ADMIN_ENTRY_PATH,
      `admin host root must redirect to ${ADMIN_ENTRY_PATH}`,
    );
  }

  // === 6. Unknown, preview and malformed hosts fail closed ================
  {
    for (const host of [
      "evil.com",
      "starfetch.ng.evil.com",
      "admin.starfetch.ng.evil.com",
      "admine.starfetch.ng",
      "starfetch.co",
      "localhost",
      "127.0.0.1",
      "preview-abc123.vercel.app",
      "",
      null,
    ]) {
      const decision = decide(host, "/admin/dashboard");
      assert(decision.action === "deny", `host ${JSON.stringify(host)} must be denied`);
    }

    // A Vercel preview host is denied unless explicitly allowed.
    assert(decide("preview-abc.vercel.app", "/").action === "deny", "unapproved preview host must be denied");
    const withPreview = { ...config, allowedPreviewHosts: ["preview-abc.vercel.app"] };
    const previewDecision = decide("preview-abc.vercel.app", "/", withPreview);
    assert(previewDecision.action === "allow" && previewDecision.host === "public", "an APPROVED preview host may serve the public site");
    // ...but it can never reach the staff surface.
    assert(decide("preview-abc.vercel.app", "/admin/dashboard", withPreview).action === "deny", "an approved preview host must never serve staff pages");
  }

  // === 7. Missing or invalid configuration denies everything ==============
  {
    for (const path of ["/", "/login", "/admin/login", "/admin/dashboard"]) {
      const decision = decide(PUBLIC, path, null);
      assert(decision.action === "deny" && decision.status === 503, `a null config must deny ${path} with 503`);
    }

    // Same host listed as both public and admin is ambiguous: refuse to guess.
    const ambiguous: HostPolicyConfig = { publicHosts: [PUBLIC], adminHosts: [PUBLIC] };
    assert(decide(PUBLIC, "/", ambiguous).action === "deny", "a host cannot be both public and admin");

    // Empty public list is invalid.
    const noPublic: HostPolicyConfig = { publicHosts: [], adminHosts: [ADMIN] };
    assert(decide(ADMIN, "/admin/dashboard", noPublic).action === "deny", "empty publicHosts must be rejected");

    // A wildcard is not a hostname and must be rejected outright.
    const wildcard: HostPolicyConfig = { publicHosts: ["*.starfetch.ng"], adminHosts: [ADMIN] };
    assert(decide("anything.starfetch.ng", "/", wildcard).action === "deny", "wildcard host entries must be invalid");
  }

  // === 8. AVAILABILITY: admin config faults must not take the site down ====
  // This is the correction David raised. The old reader returned a null config
  // for ANY admin-side problem, and a null config denied every request on every
  // host with 503 — so a staff-portal typo took the public website and the
  // investor portal offline. Severity now separates the two sides.
  {
    // --- Fatal: PUBLIC_HOSTNAMES missing or invalid ----------------------
    const empty = readHostPolicyConfig({} as NodeJS.ProcessEnv);
    assert(empty.config === null, "an empty environment must not produce a config");
    assert(empty.fatal === true, "no public hostname must be FATAL");
    assert(empty.problem?.includes("missing") === true, "the problem must say what is missing");

    // Admin configured but no public host: still fatal, because we cannot tell an
    // approved public host from an arbitrary one.
    const adminOnly = readHostPolicyConfig({
      ADMIN_HOSTNAMES: ADMIN,
      NODE_ENV: "production",
    } as unknown as NodeJS.ProcessEnv);
    assert(adminOnly.config === null, "admin-only configuration must be rejected (publicHosts required)");
    assert(adminOnly.fatal === true, "a missing public host must be fatal");

    const badPublic = readHostPolicyConfig({
      PUBLIC_HOSTNAMES: "not a hostname!",
      ADMIN_HOSTNAMES: ADMIN,
      NODE_ENV: "production",
    } as unknown as NodeJS.ProcessEnv);
    assert(badPublic.config === null, "an invalid public hostname must not produce a config");
    assert(badPublic.fatal === true, "an invalid public hostname must be fatal");

    // --- Admin-only: the public site KEEPS WORKING -----------------------
    // This is the headline requirement. Each case below must leave the public
    // host serving normally while making the admin portal unreachable.

    const adminMissing = readHostPolicyConfig({
      PUBLIC_HOSTNAMES: PUBLIC,
      NODE_ENV: "production",
    } as unknown as NodeJS.ProcessEnv);
    assert(adminMissing.config !== null, "ADMIN_HOSTNAMES missing must NOT null the public config");
    assert(adminMissing.fatal === false, "a missing admin hostname must not be fatal");
    assert(
      decide(PUBLIC, "/", adminMissing.config).action === "allow",
      "the public homepage MUST still serve when ADMIN_HOSTNAMES is missing",
    );
    assert(
      decide(PUBLIC, "/login", adminMissing.config).action === "allow",
      "investor login MUST still serve when ADMIN_HOSTNAMES is missing",
    );
    assert(
      decide(PUBLIC, "/api/v1/auth/login", adminMissing.config).action === "allow",
      "investor API forwarding MUST still work when ADMIN_HOSTNAMES is missing",
    );
    // The staff hostname must be unreachable, not merely gated.
    assert(
      decide(ADMIN, "/admin/login", adminMissing.config).action === "deny",
      "the admin hostname must be unreachable when it is not configured",
    );
    // And the public host must still refuse staff paths, as always.
    assert(
      decide(PUBLIC, "/admin/dashboard", adminMissing.config).action === "deny",
      "the public host must never serve admin pages",
    );

    const adminInvalid = readHostPolicyConfig({
      PUBLIC_HOSTNAMES: PUBLIC,
      ADMIN_HOSTNAMES: "admin.starfetchinvestltd.com.ng:notaport",
      NODE_ENV: "production",
    } as unknown as NodeJS.ProcessEnv);
    assert(adminInvalid.config !== null, "an invalid ADMIN hostname must not null the public config");
    assert(adminInvalid.fatal === false, "an invalid admin hostname must not be fatal");
    assert(
      decide(PUBLIC, "/", adminInvalid.config).action === "allow",
      "the public homepage MUST still serve when ADMIN_HOSTNAMES is invalid",
    );
    assert(
      decide(ADMIN, "/admin/login", adminInvalid.config).action === "deny",
      "an invalid admin hostname must leave the portal unreachable",
    );

    // Conflicting configuration: one hostname claimed by BOTH sides. Ambiguous,
    // so it must fail safe — admin closed, public intact. We refuse the admin
    // reading rather than the public one because a public outage is the harm we
    // were asked to eliminate.
    const conflicting = readHostPolicyConfig({
      PUBLIC_HOSTNAMES: PUBLIC,
      ADMIN_HOSTNAMES: PUBLIC,
      NODE_ENV: "production",
    } as unknown as NodeJS.ProcessEnv);
    assert(conflicting.config !== null, "a conflict must not null the public config");
    assert(conflicting.fatal === false, "a public/admin conflict must not be fatal");
    assert(conflicting.config!.adminHosts.length === 0, "a conflicting admin list must be emptied");
    assert(
      decide(PUBLIC, "/", conflicting.config).action === "allow",
      "the public site MUST still serve on a conflicting configuration",
    );
    assert(
      decide(PUBLIC, "/admin/dashboard", conflicting.config).action === "deny",
      "a conflict must never open the admin surface",
    );

    // --- A complete, correct configuration -------------------------------
    const good = readHostPolicyConfig({
      PUBLIC_HOSTNAMES: `${PUBLIC}, www.${PUBLIC}`,
      ADMIN_HOSTNAMES: ADMIN,
      NODE_ENV: "production",
    } as unknown as NodeJS.ProcessEnv);
    assert(good.config !== null, `a complete configuration must parse (${good.problem})`);
    assert(good.fatal === false, "a complete configuration is not fatal");
    assert(good.problem === null, "a complete configuration has no problem");
    assert(good.config!.publicHosts.length === 2, "commas and whitespace must be split correctly");

    // localhost is NOT an admin host in production, even if requested.
    const prodLocal = readHostPolicyConfig({
      PUBLIC_HOSTNAMES: PUBLIC,
      ADMIN_HOSTNAMES: ADMIN,
      ADMIN_ALLOW_LOCALHOST: "true",
      NODE_ENV: "production",
    } as unknown as NodeJS.ProcessEnv);
    assert(prodLocal.config !== null, "config should parse");
    assert(
      decide("localhost", "/admin/dashboard", prodLocal.config).action === "deny",
      "localhost must NOT reach the admin portal in production even with ADMIN_ALLOW_LOCALHOST",
    );

    // In development it may be explicitly enabled for testing.
    const devLocal = readHostPolicyConfig({
      PUBLIC_HOSTNAMES: PUBLIC,
      ADMIN_HOSTNAMES: ADMIN,
      ADMIN_ALLOW_LOCALHOST: "true",
      ADMIN_LOCAL_DEV_HOST: "localhost",
      NODE_ENV: "development",
    } as unknown as NodeJS.ProcessEnv);
    assert(devLocal.config !== null, "dev config should parse");
    assert(
      decide("localhost", "/admin/dashboard", devLocal.config).action === "allow",
      "an explicitly enabled local dev host must reach the admin portal in development",
    );
    // The dev host is an ADMIN host, so it must still refuse investor pages.
    assert(
      decide("localhost", "/dashboard", devLocal.config).action === "deny",
      "the local admin host must still refuse investor routes",
    );
    // And enabling it must not make it public.
    assert(
      decide("localhost", "/login", devLocal.config).action === "deny",
      "the local admin host must not serve investor login",
    );
  }

  // === 8b. RAW STAFF API AND INVESTOR API ISOLATION =======================
  // David's Task 3. The generic `/api/v1/:path*` rewrite is hostname-agnostic,
  // so classification must refuse the raw staff API on the public host and
  // refuse investor API on the staff host — otherwise the rewrite becomes the
  // bypass both directions.
  {
    const cfg = readHostPolicyConfig({
      PUBLIC_HOSTNAMES: PUBLIC,
      ADMIN_HOSTNAMES: ADMIN,
      NODE_ENV: "production",
    } as unknown as NodeJS.ProcessEnv).config!;

    // --- The raw staff API family, in every spelling --------------------
    const rawAdminPaths = [
      "/api/v1/admin",
      "/api/v1/admin/",
      "/api/v1/admin/investors",
      "/api/v1/admin/investors/123/kyc",
      "/API/V1/ADMIN/users",
      "//api//v1//admin//users",
      "/api/v1/Admin/Users",
      "/api/v1/admin/users/",
      "/api/%76%31/admin/users",   // encoded "v1"
    ];
    for (const path of rawAdminPaths) {
      assert(classifyPath(path) === "admin", `${path} must classify as admin`);
      assert(isRawAdminApiPath(path) === true, `${path} must be caught by the rewrite guard`);
      assert(
        decide(PUBLIC, path, cfg).action === "deny",
        `the PUBLIC host must refuse the raw staff API at ${path}`,
      );
    }

    // Traversal attempts must be caught, not shrugged off.
    for (const path of ["/api/v1/x/../admin/users", "/api/v1/./admin/users", "/api/v1\\admin"]) {
      assert(isRawAdminApiPath(path) === true, `traversal ${path} must be refused by the rewrite guard`);
    }

    // --- Investor API must NOT forward on the admin host -----------------
    const investorApiPaths = [
      "/api/v1/auth/login",
      "/api/v1/investors",
      "/api/v1/accounts",
      "/api/v1/kyc",
      "/api/v1/investments",
      "/api/v1/transactions",
      "/api/v1/portfolios",
      "/api/v1/products",
      "/api/v1/corporate/kyc",
      "/api/v1/joint",
    ];
    for (const path of investorApiPaths) {
      assert(classifyPath(path) === "investor-api", `${path} must classify as investor-api`);
      assert(
        decide(ADMIN, path, cfg).action === "deny",
        `the ADMIN host must refuse investor API at ${path}`,
      );
      // The same paths must still work on the public host — this is the
      // regression the correction must not cause.
      assert(
        decide(PUBLIC, path, cfg).action === "allow",
        `the PUBLIC host must still forward investor API at ${path}`,
      );
    }

    // --- EVERY /api/v1 path is refused on the admin host ----------------
    // The bug this replaces: only fifteen prefixes were listed, so
    // `/api/v1/me/profile` and `/api/v1/corporate-accounts/*` fell through to
    // "other" and "other" was served on the staff origin. Adding two more strings
    // would have moved the hole; the rule is inverted instead.
    const everyApiPath = [
      "/api/v1/me/profile",                  // named in review — was NOT covered
      "/api/v1/me",                          // the bare parent
      "/api/v1/corporate-accounts",          // named in review — was NOT covered
      "/api/v1/corporate-accounts/123",
      "/api/v1/corporate-accounts/123/kyc/documents",
      "/api/v1/individual-accounts/abc",
      "/api/v1/joint-accounts/abc",
      "/api/v1/wallet",
      "/api/v1/statements/2026-11",
      "/api/v1/notifications",
      "/api/v1/support/tickets",
      "/api/v1/referrals",
      "/api/v1/requests",
      "/api/v1/me/preferences",
      "/api/v1/",                            // bare root
      "/API/V1/ME/PROFILE",                  // cased
      "//api//v1//me//profile",              // doubled slashes
      "/api/v1/me/profile/",                 // trailing slash
      "/api/%76%31/me/profile",              // encoded segment
      "/api/v1/some-route-invented-next-year", // unknown / future
    ];
    for (const path of everyApiPath) {
      assert(
        classifyPath(path) === "investor-api",
        `${path} must classify as investor-api, not fall through to "other"`,
      );
      assert(
        decide(ADMIN, path, cfg).action === "deny",
        `the ADMIN host must refuse ${path}`,
      );
      // ...while the public host keeps serving it. This is the half that must not
      // regress: blanket-blocking the admin host is only acceptable if the
      // investor API on the public host is untouched.
      assert(
        decide(PUBLIC, path, cfg).action === "allow",
        `the PUBLIC host must still forward ${path}`,
      );
    }

    // Traversal paths are classified "public" by the older dot-segment rule rather
    // than "investor-api". That is still a DENY on the admin host, which is the
    // property that matters — assert the outcome, not the internal label.
    for (const path of ["/api/v1/x/../me/profile", "/api/v1/./me/profile", "/api/v1\\me\\profile"]) {
      assert(
        decide(ADMIN, path, cfg).action === "deny",
        `the ADMIN host must refuse traversal path ${path}`,
      );
    }

    // --- The raw staff API stays blocked on BOTH hosts ------------------
    for (const path of ["/api/v1/admin", "/api/v1/admin/me", "/api/v1/admin/corporate-accounts"]) {
      assert(
        decide(PUBLIC, path, cfg).action === "deny",
        `the PUBLIC host must refuse the raw staff API at ${path}`,
      );
      assert(
        decide(ADMIN, path, cfg).action === "deny",
        `the ADMIN host must refuse the raw staff API at ${path}`,
      );
      assert(isRawAdminApiPath(path) === true, `${path} must be caught by the rewrite guard`);
    }

    // --- Unclassified paths are refused on the admin host ---------------
    // "other" is whatever has not been classified yet. On the staff origin that is
    // not a safe default.
    for (const path of ["/some-unknown-page", "/internal/thing", "/api/v2/x", "/api", "/apix"]) {
      assert(
        decide(ADMIN, path, cfg).action === "deny",
        `the ADMIN host must refuse unclassified path ${path}`,
      );
    }

    // --- The BFF endpoints stay staff-only ------------------------------
    for (const path of ["/api/admin-auth/login", "/api/admin-gateway/investors"]) {
      assert(decide(PUBLIC, path, cfg).action === "deny", `public host must refuse ${path}`);
      assert(classifyPath(path) === "admin", `${path} must classify as admin`);
    }

    // --- The NGX market feed must keep working --------------------------
    // Market data is public read-only data; blocking it on either host would be a
    // functional regression David explicitly ruled out.
    assert(classifyPath("/api/v1/market/ngx") === "investor-api", "market data classifies as public API");
    assert(
      decide(PUBLIC, "/api/v1/market/ngx", cfg).action === "allow",
      "the NGX market feed must still work on the public host",
    );

    // --- CSRF header naming is a single constant -------------------------
    assert(STAFF_CSRF_HEADER === "x-csrf-token", "the canonical CSRF header is X-CSRF-Token");
    assert(STAFF_CSRF_COOKIE === "__Host-sf_admin_csrf", "the CSRF cookie keeps its __Host- prefix");
    assert(
      STAFF_CSRF_COOKIE.startsWith("__Host-"),
      "a __Host- cookie is host-only by definition, so it cannot leak to sibling subdomains",
    );
  }

  // === 9. Headers on a denied response reveal nothing ====================
  {
    const headers = denyHeaders();
    assert(headers["Cache-Control"].includes("no-store"), "denied responses must never be cached");
    assert(headers["X-Content-Type-Options"] === "nosniff", "denied responses must be nosniff");
    assert(headers["X-Robots-Tag"].includes("noindex"), "denied responses must be noindex");
    assert(
      !Object.keys(headers).some((key) => key.toLowerCase() === "server"),
      "denied responses must not add a Server header",
    );
  }

  // === 10. Host header manipulation cannot escape =======================
  {
    // The policy function takes one host string and has no notion of a
    // forwarded header, so there is nothing to spoof. Assert the shape: a caller
    // CANNOT pass a list.
    const spoofed = decide("evil.com", "/admin/dashboard");
    assert(spoofed.action === "deny", "an arbitrary Host must never reach the admin portal");

    // A public host cannot smuggle admin access by path casing or encoding.
    for (const path of ["/Admin/Login", "/ADMIN/DASHBOARD", "/%2Fadmin%2Flogin", "/admin%2Flogin"]) {
      assert(decide(PUBLIC, path).action === "deny", `public host must deny ${path}`);
    }
  }

  console.log(
    "PASS — Admin hostname isolation: explicit allowlists with no suffix matching; " +
      "public host cannot render admin pages, admin auth or the admin gateway and is never redirected to the staff portal; " +
      "admin host serves only staff routes and redirects its root to the staff entry point; " +
      "unknown, preview and malformed hosts fail closed; ports, userinfo, IPv6 literals and wildcards are rejected; " +
      "a missing or invalid public hostname denies everything with 503 while a missing or invalid admin hostname closes only the admin portal and leaves the website and investor API serving; the raw /api/v1/admin family is refused on the public host and investor API is refused on the staff host; " +
      "localhost can never reach the admin portal in production; " +
      "and encoded, cased, doubled-slash and traversal paths cannot impersonate an admin route.",
  );
}

main();
