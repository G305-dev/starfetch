# AWS S3 OIDC smoke test — implementation and evidence report

## Outcome

**Prepared, but not run in Vercel.** There is no authenticated Vercel execution channel in this workspace and no deployed runtime evidence is available. Therefore role assumption, bucket access, object operations, and the deployed connection are **not confirmed**. No pass claim is made.

The temporary no-endpoint script is `scripts/individual-kyc-s3-oidc-smoke.mjs`, invoked with `npm run smoke:kyc-s3-oidc`. It uses the same `@vercel/oidc-aws-credentials-provider` package and existing `AWS_ROLE_ARN` used by the backend's Vercel AWS credential path. It performs STS caller-identity confirmation, versioning check, a five-minute presigned synthetic PDF PUT at a random key under only `individual-kyc/_capability-probe/`, initial `HeadObject` without `VersionId` and comparison to the PUT version, metadata/checksum/SSE validation, replay of the same conditional signed PUT, and exact-version deletion. Deletion verification calls `ListObjectVersions` with `Prefix` equal to the random synthetic object key, filters for exact key/version matches, and fails on any listing error (including 403); it never uses `HeadObject` 403 as deletion evidence. It does not perform a bucket-wide listing, download an object, or use customer data. Instructions are in `AWS_S3_OIDC_SMOKE_TEST.md`; the minimum IAM action amendment is in `AWS_S3_OIDC_IAM_AMENDMENT.md`.

No new dependency is needed for these corrections: `ListObjectVersionsCommand` is part of the existing `@aws-sdk/client-s3`. Retain the single direct `@aws-sdk/client-sts` addition from the prior preparation for exact caller-identity verification; the existing S3 presigner and Vercel OIDC provider are reused. The smoke command is not wired to app startup, production request handlers, or the regular build script. The arming variables are required and the build command must be changed temporarily by an authorized Vercel operator.

## Local checks performed

| Check | Result |
|---|---|
| `npx eslint scripts/individual-kyc-s3-oidc-smoke.mjs` | Passed |
| `node --check scripts/individual-kyc-s3-oidc-smoke.mjs` | Passed |
| `npm run smoke:kyc-s3-oidc` without Vercel/arming context | Expected safe refusal; exit 1 before AWS calls, output only `{"result":"FAIL","errorCode":"Error"}` |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `npm test -- --runInBand src/modules/individual-kyc/individual-kyc-s3-storage.spec.ts` | Passed; 5 tests |
| `npm test -- --runInBand` | 50 suites passed; 261 tests passed; 2 opt-in integration suites skipped |

The expected refusal is not evidence of AWS connectivity. It verifies that an unarmed/local invocation does not continue to network operations.

## Requires actual authorized Vercel production execution

Not completed in this workspace:

- Issuing/validating the Vercel OIDC token against live AWS trust policy and confirming exact assumed role with STS.
- S3 bucket versioning status for `starfetch-kyc-dev-2026-01`.
- Synthetic signed upload, checksum/metadata verification, conditional replay rejection, and exact-version deletion.
- Cleanup confirmation and review of sanitized Vercel build log evidence.
- Confirmation that the production project actually runs the intended credential provider version and has expected environment values.

No AWS credentials were created. No S3 bucket or key was contacted. No Vercel setting, deployment, GitHub push/merge, KYC feature gate, residency flag, compliance approval, Corporate KMS permission, authentication behavior, or KYC security gate was changed for the test.
