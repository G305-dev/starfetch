# Corporate Applicant & Four-Section Profile API Handoff

**Backend baseline:** `2c461d6df7d471ce91f83af5a770554d21278333`  
**Contract:** SF-CORP-PROFILE-01-R2 / D-06 v1.1 addendum.  
**Status:** Backend API contract and implementation only. The fixed frontend was not modified.

## 1. Registration and authenticated identity

### Existing Corporate frontend request — supported without UI changes

`POST /api/v1/auth/register`

```json
{
  "registrationType": "CORPORATE",
  "companyName": "Example Holdings Limited",
  "companyPhoneNumber": "+2348000000000",
  "email": "applicant@example.com",
  "password": "<user password>"
}
```

`companyName` and `companyPhoneNumber` are required, trimmed, bounded and persisted in an owner-linked `CorporateApplicantProfile` in the same transaction as the Corporate user and email-verification challenge. They are applicant display identity, not verified O2 legal identity. Existing normalized-email uniqueness, password hashing, verification response, and no-auto-login behavior remain. No `InvestorProfile` or `CorporateAccount` is created for this signup.

Existing Individual registration remains supported (default when `registrationType` is omitted). Individual name fields and Corporate company fields are mutually exclusive. Unknown/extra fields remain rejected by the global validation pipe.

On successful `POST /auth/login` and authenticated `GET /api/v1/me`, existing response fields remain and safe additive fields include:

- `primaryAccountType`: `INDIVIDUAL`, `CORPORATE`, or `null` for an ambiguous legacy account awaiting manual classification.
- `authorizedContexts`: server-derived context list; `JOINT` is included only for an actual current membership and a valid Individual context.
- `jointMembershipCount`: current server-side membership count.
- `companyName`, `companyPhoneNumber`: present only when the current user's Corporate applicant display identity exists.

No `requestedPortal` input was added or required. The actual frontend login call sends only `{email,password}`; the backend cannot determine which portal option the user clicked.

### Existing legacy Corporate accounts

Legacy users are backfilled to `CORPORATE` only where there is an existing Corporate-owned application, no Individual profile, and no Joint membership. Older Corporate applicants with no O2 application remain `primaryAccountType:null` because `registrationType` was not persisted by the old flow; absence of an O2 row alone is not proof. They are not permanently blocked: after support verifies authoritative historical registration evidence with two-person approval, an operator records a one-time `account_type_recovery_audits` row and classifies the account under the runbook in `CORPORATE-PROFILE-MIGRATION-AND-DEPLOYMENT.md`. There is no applicant-facing type-change endpoint. Users with an Individual profile or any Joint membership are not eligible for this Corporate recovery path. Once recovered as Corporate, they can resume the existing Corporate draft/bootstrap onboarding without fabricating an O2 account.

Missing company display fields can then be completed once by the signed-in verified Corporate owner through:

`PATCH /api/v1/me/corporate-applicant-profile`

```json
{"companyName":"Example Holdings Limited","companyPhoneNumber":"+2348000000000"}
```

This route does not overwrite an existing identity record. Ambiguous legacy users are not arbitrarily reclassified; see deployment notes.

## 2. Resource prerequisites and ownership

The profile endpoints use an existing `corporateAccountId`, not a user ID or application ID. Obtain it from the existing owner-scoped `GET /api/v1/me/corporate-accounts` discovery path. The server then proves that the authenticated initiator owns the Corporate application for that account and that the O2 details row exists.

No profile endpoint creates `CorporateAccount`, O2 application, or owner identity. Invalid, missing and non-owned UUIDs return generic `404 NOT_FOUND`. Staff/admin and Individual-only identities are denied. An actual Joint member is checked against current database membership; portal selection is never proof of membership.

## 3. Read endpoint

`GET /api/v1/corporate-accounts/{corporateAccountId}/profile`

Requires bearer authentication, verified Corporate applicant identity, owner-scoped account access, and rate limiting. Returns `{data,meta}` with:

- applicant display identity (company name/phone/email);
- canonical O2/O3 details (institution name, incorporation date, RC, business contact, masked/null TIN, `detailsVersion`);
- registered address/city/state;
- four section payloads and `sectionStatuses`;
- `profileVersion`, canonical `detailsVersion`, `updatedAt`;
- `progress.percentage`, `progress.nextSection`, `progress.canSubmit:false`, and `progress.meaning:"SAVED_FORM_COMPLETION_ONLY"`.

When no saved profile row exists, the read is genuinely 0% with all four statuses `NOT_STARTED`, `profileVersion:0`. It does not create a row or invent an account. `taxIdentificationNumber` is never returned; only `taxIdentificationNumberMasked` is present. `accountNumber` is never returned; only `accountNumberMasked` is present. `bvnLinkedToAccount` is a user declaration only.

## 4. Four sequential PATCH sections

All mutations require bearer/session authentication, Corporate applicant/owner proof, same-origin and signed CSRF cookie/header validation, and a per-user rate limit. Responses are the persisted profile projection. A section is `COMPLETE` only after the database transaction commits with valid data. Later sections require the preceding section to be complete. A stale `If-Match` returns `409 CONFLICT` without partial persistence.

### 1. Company Details — one combined UI save

`PATCH /api/v1/corporate-accounts/{corporateAccountId}/profile/company-details`

`If-Match: "profile-<profileVersion>;details-<detailsVersion>"`

```json
{
  "rcNumber":"RC-123456",
  "dateOfIncorporation":"2020-01-10",
  "taxIdentificationNumber":"TIN value entered by applicant",
  "registeredAddress":"10 Example Road",
  "city":"Lagos",
  "state":"Lagos"
}
```

- `rcNumber`, `dateOfIncorporation`, and TIN use the existing canonical `CorporateOnboardingDetails` O2 master; no duplicate legal-company master is introduced.
- Existing O4 canonicalizer, TIN envelope encryption, version check and O4 revision audit are reused. The registered address, city and state are saved in the additive profile row within the **same serializable transaction**.
- Company name, phone and email are read-only registration identity, not updated by this section. Canonical O2 institution/business contact fields stay separate.
- `taxIdentificationNumber` is write-only. Omit it or send an empty string to retain the existing encrypted TIN. There is no clear-TIN operation. A non-empty new TIN follows existing O2/KMS availability gates; the O2 gate is not relaxed.
- A valid real non-future date is required. Company details completion additionally requires a persisted TIN envelope. If absent, the other accepted values can save as `DRAFT` until a TIN can be saved under existing gates.
- If the canonical O4 route changes `detailsVersion` separately, this section and dependent saved progress are re-evaluated; resave the section with current versions.

### 2. Investment Objective & Risk Profile

`PATCH /api/v1/corporate-accounts/{corporateAccountId}/profile/investment-profile`

`If-Match: "profile-<profileVersion>"`

```json
{
  "primaryObjective":"Income",
  "riskTolerance":"Moderate",
  "investmentHorizon":"1–3 years",
  "expectedWithdrawals":"No withdrawals planned",
  "withdrawalFrequency":"As needed",
  "restrictionsOrExclusions":""
}
```

Allowed choices exactly match the checked-in UI:

- `primaryObjective`: `Capital preservation`, `Income`, `Balanced`, `Growth`.
- `riskTolerance`: `Conservative`, `Moderate`, `Balanced`, `Aggressive`.
- `investmentHorizon`: `< 1 year`, `1–3 years`, `3–5 years`, `5 years +`.
- `expectedWithdrawals`, `withdrawalFrequency`: bounded text; “No withdrawals planned” is valid. If text is an amount (e.g. `₦500,000`), the backend accepts only unambiguous NGN syntax and records the parsed minor units using integer arithmetic. Other bounded narrative is retained without pretending it is an amount.
- `restrictionsOrExclusions` is optional; empty text is accepted.

These are applicant-provided declarations, not suitability results, approval, or eligibility.

### 3. Source of Funds and Wealth

`PATCH /api/v1/corporate-accounts/{corporateAccountId}/profile/source-of-funds`

`If-Match: "profile-<profileVersion>"`

```json
{
  "selectedSources":["Business income / operating cash"],
  "otherSource":"",
  "expectedAnnualInflow":"1000000",
  "expectedTransactionFrequency":"Quarterly"
}
```

`selectedSources` accepts the exact checked-in labels `Business income / operating cash`, `Sale of assets`, `Loan / financing`, and `Other (specify)`. Selecting `Other (specify)` requires non-empty `otherSource`. `expectedAnnualInflow` accepts non-negative numeric NGN text with at most two decimal places (no floating-point persistence), stored as integer kobo and returned as a decimal string. Frequency is bounded text. This is a declaration, not wealth approval or source-of-funds verification.

### 4. Bank Details

`PATCH /api/v1/corporate-accounts/{corporateAccountId}/profile/bank-details`

`If-Match: "profile-<profileVersion>"`

```json
{
  "bankName":"Example Bank",
  "accountNumber":"0123456789",
  "accountName":"Example Holdings Limited",
  "accountType":"Current",
  "bvnLinkedToAccount":true
}
```

`accountNumber` must be exactly ten digits. It is envelope-encrypted with a distinct Corporate Profile bank KMS key and `starfetch:corporate-profile:bank-account:v1` purpose/context. The plaintext is not persisted, logged, returned or placed in revisions. Only a masked value such as `••••••6789` is returned. `bvnLinkedToAccount` stores only the submitted Boolean declaration; **no raw BVN is requested or stored**, and no bank/BVN verification occurs. Branch/sort code and mandate fields are not present.

## 5. Progress and meanings

Each committed, validated complete section contributes 25%: 0 / 25 / 50 / 75 / 100. `DRAFT` contributes zero. Progress is recomputed from database state on every GET/login-resume; it is not based on browser state. `canSubmit` is always false in this contract. There is no `/submit` or `/verification/status` profile route. Do not label this progress as KYB complete, review started, approved, verified, or eligible to invest.

## 6. Error handling

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Invalid enum/text/date/amount/Boolean/body or malformed/missing version header. Field errors are safe and never echo sensitive values. |
| 401 | `UNAUTHENTICATED` | Missing/invalid/expired bearer session. |
| 403 | `FORBIDDEN` / `EMAIL_NOT_VERIFIED` | Wrong account family/role or email verification incomplete. |
| 404 | `NOT_FOUND` | Missing or non-owned Corporate account UUID; same safe response. |
| 409 | `CONFLICT` | Stale profile/O4 version, wrong save order, or application state not editable; reload before retry. |
| 429 | `RATE_LIMITED` | Endpoint/user rate threshold exceeded. |
| 503 | `SERVICE_UNAVAILABLE` | TIN or bank KMS service/config unavailable; no plaintext fallback. |

`If-Match` values must be quoted exactly, for example `"profile-0;details-1"` for Company Details and `"profile-2"` for other sections. The ETag is not a request-body field.

## 7. Required integration work outside this backend-only patch

- The pinned `CorporateProfileContent.tsx` currently makes **no** GET/PATCH requests, so the existing page remains local-only after refresh.
- The login selector currently sends only email/password. Backend resource boundaries are enforced now, but a wrong portal selection cannot be recognized at login until the request carries it.
- The Corporate profile routes need a real `corporateAccountId` from the existing Corporate account discovery/creation flow. Registration intentionally does not invent one; current O2 activation defaults disabled.
