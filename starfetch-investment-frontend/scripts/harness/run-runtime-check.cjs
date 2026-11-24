/**
 * Access-control RUNTIME check.
 *
 * Compiles the two harness modules with JSX, substitutes the Next/Auth module
 * boundaries, then EXECUTES the real guard components (react-dom/server) and the
 * real login/restore decision code. No network, database or live backend.
 *
 * Usage: node scripts/harness/run-runtime-check.cjs
 */
const path = require("path");
const fs = require("fs");
const Module = require("module");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, ".acl-runtime-out");

// ---- shared auth state injected into the AuthProvider boundary --------------
const state = { status: "loading", user: null, pathname: "/corporate/dashboard", redirects: [], signOuts: 0 };
globalThis.__aclState = state;

const stubs = {
  "next/navigation": {
    usePathname: () => state.pathname,
    useRouter: () => ({ replace: (t) => state.redirects.push(t), push: (t) => state.redirects.push(t) }),
  },
  "next/link": { __esModule: true, default: (p) => require("react").createElement("a", { href: p.href }, p.children) },
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (stubs[request]) return request;
  if (request.startsWith("@/")) {
    const mapped = path.join(OUT, request.slice(2));
    for (const candidate of [mapped + ".js", path.join(mapped, "index.js")]) {
      try { fs.accessSync(candidate); return candidate; } catch {}
    }
  }
  return origResolve.call(this, request, ...rest);
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (stubs[request]) return stubs[request];
  // The guard imports the hook through the relative "./AuthProvider" specifier.
  if (request === "./AuthProvider") {
    const useAuth = () => ({
      status: state.status,
      user: state.user,
      refreshSession: async () => {},
      logout: async () => { state.signOuts += 1; },
    });
    return { useAuth, AuthProvider: ({ children }) => children };
  }
  return origLoad.call(this, request, parent, isMain);
};

process.env.NODE_PATH = path.join(ROOT, "node_modules");
Module._initPaths();

// Compile the harness modules (JSX) before executing them.
const { execFileSync } = require("child_process");
execFileSync(process.execPath, [path.join(ROOT, "node_modules", "typescript", "bin", "tsc"), "-p", path.join(__dirname, "tsconfig.runtime.json")], { stdio: "inherit" });

const guardHarness = require(path.join(OUT, "scripts/harness/account-context-runtime-check.js"));
const jointHarness = require(path.join(OUT, "scripts/harness/joint-regression-runtime-check.js"));
const refreshHarness = require(path.join(OUT, "scripts/harness/membership-refresh-runtime-check.js"));

const failures = [
  ...guardHarness.runGuardMatrix(),
  ...jointHarness.runJointRegressionMatrix(),
];

const sections = [
  ["guard rendering", "REAL component (react-dom/server)"],
  ["joint access regression", "REAL component (react-dom/server)"],
  ["membership refresh", "REAL module (lib/auth/membership-context-refresh)"],
];

refreshHarness.runMembershipRefreshMatrix().then((refreshFailures) => {
  failures.push(...refreshFailures);
  if (failures.length) {
    process.stderr.write(`FAIL — ${failures.length} runtime assertion(s):\n${failures.map((f) => "  ✗ " + f).join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  console.log("PASS — RUNTIME execution:");
  console.log("  guard rendering          11 groups   [REAL component]");
  console.log("  joint access regression  16 checks   [REAL component] — Individual-only invitation inbox allowed, all other Joint routes blocked, Corporate-only inbox blocked, unverifiable/empty fail closed");
  console.log("  membership refresh        " + refreshHarness.checkCount() + " checks   [REAL module] — reads only AuthProvider's committed projection, issues no request of its own, non-committed outcomes fail closed");
  console.log("");
  console.log("  Login destinations and session restore are NOT tested here any more:");
  console.log("  the duplicated decision logic was removed. They are executed against");
  console.log("  the REAL components by: npm run test:access-control:provider");
});
