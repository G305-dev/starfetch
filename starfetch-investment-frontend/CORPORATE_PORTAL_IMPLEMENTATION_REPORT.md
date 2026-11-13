# Corporate Investor Portal — Frontend Alignment Report

**Completed:** 22 October 2026  
**Scope:** Corporate frontend only. No backend, API contract, database, authentication-service, environment, infrastructure, deployment, Git, or production-record changes were made.

## Outcome

The existing Corporate portal has been converted from production-facing mock data to an authenticated, backend-honest UI. It remains intentionally unable to create, fund, upload, approve, or invest until the corresponding approved Corporate APIs are publicly available.

The existing Individual and Joint surfaces, shared authentication/session/CSRF/refresh/logout handling, protected routing, and existing approved investment/transaction behavior were not modified.

## Implemented user experience

### Protected Corporate portal

- Added `app/corporate/layout.tsx`, which applies the existing `RequireIndividualAuth` guard to every Corporate route.
- Added the shared `CorporatePortalLayout` around the existing Corporate sidebar/topbar instead of creating a second portal shell.
- The layout keys page content by the authenticated user ID, so client-side Corporate page state is remounted when the account changes. The Corporate draft flow independently resets its ephemeral form state on account/session change or loss.
- Corporate topbar identity is derived from the authenticated user; notifications are explicitly unavailable rather than invented.

### Three-tier verification

1. **Tier 1 — Business information / Mono preparation**
   - Preserves exactly the approved O2 business fields: institution name, incorporation date, RC number, TIN, business phone, and business email.
   - Shows the authenticated initiating applicant only when present; it does not collect a representative profile.
   - Sensitive values are masked in the review and profile displays.
   - The UI clearly reports that no Corporate application record/read API or Mono workflow is public. No Mono browser integration or key handling was added.

2. **Tier 2 — Documents**
   - Does not assume any document category, requirement, status, or restriction.
   - Displays an accessible disabled upload action with the reason that a backend document ruleset and secure upload endpoint are unavailable.
   - No local upload, progress, storage, retry, or resubmission behavior exists.

3. **Tier 3 — Investor review**
   - Supports the typed backend states only: `DRAFT`, `SUBMITTED`, `IN_REVIEW`, `INFO_REQUESTED`, `APPROVED`, and `REJECTED`.
   - The default absence of a backend record is truthfully rendered as unavailable/not started.
   - The approved state does not grant investment access. Investors cannot approve their own application, and no Admin tooling was added.

### Corporate onboarding

- Replaced the old multi-step mock account-opening process with a two-step, six-field **Corporate draft preparation** flow.
- Removed PIN authentication, personal information collection, bank/BVN information, mandate selection, simulated account creation, dashboard redirect, and local success behavior.
- Validation covers only the six approved draft fields. An optional authority acknowledgement is not an additional business identity field and cannot submit anything.
- `CorporateApplicationAdapter` is a typed future integration boundary only; it contains no URL, fetch implementation, endpoint assumption, or request call.

### Corporate account surfaces

Dashboard, company profile, documents, investments, transactions, account settings, products, and fixed-note product access now render authenticated/unavailable/disabled states rather than fabricated company names, balances, returns, investments, transactions, receipts, documents, verified states, or authorisations.

Investment creation, funding, product action, upload, profile editing, verification editing, retry, and approval remain visibly disabled with an explanation until approved backend authorisation exists.

## Backend API status

| Capability | Frontend state |
| --- | --- |
| O2 Corporate draft creation | **Awaiting public authenticated backend endpoint** — typed request/adapter boundary only; no call is made. |
| Corporate application read/status | **Awaiting public backend endpoint** — typed state mapping is ready. |
| Mono preparation / verification | **Awaiting backend-approved flow** — no browser integration or credentials. |
| Document ruleset | **Awaiting backend endpoint** — UI makes no assumptions. |
| Document upload/storage/replacement | **Awaiting secure backend endpoint** — disabled. |
| Staff review / information requests / decisions | **Awaiting backend endpoint** — UI mapping ready; no investor controls. |
| Corporate account/portfolio/transaction read | **Awaiting authorised backend endpoint** — no mock replacement values. |
| Corporate funding/investment/product actions | **Awaiting backend authorisation** — disabled. |

## Validation results

All commands below completed successfully after the implementation:

```text
npm run test:corporate-verification
PASS — Corporate state mapping, three-tier safety, unavailable-operation handling,
onboarding contract boundaries, sensitive-data safeguards, session reset boundary,
and no-fake-data protections are verified

npm run test:joint-contract
PASS — Joint Phase 4 contract …
PASS — Joint account switch isolation …

npm run test:auth-navigation
PASS — safe post-login return navigation …

npm run test:footer-navigation
PASS — Footer internal navigation …

npm run test:privacy-policy
PASS — Privacy page …

npm run test:complaints-policy
PASS — Complaints page …

npm run test:tools-page
PASS — Free Tools page …

npm run test:budget-planner
PASS — Budget Planner …

npm run test:returns-calculator
PASS — Returns Calculator …

npm run typecheck
PASS — tsc --noEmit

npm run build
PASS — Next.js 15.5.9 optimized production build; all 41 static routes generated
```

No lint script is configured in this repository, so no replacement lint tool or dependency was added.

## Visual QA

Production build preview was checked at desktop and mobile widths:

- `qa/corporate/corporate-onboarding-unauthenticated.png` — desktop, `/register/corporate`: authenticated-initiator gate is clear and responsive.
- `qa/corporate/corporate-onboarding-mobile-unauthenticated.png` — 390 px mobile width: no clipping or horizontal overflow observed.
- `qa/corporate/corporate-dashboard-protected.png` — desktop, `/corporate/dashboard`: unauthenticated access is redirected to the existing login flow.

No safe test credentials or public Corporate backend API were available. Therefore, authenticated-state visual QA and live Corporate endpoint tests were deliberately not simulated or claimed.

## Changed files

### New

- `app/corporate/layout.tsx`
- `components/corporate/CorporatePortalLayout.tsx`
- `components/corporate/CorporateProductsContent.tsx`
- `components/corporate/CorporateVerificationProgress.tsx`
- `lib/corporate/application.ts`
- `scripts/corporate-verification-check.ts`
- `qa/corporate/corporate-onboarding-unauthenticated.png`
- `qa/corporate/corporate-onboarding-mobile-unauthenticated.png`
- `qa/corporate/corporate-dashboard-protected.png`
- `CORPORATE_PORTAL_IMPLEMENTATION_REPORT.md`

### Updated

- `app/corporate/dashboard/page.tsx`
- `app/corporate/documents/page.tsx`
- `app/corporate/investments/page.tsx`
- `app/corporate/products/page.tsx`
- `app/corporate/products/fixed-note/page.tsx`
- `app/corporate/profile/page.tsx`
- `app/corporate/settings/page.tsx`
- `app/corporate/transactions/page.tsx`
- `components/auth/CorporateApplicantDetailsForm.tsx`
- `components/auth/CorporateBankDetailsForm.tsx`
- `components/auth/CorporateOnboardingFlow.tsx`
- `components/auth/CorporateOnboardingStepper.tsx`
- `components/auth/CorporatePersonalInformationForm.tsx`
- `components/auth/CorporateSecurityInformationForm.tsx`
- `components/auth/MandateSelectionForm.tsx`
- `components/auth/corporate-onboarding-data.ts`
- `components/corporate/BusinessAccountSettingsContent.tsx`
- `components/corporate/CorporateDashboardContent.tsx`
- `components/corporate/CorporateDocumentsContent.tsx`
- `components/corporate/CorporateInvestmentsContent.tsx`
- `components/corporate/CorporateProfileContent.tsx`
- `components/corporate/CorporateTopbar.tsx`
- `components/corporate/CorporateTransactionsContent.tsx`
- `components/corporate/corporate-dashboard-data.ts`
- `package.json`

## Clean archive

`Starfetch_Corporate_Portal_Frontend_Alignment.zip` contains only the files listed above (including this report and the three visual-QA screenshots). It excludes dependencies, generated builds, `.next`, environment files, credentials, and temporary artifacts.
