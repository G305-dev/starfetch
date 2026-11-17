# Temporary Vercel → AWS S3 OIDC smoke job

## What is prepared

`scripts/individual-kyc-s3-oidc-smoke.mjs` is a one-off **build-process script**, not an API route. It uses the already installed `@vercel/oidc-aws-credentials-provider`, the existing `AWS_ROLE_ARN`, and AWS SDK v3. It requests only STS `GetCallerIdentity`, bucket versioning, a synthetic `PutObject`/`HeadObject`, a conditional replay, exact-version `DeleteObject`, and `ListObjectVersions` with `Prefix` set to that run's exact random synthetic key for deletion verification. It never performs a bucket-wide listing, `GetObject`, or touches customer objects. The only additional IAM action required for deletion verification is detailed in [`AWS_S3_OIDC_IAM_AMENDMENT.md`](AWS_S3_OIDC_IAM_AMENDMENT.md). Its only object key is a random UUID below the hard-coded `individual-kyc/_capability-probe/` prefix in `starfetch-kyc-dev-2026-01` (`eu-west-1`).

It is not imported by the application or any request path. The command is `npm run smoke:kyc-s3-oidc`. The script refuses to run unless explicitly armed, in Vercel production context, with the expected issuer and exact project/environment subject, the existing expected role name, no static AWS access keys, and the KYC storage/upload/scanner feature flags not true. It does not read or write residency/compliance approval flags. It does not alter them.

A successful JSON output contains only step statuses. Failures output a sanitized AWS error code/status and do not print the account ID, role ARN, token, credentials, key, bytes, provider response body, or bucket listing. Synthetic bytes are wiped from memory and the script attempts cleanup even if a step fails. If cleanup is denied or a response is lost, the report says cleanup failed/incomplete; do not claim a clean result. S3 lifecycle cleanup for this unique prefix can be a fallback only if approved and verified.

## One-time production build procedure (operator action required)

No Vercel execution or deployment has been performed from this workspace, and this worktree has not been pushed or merged. The script must be present in an authorized Vercel build source before this procedure can run. Do not push or merge it to satisfy the smoke test; if no approved way exists to make the prepared code available to a one-off build under that constraint, leave the test unrun and report that limitation.

1. Confirm Vercel OIDC is enabled for team `seyii`; inspect the AWS role trust policy for the intended provider, audience, and subject conditions. The diagnostic verifies token `iss=https://oidc.vercel.com/seyii`, `sub=owner:seyii:project:starfetch-api:environment:production`, then STS confirms that the caller is an assumed session for `StarfetchCorporateO2VercelProductionRole` in the ARN's account. AWS remains the authority that validates token signature, audience, issuer trust, and role trust.
2. Review the IAM policy before execution. The only new action needed for the corrected deletion check is `s3:ListBucketVersions` on the bucket ARN with `s3:prefix` restricted to `individual-kyc/_capability-probe/*`; see [`AWS_S3_OIDC_IAM_AMENDMENT.md`](AWS_S3_OIDC_IAM_AMENDMENT.md). Existing permissions must already cover the stated synthetic-prefix object operations and bucket-level `GetBucketVersioning`. The diagnostic can fail if the existing role does not actually have those permissions. Do not expand Corporate KMS permissions or broaden the role just to make the test pass.
3. In Vercel production environment variables, add the temporary one-run arming values `STARFETCH_S3_OIDC_SMOKE_RUN=true` and `STARFETCH_S3_OIDC_SMOKE_CONFIRM=starfetch-api-production-one-off`. Do not set or change `INDIVIDUAL_KYC_DATA_RESIDENCY_APPROVED`, storage approval flags, retention flags, or any KYC enablement flags. The script aborts if storage, upload, or scanner flags are `true`.
4. Save the current Vercel Build Command. For one production build only, use:

   ```sh
   npm run build && npm run smoke:kyc-s3-oidc
   ```

   Vercel supports OIDC tokens in both builds and Functions; using the build phase avoids adding a public HTTP endpoint. The OIDC provider used here exchanges the Vercel token for temporary AWS role credentials. Trigger a build only if the script is already available through an approved source mechanism that does not violate the no-push/no-merge constraint. This workspace has not made the change available to Vercel; if the only route requires a GitHub push/merge or unapproved deployment, stop without running it. A failed smoke command fails that build, so coordinate any permitted test window and release owner.
5. Capture the sanitized build log JSON as the report. If it passes, it proves that this Vercel production build context assumed the expected role and completed these exact synthetic-prefix S3 operations at that time. It does **not** prove data residency, compliance approval, access to real documents, or that KYC upload/scanner features are approved. If it fails, record only step/status and sanitized error code; investigate the trust or least-privilege policy with the AWS/Vercel owner.
6. Immediately restore the saved Build Command and remove the two temporary arming variables, regardless of pass/fail. Confirm the normal build command is restored. Do not leave the smoke script armed for future production builds. No code push/merge is required to run the prepared script if it is already present in the authorized build revision; this workspace has not been pushed or deployed.

The Vercel build execution context is the no-endpoint option. If the owner specifically requires proof from an already-running serverless Function rather than its production build context, the platform must provide an approved private invocation mechanism; this implementation intentionally does not create a route or public diagnostic endpoint.

## Expected report fields

The script reports `runtimeGuard`, `roleAssumption`, `bucketVersioning`, `syntheticPut`, `metadataChecksum`, `conditionalReplayRejected`, `exactVersionDelete`, `cleanup`, and overall `result`. `PASS` is not recorded here because the actual Vercel build must run the command and produce evidence. Local guard check was run without arming variables and failed closed before any AWS call.

## Local check performed

```sh
npm run smoke:kyc-s3-oidc
```

It exited nonzero with the sanitized guard failure `{"result":"FAIL","errorCode":"Error"}` because no Vercel production/OIDC context or one-run confirmation was available. No network call, role assumption, AWS account access, bucket access, or object operation occurred locally.

## References

- [Vercel OIDC Federation Reference](https://vercel.com/docs/oidc/reference) — documents AWS credentials provider, STS role assumption, and token claim formats.
- [Connect to Amazon Web Services (AWS)](https://vercel.com/docs/oidc/aws) — documents the AWS role and provider usage.
