# Starfetch Admin Portal — Production integration frontend (NOT released)

This package replaces the old demo UI with protected, provisional real-API integrations. It is **not** production ready. It has no live backend data, test account, demo bypass, mock financial values or sample KYC records. The current Starfetch backend does not yet expose the proposed Admin API; production remains **fail-closed (503)** by default.

## Installation

1. Apply this package ONLY against the reviewed `admin-portal` branch. Do not overwrite a dirty tree. Use the accompanying PowerShell installer or review and copy the changed files and deletion list manually.
2. Install dependencies using `npm ci` under `starfetch-admin-frontend`. Run `npm run typecheck` and `npm run build`. All dependency installation and actual server tests must be performed in an environment with npm access.
3. Keep Vercel production Admin access **disabled**. Do not enter customer records in Preview.
4. Review and approve the proposed contract jointly with David, including staff cookie semantics, response DTOs, KYC stages, account eligibility and read-model valuation support.
5. Only after dedicated staff sessions, granular RBAC, server-side object-level authorization, origin/CSRF, audit, provider/data residency, unit/integration/E2E tests and sign-off: set the **server-only** environment values listed below.

## Server-only configuration (must never use NEXT_PUBLIC_*)

- `ADMIN_STAFF_INTEGRATION_ENABLED=approved-v1`
- `ADMIN_RELEASE_APPROVED=true` — requires management/compliance/security approval, never set on Preview to bypass testing.
- `ADMIN_BACKEND_URL=https://approved-backend-host` — trusted HTTPS upstream origin, optional path prefix.
- `ADMIN_STAFF_SESSION_COOKIE=__Host-<agreed-cookie-name>` — **must** match David's secure staff login Set-Cookie and session-validation contract. Browser receives the reissued host-only Secure HttpOnly cookie, never JS token/localStorage.

Default without these settings: `/admin/*` (except staff sign-in) remains 503. Login form is disabled. `/api/admin-gateway/*` and `/api/admin-auth/*` fail closed. Middleware cookie presence does not authenticate; server protected pages and proxy calls verify backend session every time. Backend must enforce permissions and object-level access again.

**Important**: The cookie bridge is a provisional implementation until David confirms the actual backend Set-Cookie, refresh, logout/CSRF and session revocation protocol. The BFF cannot make an absent backend auth service real. Independent KYC final compliance approval and financial approval/settlement are deliberately not wired in the UI until backend contracts and maker-checker protections are agreed.

## API contract

Uses the proposed `/api/v1/admin` route family via a same-origin `/api/admin-gateway` allowlisted BFF. Read `API-INTEGRATION-MATRIX.md`, `PRODUCTION-BLOCKERS.md` and `DAVID-API-QUESTIONS.md` in the delivery ZIP. Each view has real fetch/loading/error/empty/403 states; unavailable backend surfaces never use fixtures. Post-invitation does NOT create an active investor; investment/transaction Add forms issue pending requests ONLY.

## Current UI decisions preserved

- Starfetch green design, protected sidebar routes and centered modals.
- Dashboard: 4 metrics, AUM series/allocation and recent registrations linking to Users; no Pending Actions, System Activity or row actions.
- Users: server-side list/filter, profile view, canonical KYC navigation, invite and controlled deactivation request (not hard delete).
- KYC: permitted reviewer-level correction/reject/approve-review requests; *no independent final compliance button until contract approved*.
- Investments: Add creates draft request for an eligible backend account. View shows investment summary/performance, not Documents or Activity Log. Booked positions cannot have their financial fields manually edited.
- Transactions: All/Deposits/Withdrawals, View and Add controlled request; immutable settled transaction read. No fake Approved/Completed action.
- Portfolio: **exactly** Investment Solution, Amount Invested, Current Value. No recent activity.
- Settings: exactly four backend-supplied summary cards; missing/unapproved DTO shows unavailable.
