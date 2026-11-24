/**
 * Preload for the provider-synchronisation harness.
 *
 * Compiles the TypeScript harness with JSX into .acl-runtime-out, then installs
 * the two module boundaries a headless run cannot provide: Next.js router hooks
 * and react-test-renderer's `act` environment. The HTTP boundary is mocked
 * inside the harness itself (globalThis.fetch), not here.
 */
const path = require("path");
const fs = require("fs");
const Module = require("module");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, ".acl-runtime-out");

// React 19 requires this flag for act() outside a DOM test environment.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// The router is the SINGLE navigation record the assertions read. The harness
// helpers and the stubbed hooks must share it, or a push would be invisible.
const harness = (globalThis.__sfHarness = globalThis.__sfHarness || {
  router: { pathname: "/", pushes: [], replaces: [] },
  calls: {},
  me: { kind: "ok" },
  refresh: { kind: "ok" },
  projection: {},
  invitations: [],
  accounts: [],
  acceptedInvitations: [],
  createdAccounts: 0,
});
const state = harness.router;
globalThis.__sfRouter = state;

const stubs = {
  "next/navigation": {
    usePathname: () => harness.router.pathname,
    useRouter: () => ({
      push: (target) => { harness.router.pushes.push(target); },
      replace: (target) => { harness.router.replaces.push(target); },
      back: () => {},
      prefetch: () => {},
    }),
    useSearchParams: () => globalThis.__sfSearch ?? new URLSearchParams(),
    redirect: () => {},
    notFound: () => {},
  },
  "next/link": {
    __esModule: true,
    default: (props) => require("react").createElement("a", { href: props.href }, props.children),
  },
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (stubs[request]) return stubs[request];
  if (request.startsWith("@/")) {
    const mapped = path.join(OUT, request.slice(2));
    for (const candidate of [mapped + ".js", path.join(mapped, "index.js")]) {
      try { return origLoad.call(this, candidate, parent, isMain); } catch (error) {
        if (error.code !== "MODULE_NOT_FOUND") throw error;
      }
    }
  }
  if (request === "next/navigation" || request === "next/link") return stubs[request];
  return origLoad.call(this, request, parent, isMain);
};

// Allow the emitted harness to resolve the app's own "@/..." imports.
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith("@/")) {
    const mapped = path.join(OUT, request.slice(2));
    for (const candidate of [mapped + ".js", path.join(mapped, "index.js")]) {
      try { return origResolve.call(this, candidate, parent, ...rest); } catch { /* try next */ }
    }
  }
  return origResolve.call(this, request, parent, ...rest);
};

/**
 * Browser `FormData` boundary. The real SignInForm reads its uncontrolled email
 * and password fields out of FormData on submit. There is no DOM here, so the
 * driver supplies the field values exactly as a browser would have collected
 * them, via `currentTarget.__fields`.
 */
if (typeof globalThis.FormData === "undefined" || !globalThis.__sfRealFormData) {
  globalThis.__sfRealFormData = globalThis.FormData;
  globalThis.FormData = class FormData {
    constructor(form) {
      this.map = new Map();
      if (form && form.__fields) {
        for (const [key, value] of Object.entries(form.__fields)) this.map.set(key, String(value));
      }
    }
    get(name) { return this.map.has(name) ? this.map.get(name) : null; }
    getAll(name) { return this.map.has(name) ? [this.map.get(name)] : []; }
    has(name) { return this.map.has(name); }
    set(name, value) { this.map.set(name, String(value)); }
    append(name, value) { this.map.set(name, String(value)); }
    delete(name) { this.map.delete(name); }
    entries() { return this.map.entries(); }
    keys() { return this.map.keys(); }
    values() { return this.map.values(); }
    forEach(callback) { this.map.forEach((value, key) => callback(value, key, this)); }
    [Symbol.iterator]() { return this.map.entries(); }
  };
}

execFileSync(process.execPath, [path.join(ROOT, "node_modules", "typescript", "bin", "tsc"), "-p", path.join(__dirname, "tsconfig.runtime.json")], { stdio: "inherit" });
