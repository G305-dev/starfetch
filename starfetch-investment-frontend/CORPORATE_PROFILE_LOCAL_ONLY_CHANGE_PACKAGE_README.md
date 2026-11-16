# Corporate Profile — Local-Only Form Preview

**Date:** 22 October 2026  
**Status:** Corporate Profile forms are for in-session review only; there is no profile API read, save, submission, or browser-storage persistence.

## What changed

- The Company Profile page now opens the four requested sections for an authenticated applicant without calling `GET /me/corporate-profile`.
- The sections remain sequential. Client-side required-field validation unlocks the next section for the current page session only. Revising an earlier section clears completion for it and all dependent later sections.
- Account-managed Company Name, Company Phone Number, and Account Email remain read-only. Company name/phone are shown if present in the authenticated user projection; when absent they are shown as unavailable rather than inferred or invented.
- Profile form values live only in React component memory. They are not sent to a backend, localStorage, or sessionStorage and are cleared on page refresh, leaving the page, logout, or changing accounts.
- The controls say “Validate & continue” and “Mark complete for this session.” There is no Save draft or Submit action. Completion does not imply KYC/KYB verification or approval.
- Bank Details do not include Branch/sort code or a raw BVN number. A Yes/No declaration asks only whether the account is BVN-linked.
- Added a compatibility replacement at `scripts/corporate-profile-api-check.ts`. Some existing branches still contain the former API test, and Next.js typechecks all included `.ts` files even when a script is no longer run. The replacement delegates to the current local-only check and does not import removed profile API functions.

## Validation

- `npm run typecheck`
- `npm run test:corporate-profile`
- `node scripts/run-typescript-check.cjs scripts/corporate-profile-api-check.ts` (legacy-file build-fix check)
- `npm run test:corporate-registration`
- `npm run test:corporate-verification`
- `npm run test:corporate-api`
- `npm run test:general-corporate-login`
- `npm run test:corporate-post-login-routing`
- `npm run test:kyc-dashboard-prompt`
- `npm run build`
- Live preview checks for `/corporate/profile` and `/register/corporate`

## Backend boundary

The existing shared authentication and registration requests are separate from the Corporate Profile form. The Corporate Profile component itself performs no profile API calls. The previous `CORPORATE_PROFILE_PERSISTENCE_BACKEND_REPORT_FOR_SEGUN.md` is retained as a possible future integration specification only; it does not describe the current frontend behavior. No backend code, migration, deployment, Git push, or merge was performed.
