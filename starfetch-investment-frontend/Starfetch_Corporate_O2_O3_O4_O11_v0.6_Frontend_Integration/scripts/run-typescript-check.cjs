const { execFileSync } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { basename, dirname, join, resolve } = require("node:path");

const source = process.argv[2];
if (!source) {
  throw new Error("Usage: node scripts/run-typescript-check.cjs <typescript-test-file>");
}

const root = resolve(__dirname, "..");
const sourcePath = resolve(root, source);
const output = mkdtempSync(join(tmpdir(), "starfetch-typescript-check-"));
try {
  execFileSync(process.execPath, [
    join(root, "node_modules", "typescript", "bin", "tsc"),
    sourcePath,
    "--target", "ES2022",
    "--module", "commonjs",
    "--moduleResolution", "node",
    "--esModuleInterop",
    "--skipLibCheck",
    "--outDir", output,
  ], { cwd: root, stdio: "inherit" });
  const compiled = join(output, "scripts", `${basename(source, ".ts")}.js`);
  execFileSync(process.execPath, [compiled], { cwd: root, stdio: "inherit" });
} finally {
  rmSync(output, { recursive: true, force: true });
}
