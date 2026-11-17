# Individual KYC Prompt — Change Package

## What changed

On the **Individual dashboard (`/dashboard`)**, after login, a **"Complete your KYC"** popup now appears **only when KYC has not been submitted yet**.

- **Not submitted** (`DRAFT`, `REJECTED`, `INFO_REQUIRED`, `INFO_REQUESTED`, or status unknown) → popup shows with two options:
  - **Complete KYC** → goes to `/profile` (the Individual KYC form)
  - **Maybe Later** → closes the popup for this dashboard visit
- **Submitted** (`SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `COMPLETE`) → popup **never shows** after login.

## Included files

- `lib/individual-kyc-prompt.ts` — pure frontend rules: `hasSubmittedIndividualKyc()`, `shouldShowIndividualKycPrompt()`, `isKycNeedsAttention()`, `completedKycSectionCount()`.
- `components/portal/IndividualKycPrompt.tsx` — accessible modal (`role="dialog"`, `aria-modal="true"`), focus on "Complete KYC", Escape / "Maybe Later" dismisses, background scroll lock, progress hint ("You've completed X of 4 sections…").
- `app/dashboard/page.tsx` — renders `<IndividualKycPrompt />` inside the existing `RequireIndividualAuth` boundary on `/dashboard`.
- `scripts/individual-kyc-prompt-check.ts` — regression check for the submitted/not-submitted rules, popup copy/actions, dashboard integration, and no-browser-storage boundary.
- `package.json` — adds `npm run test:individual-kyc-prompt`.

## Behaviour details

- Status source: existing authenticated `GET /api/v1/me/kyc-profile` via `getIndividualKycProfile()` in `lib/api/client.ts`. No new backend endpoint is needed.
- "Maybe Later" is **in-memory only** (no `localStorage`/`sessionStorage`/cookies). Refreshing the page or signing in again shows the popup again until KYC is submitted.
- If the KYC status cannot be loaded (network/API error), the popup **fails closed** and shows with generic copy — it never assumes KYC is submitted.
- If KYC was submitted but later needs attention (`REJECTED` / `INFO_REQUIRED` / `INFO_REQUESTED`), the popup shows again with "Your KYC needs attention…" copy.
- The popup does not submit KYC data, create an investment, or change any account state. It only routes to `/profile`.
- Scope is **Individual only** (`/dashboard`). Corporate (`/corporate/dashboard`) and Joint dashboards are untouched.

## How to verify

```bash
npm install
npm run typecheck
npm run test:individual-kyc-prompt
npm run build
```

Manual QA:

1. Sign in as Individual with KYC `DRAFT` → `/dashboard` shows the popup. **Complete KYC** goes to `/profile`. **Maybe Later** closes it. Refresh → popup shows again.
2. Sign in as Individual with KYC `SUBMITTED` (or `UNDER_REVIEW` / `APPROVED` / `COMPLETE`) → `/dashboard` loads with **no popup**.
3. Sign in with KYC `REJECTED` / `INFO_REQUIRED` → popup shows with the "needs attention" copy.

## Safety boundaries

- Frontend only. No backend files changed.
- No KYC answers, documents, or sensitive values are read by the popup — only the workflow `status` and section completion counts.
- No browser persistence of dismissal or KYC status.
