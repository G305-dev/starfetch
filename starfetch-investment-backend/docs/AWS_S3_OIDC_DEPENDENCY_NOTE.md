# Dependency delta for corrected S3 OIDC smoke test

No new dependency was introduced for the requested corrections.

- `ListObjectVersionsCommand` comes from the existing `@aws-sdk/client-s3` dependency.
- The script reuses existing `@aws-sdk/s3-request-presigner` and `@vercel/oidc-aws-credentials-provider`.
- Retain the single direct `@aws-sdk/client-sts` dependency (`^3.1169.0`) from the prior smoke-test preparation for `GetCallerIdentity` verification.
- The existing `smoke:kyc-s3-oidc` package script is unchanged by this correction.

No package or lockfile edit is needed when applying only this correction on top of the previously prepared worktree.
