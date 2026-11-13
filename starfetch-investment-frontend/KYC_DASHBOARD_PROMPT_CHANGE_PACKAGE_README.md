# KYC Dashboard Prompt Change Package

This ZIP contains the frontend files for the required KYC completion reminder that appears after an authenticated user enters the investment dashboard.

## Included journeys

- **Individual Investor:** `/dashboard` shows the KYC prompt with the only action linking to `/profile`.
- **Corporate Applicant:** `/corporate/dashboard` shows the KYC prompt with the only action linking to `/corporate/profile`.

## Included files

- `components/auth/KycCompletionPrompt.tsx` — accessible modal and approved profile destinations.
- `app/dashboard/page.tsx` — Individual dashboard integration.
- `app/corporate/dashboard/page.tsx` — Corporate dashboard integration.
- `scripts/kyc-dashboard-prompt-check.ts` — source-level regression check for the required modal, links, protected dashboard placement, and no-dismiss/no-browser-storage boundary.
- `package.json` — test command registration.
- `KYC_DASHBOARD_PROMPT_BACKEND_HANDOFF_FOR_SEGUN.md` — backend contract and QA handoff report for the server-side approved completion signal.

## Current behaviour

Because the backend has not yet provided an approved KYC-completion signal, the reminder is rendered on fresh authenticated dashboard entry. The handoff report specifies the backend signal required to hide it only when the backend confirms `COMPLETE`.

## Safety boundaries

- No KYC completion status is stored in browser persistence.
- There is no dismiss, close, or “Not now” action.
- The popup does not submit data or create an investment, booking, funding request, enquiry, account approval, or Corporate authorization.
- No backend files are included or changed by this package.
