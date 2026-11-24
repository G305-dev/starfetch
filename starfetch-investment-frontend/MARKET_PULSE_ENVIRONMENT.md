# Market Pulse — production deployment requirements

`public/data/market-pulse.json` is read from disk at render time by
`lib/market/market-pulse.ts`. This file records what that requires in
**production**, and how to prove it works there.

V1 only ever demonstrated the JSON loading under `next dev`, where
`process.cwd()` is the project root and the file is guaranteed to exist. That
proves nothing about a deployed build. This document closes that gap.

---

## The path resolution order

`loadMarketPulse()` tries these absolute paths in order and uses the first that
reads **and** validates:

| # | Path | Covers |
|---|---|---|
| 1 | `$MARKET_PULSE_FILE_PATH` | Operator override for an unusual layout |
| 2 | `<cwd>/public/data/market-pulse.json` | `next dev`, `next start`, Vercel build output |
| 3 | `<cwd>/.next/standalone/public/data/market-pulse.json` | A standalone build started from its own directory |
| 4 | `<cwd>/../public/data/market-pulse.json` | A standalone build started from the project root |

The resolved path is returned on the result object as `sourcePath`, and every
attempted path as `attemptedPaths`, so a deployment problem is diagnosable
rather than presenting as a silent "temporarily unavailable" card.

---

## Deployment shapes

### `next start` (standard, and what this repo's build produces)

`process.cwd()` is the project root. Candidate #2 resolves. **No action needed.**

### `output: "standalone"`

The server starts from `.next/standalone`, and **Next does not copy `public/`
into it automatically**. You must copy it as part of the build/deploy step:

```bash
next build
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
node .next/standalone/server.js
```

With that copy in place, candidate #3 resolves. Without it, the card renders
"temporarily unavailable" — correctly, and without inventing a figure, but the
deployment is broken. `scripts/market-pulse-deploy-check.cjs` covers both cases.

### Docker / read-only filesystem

If `public/` is baked into the image, nothing changes. The file is only ever
**read**, never written, so a read-only mount is fine.

### Serverless (Vercel and similar)

`public/` ships with the deployment and `cwd` is the project root, so candidate
#2 resolves. Note that the file is read with `fs`, not served over HTTP — it is
bundled as a static asset **and** read directly, which is deliberate: reading it
lets a malformed file degrade to an explicit unavailable state instead of
breaking the page.

> **Vercel caveat worth knowing:** files read via `fs` inside a server component
> are traced into the serverless bundle by Next's output file tracing. If a
> future change reads the file from a dynamic path, verify it is still traced —
> `market-pulse-deploy-check.cjs` runs the resolver directly and will catch a
> missing file.

---

## How to verify a deployment

```bash
npm run test:market-pulse-deploy
```

This asserts, without a browser:

1. the file resolves from the project root (what `next start` does);
2. it resolves from a standalone build **once `public/` is copied in**;
3. it **fails closed** with an empty `sourcePath` and a populated
   `attemptedPaths` when `public/` is missing — and leaks no figures;
4. `MARKET_PULSE_FILE_PATH` is honoured and tried first;
5. the candidate ordering is deterministic.

For an end-to-end confirmation against a real running server, load the homepage
and check that the three figures appear in the **server-rendered HTML**
(`curl -s https://<host>/ | grep -o '14.06%'`). `scripts/market-browser-check.cjs`
does this automatically against a local `next start`.

---

## What happens if the file is missing or malformed

The card renders **"Indicators temporarily unavailable"**. It never:

- shows a partially correct panel,
- reuses a previously seen value,
- or falls back to a number hardcoded in the component.

`npm run test:market-render` asserts this for a missing file, a file with one
indicator removed, and a file missing a period, source or verification date.

---

## Updating the figures

See [`public/data/README.md`](public/data/README.md). Unchanged: the values are
manually maintained and are **not** live or real-time data.
