# Starfetch Corporate applicant registration — frontend integration (OpenAPI v0.6.1 / D-06 Revision 8)

## Scope

Frontend-only implementation of the attached canonical OpenAPI v0.6.1 and D-06 Revision 8 Corporate applicant registration addendum. No backend source, backend contract, deployment, or Git operation was changed.

The implementation adopts the additive Corporate registration variant while preserving the pre-existing Individual, Joint, O2/O3/O4/O11, verification-tier, and snapshot-freshness boundaries.

## Delivered user journey

1. **Open Account → Corporate** now opens a dedicated Corporate applicant registration route.
2. The public Corporate form collects only **email**, **password**, and frontend-only **confirm password**.
3. It calls `POST /api/v1/auth/register` with exactly:

   ```json
   {
     "registrationType": "CORPORATE",
     "email": "applicant@example.com",
     "password": "…"
   }
   ```

   Names and `confirmPassword` are never sent.
4. A successful `201` stores only non-authorisation verification routing state in session storage and directs the applicant to the Corporate email-verification screen.
5. Email verification reuses the established backend verification/resend flow. It creates no authenticated frontend session.
6. The success screen directs the applicant to `/login?next=/register/corporate`.
7. Corporate applicant login uses the existing `POST /api/v1/auth/login` / `INVESTOR` session architecture. The route does not create a Corporate role or a Business-login API.
8. After verified login, the safe return route leads to the authenticated Corporate onboarding/O2 DRAFT flow. The authenticated Corporate dashboard remains protected and discovers applications only using backend-authoritative owner discovery.

## Contract and safety details

- Added `registerCorporateApplicant()` with a deliberately exact, non-extensible three-field body.
- Preserved legacy `registerIndividual()` without `registrationType`; first and last names remain required for that caller.
- Added the neutral `loginInvestor()` name for the existing shared login endpoint; the old `loginIndividual` export remains as a compatibility alias.
- Updated `SafeUser` normalization to accept intentional empty-string `firstName` and `lastName` values for a profileless Corporate applicant, while validating the canonical `INVESTOR | STAFF | ADMIN` role field.
- Corporate applicants do **not** trigger `/api/v1/me/profile`; the individual-profile endpoint is never used as an authentication or Corporate-onboarding prerequisite.
- No display name is manufactured from blank values. Corporate views use contextual labels or “Not supplied”, not an invented personal name.
- Refresh cookies, in-memory access token handling, mutation CSRF headers, same-origin requests, bounded refresh, O2 idempotency, and O4 conflict protections are unchanged.
- Account-type choices are frontend navigation/presentation state only. No UI control sends or selects a backend authentication role.
- Email verification routing state is explicitly non-authorisation state. It contains the existing verification ID/masked email and journey label only; no session token or permission is stored.
- O2 remains backend feature-gated. A `503 FEATURE_UNAVAILABLE` is shown as an actual failure; no DRAFT is simulated.
- Restricted documents, provider verification, staff/compliance, submission/approval, investment, and snapshot regeneration functionality remain unavailable.

## Files added

- `components/auth/CorporateApplicantRegistrationForm.tsx`
- `components/auth/CorporateRegistrationEntry.tsx`
- `app/register/corporate/verify-email/page.tsx`
- `app/register/corporate/verify-email/success/page.tsx`
- `scripts/corporate-applicant-registration-check.ts`
- `Starfetch_Corporate_v0.6.1_Applicant_Registration_Report.md`

## Files updated

- `lib/api/client.ts`
- `lib/auth/verification-flow.ts`
- `components/auth/AuthProvider.tsx`
- `components/auth/AccountTypeSelection.tsx`
- `components/auth/CorporateOnboardingFlow.tsx`
- `components/auth/CorporatePersonalInformationForm.tsx`
- `components/auth/EmailVerificationForm.tsx`
- `components/auth/EmailVerificationSuccess.tsx`
- `components/auth/RequireIndividualAuth.tsx`
- `components/auth/SignInForm.tsx`
- `components/corporate/CorporateDashboardContent.tsx`
- `components/corporate/CorporateProfileContent.tsx`
- `components/corporate/CorporateTopbar.tsx`
- `app/corporate/layout.tsx`
- `app/register/corporate/page.tsx`
- `scripts/auth-return-navigation-check.ts`
- `package.json`

## Validation

All commands were run from `/home/user/starfetch-investment-frontend` after `npm ci`:

| Command | Result |
|---|---|
| `npm run typecheck` | Passed — TypeScript `tsc --noEmit` |
| `npm run build` | Passed — production Next.js build; 43 static routes generated |
| `npm run test:corporate-registration` | Passed — mocked exact Corporate registration body, unchanged Individual body, profileless blank-name `INVESTOR` login, no Individual profile request, verification and protected-route boundaries |
| `npm run test:auth-navigation` | Passed — safe Corporate applicant return navigation plus Joint regression |
| `npm run test:corporate-api` | Passed — retained discovery/O2/O3/O4/O11/freshness transport safety |
| `npm run test:corporate-verification` | Passed — retained tier independence, discovery/session-clearing, O4 conflict and freshness UI boundaries |
| `npm run test:joint-contract` | Passed — Joint contract and session/account-isolation regressions |

`npm ci` surfaced the existing dependency audit report of 3 findings (2 high, 1 critical). No dependency update was made because it is outside this frontend-contract integration scope.

## ZIP extraction / Vercel note

The accompanying ZIP is a **root-content frontend archive**. When adopting it in the GitHub repository, extract/copy the archive’s contents (`app`, `components`, `lib`, `public`, `scripts`, and root configuration files) directly into the repository root.

Do **not** place the extracted `Starfetch_Corporate_…` folder inside the repository. A nested extracted frontend causes the root `tsconfig.json` to type-check two projects and can produce unresolved `@/components/...` errors on Vercel.

The ZIP excludes `node_modules`, `.next`, prior archives, artifacts, backend source, and the supplied OpenAPI/handoff documents.
