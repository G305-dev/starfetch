# Minimal IAM amendment for the one-off S3 OIDC smoke test

**Do not apply from this workspace.** An AWS administrator should review and approve this one action addition on the existing `StarfetchCorporateO2VercelProductionRole` only if the current role lacks it. Do not alter the OIDC trust policy, Corporate KMS permissions, authentication, KYC gates, or other statements.

`ListObjectVersionsCommand` needs `s3:ListBucketVersions` on the bucket resource. The smoke script sends `Prefix` equal to its random synthetic key, which is always under `individual-kyc/_capability-probe/`; it then filters results by exact key and version ID. The condition limits this listing permission to that path. AWS documents that `s3:ListBucketVersions` supports `s3:prefix` and that the API `Prefix` selects keys starting with the supplied value.

Add only this statement to the existing identity policy (or approved bucket policy), substituting no wider bucket or prefix:

```json
{
  "Sid": "AllowListVersionsForIndividualKycOidcSmokePrefix",
  "Effect": "Allow",
  "Action": "s3:ListBucketVersions",
  "Resource": "arn:aws:s3:::starfetch-kyc-dev-2026-01",
  "Condition": {
    "StringLike": {
      "s3:prefix": "individual-kyc/_capability-probe/*"
    }
  }
}
```

Do **not** add `s3:ListBucket`, wildcard resources, or permissions for other prefixes. The smoke operation also relies on the role's already-existing narrowly scoped object permissions for signed `PutObject` with `If-None-Match`, `HeadObject`/checksum metadata, and `DeleteObjectVersion`. This amendment intentionally adds no object permission. If those existing object permissions are absent, stop and review separately rather than broadening this amendment.

Before execution, verify the role's effective permissions and any bucket-policy explicit denies. After the one-off test, remove this statement if the listing capability is not otherwise approved/needed, and confirm removal. This workspace has not changed AWS policy.

References:

- [AWS S3 policy condition keys](https://docs.aws.amazon.com/AmazonS3/latest/userguide/amazon-s3-policy-keys.html) — `s3:prefix` can restrict `s3:ListBucketVersions`.
- [AWS ListObjectVersions API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectVersions.html) — `Prefix` narrows the version listing request.
