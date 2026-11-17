# Individual KYC persistence API — v1 (backend-only, fail-closed)

**Base:** `/api/v1/me/kyc-profile`  
**Authentication:** session-aware bearer token; every route is tied to `principal.userId`. The role must be `INVESTOR` and the account must have an `InvestorProfile`. A Corporate applicant with role `INVESTOR` but no `InvestorProfile` is excluded. No owner ID is accepted in any request.  
**Mutation security:** `CookieMutationGuard` (Origin policy and session-bound signed double-submit CSRF) and per-user keyed rate limits run after authentication/authorization.  
**Persistence:** one owner-scoped profile, encrypted envelope payload, versioned section state, metadata-only documents, append-only profile events.

## Routes

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/me/kyc-profile` | Restore status, version, saved sections, calculated section states, progression, and document metadata. Bank number is returned only as `accountNumberMasked` (last four digits); full number is never serialized. |
| `PUT` | `/me/kyc-profile/personal` | Partial Personal/PEP draft save. Name/email are not accepted; update name/phone through the existing `/me/profile` API. |
| `PUT` | `/me/kyc-profile/investment-profile` | Partial investment/risk draft save. |
| `PUT` | `/me/kyc-profile/source-of-funds` | Partial source-of-funds/wealth draft save. |
| `PUT` | `/me/kyc-profile/bank-details` | Partial bank draft save. `bvnLinkedToAccount` is a declaration only; raw BVN, branch and sort-code fields are not accepted. |
| `POST` | `/me/kyc-profile/id-document/upload-intent` | Request short-lived upload authorization and create metadata. |
| `POST` | `/me/kyc-profile/id-document/:documentId/complete` | Validate stored object signature/size, run scanner, then mark metadata clean only on positive scanner confirmation. |
| `POST` | `/me/kyc-profile/submit` | Submit only when the server calculates all four sections complete and a matching ID is uploaded and clean. The profile transitions from `DRAFT` to `SUBMITTED` once, with a server timestamp. |

All section-save, upload-intent, document-completion, and submission bodies include the current integer `version`. A stale version returns HTTP 409; clients must refresh and reconcile. Partial fields are merged into the encrypted draft; `null` clears a field. Earlier sections remain editable. Section completion is calculated sequentially: personal (including matching clean ID), investment, source of funds, then bank details.

## Exact v1 response contract (preserved field names)

This integration keeps the backend fields already implemented; it does **not** rename them to the proposal's `sectionStatus` or move section values to top-level `personal`.

```json
{
  "data": {
    "status": "DRAFT",
    "version": 4,
    "submittedAt": null,
    "updatedAt": "2026-10-22T12:00:00.000Z",
    "sections": {
      "personal": { "pepStatus": "NO", "idDocumentType": "PASSPORT" },
      "investmentProfile": { "investmentHorizon": "DAYS_180", "annualIncomeMinor": "100000" },
      "sourceOfFunds": { "sourceOfFunds": ["OTHER"], "otherSource": "synthetic detail" },
      "bankDetails": { "bankName": "Example Bank", "accountNumberMasked": "******6789" }
    },
    "sectionStatuses": {
      "personal": "DRAFT",
      "investment": "DRAFT",
      "sourceOfFunds": "NOT_STARTED",
      "bank": "NOT_STARTED"
    },
    "documents": [],
    "progression": { "nextSection": "personal", "canSubmit": false }
  },
  "meta": { "requestId": "server-request-id" }
}
```

The timestamp and request ID above are illustrative. Actual response fields and casing are as shown; fields omitted from `sections` are not yet saved. A successful mutation response contains the new `version`, calculated `sectionStatuses` (`NOT_STARTED`, `DRAFT`, `COMPLETE`), and `progression`. The global interceptor supplies `{ data, meta }`.

**Frontend integration:** use `response.data.sections.personal`, `response.data.sections.investmentProfile`, `response.data.sections.sourceOfFunds`, and `response.data.sections.bankDetails`; read completion from `response.data.sectionStatuses.personal`, `.investment`, `.sourceOfFunds`, and `.bank`. Do not expect the proposal's top-level `data.personal` or singular `data.sectionStatus`; no aliases are emitted. Change the frontend API adapter/types and hydration/progression mapping to this exact v1 contract. Existing local-only component state must be mapped at that adapter boundary; no frontend files were modified here. Error messages do not contain submitted values, file bytes, encryption data, or secret configuration.

## Section request fields (partial-update DTOs)

Every section body includes required integer `version`; all listed section values are optional partial fields. The global validation pipe rejects unknown keys. `null` clears a saved value, while omitted properties remain unchanged.

- **Personal**: `dateOfBirth`, `gender`, `nationality`, `stateOfResidence`, `residentialAddress`, `idDocumentType`, `occupation`, `pepStatus`, `pepDetails`.
- **Investment Profile**: `primaryInvestmentObjective`, `riskTolerance`, `investmentHorizon`, `investmentKnowledgeExperience`, `expectedWithdrawalsMinor`, `annualIncomeMinor`, `estimatedNetWorthMinor`, `financialCurrency`, `withdrawalFrequency`, `investmentRestrictions`.
- **Source of Funds**: `sourceOfFunds`, `otherSource`, `expectedAnnualInflowMinor`, `expectedTransactionFrequency`.
- **Bank Details**: `bankName`, `accountNumber`, `accountName`, `accountType`, `bvnLinkedToAccount`.

Example Investment Profile partial save:

```json
{
  "version": 4,
  "investmentHorizon": "YEARS_1_TO_3",
  "annualIncomeMinor": "120000000",
  "estimatedNetWorthMinor": "750000000",
  "financialCurrency": "NGN"
}
```

`annualIncomeMinor`, `estimatedNetWorthMinor`, and `expectedAnnualInflowMinor` are digit strings in integer minor units; JSON floating-point amounts are not accepted. The currency example is illustrative only; `NGN` is not enabled as an approved completion currency until management confirms that policy.

## Data and validation

- Applicant-entered values are authenticated-encrypted with a dedicated Individual-KYC KMS key and purpose-specific KMS/AES-GCM context, bound to profile and owner. The provider never falls back to the Corporate TIN/O2 key. Crypto/key/residency unavailability blocks writes and restoration.
- Document bytes are never stored in PostgreSQL. The database stores owner/profile-scoped metadata and an opaque private object key only. Supported declared formats: PDF, JPEG, PNG; maximum: 10 MiB. Content type is rechecked against file signatures before scanning.
- PEP details can be drafted only after declaring `pepStatus: YES`; partial details can be saved, but all four details are required for Personal completion. Selecting `NO` clears stale PEP details.
- Horizon input accepts exactly these five stable API enum codes: `DAYS_180` → “180 days”; `DAYS_365` → “365 days”; `YEARS_1_TO_3` → “1–3 years”; `YEARS_3_TO_5` → “3–5 years”; `YEARS_5_PLUS` → “5+ years”. Send/store the codes; the labels are display text and may be localized.
- Annual income and estimated net worth belong to `InvestmentProfileKycSectionDto` and are stored under `sections.investmentProfile.annualIncomeMinor` / `estimatedNetWorthMinor`. Source of Funds owns only `sourceOfFunds`, `otherSource`, `expectedAnnualInflowMinor`, and `expectedTransactionFrequency` (plus the version). The former v1 draft payload stored annual income and net worth in Source of Funds; read-time normalization moves those saved values into Investment Profile without overwriting an existing Investment value. A subsequent successful save re-encrypts the normalized shape.
- Raw BVN and unsupported fields are rejected by the strict global validation pipe. Bank account number is exactly ten digits on write and is returned masked on read.
- Lifecycle values are `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `INFO_REQUIRED`, `APPROVED`, `REJECTED`. This applicant API can create/submit drafts only. Database guards and service code do not permit review/approval transitions, decisions, or editable approval flags. The existing `/me` completion response remains `individual: REQUIRED` absent a genuine authorized current approval source; Corporate completion logic is unchanged and Mono stays disabled.

## Intentionally unresolved policy catalogues

The report names controlled dropdowns but does not supply the approved option values. The backend accepts bounded partial draft text for the unresolved fields but keeps the related section `DRAFT`; successful submission remains fail-closed until reviewed allowlists and currency policy are supplied. No business/regulatory choices or `NGN` default are invented.

**Decision list Emmanuel and management/Compliance must provide:**

1. Investment objective options and stable API codes.
2. Risk tolerance options and stable API codes.
3. Investment knowledge/experience options and stable API codes.
4. Allowed source-of-funds options and stable API codes (confirm whether/how `OTHER` appears).
5. Bank account-type options and stable API codes.
6. Withdrawal-frequency options and stable API codes.
7. Expected transaction-frequency options and stable API codes.
8. Allowed financial currency/currencies, minor-unit interpretation, and whether `NGN` is the sole/approved initial currency.
9. Required/optional rules and allowed numeric bounds for expected withdrawals, annual income, estimated net worth, and expected annual inflow.

The allowlist-backed completion gates for each of the eight items above are currently empty. The profile can save partial values, but none of those draft strings alone can cause section completion. `OTHER` has its conditional detail rule but is not treated as an approved source category by itself.

## Documents: production dependency and current behavior

The production storage and scanner providers are intentionally bound to fail-closed disabled adapters. Upload intent and actual document completion therefore return `503 FEATURE_UNAVAILABLE` with the dependency stated as private encrypted Individual-KYC object storage and a real malware-scanning/quarantine service not being configured. Do not configure these endpoints to use public Supabase, local/Vercel disk, or a synthetic scanner. Production activation requires all of:

1. formally approved data residency/cross-border processing region and retention policy;
2. dedicated private, encrypted, quarantined object storage with short-lived/single-use upload authorization;
3. server-side checksum/type/size validation and a real scanner with a versioned positive-clean result;
4. operational delete/expiry/retry and audit policies.

The synthetic memory store and EICAR-marker scanner exist only as isolated test fixtures and refuse non-test construction. Real applicant data must not be used in tests.

## Manual decisions needed before production readiness

- Approve enumerations for objective, risk, experience, source-of-funds and financial currency; confirm required fields and numeric/currency bounds.
- Approve lawful basis, notice, retention, residency/transfer location, dedicated key ownership/rotation and operational response.
- Select and configure the private encrypted object store and real scanner/quarantine integration; establish evidence lifecycle and retention.
- Approve the separate authorized review/decision grant, separation of duties, freshness/revocation semantics and genuine Individual final-approval source. Until then, no KYC completion promotion is possible.

## Verification scope

Unit tests cover DTO allowlists, PEP conditionals, all five horizon values, legacy annual-income/net-worth relocation, OTHER detail/status, encryption and masking, owner/Corporate exclusion, document ownership/signatures/scanning, stale version, section persistence/restoration, and incomplete submission. The requested `127.0.0.1:5433/starfetch_test` refused a TCP connection and PostgreSQL client utilities were absent, so its identity/isolation could not be verified; no migration or migration-backed/E2E test was run. The existing `/api/v1/me` KYC completion service and tests remain unchanged.
