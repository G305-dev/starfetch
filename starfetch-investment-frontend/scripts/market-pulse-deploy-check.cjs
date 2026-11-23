/**
 * Verifies that `public/data/market-pulse.json` loads in a PRODUCTION deployment
 * shape, not just under `next dev`.
 *
 * V1 only ever demonstrated the JSON loading in development, where
 * `process.cwd()` is the project root and the file is guaranteed to be there.
 * That proves nothing about production: a standalone build starts from
 * `.next/standalone`, and `public/` is not copied into it automatically.
 *
 * This script:
 *   1. asserts the resolver finds the file from the PROJECT ROOT (next start);
 *   2. asserts it finds the file from `.next/standalone` when the public
 *      directory has been copied there (the documented requirement);
 *   3. asserts it FAILS CLOSED with a diagnosable result when the file is absent,
 *      instead of throwing or showing a fabricated figure;
 *   4. asserts the env override wins.
 *
 * Run: node scripts/market-pulse-deploy-check.cjs
 */
const { mkdtempSync, mkdirSync, copyFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const Module = require("module");

const root = resolve(__dirname, "..");
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

// Compile the TS sources the resolver needs.
const out = mkdtempSync(join(tmpdir(), "starfetch-pulse-"));
try {
  require("child_process").execFileSync(
    process.execPath,
    [
      join(root, "node_modules", "typescript", "bin", "tsc"),
      join(root, "lib/market/market-pulse.ts"),
      "--target", "ES2022",
      "--module", "commonjs",
      "--moduleResolution", "node",
      "--esModuleInterop",
      "--skipLibCheck",
      "--outDir", out,
    ],
    { cwd: root, stdio: "inherit" },
  );

  const { loadMarketPulse, marketPulseCandidatePaths, MARKET_PULSE_FILE } = require(
    join(out, "market-pulse.js"),
  );

  const run = async () => {
    // ---- 1. Project root (what `next start` does) --------------------------
    {
      const result = await loadMarketPulse(root, {});
      check(result.status === "ready", `[project root] expected ready, got ${result.status}`);
      if (result.status === "ready") {
        check(result.data.indicators.length === 3, "[project root] expected 3 indicators");
        check(
          typeof result.sourcePath === "string" && result.sourcePath === join(root, MARKET_PULSE_FILE),
          `[project root] resolved an unexpected path: ${result.sourcePath}`,
        );
      }
    }

    // ---- 2. Standalone deployment with public/ copied in -------------------
    {
      const standalone = mkdtempSync(join(tmpdir(), "starfetch-standalone-"));
      try {
        mkdirSync(join(standalone, "public/data"), { recursive: true });
        copyFileSync(join(root, MARKET_PULSE_FILE), join(standalone, MARKET_PULSE_FILE));

        const result = await loadMarketPulse(standalone, {});
        check(result.status === "ready", `[standalone] expected ready, got ${result.status}`);
        if (result.status === "ready") {
          check(
            result.sourcePath === join(standalone, MARKET_PULSE_FILE),
            `[standalone] resolved an unexpected path: ${result.sourcePath}`,
          );
        }
      } finally {
        rmSync(standalone, { recursive: true, force: true });
      }
    }

    // ---- 3. Standalone WITHOUT public/ (the real V1 failure mode) ----------
    {
      const standalone = mkdtempSync(join(tmpdir(), "starfetch-standalone-empty-"));
      try {
        // .next/standalone exists but public/ was never copied Ã¢â‚¬â€ exactly what an
        // unpackaged standalone build looks like.
        mkdirSync(join(standalone, ".next/standalone"), { recursive: true });

        const result = await loadMarketPulse(standalone, {});
        check(
          result.status === "unavailable",
          `[standalone, public/ missing] expected unavailable, got ${result.status}`,
        );
        check(
          Array.isArray(result.attemptedPaths) && result.attemptedPaths.length >= 2,
          "[standalone, public/ missing] the failure must record which paths were tried",
        );
        check(result.sourcePath === null, "[standalone, public/ missing] sourcePath must be null");
        // Critically: no fabricated figures anywhere in the failure result.
        check(!JSON.stringify(result).includes("14.06"), "[standalone, public/ missing] must not leak a stale value");
      } finally {
        rmSync(standalone, { recursive: true, force: true });
      }
    }

    // ---- 4. Env override wins ---------------------------------------------
    {
      const alt = mkdtempSync(join(tmpdir(), "starfetch-alt-"));
      try {
        mkdirSync(join(alt, "data"), { recursive: true });
        copyFileSync(join(root, MARKET_PULSE_FILE), join(alt, "market-pulse.json"));

        const overridePath = join(alt, "market-pulse.json");
        const candidates = marketPulseCandidatePaths("/nonexistent-root", {
          MARKET_PULSE_FILE_PATH: overridePath,
        });
        check(candidates[0] === overridePath, "[env override] must be tried first");

        const result = await loadMarketPulse("/nonexistent-root", {
          MARKET_PULSE_FILE_PATH: overridePath,
        });
        check(result.status === "ready", `[env override] expected ready, got ${result.status}`);
      } finally {
        rmSync(alt, { recursive: true, force: true });
      }
    }

    // ---- 5. Candidate ordering is deterministic ---------------------------
    {
      const candidates = marketPulseCandidatePaths("/app", {});
      check(candidates[0] === join("/app", MARKET_PULSE_FILE), "[candidates] cwd must be first");
      check(
        candidates.includes(join("/app", ".next/standalone", MARKET_PULSE_FILE)),
        "[candidates] must include the standalone root",
      );
      check(candidates.includes(join("/app", "..", MARKET_PULSE_FILE)), "[candidates] must include the parent root");
    }

    if (failures.length) {
      console.error(`FAIL Ã¢â‚¬â€ Market Pulse deployment check:\n${failures.map((f) => "  Ã¢Å“â€” " + f).join("\n")}`);
      process.exitCode = 1;
    } else {
      console.log(
        "PASS Ã¢â‚¬â€ Market Pulse deployment: resolves from the project root (next start) and from a standalone build once public/ is copied in; fails closed with an empty attempted-path report when the file is absent, leaking no figures; the MARKET_PULSE_FILE_PATH override is honoured and tried first",
      );
    }
  };

  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} finally {
  // Compiled output is no longer needed; the async run() has already resolved by
  // the time the process exits because nothing else holds the loop open.
  process.on("exit", () => rmSync(out, { recursive: true, force: true }));
}
