Starfetch — KYC “Maybe later” popup patch

Contents
- components/auth/KycCompletionPrompt.tsx
- scripts/kyc-dashboard-prompt-check.ts

Apply
Copy the two included files into the matching paths in the frontend project, keeping the directory structure.

Behavior
The Individual and Corporate KYC prompt shows “Complete KYC” beside “Maybe later”. “Maybe later” hides the prompt for the current component visit only; it does not use local/session storage or mark KYC complete. The prompt appears again after refresh or a fresh dashboard mount until an approved backend completion signal is available.

Validation completed in the workspace
- npm run typecheck
- npm run test:kyc-dashboard-prompt
- npm run build

No backend, deployment, or Git push is included in this patch.
