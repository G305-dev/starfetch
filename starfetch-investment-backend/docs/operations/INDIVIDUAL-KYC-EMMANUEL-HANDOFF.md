# Emmanuel handoff — Individual KYC backend v1

**Status:** safe backend integration implemented; not production-ready for real submission/document collection.  
**GitHub main comparison snapshot:** `G305-dev/starfetch` default branch, commit `47e4bbbd25ad2f2abcfdff16f4c8b75d5708dabe` (retrieved from the public GitHub API; no checkout or push).  
**Detailed route contract:** `docs/api/INDIVIDUAL-KYC-PERSISTENCE-v1.md`.

## Contract decision: preserve the backend names

The Individual KYC `GET` contract keeps the fields already implemented:

- `data.sections.personal`, `data.sections.investmentProfile`, `data.sections.sourceOfFunds`, `data.sections.bankDetails`
- `data.sectionStatuses.personal`, `data.sectionStatuses.investment`, `data.sectionStatuses.sourceOfFunds`, `data.sectionStatuses.bank`

There is no top-level `data.personal` alias and no singular `data.sectionStatus` alias. Those names appeared in the proposed example, but the backend v1 fields are established and have not been silently renamed. Frontend types/adapter/hydration/progression must map to the existing backend names. Exact response example is in the API contract.

## Endpoints

- `GET /api/v1/me/kyc-profile`
- `PUT /api/v1/me/kyc-profile/personal`
- `PUT /api/v1/me/kyc-profile/investment-profile`
- `PUT /api/v1/me/kyc-profile/source-of-funds`
- `PUT /api/v1/me/kyc-profile/bank-details`
- `POST /api/v1/me/kyc-profile/id-document/upload-intent`
- `POST /api/v1/me/kyc-profile/id-document/:documentId/complete`
- `POST /api/v1/me/kyc-profile/submit`

Mutations use authenticated `principal.userId`, session-aware bearer auth, CSRF, rate limiting, and integer optimistic-lock `version`. Never send owner ID. Corporate INVESTOR users without an `InvestorProfile` are denied. Bank account number is accepted only as 10 digits and later returned as `accountNumberMasked`; raw BVN, branch and sort code are not accepted.

## Exact section mapping

- **Investment Profile** includes `annualIncomeMinor` and `estimatedNetWorthMinor` in addition to objective, tolerance, horizon, knowledge/experience, expected withdrawals, currency, withdrawal frequency, and optional restrictions.
- **Source of Funds** includes source selections, conditional `otherSource`, `expectedAnnualInflowMinor`, and expected transaction frequency. Annual income/net worth are not new request fields on this endpoint.
- Old encrypted drafts with annual income/net worth under `sourceOfFunds` are normalized on read into `investmentProfile` without overwriting a value already present there. They are re-encrypted in the normalized shape on the next successful section save. No database backfill or data loss is required.

## Horizon values

Use stable machine values (not labels):

| API code | Display label |
|---|---|
| `DAYS_180` | 180 days |
| `DAYS_365` | 365 days |
| `YEARS_1_TO_3` | 1–3 years |
| `YEARS_3_TO_5` | 3–5 years |
| `YEARS_5_PLUS` | 5+ years |

The code-to-label map is exported as `INDIVIDUAL_KYC_HORIZON_LABELS`. Frontend may localize labels but must submit the stable code.

## Frontend changes required (not included in this backend task)

1. Type the exact `sections` / plural `sectionStatuses` response shape above.
2. Load the saved profile on open; hydrate the four sections and use returned status/progression. Keep edits local until the relevant PUT succeeds.
3. Move `annualIncomeMinor` and `estimatedNetWorthMinor` controls/payload from Source of Funds to Investment Profile. Keep `expectedAnnualInflowMinor` on Source of Funds.
4. Replace horizon free-text/label submissions with the five stable API codes.
5. Keep phone updates on the existing `/me/profile` route. Names and email remain read-only.
6. Respect the backend's `accountNumberMasked` display; never send the mask back as `accountNumber`.
7. Do not claim upload persistence: production upload-intent returns `503 FEATURE_UNAVAILABLE` until the approved storage/scanner dependencies exist. Do not send document bytes to local storage, public buckets, or JSON APIs.
8. Keep the KYC completion reminder visible: `/api/v1/me` continues to report Individual `REQUIRED` until an authorized current approval source exists.

## Blockers requiring Emmanuel/management decisions

The report does not supply dropdown option lists. Completion gates remain closed until the following are supplied and approved:

1. Investment objective list/codes.
2. Risk tolerance list/codes.
3. Investment knowledge/experience list/codes.
4. Source-of-funds list/codes (including `OTHER` treatment).
5. Bank account type list/codes.
6. Withdrawal frequency list/codes.
7. Expected transaction frequency list/codes.
8. Financial currency allowlist, minor-unit rules, and whether NGN is approved.
9. Required/optional rules and numeric bounds for expected withdrawals, annual income, estimated net worth, and annual inflow.
10. Lawful basis, notice, retention, residency/cross-border region and dedicated KMS key approvals.
11. Private encrypted quarantine object store and real malware scanner, plus retention/expiry/delete/runbook.
12. Separate authorized reviewer and final-approval source, grant controls, segregation of duties, and evidence freshness/revocation rules.

`INDIVIDUAL_KYC_DATA_RESIDENCY_APPROVED` defaults false. It must not be toggled merely to make tests pass. Upload/scanning adapters remain production-disabled. No approval transition is exposed; `/me` and dashboard behavior stay fail-closed.

## Database test status

The requested `127.0.0.1:5433/starfetch_test` could not be positively identity/isolation-verified in this environment: no PostgreSQL client/server utilities were available and a TCP connection to `127.0.0.1:5433` was refused. No migration was applied and no E2E/destructive tests were run. No Neon or production database was contacted. Run the migration/E2E only after the server is available and its loopback bind, database name, server identity, and isolation from shared/production data have been positively verified.

## Compatibility patch included

The consolidated changed-files archive includes both the previously unpushed `/api/v1/me` completion-status patch and the updated Individual KYC implementation, relative to the GitHub main snapshot SHA above. `/api/v1/me` still returns Individual `REQUIRED` without genuine current authorized approval. Corporate completion criteria are unchanged. The archive is backend-only and excludes `.env`, credentials, `node_modules`, and customer data.
