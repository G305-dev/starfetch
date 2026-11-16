# Corporate Account Creation and Profile Persistence — Backend Handoff for Segun

**Date:** 22 October 2026  
**Audience:** Segun / Backend Team  
**Status:** Backend implementation specification; frontend is being aligned to this contract  
**Scope:** Corporate applicant registration identity and the four sequential Company Profile sections

---

## 1. Requested outcome

Please configure the backend to support the Corporate account creation and profile workflow below. This is a frontend/API handoff only: **no backend source, database, migration, or deployment has been changed by this task.**

The authenticated Corporate applicant completes four server-backed sections, in this order:

1. **Corporate Applicant Information & Company Details**
2. **Investment Objective & Risk Profile**
3. **Source of Funds and Wealth**
4. **Bank Details**

The next section stays locked until the backend reports the previous section as `COMPLETE`. Saved drafts must resume for the same authenticated applicant. Completing these forms does not submit an application, approve Corporate KYC/KYB, create an approved Corporate investment account, grant an authorization role, or enable investment actions.

---

## 2. Corporate account creation changes

The create-account form must capture the following account-managed applicant identity:

- **Company name** — required
- **Company phone number** — required and validated as a phone number
- **Email address** — required
- Password and confirmation — required; confirmation is frontend-only

The existing shared registration endpoint remains in use. Corporate applicants continue using the existing verified **`INVESTOR`** login; do not introduce a separate Corporate authentication/authorization role or change Corporate login into a privileged business login.

### Request expected by the updated frontend

`POST /api/v1/auth/register`

```json
{
  "registrationType": "CORPORATE",
  "companyName": "Example Holdings Limited",
  "companyPhoneNumber": "+234 800 000 0000",
  "email": "applicant@example.com",
  "password": "..."
}
```

The frontend deliberately does **not** send `confirmPassword`. Keep the existing email-verification response envelope/flow. Validate and associate the company name and phone with the new Corporate applicant; persist them securely through email verification so they are present in the verified account's owner-scoped Company Profile. The authenticated account email remains account-managed.

> **Deployment dependency:** the currently approved Corporate registration request accepts only `registrationType`, `email`, and `password`. The backend must be updated to validate and accept `companyName` and `companyPhoneNumber` before this new form can successfully register a Corporate applicant. Until that backend change is deployed, registration must fail safely with the normal API error; the frontend must not claim success or fall back to local persistence.

After verification and sign-in, return the registered company name and phone in the Company Profile applicant projection. The Corporate applicant must not be able to edit those account-creation values from the Profile UI or section-save APIs.

---

## 3. Corporate Profile display and section order

### Section 1 — Corporate Applicant Information & Company Details

**Read-only, account-managed applicant information:**

- Company name (from Corporate registration)
- Company phone number (from Corporate registration)
- Account email (verified account identity)

**Editable registered-company details:**

- RC number
- Date of incorporation
- Tax Identification Number (TIN)
- Registered address
- City
- State

The TIN may be sent on a write request, but must be masked in every subsequent read. When a TIN is already present, a blank TIN input means **retain the existing value**; a replacement value is write-only.

### Section 2 — Investment Objective & Risk Profile

- **Primary investment objective:** `Capital preservation`, `Income`, `Balanced`, `Growth`
- **Risk tolerance:** `Conservative`, `Moderate`, `Balanced`, `Aggressive`
- **Investment horizon:** `< 1 year`, `1–3 years`, `3–5 years`, `5 years +`
- **Expected withdrawals**
- **Withdrawal frequency**
- **Investment restrictions or exclusions**, optional (“if any”)

The company selects one primary objective, one risk-tolerance value, and one horizon. The horizon values above follow the supplied Corporate account form; the Individual Profile horizon rules are separate.

### Section 3 — Source of Funds and Wealth

- One or more of:
  - `Business income / operating cash`
  - `Sale of assets`
  - `Loan / financing`
  - `Other (specify)`
- Other-source explanation, required only if `Other (specify)` is selected
- Expected annual inflow (NGN)
- Expected transaction frequency

### Section 4 — Bank Details

- Bank name
- Account number (10-digit NUBAN; write-only on save)
- Account name
- Account type
- BVN-linked-to-account confirmation: `Yes` / `No`

**Do not add a Branch/sort-code field. Do not request or accept a raw BVN number.** `bvnLinkedToAccount` is only an applicant declaration; it must not be represented as BVN validation or successful verification.

---

## 4. Recommended authenticated API contract

All routes below are recommended same-origin `/api/v1` routes. The frontend sends the existing authenticated request headers, including bearer/session authentication and CSRF on mutations. Mutations also send the current version as a strong quoted `If-Match` header (for example `If-Match: "7"`). Use the authenticated principal to choose ownership; never accept a user/investor ID from the browser to choose the record.

All successful responses should use the normal API envelope, e.g. `{ "data": { ... }, "meta": { "requestId": "..." } }`.

### 4.1 Read the signed-in applicant's Corporate Profile

`GET /api/v1/me/corporate-profile`

Return only the authenticated applicant's profile. A safe response shape expected by the frontend is:

```json
{
  "data": {
    "applicant": {
      "companyName": "Example Holdings Limited",
      "companyPhoneNumber": "+234 800 000 0000",
      "email": "applicant@example.com"
    },
    "sections": {
      "companyDetails": "COMPLETE",
      "investmentProfile": "NOT_STARTED",
      "sourceOfFunds": "NOT_STARTED",
      "bankDetails": "NOT_STARTED"
    },
    "companyDetails": {
      "rcNumber": "RC-123456",
      "dateOfIncorporation": "2020-01-02",
      "taxIdentificationNumberMasked": "••••5678",
      "registeredAddress": "10 Example Road",
      "city": "Lagos",
      "state": "Lagos"
    },
    "investmentProfile": {
      "primaryObjective": "Balanced",
      "riskTolerance": "Moderate",
      "investmentHorizon": "1–3 years",
      "expectedWithdrawals": "₦500,000",
      "withdrawalFrequency": "Quarterly",
      "restrictionsOrExclusions": ""
    },
    "sourceOfFunds": {
      "selectedSources": ["Business income / operating cash"],
      "otherSource": "",
      "expectedAnnualInflow": "1000000",
      "expectedTransactionFrequency": "Quarterly"
    },
    "bankDetails": {
      "bankName": "Example Bank",
      "accountNumberMasked": "******6789",
      "accountName": "Example Holdings Limited",
      "accountType": "Current",
      "bvnLinkedToAccount": true
    },
    "version": 7,
    "updatedAt": "2026-10-22T12:00:00.000Z"
  },
  "meta": { "requestId": "..." }
}
```

The profile should be created/seeded as part of successful Corporate registration/verification, or otherwise be available to the signed-in owner without needing an owner ID in the route. Do not return plaintext TIN or a full bank account number. Unknown/malformed section states must fail closed.

### 4.2 Save Section 1 — Company Details

`PUT /api/v1/me/corporate-profile/company-details`

```json
{
  "rcNumber": "RC-123456",
  "dateOfIncorporation": "2020-01-02",
  "taxIdentificationNumber": "TIN-SECRET-WRITE-ONLY",
  "registeredAddress": "10 Example Road",
  "city": "Lagos",
  "state": "Lagos"
}
```

`taxIdentificationNumber` may be omitted only to retain an existing encrypted TIN. Do not accept `companyName`, `companyPhoneNumber`, or `email` as editable fields on this route. If required fields are incomplete, store a draft and return section status `DRAFT`; return `COMPLETE` only after server-side validation.

### 4.3 Save Section 2 — Investment Profile

`PUT /api/v1/me/corporate-profile/investment-profile`

```json
{
  "primaryObjective": "Balanced",
  "riskTolerance": "Moderate",
  "investmentHorizon": "1–3 years",
  "expectedWithdrawals": "₦500,000",
  "withdrawalFrequency": "Quarterly",
  "restrictionsOrExclusions": ""
}
```

Validate controlled options server-side. Completion requires objective, risk tolerance, horizon, expected withdrawals, and withdrawal frequency. Restrictions/exclusions remain optional.

### 4.4 Save Section 3 — Source of Funds

`PUT /api/v1/me/corporate-profile/source-of-funds`

```json
{
  "selectedSources": ["Business income / operating cash"],
  "otherSource": "",
  "expectedAnnualInflow": "1000000",
  "expectedTransactionFrequency": "Quarterly"
}
```

Require at least one allowed source, expected annual inflow, and transaction frequency for completion. Require `otherSource` when `Other (specify)` is selected. Saving must not itself screen, assess, or clear source-of-funds information.

### 4.5 Save Section 4 — Bank Details

`PUT /api/v1/me/corporate-profile/bank-details`

```json
{
  "bankName": "Example Bank",
  "accountNumber": "0123456789",
  "accountName": "Example Holdings Limited",
  "accountType": "Current",
  "bvnLinkedToAccount": true
}
```

`accountNumber` may be omitted to retain an existing account number; the UI clears the entered number after a successful save and only shows the masked value returned by the server. Require bank name, account name/type and an explicit BVN-linked choice for section completion.

Reject unknown/prohibited fields, including Branch/sort code and raw BVN. Encrypt/tokenise account numbers and TIN at rest. Never return those values in full after the write request.

### Response to all section saves

Return the full safe profile projection (same shape as the GET), with a new `version`, canonical saved values, masked sensitive fields, and server-computed section statuses. Section status values are `NOT_STARTED`, `DRAFT`, and `COMPLETE` only.

---

## 5. Sequential completion and amendment rules

1. Section 1 is initially open. Section 2 must be rejected or remain inaccessible until Section 1 is server-confirmed `COMPLETE`.
2. Section 3 requires Section 2 `COMPLETE`; Section 4 requires Section 3 `COMPLETE`.
3. A partial save returns `DRAFT`; it does not unlock the next section.
4. On an actual change to an earlier completed section, invalidate/reopen dependent later sections so the applicant must review and complete them again. Preserve their values as drafts only if policy permits; never leave dependent sections marked current/complete based on stale prerequisites.
5. If a request repeats the same values, avoid needless invalidation.
6. For every mutation, compare the supplied `If-Match` version. A stale request must return `409 CONFLICT` without overwriting newer values.
7. Server validation is authoritative. Frontend validation is only a usability aid; the UI advances only when the returned previous-section status is `COMPLETE`.
8. Section completion is not submission, KYC/KYB approval, account activation, or investment authorisation. No submit/approve endpoint is requested in this handoff.

---

## 6. Data model and ownership

Recommended one-to-one owner-scoped `corporate_profiles` record (or equivalent), linked to the authenticated verified applicant ID:

- immutable account-managed `company_name`, `company_phone_number`, and canonical account email/source reference;
- registered-company fields: `rc_number`, `date_of_incorporation`, encrypted `tax_identification_number`, `registered_address`, `city`, `state`;
- investment objective, risk tolerance, horizon, withdrawal expectations/frequency, optional restrictions;
- source-of-funds selections, conditional other detail, annual inflow and transaction frequency;
- encrypted/tokenised bank account number, masked last four only for safe display, bank/account name/type, BVN-link declaration;
- four section status columns, optimistic version, creation/update timestamps.

Use a child table for selected fund sources if appropriate. For money, use a decimal/precision-safe representation or integer minor units plus currency; do not use floating-point values. Do not mix this profile with the separate O2 Corporate account-opening draft or imply that this record creates an approved investment account.

Every database read/write must scope to the authenticated owner. Never trust an account ID, owner ID, or applicant ID supplied by the browser. Avoid exposing TIN, full account number, prior sensitive values, or raw PII in logs, analytics, errors, staff list endpoints, or history metadata.

---

## 7. Security and privacy controls

- Retain the existing email verification and shared Investor authentication flow.
- Require verified authentication and enforce owner-scoped authorization on every Corporate Profile route.
- Require CSRF protection on each mutation and strong optimistic concurrency via `If-Match`.
- Encrypt TIN and bank-account values at rest using approved key management; mask on reads.
- Validate phone, RC/date, address, controlled option values, NUBAN, amount/frequency formats, and conditional source-of-funds fields on the server.
- Do not collect raw BVN, Branch, or sort-code values.
- Do not log registration credentials, plaintext TIN, account numbers, or full profile payloads.
- Apply data retention, correction, access, deletion, staff access, and audit rules through approved compliance/privacy policy.
- Preserve safe failure behavior for unavailable API/service, malformed response, forbidden owner access, validation error, and version conflict.

---

## 8. Acceptance tests for backend delivery

| ID | Scenario | Expected result |
|---|---|---|
| CORP-PROFILE-01 | Corporate registration contains company name and phone | Shared registration API validates and securely associates both with the new Corporate applicant. |
| CORP-PROFILE-02 | Individual registration remains unchanged | Individual names/email/password contract is unaffected. |
| CORP-PROFILE-03 | Verified applicant calls `GET /me/corporate-profile` | Only that owner's applicant identity, profile, status and masked values are returned. |
| CORP-PROFILE-04 | Applicant attempts to alter company name/phone/email through a section route | Request is rejected; account-managed identity remains immutable. |
| CORP-PROFILE-05 | Section 2 save before Section 1 is complete | Request is rejected or cannot mark Section 2 complete. |
| CORP-PROFILE-06 | Each section is saved validly in order | Server returns that section `COMPLETE` and unlocks only the next section. |
| CORP-PROFILE-07 | Section 1 is amended after later sections were complete | Later dependent statuses are reopened/invalidated; user must re-complete sequentially. |
| CORP-PROFILE-08 | `Other (specify)` is selected without an explanation | Server returns safe validation failure; Source of Funds is not complete. |
| CORP-PROFILE-09 | Bank Details includes raw BVN, Branch or sort code | Unknown/prohibited fields are rejected and not stored. |
| CORP-PROFILE-10 | TIN/account number is saved, then profile is read | Only masked values are returned; plaintext is never returned or logged. |
| CORP-PROFILE-11 | Two browser sessions save the same stale version | Second save receives `409 CONFLICT` and does not overwrite the first. |
| CORP-PROFILE-12 | Applicant tries another investor's profile or mutates a supplied owner ID | No cross-owner data is returned; no body-provided owner ID is trusted. |
| CORP-PROFILE-13 | All four sections are complete | Profile section statuses may be complete, but no KYC/KYB approval, Corporate authorization, or investment eligibility is inferred. |
| CORP-PROFILE-14 | Registration/Profile service is unavailable | No frontend local-storage fallback or false success is produced. |

---

## 9. Requested backend deliverables

1. Updated shared Corporate registration schema/validation for company name and phone.
2. Database migration and owner-scoped Corporate Profile model, including section statuses and `If-Match` versioning.
3. OpenAPI schemas for `GET /me/corporate-profile` and the four `PUT` section routes.
4. Safe response projection for immutable applicant info and masked TIN/account data.
5. Server-side section completion, ordering, and downstream invalidation logic.
6. Encryption, CSRF, owner authorization, logging, retention, and staff-access confirmation.
7. Automated acceptance tests above and a staging example for each section state.
8. Confirmation of deployed contract/version so the frontend integration can be validated against the live backend.

---

## 10. Explicit non-goals

- No backend source code, migrations, deployment, Git push, merge, or account activation is performed by this frontend task.
- No separate Corporate authentication role or credential is created.
- No RC number is added to login credentials.
- No raw BVN, Branch/sort code, document upload, directors/signatories, beneficial ownership or PEP field is introduced by this request.
- No O2 Corporate application is automatically created by saving the profile.
- No submission, compliance decision, verification result, product execution, investment, booking, or funding action is enabled.
