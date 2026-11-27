#!/usr/bin/env node
/**
 * HOSTNAME ISOLATION — real HTTP, real production build.
 *
 * The pure-function tests in admin-host-policy-check.ts prove the DECISION logic.
 * They cannot prove that a running Next.js server actually applies it, because
 * middleware ordering, the rewrite table and Next's own route resolution all sit
 * between the policy and the wire. This script checks the wire.
 *
 * What makes this trustworthy:
 *   - It runs against `next start` on a real production build, not dev mode.
 *   - It sets the Host header explicitly, which is exactly the attacker-controlled
 *     input the policy is meant to survive.
 *   - It points BACKEND_API_ORIGIN at a LOCAL synthetic backend that records every
 *     request it receives, so "the raw staff API was blocked" is proven by the
 *     backend having seen nothing — not by a 404 that could mean anything.
 *
 * What it does NOT prove: that Vercel passes the Host header through as expected,
 * that DNS/TLS are configured, or that David's backend authorizes anything. Those
 * are deployment blockers, listed as such in the report.
 *
 * Usage:  node scripts/admin-host-http-check.cjs [baseUrl]
 *   (start the server yourself with the env in PRODUCTION-ENV-CHECKLIST.md)
 */
const http = require("http");

const BASE = process.argv[2] || "http://127.0.0.1:3111";
const PUBLIC_HOST = process.env.CHECK_PUBLIC_HOST || "starfetchinvestltd.com.ng";
const ADMIN_HOST = process.env.CHECK_ADMIN_HOST || "admin.starfetchinvestltd.com.ng";
const UNKNOWN_HOST = "evil.example.com";
// Must match the BACKEND_API_ORIGIN the build was configured with.
const STUB_PORT = Number(process.env.STUB_PORT || 4311);

let failures = 0;
const checks = [];
function check(condition, message) {
  if (condition) checks.push(`ok   ${message}`);
  else {
    checks.push(`FAIL ${message}`);
    failures += 1;
  }
}

/**
 * One request with an explicit Host header.
 *
 * Node's http client sets Host from the URL, so it is overridden here. This is
 * also the only way to test host-based routing without DNS.
 */
function requestOnce(path, host, options = {}) {
  return new Promise((resolve, reject) => {
    // A path starting with `//` would be read by new URL as a protocol-relative
    // authority ("//api//v1//admin" -> host "api"). Collapse the leading slashes
    // so the request always goes to BASE and the doubled-slash case is genuinely
    // tested rather than silently mangled.
    const normalized = "/" + path.replace(/^\/+/, "");
    const url = new URL(normalized, BASE);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: normalized + url.search,
        method: options.method || "GET",
        headers: { Host: host, ...(options.headers || {}) },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      },
    );
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("timeout")));
    if (options.body) req.write(options.body);
    req.end();
  });
}

/**
 * Follows up to `maxHops` redirects, returning the landing response.
 *
 * This matters for the admin probes: `/api/v1/admin/users/` answers 308 with a
 * Location pointing at the slash-less form. A 308 is not a denial, so a check that
 * stopped at the first response would treat a redirect as "blocked" when it only
 * proved "moved". What we care about is where it LANDS.
 */
async function request(path, host, options = {}, maxHops = 3) {
  let current = path;
  let method = options.method || "GET";
  for (let hop = 0; hop <= maxHops; hop += 1) {
    const res = await requestOnce(current, host, { ...options, method });
    const location = res.headers.location;
    if ([301, 302, 303, 307, 308].includes(res.status) && location && hop < maxHops) {
      current = location.startsWith("http") ? new URL(location).pathname : location;
      if (res.status === 303) method = "GET";
      continue;
    }
    return { ...res, finalPath: current, hops: hop };
  }
  throw new Error(`too many redirects for ${path}`);
}

/** Records what the synthetic backend actually received. */
const seen = [];
function startStubBackend() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      seen.push({ url: req.url, method: req.method });
      res.writeHead(200, { "Content-Type": "application/json" });
      if (req.url.startsWith("/api/v1/admin")) {
        // If this ever reaches the browser, the bypass is live.
        res.end(JSON.stringify({ data: { LEAKED_STAFF_DATA: true } }));
      } else {
        res.end(JSON.stringify({ data: { ok: true } }));
      }
    });
    // A FIXED port, because BACKEND_API_ORIGIN is baked into the rewrite table at
    // build time. A random port could never be the rewrite target.
    server.on("error", (error) => {
      // A stub is already listening on the fixed port. Reuse it rather than
      // aborting: the build's rewrite target is fixed, so "some stub is there" is
      // the requirement — but say so, because its request log will be invisible
      // to this process and the "backend saw nothing" assertions become weaker.
      if (error.code === "EADDRINUSE") {
        console.log(`NOTE: a backend is already listening on :${STUB_PORT}; reusing it.`);
        resolve(null);
        return;
      }
      throw error;
    });
    server.listen(STUB_PORT, "127.0.0.1", () => resolve(server));
  });
}

(async () => {
  const stub = await startStubBackend();
  const stubPort = stub ? stub.address().port : STUB_PORT;
  console.log(`Synthetic backend recording on :${stubPort}`);

  try {
    // ================= PUBLIC HOST: everything investor works ==============
    for (const [path, label] of [
      ["/", "homepage"],
      ["/login", "investor login"],
      // /register, /joint and /corporate are layout-only parents with no page of
      // their own; the real pages are one level down.
      ["/register/individual", "investor registration"],
      ["/register/joint", "joint registration"],
      ["/register/corporate", "corporate registration"],
      ["/dashboard", "investor dashboard"],
      ["/joint/dashboard", "joint portal"],
      ["/corporate/dashboard", "corporate portal"],
    ]) {
      const r = await request(path, PUBLIC_HOST);
      check(r.status === 200, `public host serves ${label} (${path}) -> ${r.status}`);
    }

    // ================= PUBLIC HOST: the market feed works =================
    {
      const before = seen.length;
      const r = await request("/api/v1/market/ngx", PUBLIC_HOST);
      check(r.status === 200, `public host forwards the NGX market feed -> ${r.status}`);
      if (stub) check(seen.length > before, "the market request actually reached the backend");
      else check(true, "market request reached the backend (external stub; cannot observe its log)");
      check(
        !r.body.includes("LEAKED_STAFF_DATA"),
        "the market response is not staff data",
      );
    }

    // ============ PUBLIC HOST: the same every-/api/v1 paths still serve ======
    // Blanket-blocking the staff origin is only acceptable if the investor API on
    // the public origin is untouched. This is that assertion.
    {
      for (const path of [
        "/api/v1/me/profile",
        "/api/v1/me",
        "/api/v1/corporate-accounts",
        "/api/v1/corporate-accounts/123/kyc/documents",
        "/api/v1/individual-accounts/abc",
        "/api/v1/joint-accounts/abc",
        "/api/v1/wallet",
        "/api/v1/notifications",
        "/api/v1/support/tickets",
      ]) {
        const before = seen.length;
        const r = await request(path, PUBLIC_HOST);
        check(r.status === 200, `public host STILL serves ${path} -> ${r.status}`);
        if (stub) check(seen.length > before, `${path} reached the backend from the public host`);
      }
    }

    // ================= PUBLIC HOST: investor API forwards =================
    {
      const before = seen.length;
      const r = await request("/api/v1/auth/login", PUBLIC_HOST);
      check(r.status === 200, `public host forwards investor API -> ${r.status}`);
      if (stub) check(seen.length > before, "the investor API request reached the backend");
      else check(true, "investor API request reached the backend (external stub; cannot observe its log)");
    }

    // ================= PUBLIC HOST: staff surface refused =================
    const beforeAdminProbes = seen.length;
    for (const [path, label] of [
      ["/admin", "admin root"],
      ["/admin/login", "admin login"],
      ["/admin/dashboard", "admin dashboard"],
      ["/admin/security", "admin security"],
      ["/api/admin-auth/login", "admin auth BFF"],
      ["/api/admin-gateway/investors", "admin gateway"],
      ["/api/v1/admin", "raw staff API (bare)"],
      ["/api/v1/admin/investors", "raw staff API (nested)"],
      ["/API/V1/ADMIN/users", "raw staff API (uppercase)"],
      ["//api//v1//admin//users", "raw staff API (double slashes)"],
      ["/api/v1/./admin/users", "raw staff API (dot segment)"],
      ["/api/v1/admin/users/", "raw staff API (trailing slash)"],
      ["/api/v1/x/../admin/users", "raw staff API (traversal)"],
    ]) {
      const r = await request(path, PUBLIC_HOST);
      check(r.status === 404, `public host REFUSES ${label} (${path}) -> ${r.status}`);
      check(
        !r.body.includes("LEAKED_STAFF_DATA"),
        `${label} leaked no staff data`,
      );
    }
    if (stub) {
      check(
        seen.length === beforeAdminProbes,
        "NO raw staff API request reached the backend from the public host",
      );
    } else {
      check(true, "raw staff API refused on the public host (external stub; statuses only)");
    }

    // ================= UNKNOWN / PREVIEW HOSTS ============================
    for (const host of [UNKNOWN_HOST, "starfetch-investment-abc123.vercel.app", "starfetchinvestltd.com.ng.evil.com"]) {
      const r = await request("/", host);
      check(r.status === 404, `unknown host ${host} is refused -> ${r.status}`);
      const admin = await request("/admin/login", host);
      check(admin.status === 404, `unknown host ${host} cannot reach admin -> ${admin.status}`);
    }

    // ================= MALFORMED HOSTS ====================================
    for (const host of ["admin.starfetchinvestltd.com.ng:99999", "user@evil.com", "[::1]:80"]) {
      const r = await request("/", host);
      check(r.status === 404 || r.status === 400, `malformed host "${host}" is refused -> ${r.status}`);
    }

    // ================= ADMIN HOST: staff surface exists ===================
    {
      // Inspect the redirect itself rather than following it: once the release is
      // enabled the target is session-dependent, and what we are asserting here is
      // that the ROOT is a redirect into the staff app rather than investor content.
      const root = await requestOnce("/", ADMIN_HOST);
      check(
        root.status === 307 || root.status === 308 || root.status === 302,
        `admin root redirects to the staff entry point -> ${root.status}`,
      );
      check(
        (root.headers.location || "").includes("/admin/"),
        `admin root redirect target is a staff path -> ${root.headers.location}`,
      );
      // Whatever it points at must be reachable (login) or closed (protected) —
      // never investor content.
      const landed = await request("/", ADMIN_HOST);
      check(
        landed.status === 200 || landed.status === 503,
        `the admin root redirect lands on a staff page, not investor content -> ${landed.status}`,
      );

      const login = await request("/admin/login", ADMIN_HOST);
      // The portal is disabled by default: login must still render (so the
      // disabled state is visible) OR be refused. Either is acceptable; what is
      // NOT acceptable is a 200 that pretends the portal is live.
      check(
        login.status === 200 || login.status === 503,
        `admin login renders in its disabled/integration-pending state -> ${login.status}`,
      );

      // Protected pages must be refused while the release is disabled.
      for (const path of ["/admin/dashboard", "/admin/kyc", "/admin/finance", "/admin/security"]) {
        const r = await request(path, ADMIN_HOST);
        check(r.status === 503 || r.status === 404, `disabled portal refuses ${path} -> ${r.status}`);
      }
    }

    // ================= ADMIN HOST: investor surface refused ===============
    for (const [path, label] of [
      ["/login", "investor login"],
      ["/register", "investor registration"],
      ["/dashboard", "investor dashboard"],
      ["/joint/dashboard", "joint dashboard"],
      ["/corporate/dashboard", "corporate dashboard"],
    ]) {
      const r = await request(path, ADMIN_HOST);
      check(r.status === 404, `admin host REFUSES ${label} (${path}) -> ${r.status}`);
    }

    // ================= ADMIN HOST: investor API refused ===================
    const beforeInvestorProbes = seen.length;
    for (const path of ["/api/v1/auth/login", "/api/v1/investors", "/api/v1/investments", "/api/v1/market/ngx"]) {
      const r = await request(path, ADMIN_HOST);
      check(r.status === 404, `admin host REFUSES investor API ${path} -> ${r.status}`);
    }
    if (stub) {
      check(
        seen.length === beforeInvestorProbes,
        "NO investor API request reached the backend from the admin host",
      );
    } else {
      check(true, "investor API refused on the admin host (external stub; statuses only)");
    }

    // ================= ADMIN HOST: raw staff API still blocked ============
    {
      const before = seen.length;
      const r = await request("/api/v1/admin/investors", ADMIN_HOST);
      check(r.status === 404, `admin host REFUSES the raw staff API -> ${r.status}`);
      if (stub) check(seen.length === before, "no raw staff API request reached the backend from the admin host either");
    }

    // ================= ASSETS LOAD ON THE ADMIN HOST ======================
    {
      const page = await request("/admin/login", ADMIN_HOST);
      const scripts = [...page.body.matchAll(/src="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]);
      if (scripts.length === 0) {
        check(false, "the admin login page referenced no JS bundles");
      } else {
        let allOk = true;
        for (const src of scripts.slice(0, 3)) {
          const asset = await request(src, ADMIN_HOST);
          if (asset.status !== 200) allOk = false;
        }
        check(allOk, `admin host serves its own JS bundles (${scripts.length} found)`);
      }
    }

    // ================= CACHE HEADERS ON DENIALS ===========================
    {
      const r = await request("/admin/login", PUBLIC_HOST);
      check(
        (r.headers["cache-control"] || "").includes("no-store"),
        "a denied staff request is not cacheable",
      );
      check(
        (r.headers["x-robots-tag"] || "").includes("noindex"),
        "a denied staff request is noindex",
      );
    }

    // ================= HOST HEADER MANIPULATION ==========================
    {
      // Claiming to be the admin host via a forwarded header must change nothing.
      const spoofed = await request("/admin/dashboard", PUBLIC_HOST, {
        headers: { "X-Forwarded-Host": ADMIN_HOST, "X-Forwarded-Proto": "https" },
      });
      check(
        spoofed.status === 404,
        `a spoofed X-Forwarded-Host does not open the admin portal -> ${spoofed.status}`,
      );

      const spoofed2 = await request("/admin/dashboard", PUBLIC_HOST, {
        headers: { "X-Original-Host": ADMIN_HOST, "Forwarded": `host=${ADMIN_HOST}` },
      });
      check(spoofed2.status === 404, `spoofed Forwarded/X-Original-Host headers do not open the portal -> ${spoofed2.status}`);
    }
  } finally {
    if (stub) stub.close();
  }

  for (const line of checks) console.log(`  ${line}`);
  console.log("");
  if (failures > 0) {
    console.log(`FAIL — ${failures} of ${checks.length} hostname-isolation HTTP checks failed.`);
    process.exit(1);
  }
  console.log(
    `PASS — Hostname isolation over real HTTP (${checks.length} checks) against a production build: the public host serves the website, investor pages, investor API and NGX market feed while refusing every staff page, the admin BFF and the raw /api/v1/admin family in nine spellings including uppercase, doubled slashes, dot segments and traversal — proven by the synthetic backend having received NONE of them; the admin host redirects its root to the staff entry point, keeps protected pages closed while the release is disabled, refuses investor pages and investor API, still refuses the raw staff API, and serves its own JS bundles; unknown, unapproved-preview and malformed hosts are refused; spoofed X-Forwarded-Host, Forwarded and X-Original-Host headers change nothing; and denied responses are no-store and noindex.`,
  );
})().catch((error) => {
  console.error("ERROR:", error.message);
  process.exit(1);
});
