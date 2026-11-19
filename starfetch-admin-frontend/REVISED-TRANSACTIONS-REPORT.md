# Revised Admin Dashboard and Transactions — change and validation report

## Scope and baseline

Admin-only update against `G305-dev/starfetch`, `admin-portal` commit `43aee090e51fbae6fe60598669f459f74de5cde6`. Investor frontend and backend were not modified. No commit, push, merge or deployment was performed. The standalone ZIP includes the complete admin source; the accompanying patch is relative to the baseline above and preserves file deletions.

## Behavior

- Dashboard renders only Total Investors, Verified Investors and Total AUM; Quick Actions is removed. The AUM chart, Pending Actions, Recent Registrations and Recent System Activity are retained in a responsive two-column layout where space permits.
- The transaction table no longer has selection checkboxes or selection state. Separate View and Edit buttons are retained in every row. Search, tabs, filters and pagination remain.
- View is a centered, read-only dialog with all requested fields, other available non-excluded sample details, Close and X controls. It intentionally omits Status Timeline and Approval Trail. Dialogs support Escape, focus containment and focus return.
- Add and Edit use a centered form with a generated/read-only ID; investor, account reference, payment method and purpose are required; a positive numeric amount with at most two decimals and a valid date are required. Optional fields are marked in the form. The typed shared status list supplies both forms, the status filter and badge types, including Approved and Rejected. New records default to Pending Approval. Existing illustrative activity and related records remain original fixture examples; they are not calculated or updated by edits.
- Add/Edit affect **synthetic browser-memory records only**; no transaction API, real approval, settlement, payment or ledger action is performed. Changes survive client-side navigation during the current page session, but reset on reload, tab closure or a new session. No browser storage is used. Add clears filters to show the new row; Edit clears them if the updated row no longer matches.
- The private demo login and production fail-closed gate remain unchanged. Vercel Deployment Protection is required independently and is not verified by this application. See README.md. Never enter real credentials or customer information.
- Bundled the same Manrope variable font and its SIL Open Font License to avoid a Google Fonts build-fetch failure. Upgraded Next.js from 15.5.9 to 15.5.29 and PostCSS/Sharp through the admin package and overrides after the original lockfile audit reported critical/high advisories, including middleware-bypass advisories. These dependency changes should be reviewed alongside the patch.

## Validation results

- `npm ci --no-audit --no-fund`: passed from the new lockfile.
- `npm run typecheck`: passed without diagnostics.
- `npm run build`: passed, Next.js 15.5.29; all static and dynamic routes built successfully. Initial build before bundling the font failed inside the external Google Fonts loader; final build passed using the local font.
- Preview-configured build (`ADMIN_DEMO_MODE=1 VERCEL=1 VERCEL_ENV=preview npm run build`): passed.
- Chromium desktop: private placeholder login; dashboard card and section requirements; separate row actions, no table checkboxes and pagination; View contents, read-only behavior, focus trap/return and Escape; Edit prefills, immutable ID and immediate updates; Add required, amount and date validation, default status, creation, viewing and editing; Approved/Rejected badges and filters; search and browser-memory persistence across navigation/reset on reload. No `/api/` requests, page errors, localStorage or sessionStorage entries were observed during the tested flow.
- Chromium filters/navigation: transaction type, account type, categories, custom dates and invalid-date feedback passed; all seven navigation routes and demo labels passed. Mobile 390px: modal fits viewport, status select, Escape and navigation menu passed.
- Simulated enabled Preview: all seven admin routes 200 with demo notice. Simulated production with demo flag and simulated Preview without the flag: all seven routes 503 and login disabled. No real Vercel deployment or Deployment Protection setting was tested.
- Default production-build output was scanned for a few known synthetic fixture identifiers; no matches were found in `.next/static` or `.next/server/app`. This targeted scan is not a complete security audit.
- `npm audit`: zero reported vulnerabilities for the installed dependency graph at verification time; this is not a full security review.

## Changed files relative to the baseline

### Modified

- `BACKEND-INTEGRATION.md`
- `CHANGES.md`
- `FILES.md`
- `PRIVATE-DEMO-REPORT.md`
- `README.md`
- `RESTORATION-REPORT.md`
- `app/layout.tsx`
- `components/admin/demo/AdminBadges.tsx`
- `components/admin/demo/AdminDashboard.tsx`
- `components/admin/demo/AdminTransactionsPage.tsx`
- `components/admin/demo/AdminTransactionsTable.tsx`
- `components/admin/demo/TransactionFilters.tsx`
- `components/admin/demo/fixtures/admin-transactions-data.ts` (type import only; synthetic rows unchanged)
- `package.json`
- `package-lock.json`

### Added

- `components/admin/demo/DemoTransactionDialog.tsx`
- `components/admin/demo/transaction-status.ts`
- `public/fonts/Manrope-Variable.ttf` — Manrope variable font from https://github.com/google/fonts/tree/main/ofl/manrope
- `public/fonts/OFL.txt` — accompanying font license
- `REVISED-TRANSACTIONS-REPORT.md`

### Removed

- `components/admin/demo/DemoTransactionEdit.tsx` — replaced by the unified form/dialog.
- `components/admin/demo/TransactionDetailPanel.tsx` — replaced by the read-only View modal.

The ZIP excludes dependencies, build output, environment files and the tracked generated `tsconfig.tsbuildinfo` cache. Back up independent changes before replacing the app directory. Alternatively, apply the included patch from the repository root with `git apply --check` then `git apply`; do not blindly overlay the old directory, as removed files would remain.
