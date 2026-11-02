# STARFETCH D-06 — Corporate Account Opening Frontend Update

**Status:** Frontend/backend synchronization record  
**Owner:** Emmanuel — Frontend / Investor Portal  
**Scope:** Corporate Account Opening, frontend-only three-step onboarding flow.

## Purpose

This record captures the proposed future backend data contract implied by the approved Corporate Account Opening frontend. No backend endpoint, persistence, validation, workflow automation, or submission behaviour is implemented by this frontend update.

## Frontend flow

The Corporate Account selection routes to `/register/corporate` and presents exactly three steps:

1. Corporate Applicant Details
2. Mandate Selection
3. Bank Details

The frontend preserves state only while the visitor moves through these steps. The Step 3 **Continue to Dashboard** control routes to `/dashboard` after local validation and does not send data to a backend.

## Proposed future field groups

### Corporate Applicant Details

| Frontend field | Proposed backend field | Frontend validation |
|---|---|---|
| Name of Institution | `institutionName` | Required |
| Date of Incorporation | `dateOfIncorporation` | Required; cannot be a future date |
| RC Number | `rcNumber` | Required |
| Tax Identification Number (TIN) | `taxIdentificationNumber` | Required |
| Business Phone Number | `businessPhoneNumber` | Required; basic phone format |
| Business Email | `businessEmail` | Required; email format |

### Mandate Selection

| Frontend field | Proposed backend field | Approved values |
|---|---|---|
| Mandate | `selectedMandate` | Starfetch Fixed Note; Discretionary Portfolio Management; Non-Discretionary Portfolio Management |

### Bank Details

| Frontend field | Proposed backend field | Frontend validation |
|---|---|---|
| Bank Name | `bankName` | Required |
| Account Number | `accountNumber` | Required; 6–20 numeric digits |
| Account Name | `accountName` | Required; 2–100 characters |
| Account Type | `accountType` | Required; Current, Savings, Corporate Current, or Other |
| BVN Linked to Account | `linkedBvn` | Required; 11 numeric digits |

## Backend impact

**Future backend impact: yes.** A later approved backend integration must define the endpoint, authentication, authorization, field validation, submission state, error envelope, and post-submission workflow before this form can submit data.

## Explicitly out of scope

This update does not approve or add directors/signatories, beneficial owners, document upload, declarations, PEP information, source-of-funds information, KYC APIs, payment APIs, or any other fields/workflows beyond the three approved steps.
