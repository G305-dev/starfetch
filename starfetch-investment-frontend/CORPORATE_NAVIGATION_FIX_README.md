# Corporate Dashboard Navigation Fix — Change Package (frontend only)

Branch: `corporate-work` (local branch; changes left uncommitted for manual review — nothing pushed, committed, merged, deployed or PR'd).

## Root cause

Corporate sidebar tabs used native `<a href>` anchors. Every tab click was a **full page reload**, which wipes the in-memory access token (`inMemoryAccessToken` in `lib/api/client.ts`). After reload, `AuthProvider` had to restore the session via `POST /auth/refresh` + `GET /me`, and **any** failure — network blip, 5xx, rate limit, not just 401 — marked the user `unauthenticated`, so `RequireInvestorAuth` (`app/corporate/layout.tsx`) redirected to `/login`. Every tab click was therefore a session-restore gamble.

The same full-reload pattern existed in `Logo` and `Button` (`components/ui.tsx`) and `CorporateQuickActions`.

## Fix

### 1. Client-side navigation (`next/link`)
- `components/corporate/CorporateSidebar.tsx` — tabs now use `<Link>` (Overview `/corporate/dashboard`, Investments `/corporate/investments`, Transactions `/corporate/transactions`, Products `/corporate/products`, Company Profile `/corporate/profile`). Styling, icons, active states and mobile menu preserved; `onNavigate` still closes the mobile menu.
- `components/corporate/CorporateQuickActions.tsx` — `<a>` → `<Link>`.
- `components/ui.tsx` — `Logo` and `Button` now render `<Link>` (all 9 `Button` usages pass `href`; `href` is now required). Internal clicks no longer reload the document, so the in-memory token survives tab navigation and no refresh is needed.
- Corporate isolation preserved: all sidebar destinations stay under `/corporate/*`; nothing links to `/dashboard` or `/profile`.

### 2. Session restore hardening (`components/auth/AuthProvider.tsx`)
- New `error` status for transient restore failures. Only backend-confirmed `UNAUTHENTICATED` (401) ends the session.
- Network/5xx/rate-limit failures during initial restore → `error` (retryable screen), never a login redirect.
- Background re-refresh while already authenticated keeps the session visible; transient failure preserves it (token still in memory).
- Security architecture unchanged: in-memory token, HttpOnly refresh cookie (`credentials: "include"`), CSRF double-submit headers, single-flight refresh, refresh-and-retry on 401, secure expiry/logout. No localStorage. Guards not removed.

### 3. Guard (`components/auth/RequireIndividualAuth.tsx`)
- `loading` → spinner (no premature redirect). `unauthenticated` → redirect to `/login?next=…` (only backend-confirmed). `error` → "We couldn't restore your session" with **Try again** (`refreshSession()`) and explicit **Back to login** — never an automatic redirect.
- `lib/auth/joint-registration-entry.ts` — `JointRegistrationEntryStatus` includes `"error"` (waits, like loading).

### 4. KYC popups preserved
- Individual: `/dashboard` → `IndividualKycPrompt` → `/profile` (Individual API status).
- Corporate: `/corporate/dashboard` → `CorporateKycPrompt` → `/corporate/profile` (no Individual endpoints). Untouched by this fix except navigation is now client-side.

## Files

- `components/corporate/CorporateSidebar.tsx`
- `components/corporate/CorporateQuickActions.tsx`
- `components/ui.tsx` (Logo + Button)
- `components/auth/AuthProvider.tsx`
- `components/auth/RequireIndividualAuth.tsx`
- `lib/auth/joint-registration-entry.ts`
- `scripts/corporate-navigation-check.ts` (new, `npm run test:corporate-navigation`)
- `package.json` (adds `test:corporate-navigation`)

## Validation

```bash
npm run typecheck                    # PASS
npm run test:corporate-navigation    # PASS (new)
npm run build                        # PASS
```

Plus all prior checks PASS: `test:individual-kyc-prompt`, `test:kyc-dashboard-prompt`, `test:corporate-dashboard`, `test:corporate-verification`, `test:corporate-post-login-routing`, `test:dashboard-greeting`, `test:mobile-menu-visibility`, `test:homepage-value-proposition`, `test:market-widgets`, `test:about-profile-cards`.

## Manual test flow (desktop + mobile)

1. Log in as Corporate investor → `/corporate/dashboard`.
2. Click Investments → Transactions → Products → Company Profile → Overview: all client-side, no login redirect, no spinner flash.
3. Click Complete KYC → `/corporate/profile` (stays in Corporate Portal).
4. Refresh any `/corporate/*` page → spinner while restoring, then dashboard (session restored via refresh cookie).
5. Log out → protected Corporate pages redirect to `/login`.
6. Expired/invalid session (e.g. refresh cookie cleared) → redirect to `/login` (backend-confirmed only).
7. Block network during restore → retry screen, not login.

## Remaining backend/deployment notes

- No backend changes were made. If `POST /auth/refresh` itself is flaky (rotation races, CSRF cookie domain, `BACKEND_API_ORIGIN` rewrite misconfiguration), tab navigation no longer depends on it — but full reloads (refresh button, deep links) still do. Verify in staging that refresh succeeds with the deployed cookie/CSRF configuration.
- Corporate financial data remains unavailable (no approved portfolio endpoint) — unrelated to this fix; dashboards show honest empty states.
