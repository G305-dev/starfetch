# Corporate KYC documents: production storage configuration and release gates

**Status: NOT production-ready.** Do not describe Corporate document upload as live or production-ready until **all** of the following are true:

1. the backend PR is merged
2. the Corporate migration `20261119120000_corporate_kyc_documents_submission` is applied to production
3. Vercel production is redeployed with the configuration below
4. a real, authenticated Corporate upload **and** view test passes in production (section 6)

Nothing in this document has been applied to AWS or Vercel from the development workspace.

The scope remains exactly three mandatory documents: `CERTIFICATE_OF_INCORPORATION`, `MEMART`, `TIN_CERTIFICATE`.

## 1. What is reused (nothing new is created)

| Item | Value | Source |
|---|---|---|
| Storage adapter | `S3CompatibleIndividualKycDocumentStorage` (existing class) | `src/modules/individual-kyc/individual-kyc-s3-storage.ts` |
| Bucket | `starfetch-kyc-prod-2026-01` (existing) | `INDIVIDUAL_KYC_S3_BUCKET` |
| Region | `eu-west-1` | `INDIVIDUAL_KYC_S3_REGION` |
| Object prefix | `onboarding-documents/` | Hard-coded and checked by a DB constraint: key = `onboarding-documents/<document UUID>` |
| Credentials | Vercel OIDC → `StarfetchCorporateO2VercelProductionRole` (existing) | `AWS_ROLE_ARN` + `INDIVIDUAL_KYC_S3_CREDENTIAL_REFERENCE=workload-identity` |

- No new bucket, AWS credential or environment variable is introduced.
- Static AWS keys are rejected at startup.

**Corporate uses its own adapter instance** (`CORPORATE_KYC_DOCUMENT_STORAGE`, built by `createCorporateKycDocumentStorage`), with the same class, settings, bucket and role. The only difference is where the adapter's one-time synthetic capability probe writes:

- **Corporate probe:** `onboarding-documents/_capability-probe/<uuid>`
- **Individual KYC instance:** unchanged, keeps `individual-kyc/_capability-probe/<uuid>`

The probe runs before the first storage operation on each serverless instance. It writes, checks and deletes one synthetic object version, so the Corporate IAM grant never needs a prefix outside `onboarding-documents/`.

## 2. Environment variables the Corporate upload code reads

### 2.1 The nine `INDIVIDUAL_KYC_*` deployment variables

The production values below come from the deployment request. Unit test `corporate-kyc-document-storage.spec.ts` builds the adapter from `process.env` → `configuration()` → `ConfigService` and checks each mapping.

| # | Variable | Production value | Read as | Effect |
|---|---|---|---|---|
| 1 | `INDIVIDUAL_KYC_S3_STORAGE_ENABLED` | `true` | `individualKyc.s3.enabled` | Gate |
| 2 | `INDIVIDUAL_KYC_DOCUMENT_UPLOAD_ENABLED` | `true` | `individualKyc.documentUploadEnabled` | Gate |
| 3 | `INDIVIDUAL_KYC_DATA_RESIDENCY_APPROVED` | `true` (governance approval) | `individualKyc.dataResidencyApproved` | Gate |
| 4 | `INDIVIDUAL_KYC_STORAGE_RESIDENCY_APPROVED` | `true` (governance approval) | `individualKyc.s3.storageResidencyApproved` | Gate |
| 5 | `INDIVIDUAL_KYC_STORAGE_PRIVATE_BUCKET_APPROVED` | `true` (governance approval) | `individualKyc.s3.privateBucketApproved` | Gate |
| 6 | `INDIVIDUAL_KYC_STORAGE_TLS_POLICY_APPROVED` | `true` (governance approval) | `individualKyc.s3.tlsPolicyApproved` | Gate |
| 7 | `INDIVIDUAL_KYC_STORAGE_RETENTION_APPROVED` | `true` (governance approval) | `individualKyc.s3.retentionApproved` | Gate |
| 8 | `INDIVIDUAL_KYC_S3_BUCKET` | `starfetch-kyc-prod-2026-01` | `individualKyc.s3.bucket` | Bucket |
| 9 | `INDIVIDUAL_KYC_S3_REGION` | `eu-west-1` | `individualKyc.s3.region` | SigV4 signing region |

- The 7 gates must each be the exact string `true`. Anything else (`TRUE`, `1`, empty, missing) keeps storage disabled, and every upload/view returns `503 FEATURE_UNAVAILABLE` (tested per gate).
- These are the same 7 gates the Individual KYC storage factory uses.

### 2.2 ⚠ Other existing variables are also required: the nine alone will stop the API from booting

Startup validation (`src/config/env.validation.ts`) and the adapter constructor were already in the codebase before this change. Once gate 1 or 2 is `true`, they require the variables below. If they are missing, **`validateEnv` throws at boot and the whole API fails to start**, including login and health. This is a unit-tested fact, not a guess.

| Variable | Production value | Why it is required |
|---|---|---|
| `INDIVIDUAL_KYC_S3_ENDPOINT` | `https://s3.eu-west-1.amazonaws.com` | Required HTTPS endpoint. No provider is selected by default. |
| `INDIVIDUAL_KYC_S3_CREDENTIAL_REFERENCE` | `workload-identity` | Selects the Vercel OIDC role. `file:` references are refused on Vercel. |
| `INDIVIDUAL_KYC_KMS_KEY_ID`, `INDIVIDUAL_KYC_KMS_KEY_VERSION` | the approved **Individual KYC** KMS key (not the Corporate O2 key) | Required whenever `INDIVIDUAL_KYC_DATA_RESIDENCY_APPROVED=true` |
| `AWS_REGION` | `eu-west-1` | Already set for Corporate O2. Required with residency approval. |
| `AWS_ROLE_ARN` | `arn:aws:iam::<ACCOUNT_ID>:role/StarfetchCorporateO2VercelProductionRole` | Already set for Corporate O2. Used by the OIDC credential provider. |
| `INDIVIDUAL_KYC_S3_FORCE_PATH_STYLE` | optional; recommended `false` for AWS S3 | Defaults to `true` (path-style), which AWS S3 still accepts |

All of these already exist in the codebase; none is new. If the deployment configuration lists only the nine variables in 2.1, add these before enabling the gates.

### 2.3 Cross-impact on Individual KYC (decision for the product owner)

These are shared flags. Setting them in production also activates the **Individual KYC** storage/upload paths, and `INDIVIDUAL_KYC_DATA_RESIDENCY_APPROVED=true` also activates Individual KYC payload encryption with the Individual KMS key.

Individual KYC uses its own prefixes (`individual-kyc/...`), which the Corporate IAM statement below deliberately does **not** cover. If the role has no separate Individual grant, Individual uploads fail closed with `503` and nothing is written. Confirm this is acceptable, or grant Individual separately under its own review.

## 3. Exact IAM permissions for `StarfetchCorporateO2VercelProductionRole`

Every S3 call the adapter makes for Corporate (upload, version-pinned view, failed-upload cleanup and the capability probe) is recorded with a fake S3 client in `corporate-kyc-document-storage.spec.ts`. The test checks this exact action/resource set:

| Operation (code path) | S3 API | IAM action | Resource |
|---|---|---|---|
| Upload (`putDocumentObject`): conditional `If-None-Match: *`, SSE-S3 `AES256`, SHA-256 checksum | PutObject | `s3:PutObject` | `…/onboarding-documents/*` |
| Version-pinned view (`createViewAuthorization`): 60 s presigned GET with `versionId`, attachment | GetObject + versionId | `s3:GetObjectVersion` | `…/onboarding-documents/*` |
| Failed-upload cleanup (`deleteObjectVersion`) | DeleteObject + versionId | `s3:DeleteObjectVersion` | `…/onboarding-documents/*` |
| Probe: synthetic presigned conditional PUT and replay | PutObject | `s3:PutObject` | `…/onboarding-documents/_capability-probe/*` (covered by the row above) |
| Probe: metadata/checksum check (`HeadObject`, no versionId) | HeadObject | `s3:GetObject` | `…/onboarding-documents/_capability-probe/*` **only** |
| Probe: synthetic version cleanup | DeleteObject + versionId | `s3:DeleteObjectVersion` | covered by the row above |
| Probe: versioning must be `Enabled` | GetBucketVersioning | `s3:GetBucketVersioning` | `arn:aws:s3:::starfetch-kyc-prod-2026-01` (bucket) |

### 3.1 Policy statements to add (replacing any broader Corporate document statement)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CorporateKycDocumentUploadEncrypted",
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::starfetch-kyc-prod-2026-01/onboarding-documents/*",
      "Condition": {
        "StringEquals": { "s3:x-amz-server-side-encryption": "AES256" },
        "Bool": { "aws:SecureTransport": "true" }
      }
    },
    {
      "Sid": "CorporateKycDocumentVersionPinnedView",
      "Effect": "Allow",
      "Action": "s3:GetObjectVersion",
      "Resource": "arn:aws:s3:::starfetch-kyc-prod-2026-01/onboarding-documents/*",
      "Condition": { "Bool": { "aws:SecureTransport": "true" } }
    },
    {
      "Sid": "CorporateKycDocumentFailedUploadCleanup",
      "Effect": "Allow",
      "Action": "s3:DeleteObjectVersion",
      "Resource": "arn:aws:s3:::starfetch-kyc-prod-2026-01/onboarding-documents/*",
      "Condition": { "Bool": { "aws:SecureTransport": "true" } }
    },
    {
      "Sid": "CorporateKycCapabilityProbeHead",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::starfetch-kyc-prod-2026-01/onboarding-documents/_capability-probe/*",
      "Condition": { "Bool": { "aws:SecureTransport": "true" } }
    },
    {
      "Sid": "CorporateKycCapabilityProbeVersioningCheck",
      "Effect": "Allow",
      "Action": "s3:GetBucketVersioning",
      "Resource": "arn:aws:s3:::starfetch-kyc-prod-2026-01"
    }
  ]
}
```

**Scope notes**

- **All object permissions are limited to `onboarding-documents/*`.** `s3:GetObject` (unversioned read) is limited further, to the synthetic probe sub-prefix. Customer documents can only be read by exact version, through the 60-second view grant.
- **`s3:GetBucketVersioning` is the one bucket-level action.** It is a bucket sub-resource, so it cannot be prefix-scoped. It returns only the versioning status, not object data or listings. The existing adapter refuses to operate (fails closed with 503) without it, because version-pinned viewing depends on versioning being enabled.
- **SSE-S3 needs no KMS permission.** The bucket's default encryption and bucket policy must **not** require SSE-KMS, or uploads will be denied.
- **Do not grant:**
  - `s3:DeleteObject` (unversioned delete or delete markers)
  - `s3:ListBucket` / `s3:ListBucketVersions`
  - `s3:PutObjectAcl` / `s3:PutObjectTagging`
  - `s3:GetObject` on `onboarding-documents/*`
  - any `s3:*` wildcard, or any other bucket or prefix
- **Do not change the role's OIDC trust policy or its Corporate O2 KMS statements.**
- **Bucket requirements:** versioning `Enabled`; Block Public Access on (all four settings); no public bucket policy; no explicit Deny matching the statements above.

### 3.2 Read-only verification for the AWS owner

The development workspace has no AWS access, so the role's live permissions have **not** been inspected. Run these read-only checks and keep the output:

```bash
ROLE=StarfetchCorporateO2VercelProductionRole
ACCOUNT_ID=<ACCOUNT_ID>
B=starfetch-kyc-prod-2026-01
ROLE_ARN=arn:aws:iam::$ACCOUNT_ID:role/$ROLE

# 1. What is attached
aws iam list-role-policies --role-name $ROLE
aws iam list-attached-role-policies --role-name $ROLE
#    then: aws iam get-role-policy / get-policy-version for each

# 2. Must be "allowed"
aws iam simulate-principal-policy --policy-source-arn $ROLE_ARN \
  --action-names s3:PutObject s3:GetObjectVersion s3:DeleteObjectVersion \
  --resource-arns arn:aws:s3:::$B/onboarding-documents/00000000-0000-4000-8000-000000000000 \
  --context-entries ContextKeyName=s3:x-amz-server-side-encryption,ContextKeyValues=AES256,ContextKeyType=string \
                    ContextKeyName=aws:SecureTransport,ContextKeyValues=true,ContextKeyType=boolean \
  --query 'EvaluationResults[].[EvalActionName,EvalDecision]' --output table
aws iam simulate-principal-policy --policy-source-arn $ROLE_ARN \
  --action-names s3:GetObject \
  --resource-arns arn:aws:s3:::$B/onboarding-documents/_capability-probe/00000000-0000-4000-8000-000000000000 \
  --context-entries ContextKeyName=aws:SecureTransport,ContextKeyValues=true,ContextKeyType=boolean \
  --query 'EvaluationResults[].[EvalActionName,EvalDecision]' --output table
aws iam simulate-principal-policy --policy-source-arn $ROLE_ARN \
  --action-names s3:GetBucketVersioning --resource-arns arn:aws:s3:::$B \
  --query 'EvaluationResults[].[EvalActionName,EvalDecision]' --output table

# 3. Must be "implicitDeny" or "explicitDeny" (least privilege)
aws iam simulate-principal-policy --policy-source-arn $ROLE_ARN \
  --action-names s3:DeleteObject s3:GetObject s3:PutObjectAcl \
  --resource-arns arn:aws:s3:::$B/onboarding-documents/00000000-0000-4000-8000-000000000000 \
  --query 'EvaluationResults[].[EvalActionName,EvalDecision]' --output table
aws iam simulate-principal-policy --policy-source-arn $ROLE_ARN \
  --action-names s3:PutObject s3:GetObjectVersion \
  --resource-arns arn:aws:s3:::$B/some-other-prefix/x \
  --query 'EvaluationResults[].[EvalActionName,EvalDecision]' --output table
aws iam simulate-principal-policy --policy-source-arn $ROLE_ARN \
  --action-names s3:ListBucket s3:ListBucketVersions --resource-arns arn:aws:s3:::$B \
  --query 'EvaluationResults[].[EvalActionName,EvalDecision]' --output table

# 4. Bucket configuration (read-only)
aws s3api get-bucket-versioning --bucket $B                  # Status: Enabled
aws s3api get-public-access-block --bucket $B                # all four true
aws s3api get-bucket-encryption --bucket $B                  # must not force aws:kms for this prefix
aws s3api get-bucket-policy --bucket $B --query Policy --output text   # check for conflicting Deny
```

`simulate-principal-policy` evaluates identity policies only. Review the bucket policy (step 4) for explicit denies separately. The production upload/view test in section 6 is the final proof.

## 4. Behaviour if something is missing (fail-closed)

| Condition | Result |
|---|---|
| Any gate not exactly `true` | Corporate upload/view → `503 FEATURE_UNAVAILABLE`; no DB row; nothing written to S3 |
| Gate 1 or 2 `true` but endpoint, credential reference or Individual KMS key missing | **API fails to boot** (section 2.2) |
| IAM missing any action in section 3 | Capability probe fails → `503 FEATURE_UNAVAILABLE`. Vercel logs show a sanitized line such as `{"stage":"signed_put","awsErrorCode":"AccessDenied","httpStatus":403,"requestId":"…"}` (stage is one of `credential_acquisition_oidc`, `bucket_versioning`, `signed_put`, `metadata_head`, `replay_protection`, `cleanup`) |
| `s3:GetObjectVersion` missing only | Upload works and the view grant is issued, but S3 answers 403 when the URL is opened |
| Bucket versioning not `Enabled` | Probe fails → 503 |

## 5. Production release order

1. **AWS owner:** apply the statements in section 3.1 and run the checks in section 3.2. Record the results.
2. **Governance:** record approvals for the 5 approval gates (residency, storage residency, private bucket, TLS policy, retention), plus the Individual KYC cross-impact decision (section 2.3).
3. **Merge** the backend PR into `main`.
4. **Apply the migration** to production with the team's normal process (`npx prisma migrate deploy` with the production `DATABASE_URL`). Confirm `20261119120000_corporate_kyc_documents_submission` appears in `_prisma_migrations`.
5. **Set the Vercel production environment variables** (sections 2.1 and 2.2).
6. **Redeploy** Vercel production. Confirm `/api/v1/health` returns 200; this shows startup validation passed.
7. Run the **production upload and view test** (section 6).
8. Only after step 7 passes may anyone describe Corporate document upload as working in production.

## 6. Production upload and view test (required before any "ready" claim)

Use a dedicated internal test Corporate account and a synthetic, non-customer PDF (for example, a one-page "TEST DOCUMENT – NOT A REAL CERTIFICATE"). Never use customer documents.

1. Sign in as the test Corporate initiator (verified email). Call `GET /api/v1/corporate-accounts/{id}/kyc-documents`. Expect 200 with exactly 3 requirements.
2. `POST /api/v1/corporate-accounts/{id}/kyc-documents/MEMART` (multipart `file`, with CSRF header and Origin). Expect **201**, a `currentDocument` with `version: 1`, `scanStatus: NOT_SCANNED`, and no key, bucket or filename in the body.
3. `POST …/kyc-documents/{documentId}/view-authorization`. Expect 200 with `expiresAt` ≤ 60 s ahead. Open `viewUrl` within 60 s; the browser should download the same bytes as an attachment.
4. Open the same `viewUrl` again after 60 s. Expect S3 to return `403 AccessDenied` (Request has expired).
5. **AWS console (owner):** confirm one object version exists at `onboarding-documents/<documentId>` with SSE `AES256`, and no leftover object under `onboarding-documents/_capability-probe/`.
6. **Database (read-only):** confirm one `corporate_kyc_documents` row and `UPLOADED` + `VIEW_AUTHORIZED` rows in `corporate_kyc_document_events`.
7. Do **not** submit the test application unless the team has agreed how test submissions are handled, because submission is permanent and append-only.

Record the date, the request IDs (`meta.requestId`) and the pass/fail result of each step.
