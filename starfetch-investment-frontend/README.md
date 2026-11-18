# Starfetch Admin Frontend — development demo

Standalone Next.js, TypeScript and Tailwind admin frontend. It does not include or modify the investor frontend or backend. The original demo fixtures are isolated in `components/admin/demo/fixtures`; demo components are loaded only in explicitly enabled development mode. Existing financial values, counts, names, documents, statuses, charts and activity are synthetic examples, not live data. Some totals and chart series are independent of sample rows.

## Security and access

There is **no real staff authentication or authorization**. By default, admin routes fail closed with HTTP 503 and the sign-in form is disabled. This blocker is not an authentication implementation. David must provide approved backend staff authentication and server-side authorization before any public deployment or real data use. Never enter real credentials into this preview.

For local-only development, `ADMIN_DEMO_MODE=1` enables a clearly marked demo bypass **only when `NODE_ENV` is development**. It does not authenticate, verify, transmit or store credentials and creates no session. Any valid-format placeholder email and nonempty placeholder password open the demo. Keep this mode private: it exposes synthetic fixtures without access control. Production denies access and ignores the flag even when set; demo modules are not loaded by production pages.

No demo operation uses an API, database, localStorage or sessionStorage. Transaction **Edit** changes only the example product/funding purpose in React memory, resets on reload, and cannot change amount, balance, status, settlement, ledger entries or approval results. KYC is view-only. No real approval, payment, portfolio update or notification is performed.

## Run the demo locally

Install Node.js 20.9+ and npm; extract the ZIP to a writable directory, then:

```sh
npm ci
```

macOS/Linux:
```sh
ADMIN_DEMO_MODE=1 npm run dev -- --port 3002
```

Windows PowerShell:
```powershell
$env:ADMIN_DEMO_MODE = '1'
npm run dev -- --port 3002
```

Open `http://localhost:3002/admin/login`, enter any valid-format **placeholder** email and any nonempty **placeholder** password, then select Open demo. No real credentials should be used. Without `ADMIN_DEMO_MODE=1`, admin routes return 503 and sign-in is disabled even during development. Running `npm run build` and `npm run start` cannot enable demo mode.

## Checks and integration

```sh
npm run typecheck
npm run build
```

Package installation and build-time Manrope font download require network access. The ZIP excludes `node_modules`, `.next`, environment files and caches. Review `BACKEND-INTEGRATION.md` for required contracts and `CHANGES.md` for a complete list of changes relative to `Starfetch-Admin-Cleanup.zip`. When applying the ZIP, replace the admin directory or explicitly remove paths listed in `CHANGES.md`; overlaying can retain obsolete files. Back up independent local changes first.
