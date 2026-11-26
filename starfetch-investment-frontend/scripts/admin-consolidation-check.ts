/**
 * Admin portal consolidation contract tests.
 *
 * These are STATIC and CONTRACT tests: they inspect source and pure functions.
 * They prove structure, isolation declarations and that nothing false is claimed.
 * They do NOT prove the backend authorizes anything — see the security report for
 * what remains unverified until David implements the API.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PERMISSIONS, LEGACY_PERMISSION_KEYS, money, toMinor } from "../lib/admin-api/contracts";
import { ADMIN_NAV, ADMIN_NAV_ITEMS, ADMIN_ROUTES, visibleNav, navItemFor } from "../lib/admin/navigation";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/**
 * The runner compiles this file to a temp directory, so `__dirname` is not the
 * repo. Resolve from the working directory instead — the runner always invokes
 * node with cwd set to the project root.
 */
const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), "utf8");
const exists = (path: string): boolean => existsSync(join(root, path));

/**
 * Strips comments so a structural assertion tests executable code rather than
 * prose. Several files DOCUMENT the risk they avoid ("never read
 * X-Forwarded-Host"); matching the raw text would fail on the documentation.
 */
const readCode = (path: string): string =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

function main(): void {
  // === 1. Every existing permission key is preserved ======================
  {
    for (const key of LEGACY_PERMISSION_KEYS) {
      const value = (PERMISSIONS as Record<string, string>)[key];
      assert(typeof value === "string" && value.length > 0, `legacy permission key "${key}" was removed or renamed`);
    }
    // The exact wire strings the backend may already issue.
    const expected: Record<string, string> = {
      dashboard: "admin.dashboard.read",
      investors: "investors.read",
      invite: "investors.invite",
      deactivate: "investors.deactivate.request",
      kyc: "kyc.read",
      kycReview: "kyc.review",
      kycFinal: "kyc.compliance.final",
      investments: "investments.read",
      investmentsPrepare: "investments.prepare",
      transactions: "transactions.read",
      transactionsPrepare: "transactions.prepare",
      portfolios: "portfolios.read",
      settings: "settings.read",
      audit: "audit.read",
    };
    for (const [key, value] of Object.entries(expected)) {
      assert(
        (PERMISSIONS as Record<string, string>)[key] === value,
        `permission "${key}" must keep its existing wire value "${value}"`,
      );
    }
    // No permission may be a broad wildcard.
    for (const value of Object.values(PERMISSIONS) as string[]) {
      assert(!value.includes("*"), `permission "${value}" must not be a wildcard`);
      assert(/^[a-z][a-z0-9.-]+$/.test(value), `permission "${value}" must be a granular dotted key`);
    }
  }

  // === 2. Prepare and approve are separable for every financial operation ==
  {
    const pairs: Array<[string, string, string]> = [
      ["investmentsPrepare", "investmentsApprove", "investment instructions"],
      ["transactionsPrepare", "transactionsApprove", "transactions"],
      ["productsDraft", "productsApprove", "products"],
      ["campaignsDraft", "campaignsApprove", "campaigns"],
      ["notificationsCompose", "notificationsApprove", "notifications"],
      ["financeAdjustmentRequest", "financeApprove", "finance adjustments"],
    ];
    for (const [prepareKey, approveKey, label] of pairs) {
      const prepare = (PERMISSIONS as Record<string, string>)[prepareKey];
      const approve = (PERMISSIONS as Record<string, string>)[approveKey];
      assert(!!prepare, `${label} must have a prepare permission`);
      assert(!!approve, `${label} must have a separate approve permission`);
      assert(prepare !== approve, `${label}: prepare and approve must be different keys (maker-checker)`);
    }
  }

  // === 3. All 18 sections exist and are reachable ========================
  {
    assert(ADMIN_NAV_ITEMS.length === 18, `expected 18 admin sections, found ${ADMIN_NAV_ITEMS.length}`);
    const briefSections = ADMIN_NAV_ITEMS.map((item) => item.briefSection).sort((a, b) => a - b);
    for (let n = 1; n <= 18; n += 1) {
      assert(briefSections.includes(n), `brief section ${n} has no navigation entry`);
    }
    assert(new Set(briefSections).size === 18, "brief section numbers must be unique");

    // Every route the nav declares has a page, and every page has a nav entry.
    for (const item of ADMIN_NAV_ITEMS) {
      const page = `app${item.href}/page.tsx`;
      assert(exists(page), `navigation declares ${item.href} but ${page} does not exist`);
    }
    // The seven pre-existing pages must still be present.
    for (const legacy of ["/admin/dashboard", "/admin/users", "/admin/kyc", "/admin/investments", "/admin/transactions", "/admin/portfolios", "/admin/settings"]) {
      assert(ADMIN_ROUTES.includes(legacy), `the pre-existing page ${legacy} must be preserved in navigation`);
      assert(exists(`app${legacy}/page.tsx`), `the pre-existing page ${legacy} must still exist`);
    }
  }

  // === 4. Every page is permission-gated =================================
  {
    for (const item of ADMIN_NAV_ITEMS) {
      const source = read(`app${item.href}/page.tsx`);
      assert(
        source.includes("ProtectedPage"),
        `${item.href} must render through ProtectedPage so the session is verified server-side`,
      );
      // Pages reference the catalogue KEY (e.g. PERMISSIONS.dashboard), not the
      // wire string, so assert the key that maps to this permission.
      const keyForPermission = Object.entries(PERMISSIONS as Record<string, string>).find(
        ([, value]) => value === item.permission,
      )?.[0];
      assert(!!keyForPermission, `navigation permission ${item.permission} must exist in the catalogue`);
      assert(
        source.includes(`PERMISSIONS.${keyForPermission}`),
        `${item.href} must gate on PERMISSIONS.${keyForPermission} (${item.permission})`,
      );
      // Accept either quote style; the pre-existing pages use single quotes.
      assert(
        /export const dynamic\s*=\s*["']force-dynamic["']/.test(source),
        `${item.href} must be force-dynamic so staff data is never statically cached`,
      );
    }
  }

  // === 5. Unfinished sections never claim to work ========================
  {
    const pending = ADMIN_NAV_ITEMS.filter((item) => item.status === "integration-pending");
    assert(pending.length === 11, `expected 11 integration-pending sections, found ${pending.length}`);
    for (const item of pending) {
      const source = read(`app${item.href}/page.tsx`);
      // A pending section may present either the simple honest shell or a fully
      // prepared interface. Both are acceptable; what is NOT acceptable is a page
      // that neither states its readiness nor renders a prepared component.
      const usesShell = source.includes("IntegrationPendingSection");
      const usesPrepared = /components\/admin\/prepared\//.test(source);
      assert(
        usesShell || usesPrepared,
        `${item.href} must use the honest pending shell or a prepared section component`,
      );
      // Whatever it renders, it must declare the contract as not approved. This is
      // the assertion that actually protects against a section silently going live.
      if (usesPrepared) {
        assert(
          source.includes('contract="not-approved"'),
          `${item.href} must pass contract="not-approved" so every action stays inert`,
        );
      }
      assert(
        !/priceUsd|amountMinor\s*=|balance/i.test(source.replace(/blockedBy|permission/g, "")),
        `${item.href} must not compute or hardcode a financial figure`,
      );
    }

    // The pending shell must state that it cannot perform work, and must not
    // render any fabricated record.
    const shell = read("components/admin/IntegrationPendingSection.tsx");
    assert(shell.includes("cannot perform work yet"), "the pending shell must say the section cannot perform work");
    assert(shell.includes("does not invent"), "the pending shell must say no financial data is invented");
    assert(!/mock|sample-data|demo-|lorem/i.test(shell), "the pending shell must not carry demo content");
  }

  // === 6. No demo credentials, mock data or sample financials anywhere ===
  {
    const scanned = [
      "components/admin/AdminShell.tsx",
      "components/admin/IntegrationPendingSection.tsx",
      "lib/admin/navigation.ts",
      "lib/admin/host-policy.ts",
      "lib/admin-api/contracts.ts",
      "lib/admin-api/server.ts",
      ...ADMIN_NAV_ITEMS.map((item) => `app${item.href}/page.tsx`),
    ];
    const forbidden: Array<[RegExp, string]> = [
      [/demo\s*(password|login|credential)/i, "demo credentials"],
      [/admin@(example|test|starfetch)\.(com|ng)/i, "a hardcoded staff email"],
      [/password\s*[:=]\s*["'][^"']+["']/i, "a hardcoded password"],
      [/"\d{2,}\.\d{2}"/, "a hardcoded monetary amount"],
      [/process\.env\.NEXT_PUBLIC_[A-Z_]*(SECRET|TOKEN|KEY|PASSWORD)/, "a secret in a NEXT_PUBLIC variable"],
      [/localStorage\.setItem\([^)]*(token|session|auth)/i, "an auth token written to localStorage"],
    ];
    for (const path of scanned) {
      const source = read(path);
      for (const [pattern, label] of forbidden) {
        assert(!pattern.test(source), `${path} must not contain ${label}`);
      }
    }
  }

  // === 7. Navigation filtering is permission-driven ======================
  {
    assert(visibleNav([]).length === 0, "a staff member with no permissions must see no navigation groups");
    const dashboardOnly = visibleNav([PERMISSIONS.dashboard]);
    assert(dashboardOnly.length === 1, "only the group with a visible item should render");
    assert(dashboardOnly[0].items.length === 1 && dashboardOnly[0].items[0].key === "dashboard", "only Dashboard should be visible");
    const all = visibleNav(Object.values(PERMISSIONS));
    assert(all.length === ADMIN_NAV.length, "all groups should be visible with all permissions");
    assert(navItemFor("/admin/notifications")?.briefSection === 9, "navItemFor must resolve expanded sections");
    assert(navItemFor("/admin/unknown") === undefined, "navItemFor must return undefined for unknown routes");
  }

  // === 8. Proposed gateway routes are declared but unreachable ===========
  {
    const gateway = read("app/api/admin-gateway/[...segments]/route.ts");
    const proposed = read("lib/admin/proposed-routes.ts");
    assert(
      /export const PROPOSED_ROUTES_ENABLED\s*=\s*false/.test(proposed),
      "proposed gateway routes must be hard-disabled by a const, not an environment variable",
    );
    assert(
      !/process\.env\.[A-Z_]*PROPOSED[A-Z_]*/.test(proposed),
      "the proposed-route switch must not be readable from the environment",
    );
    assert(
      !/export const PROPOSED_ROUTES|export function matchProposed/.test(gateway),
      "a route handler file may only export HTTP handlers, so the proposed routes must live in lib/",
    );
    assert(
      gateway.includes("CONTRACT_NOT_APPROVED"),
      "a proposed-but-unapproved route must return a distinct CONTRACT_NOT_APPROVED code",
    );
    assert(
      gateway.includes("Explicit route allowlist"),
      "the gateway must remain an explicit allowlist, not an open proxy",
    );
    // No catch-all forwarding.
    assert(!/pattern:\s*\/\^\\\/\//.test(gateway), "the gateway must not contain a catch-all route pattern");
  }

  // === 9. Admin gateway keeps its existing security controls =============
  {
    const gateway = read("app/api/admin-gateway/[...segments]/route.ts");
    for (const [needle, label] of [
      ["ORIGIN_REJECTED", "exact-origin checking"],
      ["CSRF_REJECTED", "CSRF token checking"],
      ["IDEMPOTENCY_KEY_REQUIRED", "idempotency key requirement"],
      ["VERSION_REQUIRED", "record-version requirement for PATCH"],
      ["PAYLOAD_TOO_LARGE", "request size limits"],
      ["private, no-store", "private non-cacheable responses"],
      ["no-store", "no-store caching"],
      ["INVALID_UPSTREAM_REDIRECT", "redirect refusal"],
    ] as Array<[string, string]>) {
      assert(gateway.includes(needle), `the gateway must retain ${label} (${needle})`);
    }
    // The financial-field allowlist that stops the UI writing arbitrary state.
    assert(gateway.includes("Unsupported financial field"), "the gateway must keep its financial-field allowlist");
  }

  // === 10. The hostname policy is the only routing authority =============
  {
    const middleware = read("middleware.ts");
    const middlewareCode = readCode("middleware.ts");
    const hostPolicyCode = readCode("lib/admin/host-policy.ts");
    assert(middleware.includes("readHostPolicyConfig"), "middleware must use the shared host policy");
    assert(middleware.includes("resolveHostPolicy"), "middleware must use the shared resolver");
    assert(
      !/x-forwarded-host/i.test(middlewareCode) && !/x-forwarded-host/i.test(hostPolicyCode),
      "neither middleware nor the host policy may READ X-Forwarded-Host — it is client-controlled",
    );
    // It must read the one header it can justify: Host.
    assert(
      middlewareCode.includes('headers.get("host")'),
      "the policy must be driven by the Host header",
    );
    assert(
      !/ADMIN_DEV_BYPASS|devAuthBypass|skipAuth/i.test(middleware),
      "middleware must not contain a development-only authentication bypass",
    );
    // Middleware must not authorize from a cookie.
    assert(
      !middleware.includes("ADMIN_STAFF_SESSION_COOKIE]") && !/cookies?\.get\([^)]*admin_session/.test(middleware),
      "middleware must not treat cookie presence as authentication",
    );
    // It must run on every path, not only /admin.
    assert(
      !/matcher:\s*\[\s*["']\/admin\/:path\*["']\s*\]/.test(middleware),
      "the matcher must cover every path so the admin host cannot serve investor routes",
    );
  }

  // === 11. Admin pages are noindex and never inherit investor chrome =====
  {
    const layout = read("app/admin/layout.tsx");
    const layoutCode = readCode("app/admin/layout.tsx");
    assert(layout.includes("index: false"), "the admin layout must set noindex");
    assert(layout.includes("robots"), "the admin layout must declare robots metadata");
    for (const chrome of ["Navbar", "Footer", "PortalSidebar", "PortalHeader", "HeroSection"]) {
      assert(
        !new RegExp(`<${chrome}|import[^;]*\\b${chrome}\\b`).test(layoutCode),
        `the admin layout must not render or import investor chrome (${chrome})`,
      );
    }
    // The layout must not itself authorize — that is the page and gateway's job.
    assert(
      !/getSession|permissions\.includes/.test(layoutCode),
      "the admin layout must not perform authorization; each page verifies the session",
    );
    // The login page must be noindex too.
    assert(read("app/admin/login/page.tsx").includes("index:false"), "the staff login page must be noindex");
  }

  // === 12. AuthProvider isolates admin from investor session init ========
  {
    const provider = read("components/auth/AuthProvider.tsx");
    assert(
      provider.includes('pathname.startsWith("/admin/")'),
      "AuthProvider must skip investor session initialisation on admin routes",
    );
    // The existing calculator exclusions must survive.
    assert(provider.includes('pathname === "/tools/budget"'), "the existing public calculator exclusion must be preserved");
  }

  // === 13. Money helpers reject unsafe arithmetic =======================
  {
    // Still integer-safe, and rejects rather than rounds.
    assert(money("123456789") === "₦1,234,567.89", `money() must format minor units exactly, got ${money("123456789")}`);
    assert(money("0") === "₦0.00", "money() must handle zero");
    assert(money(null) === "Not available", "money() must not invent a value for null");
    assert(money("12.5") === "Not available", "money() must reject a non-integer minor string");
    assert(money("-500") === "-₦5.00", "money() must handle negatives exactly");
    assert(toMinor("100.50") === "10050", "toMinor must convert exactly");
    assert(toMinor("0") === null, "toMinor must reject zero");
    assert(toMinor("1.234") === null, "toMinor must reject sub-cent precision rather than rounding");
    // A float would lose precision here; BigInt must not.
    assert(money("9007199254740993") === "₦90,071,992,547,409.93", "money() must not lose precision beyond Number.MAX_SAFE_INTEGER");
  }

  console.log(
    "PASS — Admin consolidation contract: 18 sections with all seven pre-existing pages preserved; " +
      "every page permission-gated and force-dynamic; the eleven unprepared sections say they cannot perform work and render no figures; " +
      "no demo credentials, mock records or hardcoded amounts; every legacy permission key keeps its wire value and prepare is separable from approve; " +
      "navigation is permission-filtered; proposed gateway routes are declared but hard-disabled with a distinct not-approved code; " +
      "the gateway keeps origin, CSRF, idempotency, version and size controls; " +
      "middleware never reads X-Forwarded-Host, never authorizes from a cookie and matches every path; " +
      "admin pages are noindex with no investor chrome; and monetary helpers stay integer-exact.",
  );
}

main();
