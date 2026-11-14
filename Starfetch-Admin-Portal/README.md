# Starfetch Admin Portal — standalone frontend preview

This is an admin-only export of the existing Starfetch frontend. It includes the admin sign-in, dashboard, users, investments, KYC, transactions, portfolios and settings previews. It does not include the investor portal, backend, database, API client, secrets, dependencies or generated build files. No separate Git repository is included.

## Important: preview only

**There is no authentication or access control. All admin pages are unprotected. Do not deploy publicly or enter real credentials or personal/financial information.** The login accepts any correctly formatted email and any nonempty password, then navigates locally to the mock dashboard. No credentials are verified, sent or saved and no session is created. Remember me does not persist a session.

All financial, user, KYC, transaction and system-health information is synthetic, not live. Actions are UI previews, not real approvals, payments, configuration changes, identity checks or ledger operations.

## Run locally

Install Node.js 20.9 or later (Node 20 LTS recommended), and npm. Extract the ZIP into a writable folder, open a terminal in `Starfetch-Admin-Portal`, then run:

```sh
npm ci
npm run dev
```

Open http://localhost:3000/ (redirects to `/admin/login`). To use another port, run `npm run dev -- --port 3002`. If you see a port-in-use message, choose a free port.

For a production-mode build check:

```sh
npm run typecheck
npm run build
npm run start
```

Installing packages and downloading the Manrope font at build time require network access. This archive intentionally excludes `node_modules` and `.next`; install and build on the destination machine.

## Future backend integration

**BACKEND CONTRACT REQUIRED:** David must supply approved admin authentication, staff authorization, and the relevant administrative API contracts before production use. Server-enforced protection is required on every admin route and API. This export does not implement those integrations and must remain a private preview until then.
