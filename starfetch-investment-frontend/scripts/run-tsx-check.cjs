/**
 * Compile and run a .tsx check with the project's `@/` path alias and JSX settings.
 *
 * `run-typescript-check.cjs` handles plain .ts files but neither JSX nor the alias,
 * and the prepared-UI render tests need both. TypeScript only accepts `paths` from a
 * tsconfig, so this writes a temporary config that extends the real one, then
 * compiles to a scratch directory, runs with a preload that resolves `@/`, and
 * cleans up.
 */
const { execFileSync } = require("node:child_process");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");

const source = process.argv[2];
if (!source) throw new Error("Usage: node scripts/run-tsx-check.cjs <tsx-test-file>");

const root = resolve(__dirname, "..");
const output = mkdtempSync(join(tmpdir(), "starfetch-ui-check-"));
const configPath = join(output, "tsconfig.check.json");
const preloadPath = join(output, "alias.cjs");

// Extend the project config so `paths`, `jsx` and `lib` match the real build,
// then override only what a Node-side run needs.
writeFileSync(
  configPath,
  JSON.stringify(
    {
      extends: join(root, "tsconfig.json"),
      compilerOptions: {
        noEmit: false,
        incremental: false,
        module: "commonjs",
        moduleResolution: "node",
        jsx: "react-jsx",
        outDir: join(output, "out"),
        rootDir: root,
        types: [],
      },
      include: [resolve(root, source)],
    },
    null,
    2,
  ),
);

// Emitted CommonJS keeps the literal `@/...` specifier; TypeScript resolved it via
// `paths` at compile time only. This preload maps it back to the project root so the
// check runs against the real source files.
writeFileSync(
  preloadPath,
  `const { join } = require("node:path");
const Module = require("node:module");
const outRoot = ${JSON.stringify(join(output, "out"))};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (typeof request === "string" && request.startsWith("@/")) {
    // Resolve against the compiled tree so the @/ alias and relative imports
    // resolve to the same files.
    return originalResolve.call(this, join(outRoot, request.slice(2)), ...rest);
  }
  return originalResolve.call(this, request, ...rest);
};

// Client components call useRouter/usePathname, which throw unless a Next router
// is mounted. A static render has no router, so the hooks are stubbed with inert
// implementations. This is safe for assertion purposes: these tests inspect
// markup for controls and copy, and navigation is not exercised here — the
// navigation guarantees are asserted separately at source level.
const nextNavigationStub = {
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect() {},
  notFound() {},
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "next/navigation") return nextNavigationStub;
  return originalLoad.call(this, request, parent, isMain);
};
`,
);

try {
  execFileSync(process.execPath, [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", configPath], {
    cwd: root,
    stdio: "inherit",
  });
  execFileSync(
    process.execPath,
    ["--require", preloadPath, join(output, "out", source.replace(/\.tsx?$/, ".js"))],
    {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, NODE_PATH: join(root, "node_modules") },
    },
  );
} finally {
  rmSync(output, { recursive: true, force: true });
}
