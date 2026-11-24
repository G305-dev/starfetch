/**
 * Runs the provider-synchronisation harness against the REAL AuthProvider.
 *
 * Usage: node scripts/harness/run-provider-sync-check.cjs
 *
 * Sections, with provenance stated explicitly so no reader mistakes duplicated
 * logic for a component test:
 *
 *   [REAL provider + REAL component]  AuthProvider, guards and the Joint forms
 *                                     mounted with react-test-renderer; only the
 *                                     router and fetch are substituted.
 *   [REAL resolver]                   resolveLoginDestination / isJointPathAllowed
 *                                     executed directly.
 *   [STATIC assertion]                source-level guarantees (no duplicated
 *                                     behavioural logic).
 */
require("./auth-backend-sim.cjs");

const path = require("path");
const OUT = path.resolve(__dirname, "../../.acl-runtime-out");

(async () => {
  const failures = [];

  const providerSync = require(path.join(OUT, "scripts/harness/provider-sync-runtime-check.js"));
  const loginRules = require(path.join(OUT, "scripts/harness/login-return-path-runtime-check.js"));

  const sections = [];
  try {
    const providerFailures = await providerSync.runProviderSyncMatrix();
    failures.push(...providerFailures);
    sections.push(["provider synchronisation", `${providerSync.groups.length} groups   [REAL provider + REAL component]`]);
  } catch (error) {
    failures.push(`provider synchronisation crashed: ${error && error.stack ? error.stack.split("\n").slice(0, 4).join(" | ") : error}`);
  }

  try {
    const loginFailures = await loginRules.runAll();
    failures.push(...loginFailures);
    sections.push(["login return paths", `${loginRules.caseCount} scenarios [REAL component + REAL resolver]`]);
  } catch (error) {
    failures.push(`login return paths crashed: ${error && error.stack ? error.stack.split("\n").slice(0, 4).join(" | ") : error}`);
  }

  if (failures.length) {
    process.stderr.write(`FAIL — ${failures.length} runtime assertion(s):\n${failures.map((f) => "  ✗ " + f).join("\n")}\n`);
    process.exitCode = 1;
    return;
  }

  console.log("PASS — RUNTIME execution:");
  for (const [name, detail] of sections) console.log(`  ${name.padEnd(26)}${detail}`);
})();
