# Starfetch Individual Investor Portal — Frontend Handoff

**Status:** Complete for the agreed frontend-only scope.

## Delivered

### Authentication and session safety

- Kept access tokens module-scoped and in memory only; no token is stored in browser storage or a frontend-controlled cookie.
- Preserved same-origin `/api/v1` requests, credentialed refresh-cookie flow, CSRF headers for refresh/logout, and safe public error messages.
- Added a single-flight refresh coordinator so concurrent 401 responses share one refresh request.
- Added exactly one refresh-and-retry recovery path for an expired authenticated request.
- Added generation guards across the API client and `AuthProvider` so a stale refresh, stale login, logout, or a later login cannot overwrite the current session.
- Added `cache: "no-store"` to centralized API requests to avoid caching authenticated responses in the browser fetch layer.
- Protected Individual routes retain an initial neutral verification state and redirect unauthenticated visitors to sign-in without exposing protected content.

### Individual data surfaces

- **Dashboard:** continues to use live `/me`, `/me/portfolio`, and `/me/transactions` data. It does not fabricate identity, holdings, returns, or totals.
- **Investments:** uses only `/me/portfolio` fields. `totalReturnMinor: null` renders as **Not available**; no local performance calculation is made.
- **Transactions:** calls `/me/transactions?page=N&pageSize=10`, parses transaction records directly from the root `data` array with root `meta`, and uses server pagination only. It has loading, empty, error, and retry states with no fake summary, trend, export, or filter totals.
- **Profile:** reads and saves only `firstName`, `lastName`, and nullable `phone` through `/me/profile`; email is read-only. Save confirmation appears only after the PUT succeeds. Unsupported identity verification, employment/source-of-funds, bank, PEP, risk, and document areas are explicitly non-collecting and unavailable pending backend support.

### Products and navigation

- Individual Products and Fixed Note are informational only. They do not advertise unconfirmed current rates, yields, terms, minimums, bookings, purchases, funding, deposits, enquiries, or transmitted/saved interest.
- The Individual Fixed Note route now uses `IndividualFixedNoteInfo` rather than the legacy shared rate form.
- The shared legacy Fixed Note and products behavior is isolated to the pre-existing Corporate and Joint route prefixes. This restores those out-of-scope route experiences while keeping the Individual route informational.
- Individual portal navigation now uses Next `Link` for the required routes: `/dashboard`, `/investments`, `/transactions`, `/products`, `/products/fixed-note`, and `/profile`.
- Unsupported Individual dashboard actions such as statement download and document upload were removed or replaced with real internal destinations.

## Contract and security notes

- All browser API calls remain centralized in `lib/api/client.ts` and use the existing same-origin proxy path.
- No backend code, API contract, auth service, Prisma/database/migration, proxy configuration, production record, remote GitHub state, commit, push, merge, or PR was changed.
- No direct files under `app/corporate/**` or `app/joint/**` were edited. The legacy behavior needed by those routes was restored in shared components after discovering the initial shared-component dependency.

## Validation performed

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `NEXT_TELEMETRY_DISABLED=1 npm run build` | Passed; Next generated all 35 static routes |
| Lint | No lint script is defined in `package.json` |
| API-client contract/race check | Passed: root transaction `data`/`meta` parsing, single-flight refresh, one bounded retry, session expiry, and stale refresh cannot clear a newer login |
| Static Individual route/navigation audit | Passed: required Individual route pages exist; no raw internal anchors found in the audited Individual surfaces; obsolete Individual investment/transaction/profile mock modules are absent |
| Production-server route smoke test | Passed with HTTP 200 for `/login`, `/products`, `/products/fixed-note`, `/dashboard`, `/investments`, `/transactions`, and `/profile` |

## Authenticated-browser validation limitation

The local production preview is running on port **4000** in the Arena preview UI. It intentionally has no `BACKEND_API_ORIGIN` configured, so its `/api/v1/me` request returns HTTP 404 locally. As a result, authenticated browser screenshots and live login/dashboard API validation cannot be performed here without a separately supplied safe backend-proxy origin and test account. No fake authenticated fixture or fabricated financial data was introduced to compensate.

## Key implementation files

- `lib/api/client.ts`
- `components/auth/AuthProvider.tsx`
- `components/portal/IndividualDashboardContent.tsx`
- `components/portal/MyInvestmentsContent.tsx`
- `components/portal/MyTransactionsContent.tsx`
- `components/portal/IndividualProfileContent.tsx`
- `components/portal/ProductsContent.tsx`
- `components/portal/IndividualFixedNoteInfo.tsx`
- `app/products/fixed-note/page.tsx`
