#!/usr/bin/env node
/**
 * THE AVAILABILITY GUARANTEE, over real HTTP.
 *
 * David's Task 1 in one sentence: a staff-portal configuration fault must not take
 * the public website offline. That cannot be proven from a unit test, because the
 * harm came from the COMBINATION of the reader returning null and the middleware
 * turning null into a 503 for every host.
 *
 * This script starts the SAME production build several times, each with a
 * different broken environment, and checks what the wire does. It is the only way
 * to be sure the separation holds through Next's actual request path.
 *
 * Usage: node scripts/admin-host-availability-check.cjs
 */
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_HOST = "starfetchinvestltd.com.ng";
const ADMIN_HOST = "admin.starfetchinvestltd.com.ng";
const PORT = Number(process.env.AVAIL_PORT || 3122);
// The investor API assertions forward through the /api/v1 rewrite, so a backend must
// exist or they 500. Start our OWN rather than relying on one being up: a check that
// passes only when something else happens to be listening is not a check.
const STUB_PORT = Number(process.env.STUB_PORT || 4311);
const BASE = `http://127.0.0.1:${PORT}`;

let failures = 0;
const lines = [];
function check(condition, message) {
  lines.push(`  ${condition ? "ok  " : "FAIL"} ${message}`);
  if (!condition) failures += 1;
}

function get(pathname, host, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port: PORT, path: pathname, method: "GET", headers: { Host: host, ...headers } },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("timeout")));
    req.end();
  });
}

function startStub() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: { ok: true, path: req.url } }));
    });
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.log(`NOTE: a backend is already on :${STUB_PORT}; reusing it.`);
        resolve(null);
        return;
      }
      reject(error);
    });
    server.listen(STUB_PORT, "127.0.0.1", () => resolve(server));
  });
}

function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(ROOT, "node_modules/next/dist/bin/next"), "start", "-p", String(PORT), "-H", "127.0.0.1"],
      { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    const onData = (chunk) => {
      out += chunk.toString();
      if (out.includes("Ready") || out.includes("started server")) {
        setTimeout(() => resolve(child), 400);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => reject(new Error(`server exited early (${code}): ${out.slice(-400)}`)));
    setTimeout(() => reject(new Error(`server did not start: ${out.slice(-400)}`)), 45000);
  });
}

function stopServer(child) {
  return new Promise((resolve) => {
    child.removeAllListeners("exit");
    child.on("exit", () => resolve());
    child.kill("SIGKILL");
  });
}

async function scenario(name, env, expectations) {
  lines.push("");
  lines.push(`=== ${name} ===`);
  const child = await startServer(env);
  try {
    for (const [pathname, host, wantStatus, label] of expectations) {
      const res = await get(pathname, host);
      check(res.status === wantStatus, `${label} -> ${res.status} (want ${wantStatus})`);
    }
  } finally {
    await stopServer(child);
    await new Promise((r) => setTimeout(r, 600));
  }
}

(async () => {
  const stub = await startStub();
  const BASE_ENV = { NODE_ENV: "production", BACKEND_API_ORIGIN: `http://127.0.0.1:${STUB_PORT}` };

  // --- 1. ADMIN_HOSTNAMES missing: public keeps working -------------------
  await scenario(
    "ADMIN_HOSTNAMES is MISSING (the exact outage David reported)",
    { ...BASE_ENV, PUBLIC_HOSTNAMES: PUBLIC_HOST },
    [
      ["/", PUBLIC_HOST, 200, "public homepage still serves"],
      ["/login", PUBLIC_HOST, 200, "investor login still serves"],
      ["/register/individual", PUBLIC_HOST, 200, "investor registration still serves"],
      ["/dashboard", PUBLIC_HOST, 200, "investor dashboard still serves"],
      ["/api/v1/auth/login", PUBLIC_HOST, 200, "investor API still forwards"],
      ["/admin/login", ADMIN_HOST, 404, "the admin hostname is unreachable (never opened)"],
      ["/admin/dashboard", ADMIN_HOST, 404, "no protected admin page is reachable"],
      ["/admin/login", PUBLIC_HOST, 404, "the public host still refuses staff pages"],
    ],
  );

  // --- 2. ADMIN_HOSTNAMES invalid: public keeps working ------------------
  await scenario(
    "ADMIN_HOSTNAMES is INVALID",
    { ...BASE_ENV, PUBLIC_HOSTNAMES: PUBLIC_HOST, ADMIN_HOSTNAMES: "admin..bad!host" },
    [
      ["/", PUBLIC_HOST, 200, "public homepage still serves"],
      ["/login", PUBLIC_HOST, 200, "investor login still serves"],
      ["/api/v1/investments", PUBLIC_HOST, 200, "investor API still forwards"],
      ["/admin/login", ADMIN_HOST, 404, "an invalid admin hostname never opens the portal"],
    ],
  );

  // --- 3. Conflicting hostnames: fail safe, public intact ----------------
  await scenario(
    "the same hostname configured as BOTH public and admin",
    { ...BASE_ENV, PUBLIC_HOSTNAMES: PUBLIC_HOST, ADMIN_HOSTNAMES: PUBLIC_HOST },
    [
      ["/", PUBLIC_HOST, 200, "the public site still serves"],
      ["/admin/dashboard", PUBLIC_HOST, 404, "the conflict does not open the admin surface"],
    ],
  );

  // --- 4. PUBLIC_HOSTNAMES missing: fatal, and correctly so -------------
  await scenario(
    "PUBLIC_HOSTNAMES is MISSING (must be fatal)",
    { ...BASE_ENV, ADMIN_HOSTNAMES: ADMIN_HOST },
    [
      ["/", PUBLIC_HOST, 503, "no public host can be trusted, so nothing is served"],
      ["/", ADMIN_HOST, 503, "and the admin host is served by nothing either"],
    ],
  );

  // --- 5. Correct configuration: both surfaces exist --------------------
  await scenario(
    "CORRECT production configuration",
    { ...BASE_ENV, PUBLIC_HOSTNAMES: PUBLIC_HOST, ADMIN_HOSTNAMES: ADMIN_HOST },
    [
      ["/", PUBLIC_HOST, 200, "public homepage serves"],
      ["/login", PUBLIC_HOST, 200, "investor login serves"],
      ["/admin/login", PUBLIC_HOST, 404, "public host refuses staff login"],
      ["/api/v1/admin/users", PUBLIC_HOST, 404, "public host refuses the raw staff API"],
      ["/login", ADMIN_HOST, 404, "admin host refuses investor login"],
      ["/admin/dashboard", ADMIN_HOST, 503, "the disabled portal refuses protected pages"],
    ],
  );

  // --- 6. RELEASE ENABLED: isolation must not soften -------------------
  // The five scenarios above all run with the portal disabled, which is the only
  // approved production state. But the isolation boundary must not depend on that
  // flag: when David's backend is live and the flags flip, the admin host must
  // still refuse investor routes and every /api/v1 path, and the public host must
  // still refuse staff routes. If isolation only held because the portal was
  // closed, it was never isolation.
  //
  // NOTE: enabling the flags here does NOT mean the portal works — ADMIN_BACKEND_URL
  // and the session cookie point at nothing, so requests fail closed at the session
  // check. What is under test is the HOSTNAME boundary, not authentication.
  await scenario(
    "RELEASE FLAGS ENABLED (hostname boundary must still hold)",
    {
      ...BASE_ENV,
      PUBLIC_HOSTNAMES: PUBLIC_HOST,
      ADMIN_HOSTNAMES: ADMIN_HOST,
      ADMIN_STAFF_INTEGRATION_ENABLED: "approved-v1",
      ADMIN_RELEASE_APPROVED: "true",
      ADMIN_BACKEND_URL: "http://127.0.0.1:4311",
      ADMIN_STAFF_SESSION_COOKIE: "__Host-sf_admin_session",
    },
    [
      // The public host is unchanged by the staff flags.
      ["/", PUBLIC_HOST, 200, "public homepage unaffected by the staff release"],
      ["/login", PUBLIC_HOST, 200, "investor login unaffected"],
      ["/api/v1/me/profile", PUBLIC_HOST, 200, "investor API /me/profile still public"],
      ["/api/v1/corporate-accounts/1", PUBLIC_HOST, 200, "investor API corporate-accounts still public"],
      ["/api/v1/market/ngx", PUBLIC_HOST, 200, "NGX feed still public"],
      // Staff routes stay absent from the public host.
      ["/admin/login", PUBLIC_HOST, 404, "public host still refuses staff login"],
      ["/admin/security", PUBLIC_HOST, 404, "public host still refuses staff security page"],
      ["/api/v1/admin/investors", PUBLIC_HOST, 404, "public host still refuses the raw staff API"],
      // The admin host serves staff pages, but still refuses investor surface.
      ["/admin/login", ADMIN_HOST, 200, "admin login serves when enabled"],
      ["/login", ADMIN_HOST, 404, "admin host still refuses investor login"],
      ["/dashboard", ADMIN_HOST, 404, "admin host still refuses investor dashboard"],
      ["/api/v1/me/profile", ADMIN_HOST, 404, "admin host still refuses /api/v1/me/profile"],
      ["/api/v1/corporate-accounts/1", ADMIN_HOST, 404, "admin host still refuses corporate-accounts"],
      ["/api/v1/auth/login", ADMIN_HOST, 404, "admin host still refuses investor auth"],
      ["/api/v1/market/ngx", ADMIN_HOST, 404, "admin host still refuses the market feed"],
      ["/api/v1/admin/investors", ADMIN_HOST, 404, "admin host still refuses the raw staff API"],
      ["/api/v1/route-invented-next-year", ADMIN_HOST, 404, "admin host refuses unknown API paths"],
    ],
  );

  if (stub) stub.close();
  for (const line of lines) console.log(line);
  console.log("");
  if (failures > 0) {
    console.log(`FAIL — ${failures} availability checks failed.`);
    process.exit(1);
  }
  console.log(
    "PASS — Hostname availability over real HTTP, six server configurations (including one with the admin release flags ENABLED, where the hostname boundary holds unchanged): a missing or invalid ADMIN_HOSTNAMES leaves the public website, investor login, investor registration, investor dashboard and investor API all serving normally while the admin hostname is unreachable rather than gated — the outage David reported cannot recur; a hostname configured as both public and admin closes the staff side and keeps the public site up; a missing PUBLIC_HOSTNAMES is still fatal because no hostname can then be trusted; and with the correct production configuration both surfaces behave, each refusing the other's routes and the disabled portal closing its protected pages.",
  );
})().catch((error) => {
  console.error("ERROR:", error.message);
  process.exit(1);
});
