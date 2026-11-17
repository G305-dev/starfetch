# Corporate Dashboard Redesign — Change Package (frontend only)

The corporate dashboard (`/corporate/dashboard`) was rebuilt to match the supplied design (Greenfield Holdings example), with real backend data only — no example figures.

## What changed

### Heading (first-timer vs returning)
- **First-timers** (Corporate account created < 24 hours ago): `Welcome, {Company Name}`
- **Returning users** (account >= 1 day old): `Good morning/afternoon/evening, {Company Name}` by local time (same rules as the individual dashboard greeting in `lib/greeting.ts`)
- Company name comes from the backend: onboarding `institutionName` first, then `user.companyName`, fallback "Corporate applicant". Missing/invalid creation timestamps count as first-timer.
- The subtitle "Your corporate investment dashboard with Starfetch Investment Limited." was **removed** (no subtitle under the heading).

### Verified Applicant badge
- Green pill with shield icon, shown **only** when the backend application status is `APPROVED` (admin-verified). Email verification alone never shows it. All other statuses show no badge.

### Top-right company dropdown
- Avatar with company initials (e.g. GH) + company name + "Corporate Account" + chevron.
- Opens a menu with **Profile** (`/corporate/profile`) and **Sign out** (calls `logout()`, then routes to `/login`). Escape / outside-click closes; signing-out state disables the button.
- The notifications bell remains disabled (no approved notifications API) — no fake unread dot.

### Layout (matches design, honest data)
- Date pill top-right with calendar icon (today's local date, e.g. "Tue, 21 Jan 2025").
- 4 metric cards (Total Portfolio Value / Total Invested / Total Returns / Available Cash) — all show **"Unavailable"** because no Corporate portfolio endpoint is approved yet. No example ₦ amounts or % deltas are shown.
- Portfolio Performance card with 1M/3M/6M/YTD/1Y/All tabs (disabled until a portfolio feed is connected) and an empty state — no invented chart data.
- Corporate Account Overview card: Company Name, RC Number (`RC …`), Business Email from the owner-scoped onboarding record, with green wave decoration.
- Green wave footer decoration at the bottom of the dashboard.
- The existing **CorporateApplicationsWorkspace** (application selection, lifecycle, verification progress, DRAFT amendment, history) is preserved below the new design so onboarding functionality is unchanged.

## Files

- `lib/corporate/dashboard.ts` (new) — `isCorporateVerified`, `isCorporateFirstTimer`, `getCorporateDashboardHeading`, `getCompanyInitials`, `formatCorporateDate`, `formatRcNumber`
- `components/corporate/CorporateDashboardContent.tsx` (rewritten)
- `components/corporate/CorporateTopbar.tsx` (rewritten — dropdown)
- `scripts/corporate-dashboard-check.ts` (new, `npm run test:corporate-dashboard`)
- `scripts/corporate-post-login-routing-check.ts` (updated assertions for the new heading)
- `package.json` (adds `test:corporate-dashboard`)

## Verify

```bash
npm install
npm run typecheck
npm run test:corporate-dashboard
npm run test:corporate-verification
npm run test:corporate-post-login-routing
npm run build
```

Manual QA: sign in as a Corporate applicant created today → "Welcome, {Company}". Sign in with an account created 2+ days ago → "Good morning/afternoon/evening, {Company}" by local time. Badge appears only for APPROVED applications. Top-right dropdown shows Profile + Sign out. Metrics/chart show Unavailable (no fake data). Overview shows real company/RC/email when an application exists.
