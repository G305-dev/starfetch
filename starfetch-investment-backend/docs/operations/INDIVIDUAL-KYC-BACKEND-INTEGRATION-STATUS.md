# Individual KYC backend integration — implementation status

**Repository:** `G305-dev/starfetch`, backend only  
**Preserved implementation baseline:** `Starfetch-KYC-Completion-Full-Backend.zip`  
**Changed-files comparison base:** GitHub `main` snapshot `47e4bbbd25ad2f2abcfdff16f4c8b75d5708dabe`  
**Scope:** owner-scoped Individual KYC profile persistence, four partial-save sections, lifecycle/submission API, private-document ports and fail-closed behavior. No frontend changes.

## Implemented in this worktree

- Prisma Individual KYC profile, section/lifecycle/document enums, document metadata and append-only audit models, owner-scoped composite relations and migration. The migration defines triggers for version increments, immutable ownership/event records, applicant-only DRAFT→SUBMITTED transition, and denial of review/approval events through this route; the SQL remains unapplied because the requested local database could not be verified.
- Dedicated KMS envelope-encryption provider with purpose-separated context, owner/profile-bound authenticated encryption, a separate Individual KYC key ID/version, and no Corporate TIN key fallback. A fail-closed residency-approval setting blocks production payload encryption/decryption until region/transfer approval is explicit.
- Authenticated, session-aware, CSRF-guarded, role/profile-scoped APIs at the v1 paths documented in `docs/api/INDIVIDUAL-KYC-PERSISTENCE-v1.md`. Owner always comes from the validated principal. Corporate `INVESTOR` accounts without `InvestorProfile` are denied.
- Partial validation/merge behavior, version conflicts, sequential server-calculated progression, bank-account masking, PEP conditional handling, all five stable horizon codes, report-correct annual-income/net-worth mapping to Investment Profile, legacy encrypted-draft normalization, document metadata, and submission checks. Existing `/me` completion logic was not changed: Individual remains REQUIRED until a genuine, authorized current approval source exists; Corporate and Mono behavior are unchanged.
- Private storage/scanner interfaces with production bindings to disabled adapters. Actual upload intent and document acceptance remain unavailable absent approved encrypted private storage and a real scanner. Test-only memory storage and synthetic marker scanner refuse non-test environments.
- Added focused unit tests for DTO boundaries, calculation policy, encryption, document lifecycle, owner/Corporate exclusion, masking, stale versions and incomplete submission.

## Deliberate fail-closed blockers

1. The report provides no approved dropdown lists for investment objective, risk tolerance, knowledge/experience, source of funds, bank account type, withdrawal frequency, expected transaction frequency, or financial currency. Bounded drafts may be saved, but empty allowlists keep the relevant section-completion gates closed. Management must also supply required/optional fields and amount bounds. The API contract lists each decision explicitly; no options or NGN default are fabricated.
2. `INDIVIDUAL_KYC_DATA_RESIDENCY_APPROVED` defaults to `false`; dedicated KMS key ID/version must be set separately from Corporate. Until residency/transfer and key-region approvals are recorded, production payload encryption/decryption returns `503 FEATURE_UNAVAILABLE`.
3. Production upload and scan adapters are disabled. Enablement requires approved regional private encrypted quarantine storage, short-lived/single-use signed upload, content/type/size validation, a real malware scanner, and retention/expiry/delete operations. No public bucket, production fake scanner, or Vercel disk is used.
4. No staff review or approval writer exists; database guards deny lifecycle transitions beyond applicant submission. No fabricated decision or `COMPLETE` status is possible.

These gates mean the API integration is implemented but **not production-ready for real customer KYC submission or document collection**. Track the required decisions/dependencies before promoting any runtime flags or providers.

## Checks run

- Prisma schema validation: pass.
- Prisma Client generation: pass.
- Consolidated patch applied to the clean GitHub-main snapshot: full unit tests pass (45 suites, 230 tests, including the preserved `/me` completion suite and 5 Individual KYC suites). The implementation worktree's broader baseline also passed 46 suites / 237 tests.
- Typecheck: pass (`npm run typecheck`).
- Build: pass (`npm run build`).
- Targeted ESLint: pass for changed application/configuration and Individual KYC TypeScript files.
- Requested local PostgreSQL verification: `127.0.0.1:5433` refused the TCP connection; `psql`/`pg_isready` were unavailable. Database identity/isolation could not be confirmed, so migration and migration-backed/E2E tests were not run. No Neon, shared or production database was accessed.

## Delivery controls

- Worktree only; no push, merge, deploy, production DB, or frontend edits.
- No `.env`, credentials, customer data or real document content added.
- Prepared one consolidated GitHub-main-relative archive: `Starfetch-Individual-KYC-Consolidated-Changed-Files.zip` (33 added/modified backend files, including the prior unpushed `/api/v1/me` completion patch). It excludes `.env`, credentials, `node_modules`, build artifacts, and customer data; archive integrity passed. The authoritative source baseline ZIP remains unchanged.
