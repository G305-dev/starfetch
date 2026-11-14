# Individual KYC secure-storage implementation — delivery notes

## Delivered in this backend worktree

- Owner-scoped Individual KYC profile/document services and existing-route protections remain in place (authenticated Investor, Individual `InvestorProfile`, profile versioning, DTO validation, rate limits, encrypted payload projection, and original submission/completion gates).
- Fail-closed S3-compatible private quarantine storage with short-lived presigned PUTs; conditional create/no-overwrite, provider versioning/capability probe, checksum, metadata, content-size/type, and SSE validation; API adapter has no `GetObject` operation.
- Separate Nigerian scanner worker path with exact object-version reads, byte hash/signature verification, in-memory ClamAV INSTREAM scanning, HMAC-authenticated worker endpoints, stored one-time nonce hashes, leases/one-time job tokens, immutable scan attestations, and retention/expiry deletion.
- Additive Prisma schema/migration and default-off environment gates. Scan `CLEAN` is not identity/KYC approval; no worker path can set a profile to verified/approved.
- Dedicated `Dockerfile.individual-kyc-scanner` and entrypoint for clamd plus worker. The target Nigerian deployment has not been selected or run.
- Setup, API, activation, security, testing, and operational guide: [`INDIVIDUAL_KYC_SECURE_DOCUMENTS.md`](INDIVIDUAL_KYC_SECURE_DOCUMENTS.md).

## Validation performed

- `npx prisma validate` — passed.
- `npx prisma generate` — passed using a placeholder PostgreSQL URL; no database connection.
- `npm run typecheck` — passed after implementation edits.
- Targeted KYC/scanner suite — 10 suites passed, 49 tests passed; 2 opt-in integration suites skipped.
- Full `npm test -- --runInBand` — 50 suites passed, 261 tests passed; 2 opt-in integration suites skipped (run before final lint-only cleanup; the post-cleanup targeted KYC/scanner suite also passed).
- `npm run build` — passed, including after final controller/worker-test changes.
- `npm run lint` — exits nonzero on 9 existing lint findings outside the new KYC/scanner implementation (`cookie-mutation.guard.ts`, joint guards/services, and existing joint e2e tests). The initial lint run also reported 5 KYC/scanner findings; these were fixed, and the remaining lint report contains no Individual KYC/scanner findings.

## Not run / not approved

- The opt-in real-clamd integration was not run because clamd/container runtime is not available in this environment. Mock protocol and fail-closed tests passed.
- The opt-in live S3-compatible provider probe was not run; no provider, bucket, region, or residency approval was inferred/selected. Do not run it against production or customer data.
- No migration was applied, no database was contacted, and no Neon/production/test database was used. No deployment, push, or merge was performed.
- No end-to-end flow against real Nigerian infrastructure was possible. Production activation remains disabled until all operational/legal approvals and provider capabilities are verified.

## Source baseline and archive exclusions

Based on the consolidated backend baseline corresponding to `G305-dev/starfetch` SHA `47e4bbbd25ad2f2abcfdff16f4c8b75d5708dabe`. The integrated ZIP excludes `.env`, dependency directories, build output, Git internals, and nested archives. It contains the backend source, migration, scanner image/entrypoint, package manifests, and documentation; dependencies should be installed with `npm ci` after extraction.
