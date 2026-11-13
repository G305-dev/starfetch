# STARFETCH — Enable Business / Corporate Login on General Login Page

## Frontend change completed

The general `/login` page no longer exposes an unavailable, RC-number Business login.

- The third account choice is now **Business / Corporate**.
- Selecting it uses the existing shared Investor email/password authentication flow already used by Corporate applicants.
- RC Number has been completely removed from the login UI, validation, and client form state.
- A successful Business / Corporate selection routes to `/corporate/dashboard` by default and preserves safe protected `/corporate/*` return destinations.
- The legacy `/register/corporate` return path is still normalised to `/corporate/dashboard`, preventing O2 from opening after login.
- An `EMAIL_NOT_VERIFIED` response from the Business / Corporate selection continues through the existing Corporate email-verification route, preserving resend/security behavior.
- The account-type control explicitly remains frontend navigation only; it does not verify a separate backend role, Corporate approval, or company ownership.

No Corporate authentication endpoint, role, payload, CSRF behavior, owner-scoped discovery rule, backend contract, or O2 gate was changed.

## Modified files

- `components/auth/SignInForm.tsx`
- `scripts/corporate-applicant-registration-check.ts`
- `scripts/corporate-post-login-routing-check.ts`
- `scripts/general-corporate-login-check.ts` — new regression check
- `package.json`

## Automated validation passed

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run test:auth-navigation` | Passed |
| `npm run test:corporate-registration` | Passed |
| `npm run test:corporate-post-login-routing` | Passed |
| `npm run test:general-corporate-login` | Passed |
| `npm run test:corporate-api` | Passed |
| `npm run test:corporate-verification` | Passed |
| `npm run test:joint-contract` | Passed |
| `npm run build` | Passed — 43 routes generated |

## Browser-validation status

A temporary browser harness successfully reached the general Business / Corporate login flow and the protected Corporate dashboard. Its subsequent text assertion was too narrow for the dashboard DOM and stopped the remainder of that optional browser harness. This is not an application build, type, automated routing, API-contract, or session-protection failure. No source changes are pending for the requested general-login behavior.

## Preservation

TradingView, Market Overview, Navbar, hero, footer, landing sections, About/Board/Leadership components and assets, Individual login, Joint login, Corporate O2, backend API contracts, and authentication protections were not changed. No Git or deployment action was performed.
