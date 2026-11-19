> Historical document: demo access has since been updated for protected Vercel Preview. For current behavior and setup, see README.md and REVISED-TRANSACTIONS-REPORT.md.

# Admin demo restoration report

## Basis

- Current baseline: `Starfetch-Admin-Cleanup.zip`.
- Demo reference: `Starfetch-Admin-Portal.zip`, chosen by the user when the named `(2)` copy was not available in the workspace. Sample email addresses originally using `email.com` were changed to the reserved `example.com` domain.
- This directory remains a frontend-only local working copy; no Git commit, push, merge or deployment was performed.

## Restored and retained

- Dashboard: synthetic investor, AUM, KYC, investment and transaction figures, portfolio charts, pending actions and activities; System Health remains removed.
- Users: synthetic Individual, Joint and Corporate rows and local filters; no Verification Status table column or Users Quick Actions panel.
- KYC: synthetic review statuses and read-only details; the table offers View only, with no three-dot menu or decision buttons.
- Investments: synthetic products, amounts, investors and details; the Notes section remains removed.
- Transactions: synthetic rows and details with exactly View and Edit row actions. Edit changes the product/funding purpose only in React memory; changes reset on reload. The Status Timeline, Notes and Approval Trail sections remain absent. No amount, balance, status, settlement, ledger or approval field can be edited.
- Portfolios: synthetic holdings, charts, classifications and performance. Dashboard and portfolio totals are illustrative fixtures and may not reconcile with sample rows.
- Sidebar: Reports & Analytics, Compliance and Communications remain removed; Dashboard, Users, KYC, Investments, Transactions, Portfolios and Settings remain.
- Sign-in UI: email, password and show/hide controls restored. `ADMIN_DEMO_MODE=1` in development permits local placeholder navigation without authentication or a session. Outside this mode sign-in is disabled; production admin routes return 503 even if the flag is set.

## Safety and verification

Demo fixtures are isolated in `components/admin/demo/fixtures` and loaded only when the explicit development flag is enabled. No demo interaction calls backend APIs, makes a database write or persists transaction edits. All demo pages display a Demo Data warning. Do not enter real credentials or expose the demo publicly.

- `npm run typecheck`: passed.
- `npm run build`: passed (Next.js 15.5.9).
- Production with `ADMIN_DEMO_MODE=1`: all seven protected admin routes returned 503; sign-in fields were disabled. A scan of production static/server app output for several known fixture identifiers found none.
- Development with no flag: admin dashboard returned 503 and sign-in fields were disabled.
- Chromium desktop (1440×900): demo sign-in, dashboard chart and sample users, KYC View, transaction View and Edit, edit reset on reload, investment Notes removal and portfolio views passed. No API requests or page errors were detected in the tested interactions.
- Chromium mobile (390×844): sidebar navigation and horizontal overflow checks passed on the seven admin pages. This is not a full cross-browser, accessibility or visual regression audit.

BACKEND CONTRACT REQUIRED: David must provide real staff authentication/authorization and approved admin data and edit APIs before production. No backend or investor frontend was modified for this task.
