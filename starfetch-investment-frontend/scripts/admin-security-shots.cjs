/**
 * Screenshots for the pass-3 security corrections.
 *
 * Runs against the production build on :3130 with ADMIN_STAFF_INTEGRATION_ENABLED
 * deliberately UNSET, so the login page renders its enabled-but-unconnected state
 * and the login form's own controls are live. No staff session cookie is injected:
 * these shots are of the *unauthenticated* surface, which is exactly what changed.
 */
const { chromium } = require("playwright");
const { mkdirSync } = require("node:fs");

const OUT = "/home/user/admin-evidence-v3";
// Routed through /etc/hosts: Chromium refuses a Host header, so the hostname must
// be real to the resolver. `admin.starfetch.ng` maps to 127.0.0.1.
const BASE = "http://admin.starfetch.ng:3130";

const SHOTS = [
  { name: "login-password-step", path: "/admin/login", wait: 1200 },
  { name: "login-password-step-mobile", path: "/admin/login", wait: 1200, viewport: { width: 390, height: 844 } },
  { name: "security-fail-closed", path: "/admin/security", wait: 900 },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });

  for (const shot of SHOTS) {
    const context = await browser.newContext({
      viewport: shot.viewport ?? { width: 1440, height: 1100 },
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    await page.goto(BASE + shot.path, { waitUntil: "networkidle", timeout: 45000 }).catch(async () => {
      await page.goto(BASE + shot.path, { waitUntil: "load", timeout: 45000 });
    });
    await page.waitForTimeout(shot.wait);
    await page.screenshot({ path: `${OUT}/${shot.name}.png`, fullPage: true });
    console.log(`captured ${shot.name}`);
    await context.close();
  }

  // The MFA challenge is reached only after a password POST, which cannot succeed
  // without a backend. Rather than fake one, the challenge screens are captured
  // from the render suite's markup — see admin-security-corrections-report.md for
  // the exact reason this cannot be photographed in a real journey yet.
  await browser.close();
  console.log("done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
