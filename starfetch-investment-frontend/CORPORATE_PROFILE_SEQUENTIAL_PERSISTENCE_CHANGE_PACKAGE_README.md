# Corporate Profile Sequential Persistence — Change Package

**Date:** 22 October 2026  
**Status:** Frontend implementation aligned to a proposed backend contract; backend work remains with Segun.

## Included changes

- Corporate account creation now captures company name and company phone number in addition to email/password. Password confirmation remains frontend-only. Company identity is not editable from Corporate Profile.
- Corporate Profile now has four sequential sections:
  1. Account-managed Company Name, Company Phone Number, and Email (read-only), followed by RC Number, Date of Incorporation, TIN, Registered Address, City, and State.
  2. Investment Objective and Risk Profile, with the provided Corporate form options and liquidity/restrictions fields.
  3. Source of Funds, conditional Other details, expected annual inflow, and transaction frequency.
  4. Bank Details, with bank/account fields and a BVN-linked confirmation only.
- Later sections unlock only after a backend response marks the preceding section `COMPLETE`. Draft saves remain on the current section. Unsaved earlier-section edits block forward navigation. Backend section states are authoritative and can relock dependent sections after an earlier change.
- Corporate Profile uses authenticated owner-scoped `GET /me/corporate-profile` and versioned, CSRF-protected `PUT` section endpoints. TIN/account numbers are write-only on submission and masked on read. No raw BVN, Branch, or sort-code field is included.
- The profile UI fails closed if the authenticated backend profile cannot be loaded. It does not seed local/sample company data or use browser storage as persistence.

## Backend handoff

`CORPORATE_PROFILE_PERSISTENCE_BACKEND_REPORT_FOR_SEGUN.md` describes the proposed registration schema, database ownership model, API request/response contracts, section-order/invalidation rules, security requirements, and acceptance tests.

**Backend dependency:** the currently approved Corporate registration API accepts only `registrationType`, email, and password. It must be updated to accept/persist the new Company Name and Company Phone fields, and the four owner-scoped Corporate Profile routes must be implemented before the frontend can save or display these sections for a live account. No backend code, database migration, Git push, merge, or deployment was performed in this package.

## Validation

- `npm run typecheck` — passed.
- `npm run test:corporate-profile` — passed (API transport/security and sequential-flow checks).
- `npm run test:corporate-registration` — passed.
- `npm run test:corporate-verification` — passed.
- `npm run test:corporate-api` — passed.
- `npm run test:general-corporate-login` — passed.
- `npm run test:corporate-post-login-routing` — passed.
- `npm run test:kyc-dashboard-prompt` — passed.
- `npm run build` — passed; 43 static routes generated.
- Live preview routes `/register/corporate` and `/corporate/profile` returned HTTP 200. No real backend integration was available/modified for this work.

## Package contents

- `components/auth/CorporateApplicantRegistrationForm.tsx`
- `components/corporate/CorporateProfileContent.tsx`
- `lib/api/client.ts`
- `lib/corporate/profile.ts`
- `scripts/corporate-applicant-registration-check.ts`
- `scripts/corporate-profile-api-check.ts`
- `scripts/corporate-profile-sequential-check.ts`
- `package.json`
- `CORPORATE_PROFILE_PERSISTENCE_BACKEND_REPORT_FOR_SEGUN.md`
- This README
