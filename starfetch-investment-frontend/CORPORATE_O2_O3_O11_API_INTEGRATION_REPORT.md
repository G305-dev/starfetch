# Corporate O2/O3/O11 Frontend API Integration Report

**Completed:** 22 October 2026  
**Contract source:** David’s attached canonical OpenAPI v0.5.0 and D-06 Corporate O2/O3/O11 addendum.  
**Scope:** Corporate frontend only. No backend source, OpenAPI source, database, deployment, environment, infrastructure, or Git changes were made.

## Implemented integration

### O2 — create Corporate DRAFT

- Added authenticated same-origin integration for `POST /api/v1/corporate-accounts/applications` through the existing API client.
- Sends an explicit JSON object containing **only** the six approved fields:
  - `institutionName`
  - `dateOfIncorporation`
  - `rcNumber`
  - `taxIdentificationNumber`
  - `businessPhoneNumber`
  - `businessEmail`
- Reuses the existing in-memory bearer token, credentials mode, CSRF double-submit cookie/header, bounded refresh-and-retry behavior, and same-origin `/api/v1` request path.
- Generates a cryptographically secure opaque UUID-style `Idempotency-Key` in page memory. The same key is reused only when retrying the unchanged logical O2 request; changing a field generates a new logical request/key.
- Does not create a local success state. UI success is shown only after the exact `201` receipt is decoded.
- Handles `CONFLICT` (409), `RATE_LIMITED` (429, including Retry-After), `FEATURE_UNAVAILABLE` (503), `SERVICE_UNAVAILABLE` (503), validation, session, permission, and network failures truthfully.
- O2 remains feature-gated by the backend. The frontend does not pre-enable, bypass, or infer gate status.

### O3 — application details/current lifecycle

- Added authenticated same-origin integration for `GET /api/v1/corporate-accounts/{corporateAccountId}/onboarding`.
- Uses **only** `corporateAccountId` from the confirmed O2 receipt. It never substitutes `applicationId` in the path.
- Strictly normalises the approved safe details projection, including `taxIdentificationNumberMasked: string | null`; plaintext TIN is not accepted or rendered.
- Renders backend-returned application lifecycle status and safe details after a successful O2 receipt.

### O11 — permitted lifecycle history

- Added authenticated same-origin integration for `GET /api/v1/corporate-accounts/{corporateAccountId}/onboarding/history`.
- Uses the same O2-returned `corporateAccountId` and displays the permitted backend history fields only: event, from-status, to-status, and timestamp.
- Does not expect actor IDs, staff/compliance records, verification evidence, or internal audit details.

## Security and state boundaries

- TIN stays only in controlled React form state until a confirmed O2 result. It is never written to `localStorage`, `sessionStorage`, URLs, logs, receipt state, O3/O11 display state, or the clean archive.
- After a confirmed O2 success, the full six-field form state and idempotency key are cleared immediately.
- Form state, idempotency key, receipt, O3 result, and O11 history are all cleared when the authenticated user/session changes.
- Existing account switching and session invalidation continue through the shared `AuthProvider` and API client generation controls.
- An O3/O11 read failure after an actual O2 success is clearly shown as a read failure; it does not undo or fabricate the confirmed creation receipt.
- No account ID is placed in a URL or persisted in browser storage. Because no approved owner-scoped Corporate account listing/discovery API exists, the dashboard explicitly does not attempt to guess/discover a Corporate account from an application ID or browser state.

## Verification tiers

The backend O2/O3/O11 contract exposes application lifecycle only. The three verification tiers are deliberately independent:

- **Tier 1:** Mono / verification evidence remains unavailable.
- **Tier 2:** document rules, completeness, uploads, replacement, and resubmission remain unavailable.
- **Tier 3:** staff/compliance decision remains unavailable; an applicant cannot self-approve.

A lifecycle state is never displayed as proof of Mono success, document completeness, or staff/compliance approval.

## Validation evidence

All commands completed successfully:

```text
npm run test:corporate-verification
PASS — Corporate O2/O3/O11 contracts, safe TIN handling, idempotency,
owner-scoped reads, feature-gate/error states, independent verification tiers,
session clearing, and no-fake-data protections are verified

npm run test:corporate-api
PASS — O2 uses exact six-field authenticated/CSRF/idempotent transport;
O3/O11 use the O2 Corporate account ID, retain safe TIN projection, and
preserve conflict, feature-gate, and rate-limit errors

npm run test:joint-contract
PASS — Joint contract and session/isolation regression checks

npm run test:auth-navigation
PASS — safe Corporate verified-Investor return route and navigation checks

npm run test:footer-navigation
PASS
npm run test:privacy-policy
PASS
npm run test:complaints-policy
PASS
npm run test:tools-page
PASS
npm run test:budget-planner
PASS
npm run test:returns-calculator
PASS

npm run typecheck
PASS — tsc --noEmit

npm run build
PASS — Next.js 15.5.9 optimized production build; all 41 routes generated
```

`test:corporate-api` uses an isolated in-process mocked fetch transport to verify the exact frontend request body, bearer/CSRF/idempotency headers, bounded 401 refresh retry with the same Idempotency-Key and rotated CSRF header, O2 receipt decoding, O3/O11 path IDs, null TIN projection, and 409/429/503 handling. No live backend was called because no explicitly authorized isolated development backend credentials/origin were provided. In particular, no enabled O2 production or non-production endpoint was probed.

## Changed files

- `lib/api/client.ts`
- `lib/corporate/application.ts`
- `components/auth/CorporateOnboardingFlow.tsx`
- `components/corporate/CorporateVerificationProgress.tsx`
- `components/corporate/CorporateDashboardContent.tsx`
- `components/corporate/CorporateProfileContent.tsx`
- `scripts/corporate-verification-check.ts`
- `scripts/corporate-api-contract-check.ts`
- `package.json`
- `CORPORATE_O2_O3_O11_API_INTEGRATION_REPORT.md`

## Clean archive

`Starfetch_Corporate_O2_O3_O11_API_Integration.zip` contains only the changed frontend source, test scripts, package script manifest, and this report. It excludes the attached contracts, backend files, dependencies, generated build output, `.next`, environment files, credentials, and temporary artifacts.
