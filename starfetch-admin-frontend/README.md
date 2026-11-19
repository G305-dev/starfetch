# Starfetch Admin Frontend — private demo

Standalone Next.js, TypeScript and Tailwind admin frontend. Investor applications and backend are not included. Demo components and synthetic fixtures remain in `components/admin/demo/`; all records, charts and financial figures are examples, not live data. Some illustrative totals are independent of sample rows.

## Important: this is not authentication

**Vercel Deployment Protection is mandatory for any online preview.** The application cannot detect or enforce whether it has been enabled. Anyone who passes—or bypasses—the Vercel protection can open the admin routes directly without using the demo form. The placeholder email and password are public UI examples, not secrets or access controls. No staff authentication, role checking, session or backend API is implemented. Never use real credentials or customer data; never expose a demo publicly.

Admin routes fail closed with HTTP 503 and the login controls are disabled by default. Production remains blocked, including when `ADMIN_DEMO_MODE=1`. David must provide an approved backend staff authentication and server-side authorization contract before public deployment or real data use.

The common server-side gate permits demo mode only with `ADMIN_DEMO_MODE=1` and either: (1) local Next.js development with no Vercel environment or `VERCEL_ENV=development`; or (2) Vercel Preview with system variables `VERCEL=1` and `VERCEL_ENV=preview`. `VERCEL_ENV=production` always denies it. The login and seven routes render dynamically, and middleware also enforces the gate. A non-secret build switch removes demo modules from normal production builds; both build time and runtime must be correctly configured for Preview. Rebuild/redeploy after changing environment variables. Never promote or reuse a Preview build as a production artifact: Preview client bundles include synthetic fixtures and depend on Vercel protection for privacy.

Demo transaction **Edit** changes only an example purpose in React memory, resets on reload, and cannot change amount, balance, status, settlement, ledger entries or approval results. KYC is view-only. No live backend operations are performed.

## Required Vercel Preview configuration

1. In the intended Vercel project, set Root Directory to `starfetch-admin-frontend` and enable **Settings → Deployment Protection** before creating or sharing the demo. Choose **Standard Protection** or **All Deployments** and an appropriate protection method such as Vercel Authentication; restrict access to intended testers. Confirm all preview aliases and generated deployment URLs are protected, with no protection exceptions or public bypasses. Available methods and access depend on your Vercel plan.
2. Under **Settings → Environment Variables**, set `ADMIN_DEMO_MODE=1` for **Preview only**, preferably scoped to the intended Git branch if offered. Do not set it for Production. Enable **Automatically expose System Environment Variables** so Vercel supplies `VERCEL=1` and `VERCEL_ENV=preview` at build and runtime; don't manually assign these in the Vercel project. Do not create an `ADMIN_DEMO_BUILD` environment variable: Next.js derives it during build.
3. Deploy a new Preview using your normal Vercel workflow (not performed by this package). Verify its precise URL in a signed-out/incognito browser: Vercel must challenge access before `/admin/login`, `/admin/dashboard`, other admin paths, and `/_next/` assets. If any bypass is possible, stop and fix the protection before sharing. Then sign in through Vercel as an authorized tester.
4. On `/admin/login`, enter the placeholder email `demo@example.com` and password `demo-only`, then select **Open demo**. No actual authentication takes place. Testers with Vercel access can also enter admin routes directly.
5. Confirm the public production deployment remains blocked: its `/admin/dashboard` and other admin routes should return 503, while the login controls are disabled. Vercel Deployment Protection status itself must be checked in Vercel; an environment flag or this app's checks are not proof of protection.

Official references: https://vercel.com/docs/deployment-protection and https://vercel.com/docs/environment-variables/system-environment-variables

## Local demo

Install Node.js 20.9+ and run `npm ci`. Do not bind a local development server to a public interface.

macOS/Linux:
```sh
ADMIN_DEMO_MODE=1 npm run dev -- --port 3002
```

Windows PowerShell:
```powershell
$env:ADMIN_DEMO_MODE = '1'
npm run dev -- --port 3002
```

Open `http://localhost:3002/admin/login` and use `demo@example.com` / `demo-only`. Without `ADMIN_DEMO_MODE=1`, admin routes return 503 and login controls are disabled. A normal `npm run build`/`npm run start` does not enable local demo mode.

## Checks

```sh
npm run typecheck
npm run build
```

Package installation and build-time font fetching may require network access. The ZIP excludes `node_modules`, `.next`, environment files and caches. `RESTORATION-REPORT.md` and `CHANGES.md` record earlier work and are historical; this README and `PRIVATE-DEMO-REPORT.md` describe the current behavior. When replacing files, back up independent local changes first.
