# Individual Profile Sequential Progression — Change Package

This package contains the frontend changes from the latest Individual Profile section-progression task.

## Included behavior

- Only the active Individual Profile form is displayed.
- The flow starts with Personal Information, including the PEP Declaration.
- Investment Profile unlocks after Personal Information is completed.
- Source of Funds unlocks after Investment Profile is completed.
- Bank Details unlocks after Source of Funds is completed.
- All relevant visible fields are required to progress; conditional details are required only when applicable.
- Earlier completed sections remain available for review and editing.
- Editing an earlier section relocks dependent later sections.
- The progression is in-memory for the current page only and resets on refresh or exit.

## Included files

- `components/portal/IndividualProfileContent.tsx`
- `scripts/individual-profile-section-progression-check.ts`
- `scripts/individual-profile-local-kyc-draft-check.ts`
- `scripts/individual-profile-pep-declaration-draft-check.ts`
- `package.json`

## Validation completed

- TypeScript typecheck passed.
- Sequential progression and all relevant Individual Profile source-level checks passed.
- Production build passed with 43 static routes generated.

## Boundary retained

Completing a current-page section does not submit the local KYC, PEP, investment-profile, source-of-funds, or Bank Details drafts. It also does not confirm backend KYC completion.
