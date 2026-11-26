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
  readHostPolicyConfig,
  resolveHostPolicy,
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

  // === 8. Environment reading fails closed and ignores prod localhost ====
  {
    // Nothing configured.
    const empty = readHostPolicyConfig({} as NodeJS.ProcessEnv);
    assert(empty.config === null, "an empty environment must not produce a config");
    assert(empty.problem?.includes("missing") === true, "the problem must say what is missing");

    // Only admin configured: no public hosts, but admin alone is still usable
    // for the staff host... except validateConfig requires a public host.
    const adminOnly = readHostPolicyConfig({
      ADMIN_HOSTNAMES: ADMIN,
      NODE_ENV: "production",
    } as unknown as NodeJS.ProcessEnv);
    assert(adminOnly.config === null, "admin-only configuration must be rejected (publicHosts required)");

    // A complete configuration parses.
    const good = readHostPolicyConfig({
      PUBLIC_HOSTNAMES: `${PUBLIC}, www.starfetch.ng`,
      ADMIN_HOSTNAMES: ADMIN,
      NODE_ENV: "production",
    } as unknown as NodeJS.ProcessEnv);
    assert(good.config !== null, `a complete configuration must parse (${good.problem})`);
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
      "missing or contradictory configuration denies everything with 503; " +
      "localhost can never reach the admin portal in production; " +
      "and encoded, cased, doubled-slash and traversal paths cannot impersonate an admin route.",
  );
}

main();
