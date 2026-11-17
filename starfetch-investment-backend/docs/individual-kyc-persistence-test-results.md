# Individual KYC persistence delivery and verification

**Baseline:** `G305-dev/starfetch` `main` at `7baea41f93254a0e93ffa01cd6ba48ccc0e79e8a` (includes the previously merged document-completion trigger fix).

## Implemented

- Replaced empty completeness catalogues with proposed canonical IDs mapped to the exact existing frontend choices for objective, risk tolerance, investment knowledge, source of funds, horizon, and `NGN`.
- Normalizes UI labels to canonical values before encryption/persistence; accepts canonical IDs as well. Unknown controlled choices may still be saved as drafts but cannot pass completion.
- Keeps withdrawal frequency, transaction frequency, and account type as bounded text because the current frontend provides text inputs, not choice catalogues.
- Preserves owner-scoped encrypted profile writes, NUBAN masking, section-version/audit events, GET rehydration, and the existing submit transition to `SUBMITTED`; approval fields remain unset.
- Added focused service/contract tests and a rollback-only local PostgreSQL integration test for save, encrypted persistence, reload/status calculation, audit, and submission. No frontend/AWS/scanner/manual-review implementation was changed.

## Verification results

- `npm run typecheck` — passed.
- `npm run build` — passed.
- Prisma schema validation — passed; no schema or migration change was needed.
- `npx jest --runInBand src/modules/individual-kyc` — **9 suites passed, 50 tests passed; 1 optional external-provider probe skipped**.
- `npx jest --config ./test/jest-e2e.json --runInBand test/individual-kyc-persistence.e2e-spec.ts test/individual-kyc-document-completion.e2e-spec.ts` — **2 database suites / 4 tests skipped** because opt-in was not enabled and no isolated PostgreSQL service was available. The E2E suite is fused to loopback `starfetch_test` / `starfetch_test_role` and rolls back its fixture; it must be run against that isolated test target to claim PostgreSQL execution.

No database was contacted or changed. No push or deployment was performed. The proposed field catalogues remain subject to management review and do not represent suitability, AML/CFT, identity verification, or compliance approval.
