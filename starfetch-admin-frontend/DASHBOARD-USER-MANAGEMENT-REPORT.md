# Dashboard & User Management Update

## Scope and safety

- Baseline: `G305-dev/starfetch`, branch `admin-portal`, commit `5958cc42495c28754d316e3319a0bb5aba3e8b52`. Only `starfetch-admin-frontend` is changed; unrelated investor changes and the backend were not modified. No commit, push, merge or deployment was performed.
- This is synthetic, private demo UI only. No real accounts, compliance decisions, financial processing, authentication or admin API calls are implemented. Do not enter actual personal data, credentials, BVN, NIN, or identity documents. Production continues to fail closed; external Vercel Deployment Protection remains mandatory and must be verified by the deployment owner.

## Changes

- Dashboard removes the rendered Pending Actions and Recent System Activity panels, retains the AUM and allocation charts and summaries, and shows a full-width Recent Registrations table without Action column or per-row buttons. View All opens Users & Accounts.
- Add User has conditional Individual, Joint (two applicants) and Corporate fields, Pending default account status, required field, email-format/duplicate, phone and date validation, and generates unique demo references. Synthetic rows begin with Pending verification. The directory state is shared by add/delete, filtering, sorting, pagination, profile and the small recent/verification cards. Synthetic-only confirmation prevents accidental deletion; counts reflect the filtered sample, while summary cards and breakdown are independent illustrative aggregates. Reset restores original fixture data. Changes are browser-memory only, survive client-side navigation and are lost on reload/new tab; there is no browser storage or API.
- Read-only profiles show added fields and provide View Verification. That and the verification queue link to KYC with the selected Users reference. For original samples, a fixture email maps to its separate KYC reference; if no match exists (including added users), KYC clearly says so. KYC and Users statuses remain separate demo fixtures; navigating does not approve or reject anything.
- Dialogs use the existing centered responsive modal with Escape, focus containment and return, errors associated with inputs, plus fallback focus after a deleted row disappears. No nested dialogs.

## Changed files

- `components/admin/demo/AdminDashboard.tsx` — dashboard layout and registration link/table.
- `components/admin/demo/AdminUsersPage.tsx` — memory state, navigation, CRUD/reset and dialog composition.
- `components/admin/demo/DemoUserDialogs.tsx` — new Add and Delete dialogs.
- `components/admin/demo/AdminUsersFilters.tsx`, `AdminUsersTable.tsx` — Add trigger, Pending status filter, delete action.
- `components/admin/demo/InvestorDetailPanel.tsx` — read-only conditional details.
- `components/admin/demo/UsersOverviewCards.tsx` — current demo rows in compact cards and verification navigation.
- `components/admin/demo/admin-users-utils.ts`, `fixtures/admin-users-data.ts` — optional synthetic details and search.
- `components/admin/demo/AdminKycPage.tsx` — reference query lookup and explicit no-match state.
- `README.md`, `BACKEND-INTEGRATION.md`, `DASHBOARD-USER-MANAGEMENT-REPORT.md` — usage, safety and change documentation.

## Verification

- `npm ci --no-audit --no-fund`: passed. `npm run typecheck`: passed. Normal `npm run build` and `ADMIN_DEMO_MODE=1 VERCEL=1 VERCEL_ENV=preview npm run build`: passed.
- Chromium desktop and 390px mobile: dashboard sections and View All, Add validation and duplicate email, all three account types, Joint/Corporate read-only fields, Pending defaults, search, KYC matching/no-match, delete cancel/confirm, reset, client navigation retention, Escape and focus return passed. No `/api/` calls, page errors, localStorage or sessionStorage observed in these tested flows.
- Regression: prior six-page, extra keyboard/mobile, search/filter/pagination tests and updated transaction regression passed. The older transaction regression's expectation that removed dashboard panels remain was updated in a separate test copy before rerunning; transaction assertions were retained.
- Simulated locally using Preview build: seven admin routes returned 200 with Preview flag enabled, 503 for production and for disabled Preview; login controls were disabled for both blocked configurations. These checks do not test actual Vercel Deployment Protection or a hosted deployment.

## Handoff

The ZIP is the standalone admin source; generated dependencies, builds, caches, environment files and Git metadata are excluded. The companion patch is relative to the baseline commit and touches only `starfetch-admin-frontend`. The owner should inspect and apply it on the correct branch, configure and verify Vercel protection, and control any Git and Vercel deployment manually.
