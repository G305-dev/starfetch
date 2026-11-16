Starfetch — Individual Profile UI Redesign Patch

Files included
- components/portal/IndividualProfileContent.tsx — profile overview card, responsive progress panel, and removal of the Additional onboarding/Documents placeholder.
- scripts/individual-profile-section-progression-check.ts — verifies the new layout while preserving sequential section behavior.

Apply
Copy both files into the matching paths in the frontend project, keeping the directory structure.

Scope
This is a frontend-only patch. The current profile fields, validation, sequential progression, and local-only KYC draft behavior are preserved. The existing phone profile update call is unchanged. No backend, API client, deployment, or Git changes are included.

Validation completed in the workspace
- TypeScript check
- Individual Profile KYC and section progression checks
- Investment Profile, Bank Details, PEP, and Source of Funds checks
- Next.js production build
