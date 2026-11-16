Starfetch — Individual Profile Original Layout Restore

Apply
Copy components/portal/IndividualProfileContent.tsx from this archive over the same path in the frontend project.

What is included
- Restores the original horizontal section progress and form-first profile layout.
- Keeps main's existing Individual KYC status, personal-save, and secure-upload integrations.
- Leaves out the obsolete Additional onboarding notice and standalone Documents placeholder.
- Contains no backend changes. The existing API client and matching structured PEP component from main are required.

Validation
The TSX syntax was checked and no merge-conflict markers remain. A full build was not run against this workspace because main's KYC API exports are not present here.
