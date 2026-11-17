# Individual KYC Frontend Integration — Change Package

This is a **frontend-only** patch for the supplied `individual-kyc-api-field-mapping.md`. It implements that document as a proposed contract; it does not confirm that the routes are deployed or make backend changes.

## Included

- Owner-scoped, authenticated KYC client methods for GET, the four section saves, submission, and the document upload intent/completion flow. Mutations send the current version; a conflict reloads server progress. No owner ID is sent.
- Server-side profile rehydration for Personal Information/PEP, Investment Profile, Source of Funds, and Bank Details. There is no KYC draft persistence in `localStorage` or `sessionStorage`.
- Canonical option mappings and exact digit-string Naira-to-kobo conversions.
- The existing Individual Profile visual treatment with sequential section progress, simplified errors, and a redesigned progress summary in place of a large saved-status panel.
- An awaiting-review screen after `SUBMITTED`. It says the application is awaiting review and does not imply identity verification, approval, suitability approval, or AML/CFT clearance.
- Read-only account-managed first/last name and email; editable phone remains on the existing account-profile route. KYC values and bank details use KYC routes only. Bank submission sends no raw BVN, branch, or sort code; the saved bank account number is never rehydrated from a masked response.
- Mocked API, mapping, and section checks.

## Contract points to confirm before connecting to a backend

The supplied mapping calls the contract **proposed**. No live backend call was made. In particular, confirm the GET envelope/empty-profile behavior, the Personal/PEP payload shape, and the document-upload intent, signed-upload, and completion routes and responses. The mapping's route table does not fully specify the upload routes, and the upload flow in this patch is an assumption. Confirm the 10 MiB frontend limit and accepted file types against the existing storage workflow as well.

The frontend treats a successful submit response of `SUBMITTED` as **submitted and awaiting review**. It does not interpret that value as a distinct `UNDER_REVIEW` decision or approval. The upload UI likewise says upload completion is not document acceptance or KYC approval.

## Files in the archive

- `components/portal/IndividualProfileContent.tsx`
- `components/portal/BankDetailsDraft.tsx`
- `components/portal/InvestmentObjectiveRiskProfileDraft.tsx`
- `components/portal/PepDeclarationDraft.tsx`
- `components/portal/SourceOfFundsDraft.tsx`
- `lib/api/client.ts`
- `lib/individual-kyc-mapping.ts`
- `package.json`
- `scripts/individual-kyc-api-contract-check.ts`
- `scripts/individual-kyc-api-mapping-check.ts`
- `scripts/individual-profile-bank-details-draft-check.ts`
- `scripts/individual-profile-local-kyc-draft-check.ts`
- `scripts/individual-profile-pep-declaration-draft-check.ts`
- `scripts/individual-profile-section-progression-check.ts`
- `scripts/individual-profile-source-of-funds-draft-check.ts`
- `scripts/investment-objective-risk-profile-draft-check.ts`
- `scripts/run-typescript-check.cjs` (test runner used by the package scripts)
- This README

## Apply and validate

Overlay the files at their matching paths in the frontend project. If the target branch's `package.json` differs, merge the included test scripts rather than replacing unrelated project scripts. No new npm dependencies are introduced; `package-lock.json` is not part of this patch.

Run from the frontend project root:

```bash
npm ci
npm run typecheck
npm run test:individual-kyc-integration
npm run build
```

These checks passed in the packaged workspace. The integration tests use mocked responses and static assertions; they are not live API verification. `npm ci` reported 3 audit findings (2 high, 1 critical); this patch does not change dependencies or attempt an audit fix.

## Change boundary

No backend files, Git push, merge, or deployment are included. The backend contract and deployment must be coordinated separately before the frontend is treated as live-integrated.
