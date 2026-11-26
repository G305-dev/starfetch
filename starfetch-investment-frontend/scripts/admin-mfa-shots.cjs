/**
 * Capture the MFA challenge screens as rendered markup.
 *
 * IMPORTANT — what these images are and are not.
 *
 * The MFA challenge cannot be reached in a live browser journey yet: it requires a
 * successful password POST, which requires a backend that does not exist. Faking
 * one would make the screenshots evidence of nothing.
 *
 * So these shots render the REAL component with `react-dom/server`, wrap the markup
 * in the production Tailwind stylesheet from `.next/static/css`, and photograph
 * that. They are faithful to the component's output and layout, and they are NOT
 * evidence of the journey working end to end. The report says so explicitly.
 */
const { execFileSync } = require("node:child_process");
const { mkdtempSync, readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve, relative } = require("node:path");
const { chromium } = require("playwright");

const root = resolve(__dirname, "..");
const OUT = "/home/user/admin-evidence-v3";

const STATES = [
  { name: "mfa-verify-step", step: "mfa-verification-required", expires: true },
  { name: "mfa-enrolment-step", step: "mfa-enrolment-required", expires: true },
  { name: "mfa-expired", step: "mfa-expired", expires: false },
  { name: "mfa-locked", step: "mfa-locked", expires: false },
];

/**
 * Render every state in one child process. The driver lives inside the project so
 * the runner's `rootDir` is satisfied, and it reports through `console.log`
 * because the runner's tsconfig disables Node type definitions.
 */
function renderAll() {
  const scratch = mkdtempSync(join(root, "scripts", "mfa-shot-"));
  const driver = join(scratch, "driver.tsx");
  const entries = STATES.map(
    (s) =>
      `  ${JSON.stringify(s.name)}: renderToStaticMarkup(createElement(AdminMfaChallenge, {
    step: ${JSON.stringify(s.step)} as never,
    enabled: false,
    challengeExpiresAt: ${s.expires ? '"2026-11-17T09:05:00.000Z"' : "null"},
    onVerified: () => {},
    onCancel: () => {},
  })),`,
  ).join("\n");

  writeFileSync(
    driver,
    `import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminMfaChallenge } from "@/components/admin/login/AdminMfaChallenge";

const markup: Record<string, string> = {
${entries}
};

console.log("MARKUP_JSON_START" + JSON.stringify(markup) + "MARKUP_JSON_END");
`,
  );

  try {
    // The runner resolves the source against the project root, so it must be
    // passed relative rather than absolute.
    const stdout = execFileSync(process.execPath, [join(root, "scripts", "run-tsx-check.cjs"), relative(root, driver)], {
      cwd: root,
      encoding: "utf8",
    });
    const start = stdout.indexOf("MARKUP_JSON_START");
    const end = stdout.indexOf("MARKUP_JSON_END");
    if (start < 0 || end < 0) throw new Error("the render driver produced no markup");
    return JSON.parse(stdout.slice(start + "MARKUP_JSON_START".length, end));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function builtCss() {
  const dir = join(root, ".next", "static", "css");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const css = builtCss();
  const markup = renderAll();
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });

  for (const state of STATES) {
    const html = markup[state.name];
    if (!html) throw new Error(`no markup for ${state.name}`);
    const page = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body style="background:#f1f6f2;padding:40px;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif">
<div style="display:flex;justify-content:center">${html}</div></body></html>`;
    const file = join(tmpdir(), `${state.name}.html`);
    writeFileSync(file, page);

    const context = await browser.newContext({ viewport: { width: 900, height: 1100 } });
    const tab = await context.newPage();
    await tab.goto("file://" + file, { waitUntil: "load" });
    await tab.waitForTimeout(400);
    await tab.screenshot({ path: join(OUT, `${state.name}.png`), fullPage: true });
    console.log(`captured ${state.name}`);
    await context.close();
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
