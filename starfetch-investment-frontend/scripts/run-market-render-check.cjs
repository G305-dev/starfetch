/**
 * Compiles the JSX render check with the project's own tsc, then executes it.
 *
 * The generic run-typescript-check.cjs cannot handle JSX or the `@/` alias, so
 * this runner emits the small set of files the render check touches into a temp
 * directory with `jsx: react-jsx` and the path alias wired up.
 */
const { execFileSync } = require("node:child_process");
const { mkdtempSync, rmSync, mkdirSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");

const root = resolve(__dirname, "..");
const output = mkdtempSync(join(tmpdir(), "starfetch-market-render-"));
const tsconfigPath = join(output, "tsconfig.json");
writeFileSync(tsconfigPath, JSON.stringify({
  compilerOptions: {
    target: "ES2022",
    module: "commonjs",
    moduleResolution: "node",
    jsx: "react-jsx",
    esModuleInterop: true,
    skipLibCheck: true,
    strict: false,
    baseUrl: root,
    paths: { "@/*": ["./*"] },
    outDir: join(output, "out"),
    rootDir: root,
    typeRoots: [join(root, "node_modules", "@types")],
  },
  include: [
    join(root, "scripts/market-render-check.tsx"),
    join(root, "components/MarketOverview.tsx"),
    join(root, "components/NgxMarketTicker.tsx"),
    join(root, "components/MarketTickerItem.tsx"),
    join(root, "components/ui.tsx"),
    join(root, "components/ngx-market-directory.ts"),
    join(root, "lib/market/*.ts"),
  ],
  exclude: [],
}));

try {
  execFileSync(process.execPath, [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", tsconfigPath], { cwd: root, stdio: "inherit" });
  // tsc does not rewrite the "@/" path alias, so resolve it here: the compiled
  // tree mirrors the project, and "@/" maps to the emitted root.
  const bootstrap = join(output, "bootstrap.cjs");
  writeFileSync(bootstrap, `
const path = require("path");
const Module = require("module");
const projectRoot = ${JSON.stringify(root)};
const emittedRoot = ${JSON.stringify(join(output, "out"))};
const original = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith("@/")) {
    const mapped = path.join(emittedRoot, request.slice(2));
    try { return original.call(this, mapped, parent, ...rest); } catch (_) {}
  }
  return original.call(this, request, parent, ...rest);
};
require(${JSON.stringify(join(output, "out", "scripts", "market-render-check.js"))});
`);
  execFileSync(process.execPath, [bootstrap], {
    cwd: root,
    stdio: "inherit",
    // The compiled file lives in a temp dir, so point Node at the project's
    // own dependencies for react / react-dom.
    env: { ...process.env, NODE_PATH: join(root, "node_modules") },
  });
} finally {
  rmSync(output, { recursive: true, force: true });
}
