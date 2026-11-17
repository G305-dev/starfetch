# Individual KYC API field mapping — Emmanuel handoff

**Backend baseline:** `G305-dev/starfetch` `main` at `7baea41f93254a0e93ffa01cd6ba48ccc0e79e8a`.

This guide maps the existing Individual Profile options to the authenticated backend API. It is a proposed wire contract for integration and management review, **not** a claim of management, suitability, AML/CFT, or compliance approval. It does not perform screening or verify applicant declarations.

## Routes and optimistic version

All routes are under `/api/v1/me/kyc-profile`. Authenticate as the signed-in Investor; do not send an owner/user ID. Use the current integer `version` on each mutation. Use the version returned by each save/upload response for the next write; a stale version returns `409 CONFLICT`, then reload with `GET`.

| Method and route | Purpose |
|---|---|
| `GET /api/v1/me/kyc-profile` | Restore the owner’s saved profile, section statuses, masked bank account, document/manual-review status, `version`, and `progression`. |
| `PUT /api/v1/me/kyc-profile/personal` | Save the Personal and PEP section. |
| `PUT /api/v1/me/kyc-profile/investment-profile` | Save Investment Profile. |
| `PUT /api/v1/me/kyc-profile/source-of-funds` | Save Source of Funds. |
| `PUT /api/v1/me/kyc-profile/bank-details` | Save Bank Details. |
| `POST /api/v1/me/kyc-profile/submit` | Submit a complete draft for review; body is `{ "version": n }`. |

Mutations require the normal authenticated session/CSRF protections. Each successful save stores one authenticated-encrypted payload envelope in PostgreSQL, advances `version`, updates the calculated section statuses, and writes an append-only profile event. The API will not return the full account number.

## Proposed canonical values

The canonical wire values are stable uppercase identifiers. The labels in the right column are the options currently displayed in the frontend. Send canonical IDs; the backend also accepts these exact labels for compatibility and normalizes recognized labels to canonical IDs before saving.

| Field | Canonical wire value | Existing UI label |
|---|---|---|
| `primaryInvestmentObjective` | `CAPITAL_PRESERVATION` | Capital preservation |
|  | `INCOME` | Income |
|  | `BALANCED` | Balanced |
|  | `GROWTH` | Growth |
| `riskTolerance` | `CONSERVATIVE` | Conservative |
|  | `MODERATE` | Moderate |
|  | `BALANCED` | Balanced |
|  | `AGGRESSIVE` | Aggressive |
| `investmentKnowledgeExperience` | `NONE` | None |
|  | `LIMITED` | Limited |
|  | `GOOD` | Good |
|  | `EXTENSIVE` | Extensive |
| `investmentHorizon` | `DAYS_180` | 180 days |
|  | `DAYS_365` | 365 days |
|  | `YEARS_1_TO_3` | 1–3 years |
|  | `YEARS_3_TO_5` | 3–5 years |
|  | `YEARS_5_PLUS` | 5 years + |
| `sourceOfFunds[]` | `SALARY_EMPLOYMENT` | Salary / employment |
|  | `BUSINESS_INCOME` | Business income |
|  | `SALE_OF_ASSETS` | Sale of assets |
|  | `INHERITANCE_GIFT` | Inheritance / gift |
|  | `SAVINGS` | Savings |
|  | `PENSION_RETIREMENT` | Pension / retirement |
|  | `INVESTMENT_PROCEEDS` | Investment proceeds |
|  | `OTHER` | Other (specify) |

When `OTHER` is selected, include a non-empty `otherSource` explanation. The API does not infer or validate the truth of the selected source.

The current frontend presents amounts with `₦`; `financialCurrency` is therefore proposed as `NGN`. Monetary request fields are **decimal digit strings in minor units (kobo)**, not floating-point JSON numbers: `expectedWithdrawalsMinor`, `annualIncomeMinor`, `estimatedNetWorthMinor`, and `expectedAnnualInflowMinor`. Convert the UI naira amount to kobo before sending (multiply by 100); use digits only.

The current frontend uses free-text inputs—not option lists—for `withdrawalFrequency`, `expectedTransactionFrequency`, and `accountType`. They remain bounded strings and are not restricted to invented catalogues. Management may later approve lists separately. Unknown values for controlled fields may be saved as a draft, but those fields do not satisfy `COMPLETE` until a recognized option is supplied.

## Field mapping by section

### Investment Profile

`PUT .../investment-profile` body fields: `version`, `primaryInvestmentObjective`, `riskTolerance`, `investmentHorizon`, `financialCurrency`, `investmentKnowledgeExperience`, `expectedWithdrawalsMinor`, `withdrawalFrequency`, `annualIncomeMinor`, `estimatedNetWorthMinor`, optional `investmentRestrictions`.

Example (synthetic values):

```json
{
  "version": 7,
  "primaryInvestmentObjective": "CAPITAL_PRESERVATION",
  "riskTolerance": "MODERATE",
  "investmentHorizon": "DAYS_180",
  "financialCurrency": "NGN",
  "investmentKnowledgeExperience": "GOOD",
  "expectedWithdrawalsMinor": "25000000",
  "withdrawalFrequency": "Every six months",
  "annualIncomeMinor": "12500000000",
  "estimatedNetWorthMinor": "25000000000",
  "investmentRestrictions": null
}
```

### Source of Funds

`PUT .../source-of-funds` body fields: `version`, `sourceOfFunds` (one or more canonical IDs), conditional `otherSource`, `expectedAnnualInflowMinor`, and free-text `expectedTransactionFrequency`.

```json
{
  "version": 8,
  "sourceOfFunds": ["SALARY_EMPLOYMENT", "OTHER"],
  "otherSource": "Synthetic additional source description",
  "expectedAnnualInflowMinor": "6000000000",
  "expectedTransactionFrequency": "About monthly"
}
```

### Bank Details

`PUT .../bank-details` body fields: `version`, `bankName`, `accountNumber` (exactly 10 NUBAN digits), `accountName`, free-text `accountType`, and `bvnLinkedToAccount` (boolean declaration only). Do not send a raw BVN or branch/sort code.

```json
{
  "version": 9,
  "bankName": "Synthetic Bank",
  "accountNumber": "0123456789",
  "accountName": "Synthetic Applicant",
  "accountType": "Current account",
  "bvnLinkedToAccount": true
}
```

On subsequent GET, `sections.bankDetails.accountNumberMasked` is returned (for example `******6789`); `accountNumber` is omitted. The account number is inside the encrypted payload at rest. BVN linkage is an unverified applicant declaration.

### Personal, document, and submission dependencies

Personal completion requires the valid required personal fields, conditional PEP details if `pepStatus` is `YES`, and an identity document matching `idDocumentType`. The existing upload completion stores the document as `UNDER_REVIEW` for manual review; it does **not** mark it scanned or accepted. This Individual KYC patch does not modify the AWS/S3 or reviewer workflows.

GET returns `sectionStatuses` (`NOT_STARTED`, `DRAFT`, or `COMPLETE`), `progression.nextSection`, and `progression.canSubmit`. The four sections become `COMPLETE` in sequence after server-side validation; completeness is not verification or approval. Refresh/sign-in should call GET again for the same authenticated user to rehydrate the encrypted saved data and statuses.

Submit only when `progression.canSubmit` is true. A successful submit returns `status: "SUBMITTED"`, a timestamp, and the incremented version. The profile status and `SUBMITTED` audit event are persisted; submission means **awaiting review**, not `UNDER_REVIEW` decision or `APPROVED`. Review/final approval remain a separate authorized workflow.
