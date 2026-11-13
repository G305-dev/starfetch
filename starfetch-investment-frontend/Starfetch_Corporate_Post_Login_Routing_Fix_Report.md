# STARFETCH — Corporate Post-Login Routing Fix

## Scope completed

This is a frontend-only, minimal routing correction for Corporate applicants. It does not alter backend contracts, authentication roles/protections, TradingView widgets, landing-page content, About components, portraits, or Individual/Joint journeys.

### Corrected navigation

1. A verified Corporate applicant now receives the login return target:
   - `/login?next=%2Fcorporate%2Fdashboard`
2. Corporate sign-in defaults to `/corporate/dashboard`.
3. Legacy `next=/register/corporate` input is recognised only to preserve the existing sign-in journey, then normalised directly to `/corporate/dashboard`; it cannot re-enter unavailable O2 after authentication.
4. An authenticated visitor opening `/register/corporate` is client-redirected to the protected Corporate dashboard. The unauthenticated route continues to render only the Corporate applicant login-registration form.
5. The Corporate dashboard continues to use the existing authenticated `INVESTOR` session and does not require or create an Individual `InvestorProfile`.

### Empty/pending state

When authenticated owner-scoped Corporate discovery returns no application, the dashboard now says that the visitor is securely signed in as a Corporate applicant, clarifies that this is not an approved Corporate investment account, and states that no company details, TIN, or documents are required from the dashboard.

The existing secure O2 Corporate DRAFT implementation remains in the source for a future explicitly authorised entry point. This correction does not expose it automatically, bypass its backend feature gate, or simulate an application, approval, verification result, portfolio, or investment access.

## Modified frontend files

- `components/auth/CorporateRegistrationEntry.tsx`
- `components/auth/SignInForm.tsx`
- `components/auth/EmailVerificationSuccess.tsx`
- `components/auth/CorporateApplicantRegistrationForm.tsx`
- `components/corporate/CorporateApplicationsWorkspace.tsx`
- `components/corporate/CorporateDashboardContent.tsx`
- `scripts/auth-return-navigation-check.ts`
- `scripts/corporate-applicant-registration-check.ts`
- `scripts/corporate-post-login-routing-check.ts` (new regression check)
- `package.json`

## Validation completed

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run test:auth-navigation` | Passed |
| `npm run test:corporate-registration` | Passed |
| `npm run test:corporate-post-login-routing` | Passed |
| `npm run test:corporate-api` | Passed |
| `npm run test:corporate-verification` | Passed |
| `npm run test:joint-contract` | Passed |
| `npm run build` | Passed — 43 static routes generated |

### Browser evidence

A browser run with mocked, profileless authenticated `INVESTOR` responses reached the corrected dashboard through legacy authenticated `/register/corporate` navigation and captured `artifacts/corporate-dashboard-applicant-empty.png`. The screenshot shows the new dashboard empty/pending state and no O2 business-information form.

The final all-path browser harness was not recorded as a clean pass because its subsequent login-form test used an overly broad `Password` accessibility selector that matched both the password input and the show-password control. This is a test-harness selector issue, not a frontend routing/runtime failure. It does not affect the completed build or automated routing regression coverage.

## Delivery boundaries

- No Git operations or GitHub push were performed.
- No backend source, OpenAPI contract, endpoint, payload, role, or feature-gate change was made.
- No TradingView ticker, Market Overview, Navbar, hero, footer, landing section, Board/Leadership component, approved biography, logo, or portrait was changed.
