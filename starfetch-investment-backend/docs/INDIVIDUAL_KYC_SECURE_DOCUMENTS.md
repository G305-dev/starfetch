# Individual KYC secure document workflow

## Scope and release state

This implementation keeps the existing `/me/kyc-profile` authentication, InvestorProfile ownership check, DTO validation, versioned encrypted KYC payload, event history, submission gates, and rate limits. It adds private quarantine uploads, metadata verification, asynchronous worker scanning, one-time worker request nonces, pinned-version scan attestations, and retention cleanup. A `CLEAN` scan only means the exact uploaded bytes passed the configured malware scanner; it is **not** KYC review, identity verification, or approval.

All document infrastructure flags default to off. No storage vendor, bucket, AWS region, Nigerian residency assessment, retention period, or legal approval has been selected by this code. Keep document upload disabled unless each responsible owner has actually verified and approved the controls described below. The ordinary `/me` completion/approval requirement remains required.

Raw documents must be stored and scanned only in a specifically approved Nigerian environment. The overseas Vercel API may authorize a short-lived browser PUT, inspect object metadata, queue work, and accept worker attestations; it must never GET document bytes. The dedicated scanner worker is not a Vercel process. Configure only an approved provider/deployment and confirm data residency, subprocessors, transfer/access paths, backups, deletion behavior, retention, and incident response before enabling.

## Local verification

Use synthetic files only; never use real KYC data for tests. Prisma schema validation/generation uses the local schema and does not contact a database:

```sh
DATABASE_URL='postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder' npx prisma validate
DATABASE_URL='postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder' npx prisma generate
npm run typecheck
npm test -- --runInBand src/config/env.validation.spec.ts src/modules/individual-kyc src/individual-kyc-scanner-worker
npm run build
```

Two integration probes are opt-in and skipped by default. The ClamAV probe uses synthetic PDF/EICAR-marker bytes and a deliberately configured private test clamd. The S3 probe makes a temporary synthetic object in the explicitly configured test bucket and exercises the provider's live versioning, conditional PUT/replay, metadata, checksum, encryption, and delete behavior. Never point these at production or a real-customer bucket:

```sh
INDIVIDUAL_KYC_CLAMAV_INTEGRATION=true npm run test:kyc-clamav
INDIVIDUAL_KYC_S3_PROVIDER_PROBE=true npm run test:kyc-s3-probe
```

The S3 probe is not evidence of Nigerian residency, legal approval, bucket security, or production readiness. It uses its own synthetic data only. No migration or live database test is performed by these commands.

## Database migration

The additive migration is `prisma/migrations/20261114100000_individual_kyc_secure_document_workflow/migration.sql`. It adds scan lifecycle columns, version/checksum/attestation and retention fields, the worker nonce table, and DB transition/audit guards. Before any deployment:

1. Confirm the target database is the intended non-production environment and take an approved backup.
2. Review the migration against that environment's actual schema and provider/version; test on an isolated disposable database with synthetic data.
3. Obtain database-owner and compliance/security approval. This repository change does not run migrations.
4. Only then use the deployment team's normal migration process. Do not run `prisma migrate dev` against shared or production databases.

No production database, Neon database, deployment, push, or merge was used for this implementation.

## Activation checklist (all required, no automatic approval)

Keep these false/unset until the control is verified and an accountable owner has approved it:

- `INDIVIDUAL_KYC_DATA_RESIDENCY_APPROVED=true`: verified complete data-flow/storage/processing residency and transfer assessment; this is an explicit governance decision, not a region-name heuristic.
- `INDIVIDUAL_KYC_S3_STORAGE_ENABLED=true`: selected provider explicitly approved; HTTPS endpoint, signing region, bucket, credential reference, and provider capabilities configured.
- `INDIVIDUAL_KYC_DOCUMENT_UPLOAD_ENABLED=true`: only after storage, scanner, retention, and all approval controls pass.
- `INDIVIDUAL_KYC_SCANNER_WORKER_ENABLED=true`: authenticated worker and real clamd deployment are tested and approved.
- `INDIVIDUAL_KYC_STORAGE_RESIDENCY_APPROVED=true`, `INDIVIDUAL_KYC_STORAGE_PRIVATE_BUCKET_APPROVED=true`, `INDIVIDUAL_KYC_STORAGE_TLS_POLICY_APPROVED=true`, and `INDIVIDUAL_KYC_STORAGE_RETENTION_APPROVED=true`: verified provider/location, no-public-access and least-privilege policy, TLS-only controls, and scheduled deletion/backup policy.
- `INDIVIDUAL_KYC_SCANNER_RESIDENCY_APPROVED=true`: verified Nigerian execution location, scanner update path, access restrictions, and no outbound document transfer.
- `INDIVIDUAL_KYC_STORAGE_APPROVAL_REFERENCE`, `INDIVIDUAL_KYC_STORAGE_RETENTION_APPROVAL_REFERENCE`, `INDIVIDUAL_KYC_SCANNER_APPROVAL_REFERENCE`: non-secret references to recorded approvals, not claims that create approval.
- `INDIVIDUAL_KYC_STORAGE_RETENTION_DAYS`: approved integer from 1 to 3650. It is applied from clean scan completion; pending/failed uploads have separate expiry cleanup.
- `INDIVIDUAL_KYC_S3_ENDPOINT`, `INDIVIDUAL_KYC_S3_BUCKET`, `INDIVIDUAL_KYC_S3_REGION`, `INDIVIDUAL_KYC_S3_CREDENTIAL_REFERENCE`: explicit approved provider configuration. The S3 signing region is not residency evidence. Credential reference is `workload-identity` or an approved `/run/secrets/...` file mount; credentials themselves must never be environment values.
- `INDIVIDUAL_KYC_WORKER_HMAC_KEY`: base64 for at least 32 random bytes, injected separately into API and worker secrets; rotate under a documented process. Do not commit it or log it.
- `INDIVIDUAL_KYC_KMS_KEY_ID`, `INDIVIDUAL_KYC_KMS_KEY_VERSION`: a dedicated Individual KYC key, separate from Corporate TIN keys. For a Vercel KMS caller, configure the approved `AWS_ROLE_ARN` and OIDC trust policy. Static AWS key variables are rejected for this workflow.

Production activation requires more than setting variables: verify IAM and service-role scope, Vercel OIDC trust (if applicable), storage and database location, bucket versioning, deny-public-access, object ownership, TLS policy, conditional-write behavior, no overwrite, short presigning, checksum support, encryption-at-rest, audit logging without payloads, retention/deletion including versions/backups, scanner patch/signature maintenance, and incident/restore procedures. Validate the exact approved controls and actual vendor behavior. Capability probes fail closed if conditional create/replay protections or versioning are absent.

## Dedicated scanner worker

`Dockerfile.individual-kyc-scanner` builds the dedicated worker plus clamd in one image. Deploy it only as a private service in the specifically approved Nigerian environment. The container updates ClamAV signatures before starting, starts clamd bound to loopback, does not publish port 3310, then starts the polling worker. Keep image provenance, OS and ClamAV updates, signature freshness/availability, resource limits, logs, and outbound network policy under operational controls. The worker downloads only a pinned object version over HTTPS, checks exact size/type/metadata/version/checksum, streams bytes to clamd INSTREAM without writing them to disk, and posts an attestation. If scanner/API/storage fails, no CLEAN result is issued.

Build and run only after prerequisites are approved:

```sh
docker build -f Dockerfile.individual-kyc-scanner -t starfetch-individual-kyc-scanner:review .
docker run --rm --env-file /secure/mounted/worker.env \
  --network approved-private-network \
  starfetch-individual-kyc-scanner:review
```

Do not commit or distribute the env file. `INDIVIDUAL_KYC_CLAMD_HOST` should be loopback for this image (`127.0.0.1`); worker S3 permissions should be read-only to the quarantine prefix and only support exact version reads. API credentials permit conditional upload authorization, metadata HEAD, version-specific delete, and no document GET. Keep credentials out of image layers and command-line arguments. Do not expose clamd's TCP port to other networks.

Worker-required environment names include:

- `INDIVIDUAL_KYC_WORKER_API_BASE_URL` (HTTPS API origin, no path/query/fragment)
- `INDIVIDUAL_KYC_SCANNER_WORKER_ID` (unique stable ID)
- `INDIVIDUAL_KYC_WORKER_HMAC_KEY` (shared API/worker secret)
- `INDIVIDUAL_KYC_S3_STORAGE_ENABLED=true`, `INDIVIDUAL_KYC_S3_ENDPOINT`, `INDIVIDUAL_KYC_S3_BUCKET`, `INDIVIDUAL_KYC_S3_REGION`, `INDIVIDUAL_KYC_S3_CREDENTIAL_REFERENCE`, optional `INDIVIDUAL_KYC_S3_FORCE_PATH_STYLE`
- `INDIVIDUAL_KYC_CLAMD_HOST=127.0.0.1`, optional `INDIVIDUAL_KYC_CLAMD_PORT=3310`
- explicit worker, storage, scanner, retention, and data residency flags/approval references above.

The worker performs a signed claim/result/cleanup request loop. Each request HMAC covers method, exact path, timestamp, random nonce, worker ID, and canonical JSON body. API verifies a one-minute timestamp window and persists nonce hashes with unique constraint/expiry; replay or database failure rejects the request. Scan claims have short leases and one-time job tokens. Stale, replayed, expired, mismatched-version, and mismatched-hash attestations are rejected.

## Customer API

All customer routes below require the existing access-token session, `INVESTOR` role, an Individual `InvestorProfile`, same-origin/cookie mutation protections where applicable, and existing per-user rate limits. There are no public GET-document/download routes.

- `GET /api/v1/me/kyc-profile` — own profile projection (bank account remains masked); document metadata only.
- `PUT /api/v1/me/kyc-profile/personal`
- `PUT /api/v1/me/kyc-profile/investment-profile`
- `PUT /api/v1/me/kyc-profile/source-of-funds`
- `PUT /api/v1/me/kyc-profile/bank-details`
- `POST /api/v1/me/kyc-profile/id-document/upload-intent`
- `POST /api/v1/me/kyc-profile/id-document/{documentId}/complete`
- `POST /api/v1/me/kyc-profile/submit`

Use the existing DTO contracts and the current `version` for every mutation. Upload intent requires document type, original filename, allowed MIME (`application/pdf`, `image/jpeg`, `image/png`), exact byte size (1 byte to 10 MiB), SHA-256 base64 checksum, and profile version. The server creates the object/document IDs; do not supply an object key or owner ID. The response includes a short-lived (5 minute) signed URL, an expiry, required headers, and `signedContentLength`. PUT the exact file bytes directly to that URL with the exact returned settable headers; browsers set Content-Length from the body and JavaScript cannot set that forbidden header. Never log or persist the URL. Do not reuse it: the object is conditional-create-only. Then call complete with the document ID and updated profile version. Server HEAD-verifies size, MIME, checksum, metadata, SSE, and a non-null object version before queueing scan.

Illustrative browser logic (adapt field names to the DTO and API response; compute digest using Web Crypto):

```js
const intent = await api.post('/api/v1/me/kyc-profile/id-document/upload-intent', {
  version, documentType, originalFilename: file.name, contentType: file.type,
  sizeBytes: file.size, checksumSha256,
});
const headers = intent.requiredHeaders;
const put = await fetch(intent.uploadUrl, { method: 'PUT', headers, body: file });
if (!put.ok) throw new Error('Upload failed');
const completed = await api.post(`/api/v1/me/kyc-profile/id-document/${intent.documentId}/complete`, {
  version: intent.version,
});
```

The server response is authoritative for latest version/document ID; do not assume the illustrative response shape. A document remains pending until the Nigerian worker attests the exact pinned version/hash. `UPLOADED` plus `CLEAN` is a malware scan state, not KYC approval. Submit remains gated by all original sections and required clean document state; existing authorized review is still required for KYC approval.

## Internal worker API

These routes are for the scanner worker only. They require the HMAC headers documented above; no customer/staff bearer token or client-supplied scan result is accepted:

- `POST /api/v1/internal/individual-kyc/scan-jobs/claim`
- `POST /api/v1/internal/individual-kyc/scan-jobs/{documentId}/result`
- `POST /api/v1/internal/individual-kyc/scan-jobs/cleanup`

Use the worker package implementation to generate signatures. Never expose worker HMAC key to browsers. Worker results are tied to a lease token, worker identity, object version, SHA-256, clamd engine/version, and a validated scan timestamp. Attestation digest and append-only event are stored. Database constraints prohibit unauthorized lifecycle changes. A scanner result never changes profile to approved/verified.

## Operations and limits

- 10 MiB max document; 5-minute PUT authorization; one-time conditional object creation; private quarantine prefix; versioning mandatory; API storage adapter does not expose `GetObject`.
- Worker only reads exact version; streams to clamd; max scan size and protocol limits are enforced. Scanner outage, no signatures, invalid protocol, unavailable storage, or mismatched metadata is fail-closed.
- Expired pending uploads and failed/rejected objects are cleaned; clean objects are deleted at approved retention expiry. Cleanup is idempotent/retried, version-specific, and records an audit event. Ensure provider lifecycle/backup policy does not outlive the approved retention requirement.
- Monitor aggregate failures, queue age, stale leases, replay rejects, cleanup lag, signature freshness, and provider capability checks. Do not put filenames, document IDs/keys, signed URLs, HMACs, bytes, account data, or provider error payloads in logs/metrics.
- Reconcile retained DB metadata and object versions under an approved deletion/restore plan; document incident response and access reviews.
