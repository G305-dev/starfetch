# Starfetch Corporate frontend integration — API v0.6.0

**Scope:** frontend-only integration of the attached canonical Corporate API v0.6.0 and D-06 O4 handoff. No backend source/contract was modified, no deployment or Git operation was performed, and O2 remains feature-gated by the backend.

## Delivered integration

### Authenticated owner-only discovery
- Added `GET /api/v1/me/corporate-accounts` via `getMyCorporateApplications()`.
- Strictly accepts only the approved safe discovery rows, including `accessVia: "INITIATING_APPLICANT"`; business details and TIN are rejected from this projection.
- Corporate dashboard now loads the signed-in investor's applications, supports multiple returned applications, and selects only a backend-returned Corporate account ID.
- Account list, selected account, O3/O11 data and freshness state are cleared when the authenticated user changes or signs out. No Corporate account ID is used from local/session storage, URLs, or as persistent authorization evidence.

### O4 Corporate DRAFT amendments
- Added `PATCH /api/v1/corporate-accounts/{corporateAccountId}/onboarding/draft` through the existing authenticated, same-origin request helper.
- PATCH uses bearer authority, cookie credentials, mutation CSRF header and the current strong quoted details version: `If-Match: "<version>"`.
- The client strips unknown keys and rejects an empty patch before transport. It sends only changed values among the six approved fields.
- Editing is available only when the authoritative O3 status is `DRAFT` or `INFO_REQUESTED`.
- TIN is an optional write-only replacement. It is kept in component memory only, is cleared after an attempt and is never rendered, persisted, logged, or placed in a URL.
- A `409 CONFLICT` is not retried or overwritten. It triggers fresh O3/O11/freshness reads and tells the investor to review authoritative state before a new amendment.

### O11 amendments and snapshot freshness
- Extended O11 parsing and display with `detailsAmendments`: version, approved changed field names and changed time only. The UI explicitly does not expose old values, TIN/envelope data, actor or internal data.
- Added the read-only `GET /api/v1/corporate-accounts/{corporateAccountId}/onboarding/verification-snapshot/freshness` read.
- The screen labels it as technical source-context freshness and explicitly states that it is **not** Mono verification, document completion, submission permission, compliance approval or investment eligibility.
- No snapshot generation/regeneration action or POST call is implemented because the requisite approved ruleset-binding prerequisites are not exposed to this UI.

### Preserved boundaries
- Retained O2 creation, O3 safe read, and O11 lifecycle support.
- Tier 1 Mono evidence stays independent from lifecycle status; Tier 2 document/upload UI remains unavailable without approved rules; Tier 3 staff/compliance remains unavailable and applicant-controlled approval is not offered.
- Portfolio, investment, document and unsupported staff operations remain disabled/unavailable rather than inferred.

## Changed files

- `lib/corporate/application.ts` — v0.6 safe discovery, O4 patch/result, amendment and freshness types/constants.
- `lib/api/client.ts` — PATCH transport support, strict discovery/O4/O11/freshness normalizers and authenticated API exports.
- `components/corporate/CorporateApplicationsWorkspace.tsx` — new owner-scoped selection, secure O4 editor, refresh/conflict flow.
- `components/corporate/CorporateDashboardContent.tsx` — replaces stale no-discovery copy with the owner-scoped workspace.
- `components/corporate/CorporateVerificationProgress.tsx` — safe amendment metadata and bounded technical freshness display.
- `components/corporate/CorporateProfileContent.tsx` — corrected discovery availability copy.
- `scripts/corporate-api-contract-check.ts` — mocked v0.6 transport/normalization coverage.
- `scripts/corporate-verification-check.ts` — v0.6 UI boundary/static safety coverage.

## Validation results

All commands were run in `/home/user/starfetch-investment-frontend` after `npm ci`:

| Command | Result |
|---|---|
| `npm run typecheck` | Passed — TypeScript `tsc --noEmit` |
| `npm run build` | Passed — Next.js production build, all 41 static routes generated |
| `npm run test:corporate-api` | Passed — mocked owner discovery, multiple rows, O4 changed-field PATCH, quoted `If-Match`, 409 no-retry behavior, O11 amendments, read-only freshness, O2 refresh/CSRF retained |
| `npm run test:corporate-verification` | Passed — discovery/session clearing/O4 conflict-refresh/safe UI boundary checks |
| `npm run test:auth-navigation` | Passed — authenticated Individual/Joint Corporate-entry flow regression |
| `npm run test:joint-contract` | Passed — Joint contract and account/session-isolation regression |

`npm ci` reported 3 dependency audit findings (2 high, 1 critical) from the existing dependency resolution. No audit remediation, dependency upgrade, deployment, backend change or Git operation was performed because it is outside this integration scope.

## Packaging

`Starfetch_Corporate_O2_O3_O4_O11_v0.6_Frontend_Integration.zip` is a clean frontend-only source archive. It excludes `node_modules`, `.next`, prior ZIP artifacts, uploads, caches and backend handoff/OpenAPI files.
