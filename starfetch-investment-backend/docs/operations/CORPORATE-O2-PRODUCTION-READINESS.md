# Corporate O2 production-readiness handoff

**Audience:** David (backend) and Emmanuel (frontend/management coordination)  
**Assessment date:** 22 October 2026  
**Repository branch:** `feature/corporate-o2-production-readiness` (local only; not pushed or merged)  
**Baseline:** latest fetched `origin/main` at `5a674e35d8876972221472e91ec04c627fd00133` (confirmed against remote `refs/heads/main`)

## Decision

**Do not enable Corporate O2 in production yet.** The API, encryption envelope, authenticated/CSRF-protected write path, idempotency, O3 reads, and discovery are already implemented on `main`; the current `503 FEATURE_UNAVAILABLE` is the intended result while its fail-closed gate is off. This branch closes Vercel's KMS credential gap with OIDC-to-AWS credentials and requires `AWS_ROLE_ARN` only for Vercel Production; other runtimes use the AWS SDK credential chain with workload identity. Vercel Preview/Development cannot enable O2. KMS plaintext data-key buffers are explicitly zeroed after copying and in error paths.

Remaining go-live blockers are documented authorization for the three approvals, AWS key/role creation and review, an authorized synthetic OIDC/KMS connectivity check, an approved/configured Redis REST service and secret values, and the isolated PostgreSQL O2/O3/O4 E2E rerun. A shared atomic Redis adapter is now implemented and covered by unit tests, but it has not been connected to any Redis service and cannot be production-ready until Security/Operations approve and configure one. Vercel Preview/Development O2 writes are blocked in code and those environments must use a distinct isolated database URL. Approval flags remain false by default and were not set true. No real AWS/Redis credentials, KMS/Redis calls, Neon database connection, migration, or deployment were used here.

## Existing implementation assessment

### O2 request and persistence

- `POST /api/v1/corporate-accounts/applications` is already implemented and returns HTTP 201 with the canonical `{ corporateAccountId, applicationId, applicationStatus: DRAFT, detailsVersion: 1 }` receipt.
- Request DTO accepts exactly the six approved fields: institution name, incorporation date, RC number, TIN, business phone, and business email. It rejects extra owner/identity/status/approval fields. TIN/RC checks are structural only; this route does not claim registry verification.
- Route guards enforce session-bound authenticated and email-verified `INVESTOR` role access (the Corporate applicant role boundary; an `InvestorProfile` is not required), origin/CSRF controls, a shared per-user rate limit, and `Idempotency-Key`. Transactional retries, same-user idempotency/duplicate handling, and no cross-user merging are implemented.
- TIN is envelope-encrypted before persistence with a per-value KMS-generated AES-256 data key and AES-256-GCM. The canonical authenticated context binds application ID, environment, field, purpose and context version. The database stores ciphertext/nonce/tag/wrapped data key and key metadata, not a plaintext TIN. Plaintext is not returned or logged. KMS failures return a safe 503 and abort the transaction.
- O3 owner-scoped reads return a masked TIN only while the same privacy/KMS gate is ready; with the gate closed, the TIN projection is null. The initiator-only discovery endpoint is `GET /api/v1/me/corporate-accounts`.

### Configuration gate and concrete code change

The gate requires `CORPORATE_O2_ENABLED`, all three documented approvals, region, KMS key ID/version, a separate versioned O2 HMAC keyring, and the shared rate-limit Redis REST URL/token plus dedicated HMAC secret. All flags default false. Vercel Production additionally requires a syntactically valid `AWS_ROLE_ARN` and `VERCEL_ENV=production`; Vercel Preview/Development is rejected by both environment validation and the runtime availability gate. Outside Vercel, `AWS_ROLE_ARN` is optional and the AWS SDK default credential chain is used. For non-Vercel production, that chain must resolve to an attached workload identity (instance/task/pod role or equivalent federation); operators must not configure long-lived `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` values.

Before this branch, `KMSClient` used only the AWS SDK default credential chain, which does not itself exchange Vercel's OIDC token for AWS credentials. The branch adds the official `@vercel/oidc-aws-credentials-provider` package and configures it lazily only on Vercel. If Vercel lacks a valid role ARN, O2 remains unavailable and the KMS credential provider throws rather than falling back to ambient credentials. Non-Vercel deployments retain the SDK chain as an explicit workload-identity path. Environment validation rejects `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` whenever O2 is enabled; production operators must use OIDC/workload roles, not long-lived keypairs.

The configured `CORPORATE_O2_KMS_KEY_VERSION` is an application metadata label saved with the envelope; it is **not** an AWS KMS backing-material version. AWS KMS transparently selects prior backing material when decrypting after automatic rotation. A new KMS key resource/manual key migration is different: retain the old key and decrypt permission for all rows encrypted under it until those rows have been safely rewrapped or their approved retention ends. Encryption context uses Vercel's `VERCEL_ENV` when present (Production is `production`), falling back to `NODE_ENV` elsewhere. Vercel's Preview/Development O2 API gate is hard-closed, so those deployments cannot write differently-contextualized O2 envelopes into a shared Production database. Still configure a distinct isolated `DATABASE_URL` for Preview/Development; any direct Preview KMS connectivity test must use a separate test key/role and must not persist O2 rows.

### API contract and compatibility

Canonical OpenAPI v0.6.1 documents O2, O3, O4, O11, discovery, request/response shapes, security headers, 503s, and disabled-by-default behavior. D-06 Revision 8 adds the Corporate registration request variant while preserving the legacy Individual request; frontend/mobile coordination is pending before client adoption. See `docs/backend/onboarding/15-D06-CORPORATE-APPLICANT-REGISTRATION-ADDENDUM.md` and `docs/operations/CORPORATE-O2-RELEASE-BLOCKERS-AND-REGISTRATION.md` for the explicit contract and handoff. O2 create requests remain authenticated. The dedicated O2 quota uses a replaceable shared Redis port and one atomic Lua fixed-window operation: five requests per authenticated user per hour, with user IDs HMAC-SHA256-derived before use in Redis keys, expiry, `Retry-After`, and fail-closed 503 behavior. It does not use the general process-local limiter as a fallback. The code and tests use synthetic credentials only; no Redis service has been approved/configured or contacted. O2 activation remains blocked until an organization-approved Redis REST service and secrets are provisioned and the actual shared service is verified in an approved environment. Add Vercel Firewall per-IP limiting as defense in depth, not as the authoritative 5/hour user quota: Vercel documents that its Firewall rate-limit counters are per-region and can be exceeded across regions ([Rate Limiting SDK](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk)).

No Prisma schema or migration change is required. The migration status stated by the project owner was not checked against or changed on Neon.

## Environment variables

Set these only in the **backend Vercel project**. Do not add them to the frontend project or any `NEXT_PUBLIC_*` variable. For now keep every `CORPORATE_O2_*_APPROVED` value false and `CORPORATE_O2_ENABLED=false` in Production, Preview, and Development.

| Variable | Vercel type | Format / validation | Status and notes |
|---|---|---|---|
| `CORPORATE_O2_ENABLED` | Config | Literal `true` or `false`; default false | Leave `false` until the complete checklist is signed and production KMS access is verified. |
| `CORPORATE_O2_LAWFUL_BASIS_APPROVED` | Config | Literal boolean string | Keep false until Legal/Compliance records the applicable lawful-basis decision. |
| `CORPORATE_O2_PRIVACY_NOTICE_APPROVED` | Config | Literal boolean string | Keep false until the notice/version covers TIN processing, KMS, access, purpose, sharing, rights and retention. |
| `CORPORATE_O2_RETENTION_APPROVED` | Config | Literal boolean string | Keep false until a retention/deletion schedule, including backups and audit retention, is approved. |
| `AWS_REGION` | Config | AWS region, e.g. `<approved-kms-region>` | Set explicitly to the KMS key's region. Vercel may supply a function-region `AWS_REGION`; override it so routing cannot select a different KMS region. |
| `CORPORATE_O2_KMS_KEY_ID` | Config | Prefer the full customer-managed key ARN | Keep the key in the same region as `AWS_REGION`; do not point at an AWS-managed alias. The ARN is not a secret. |
| `CORPORATE_O2_KMS_KEY_VERSION` | Config | 1–64 chars `[A-Za-z0-9._-]` | Use an operator label such as `cmk-resource-v1`. It is metadata, not KMS's internal rotation number. |
| `AWS_ROLE_ARN` | Config | IAM role ARN `arn:<partition>:iam::<12-digit-account>:role/<path/name>` | Required only when O2 is enabled on Vercel Production; trust must match the exact Vercel project and `environment:production`. Optional outside Vercel, where the SDK default chain must resolve to a workload role/federated identity. Never configure long-lived AWS access-key environment variables. |
| `CORPORATE_O2_HMAC_ACTIVE_KEY_VERSION` | Config | 1–32 chars `[A-Za-z0-9._-]` | Must exactly match a key name in the JSON keyring. It is not secret. |
| `CORPORATE_O2_HMAC_KEYS_JSON` | **Secret** | JSON object `{ "version": "<base64-of-random-key-bytes>" }`; each decoded key is at least 32 bytes; active version must exist | Backend only. Retain old versions while idempotency/duplicate fingerprints may still be needed. Do not print, commit, or place in frontend variables. |
| `CORPORATE_O2_RATE_LIMIT_REDIS_REST_URL` | Config | HTTPS Redis REST endpoint, no embedded auth/query/fragment | Backend only. Must point to an organization-approved shared Redis service; no value is configured or tested by this change. |
| `CORPORATE_O2_RATE_LIMIT_REDIS_REST_TOKEN` | **Secret** | Provider-issued Redis REST bearer token | Backend only. Do not copy from another environment, log, or expose in frontend variables. No token was generated or used. |
| `CORPORATE_O2_RATE_LIMIT_HMAC_SECRET` | **Secret** | Base64 for at least 32 random bytes; dedicated to rate-limit key derivation | Backend only and distinct from O2 payload/idempotency HMAC keyring. Do not reuse the other HMAC key or put it in Git/logs/frontend variables. |

`CORS_ORIGINS` is also an operational prerequisite: verify the backend Production value contains the exact approved frontend origin `https://starfetch-bice.vercel.app` (plus any separately approved origins), without `*`. O2's browser mutation guard still requires an allowed Origin/Referer and session-bound CSRF cookie/header.

### Generate a dedicated HMAC keyring safely

The branch adds `scripts/generate-corporate-o2-hmac-keyring.mjs`. It creates 32 random bytes using Node's `crypto.randomBytes`, serializes a one-entry versioned JSON keyring under the operator's home directory, and prints only the file path/version—not the key. On POSIX, the script sets mode 0600/0700. Windows does not provide equivalent NTFS protection through Node's POSIX mode bits, so apply explicit ACLs as below. Run from an approved, BitLocker-protected Windows workstation in the repository root:

```powershell
node .\starfetch-investment-backend\scripts\generate-corporate-o2-hmac-keyring.mjs v1
```

Copy the `Secret file:` path shown (the path is not secret), then protect the folder and file ACLs. Do not run `Get-Content` by itself, print the file, or copy the key to the clipboard:

```powershell
$secretPath = Read-Host 'Paste the Secret file path printed by the generator'
$secretDir = Split-Path -Parent $secretPath
$principal = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$dirRule = '{0}:(OI)(CI)F' -f $principal
$fileRule = '{0}:F' -f $principal
icacls.exe $secretDir /inheritance:r
icacls.exe $secretDir /grant:r $dirRule 'NT AUTHORITY\SYSTEM:(OI)(CI)F'
icacls.exe $secretPath /inheritance:r
icacls.exe $secretPath /grant:r $fileRule 'NT AUTHORITY\SYSTEM:F'
icacls.exe $secretPath
```

Only the current Windows identity and SYSTEM should have access (subject to company endpoint policy). Keep the file off the repository, shared folders, unencrypted/synced consumer cloud storage and logs. Store the recovery copy only in the organization-approved encrypted secrets vault. Then, from the **linked backend Vercel project directory**, stream the file as input to Vercel without putting its contents in PowerShell history or command arguments:

```powershell
Get-Content -Raw -LiteralPath $secretPath | vercel env add CORPORATE_O2_HMAC_KEYS_JSON --environment production --type secret
vercel env add CORPORATE_O2_HMAC_ACTIVE_KEY_VERSION --environment production --type config --value v1 --yes
```

PowerShell pipes the file contents directly to the CLI; do not add `--value`, `Write-Output`, or `echo` for the secret. Scope the JSON keyring as Vercel **Secret** and the version as **Config**. Vercel Secret values are write-only. On rotation, merge retained prior keys with the new key from the approved vault and update the keyring before changing the active version; do not replace the keyring with only the newest key while old idempotency rows remain.

## AWS Console setup — no resources were created here

1. **Confirm ownership and region first.** An AWS account owner/security administrator must identify the approved AWS account and KMS region, and the Vercel team slug/project name. Do not guess any of these values.
2. **Create/choose a symmetric customer-managed KMS key.** In AWS Console → KMS → Customer managed keys → Create key, choose **Symmetric** and **Encrypt and decrypt**, AWS-generated key material (`AWS_KMS` origin), and the agreed region. Set a descriptive purpose. Enable automatic key rotation if the chosen key type supports it. Create/use a dedicated alias for operations, but put the full key ARN (not a movable alias) in `CORPORATE_O2_KMS_KEY_ID` so each envelope records the actual key used.
3. **Add Vercel as an OIDC identity provider.** In AWS Console → IAM → Identity providers → Add provider → OpenID Connect. Use the issuer mode configured for the Vercel team. For Team issuer mode use `https://oidc.vercel.com/<TEAM_SLUG>` and audience `https://vercel.com/<TEAM_SLUG>`. Vercel documents both Team and Global issuer modes; the trust policy's condition-key namespace must match the chosen issuer.
4. **Create a runtime IAM role with a narrow trust policy.** Use an exact production subject—no wildcard project or environment. Team-issuer example (replace placeholders with the real values; do not paste this template unchanged):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/oidc.vercel.com/<TEAM_SLUG>"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "oidc.vercel.com/<TEAM_SLUG>:sub": "owner:<TEAM_SLUG>:project:<BACKEND_PROJECT_NAME>:environment:production",
        "oidc.vercel.com/<TEAM_SLUG>:aud": "https://vercel.com/<TEAM_SLUG>"
      }
    }
  }]
}
```

5. **Grant only the KMS operations this code calls.** The O2 runtime uses `GenerateDataKey` with `KeySpec: AES_256` and `Decrypt`; it does not need broad `kms:*`, `kms:Encrypt`, key administration, or key deletion. Attach an IAM permission policy to the role for the exact key ARN and also ensure the KMS key policy authorizes this role. The service's non-secret encryption context is exactly `applicationId`, `environment`, `field`, `purpose`, `contextVersion`:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "StarfetchCorporateO2DataKeyAndDecrypt",
    "Effect": "Allow",
    "Action": ["kms:GenerateDataKey", "kms:Decrypt"],
    "Resource": "<FULL_CUSTOMER_MANAGED_KEY_ARN>",
    "Condition": {
      "StringEquals": {
        "kms:EncryptionContext:environment": "production",
        "kms:EncryptionContext:field": "taxIdentificationNumber",
        "kms:EncryptionContext:purpose": "starfetch:corporate-o2:tin:v1",
        "kms:EncryptionContext:contextVersion": "1"
      },
      "Null": { "kms:EncryptionContext:applicationId": "false" },
      "ForAllValues:StringEquals": {
        "kms:EncryptionContextKeys": ["applicationId", "environment", "field", "purpose", "contextVersion"]
      }
    }
  }]
}
```

   Use this statement in the role's identity policy and a matching KMS key-policy allow for the exact role principal (or an explicitly approved account-delegation model). Do not add encryption context values containing TIN, RC, email, or other customer data: KMS encryption context is non-secret and can appear in audit logs. `applicationId` is a random application UUID and must be present; the fixed context values above constrain purpose/environment. Validate the final policy with IAM Access Analyzer and a security reviewer before use. Vercel Preview O2 writes are blocked in code; do not provision a Preview role for the O2 API flow. If Security separately authorizes a direct OIDC/KMS connectivity check, use a dedicated test role with exact subject `environment:preview`, an isolated test CMK and `environment:preview` policy condition, and synthetic data keys only. That check must not call Corporate O2 routes or persist envelopes. Production credentials/keys must never be copied into Preview.
6. **Record actual key metadata.** In KMS → key details, copy the full key ARN and region. Set `CORPORATE_O2_KMS_KEY_VERSION` to a human-controlled metadata label for the selected key resource. KMS automatic key-material rotation is transparent; a different KMS key resource requires retaining old-key decrypt access for old envelopes.
7. **Verify CloudTrail visibility and alarms.** Ensure the AWS account's CloudTrail records KMS `GenerateDataKey`/`Decrypt`, and configure alerts for unexpected role/key usage and policy changes. The application does not log TIN or KMS plaintext keys.

AWS documents the Vercel OIDC role flow and the `awsCredentialsProvider` helper [here](https://vercel.com/docs/oidc/aws) and [here](https://vercel.com/docs/oidc/reference). AWS documents the `GenerateDataKey` plaintext/encrypted data-key contract and exact-match encryption-context requirement [here](https://docs.aws.amazon.com/kms/latest/APIReference/API_GenerateDataKey.html), least-privilege encryption-context conditions [here](https://docs.aws.amazon.com/kms/latest/developerguide/least-privilege.html), and transparent automatic key-material rotation/decryption [here](https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html).

## Vercel setup and activation order

1. In the **backend** Vercel project, set Production Config variables `AWS_REGION`, `AWS_ROLE_ARN`, `CORPORATE_O2_KMS_KEY_ID`, and `CORPORATE_O2_KMS_KEY_VERSION`; set the HMAC active version as Config and JSON keyring as Secret. Use an exact Production-only OIDC trust subject. Do not add long-lived AWS access keys.
2. Keep `CORPORATE_O2_ENABLED=false` and all approval flags false in Production, Preview and Development while assembling evidence. Do not set flags just to make startup pass. Preview/Development O2 enablement is rejected at validation and the API gate remains closed.
3. Scope a distinct, isolated non-production `DATABASE_URL` to Vercel Preview/Development; never attach Production's database URL to those environments. Set `CORPORATE_O2_ENABLED=false` there. Use a separately approved isolated test database for E2E; never point E2E tests at Neon. Do not run migration commands for this task.
4. Verify Preview/Production KMS keys, role ARNs and HMAC keyrings are separate. A directly authorized Preview OIDC/KMS check may use a separate test role/key and synthetic data key only; it must not call O2 API routes or persist rows. Because Preview O2 writes are blocked, no Preview envelope can be introduced into the shared Production database by this feature.
5. Confirm the deployed artifact is built from the reviewed branch/commit and the Vercel function runtime exposes OIDC. This checkout has no Vercel deployment manifest/entrypoint, so project/root/entrypoint mapping must be verified by the owner.
6. Before activation, require isolated PostgreSQL O2/O3/O4/discovery E2E tests to pass, verify KMS OIDC and context in the authorized harness, obtain approval for the shared Redis service, provision backend-only values, and verify the live adapter against that authorized service. Unit tests and the synthetic E2E limiter override do not prove Redis service availability or AWS IAM/OIDC integration.
7. Obtain documented sign-offs first. Only then set the three Production approval flags true and `CORPORATE_O2_ENABLED=true` as the final controlled change. Redeploy to apply the environment. Missing/malformed prerequisites fail startup or leave the route unavailable; KMS failures abort writes with 503.
8. Perform a Production synthetic smoke test only if policy expressly permits synthetic records in the production database. Otherwise use the isolated environment and production health/CloudTrail signals. Never use a real applicant TIN as a smoke test.

Vercel classifies Config values as readable configuration and Secret values as write-only secret material; create the HMAC JSON as Secret and scope variables to the backend project/environment. See [Vercel environment-variable guidance](https://vercel.com/docs/environment-variables/sensitive-environment-variables). Vercel also recommends explicitly setting `AWS_REGION` when the AWS resource region is fixed because the function's execution region may differ ([Vercel AWS OIDC](https://vercel.com/docs/oidc/aws)).

## Approval and go-live checklist

Do not mark an item complete or set an approval environment variable true without its named owner's recorded authorization/evidence.

- [ ] **Legal basis — Legal/Compliance:** record the applicable purpose and lawful basis for collecting/storing Corporate TIN, decision date, owner, and approved version.
- [ ] **Privacy notice — Privacy owner:** approve/version notice covering TIN collection, encryption, masking, access, disclosures, rights and processors.
- [ ] **Retention — Compliance/Records owner:** approve periods, deletion criteria, backups and audit treatment; the code intentionally does not invent the schedule.
- [ ] **KMS/IAM — Security:** approve key/account/region, exact Vercel OIDC project/environment trust, least-privilege role and key policies, rotation/retention, CloudTrail alerts and break-glass process.
- [ ] **Keyring — Security/Operations:** generate a dedicated random 256-bit HMAC key, store it in the approved secret vault and Vercel Secret scope, verify active version/retained keys, and confirm it is absent from Git, logs and frontend configuration.
- [ ] **Rate limit — Architecture/Security/Operations:** code and unit coverage for the async atomic shared Redis fixed-window limiter are present (5 requests per authenticated user per hour, HMAC-derived key, expiry, `Retry-After`, fail-closed 503); still obtain service approval, provision backend-only URL/token/HMAC secret in the correct runtime, verify timeout/availability and alerts with synthetic requests, and configure optional Vercel Firewall per-IP defense in depth (not the global per-user quota). No Redis service has been connected by this change.
- [ ] **Origin/cookies — Backend/Frontend:** verify the exact Production CORS allowlist and deployed secure `__Host-sf_csrf`/Origin behavior for the actual frontend domain.
- [ ] **API/security regression — Backend/QA:** rerun tests proving the six-field allowlist, authentication, CSRF, idempotency, DRAFT receipt, encryption/no plaintext persistence, O3 masking, discovery, cross-user 404, Individual/Joint compatibility, and O4/O11 owner boundaries.
- [ ] **Isolated database — QA/Operations:** positively verify loopback PostgreSQL database `starfetch_test` and user `starfetch_test_role`; run only the documented E2E command. Never point destructive test setup at Neon. Configure a distinct isolated `DATABASE_URL` for Preview/Development.
- [ ] **Preview boundary — Platform/Backend:** verify Vercel Preview/Development O2 is rejected even if `CORPORATE_O2_ENABLED=true`; never allow Preview to write O2 rows to Production's database. Any direct KMS check uses a separate test role/key and persists no envelope.
- [ ] **Vercel OIDC/KMS integration — Security/QA:** with synthetic data and a separate non-production role/key, verify OIDC assumption, `GenerateDataKey`, exact context-bound `Decrypt`, and fail-closed behavior; confirm that role cannot access production KMS resources.
- [ ] **Deployment mapping — Operations:** verify Vercel project, root directory, runtime entrypoint, Node version and source revision; local checkout has no Vercel manifest/entrypoint, so this must be confirmed externally.
- [ ] **Release authorization — Product/Legal/Compliance/Security:** record sign-offs, set all three approval flags true only after their individual evidence is approved, then set `CORPORATE_O2_ENABLED=true` as the final controlled change.

Every release-approval box remains unchecked; local unit/build checks below are evidence, not sign-off. The three legal/privacy/retention approval flags and the feature switch remain false until authorized.

## Safe verification commands (PowerShell)

These unit/build commands do not connect to a database. Run from the backend directory:

```powershell
npm ci
npm test -- --runInBand
npm run typecheck
npm run build
$env:DATABASE_URL = 'postgresql://starfetch_test_role:synthetic-placeholder@127.0.0.1:5432/starfetch_test'
npx prisma validate
Remove-Item Env:DATABASE_URL
npx eslint src/config/env.validation.ts src/config/env.validation.spec.ts src/config/configuration.ts src/modules/corporate-onboarding/corporate-onboarding.module.ts src/modules/corporate-onboarding/crypto/corporate-tin-encryption.ts src/modules/corporate-onboarding/crypto/corporate-tin-encryption.spec.ts src/modules/corporate-onboarding/services/corporate-o2-availability.service.ts src/modules/corporate-onboarding/services/corporate-o2-availability.service.spec.ts
```

The placeholder URL above is only for Prisma schema validation; `prisma validate` does not connect to it. Do not run E2E with that placeholder. For destructive E2E, populate the process-scoped `STARFETCH_ISOLATED_TEST_DATABASE_URL` from an approved local secret store, then validate it **before** any database connection. This guard refuses non-loopback hosts and wrong database/user:

```powershell
if (-not $env:STARFETCH_ISOLATED_TEST_DATABASE_URL) { throw 'Set the verified local test URL from the approved secret store.' }
$u = [Uri]$env:STARFETCH_ISOLATED_TEST_DATABASE_URL
$dbName = [Uri]::UnescapeDataString($u.AbsolutePath.TrimStart('/'))
$dbUser = [Uri]::UnescapeDataString(($u.UserInfo -split ':', 2)[0])
if ($u.Scheme -notin @('postgres', 'postgresql') -or $u.Host -notin @('127.0.0.1', 'localhost', '::1', '[::1]') -or $dbName -cne 'starfetch_test' -or $dbUser -cne 'starfetch_test_role') { throw 'Refusing E2E: URL must identify loopback starfetch_test as starfetch_test_role.' }
$env:DATABASE_URL = $env:STARFETCH_ISOLATED_TEST_DATABASE_URL
npm run test:e2e -- --runInBand test/corporate-o2.e2e-spec.ts test/corporate-o3.e2e-spec.ts test/corporate-o4.e2e-spec.ts test/corporate-draft-bootstrap.e2e-spec.ts
Remove-Item Env:DATABASE_URL
```

Each relevant E2E suite independently checks actual `current_database()`, loopback server address and `current_user` before cleanup. Never set the variable to Neon and never run these tests against any online database. The O2 E2E suite overrides KMS with a synthetic test-only AES-GCM provider and the shared rate-limit port with a deterministic local fake; it does **not** verify AWS IAM, Vercel OIDC, production KMS access, or Redis service connectivity. No migrations or cleanup are needed for schema validation.

### Results from the prior readiness correction pass (before the current release-blocker phase)

- `npm ci`: passed; 787 packages installed. npm reported 37 lockfile audit findings (11 low, 17 moderate, 9 high); no `npm audit fix` was run and no dependency versions were changed by installation. Security owner should triage before activation.
- Focused configuration/activation-gate tests: 2 suites, 24 tests passed.
- Targeted Corporate O2/O3/O4 unit tests: 6 suites, 29 tests passed.
- Full unit tests: 32 suites, 168 tests passed.
- `npm run typecheck`: passed. `npm run build`: passed (Prisma Client generation and Nest build).
- `npx prisma validate` initially reported P1012 because `DATABASE_URL` was unset; rerun with a synthetic loopback-only placeholder succeeded. No DB connection occurred.
- Targeted ESLint on all changed TypeScript files: passed with no findings.
- Destructive Corporate O2/O3/O4 E2E tests were **not run**: `STARFETCH_ISOLATED_TEST_DATABASE_URL` was unset and a TCP check found no listener at `127.0.0.1:5432` (`ECONNREFUSED`). No connection to Neon or other online database was attempted.
- AWS/Vercel OIDC/KMS integration was not run: no AWS/Vercel credentials/resources were accessed. At that earlier readiness point, no schema, migration, API contract, or frontend changes were made.

### Results for the current release-blocker and registration phase

- Full unit suite: `npm test -- --runInBand` — **37 suites, 192 tests passed**.
- Targeted auth/configuration/profile/Corporate O2/O3/O4/O11 security regressions — **17 suites, 100 tests passed**. Includes Corporate registration without an InvestorProfile, profileless login with empty names, Individual registration compatibility, unknown-role rejection, profile-service 404 handling, applicant verification/ownership, O2 rate-limit fail-closed behavior, authenticated O2 route guard wiring, and existing Corporate read/edit/encryption service tests.
- `npm run typecheck` — passed. `npm run build` — passed (Prisma generation and Nest build).
- `DATABASE_URL` was set only for `npx prisma validate` to a synthetic loopback-only schema-validation URL; Prisma validation passed without opening a database connection. No schema change or migration was generated or run.
- Targeted ESLint across changed source and test files — passed with no findings.
- Canonical OpenAPI YAML parse and contract assertions passed: 18 paths, version 0.6.1, three registration variants, no duplicate YAML keys.
- Destructive PostgreSQL E2E was **not run** in this review because no isolated test database identity was positively verified. The suites independently check database name, loopback server address, and database user before cleanup; no connection to Neon or any online database was attempted. Joint source was not changed, but Joint runtime compatibility remains pending those isolated E2E checks.
- No Redis/AWS/KMS/OIDC service connection was made. No credentials were accessed. O2 and legal/privacy/retention switches remain false; no frontend change, push, merge, deployment, or activation occurred.
- The Redis unit tests mock Redis. They prove code-level Lua arguments, HMAC-derived keying, retry-after parsing, and fail-closed paths—not actual provider compatibility or service availability. These remain release blockers.

## Deployment and rollback plan

**Deploy/activate only after** clean dependency install, full unit/typecheck/build/lint and isolated PostgreSQL O2/O3/O4/discovery E2E pass; the authorized direct OIDC/KMS check succeeds with synthetic data; the approved Redis REST service is configured and the shared limiter is verified against it; and management/compliance approvals are recorded. Preview deployments may be used for ordinary CI, but the O2 gate must remain off and is hard-disabled there even if accidentally switched on. No push, deployment or activation was performed by this agent. Keep Production flags false until final sign-off; activation requires the approval flags and enable switch as the last controlled change, followed by an approved synthetic smoke test.

**Rollback:** set `CORPORATE_O2_ENABLED=false` and redeploy immediately; the route returns the documented fail-closed 503. Do not delete Corporate rows, roll back migrations, remove the KMS key, disable its old backing material, or revoke old-key decrypt access during rollback—existing envelopes may need to be decrypted later. With the gate off, O3 returns a null masked-TIN projection while other owner-scoped details remain subject to existing read authorization. Preserve the HMAC keyring and KMS key/policy until data retention/rewrap obligations are complete.

## Short handoff for David and Emmanuel

O2 itself is implemented; the current 503 is intentional until legal/privacy/retention, KMS, Redis, and keyring gates are satisfied. The reviewed readiness changes add strict Vercel Production OIDC, retain non-Vercel workload-role SDK credentials, hard-disable O2 on Vercel Preview/Development, and wipe AWS SDK plaintext data-key buffers. This phase adds a shared atomic Redis quota and a Corporate applicant registration option on the existing auth flow; it does not switch O2 on or change the six-field O2 create request/response contract. Management/legal must document the three approvals; Security must configure the constrained Production OIDC role and customer-managed KMS key; Architecture/Security/Operations must approve and provision the shared Redis service and verify the adapter; Operations must separate Preview/Production database configuration and verify the deployed source. Emmanuel should use the explicit registration/API contract in `docs/operations/CORPORATE-O2-RELEASE-BLOCKERS-AND-REGISTRATION.md`. No Neon migration was needed or run.

## David's manual branch push (PowerShell)

These commands are provided for David to run after reviewing the corrected ZIP. They create a local branch from the then-current `origin/main`, apply only the archive's files, and push that branch; they do not merge or deploy. From a PowerShell window in the folder where the ZIP was downloaded:

```powershell
git clone https://github.com/G305-dev/starfetch.git
Set-Location .\starfetch
git fetch origin
git switch --create feature/corporate-o2-production-readiness origin/main
Expand-Archive -LiteralPath "$HOME\Downloads\Corporate-O2-Production-Readiness-Corrected.zip" -DestinationPath . -Force
git status --short
git diff --check
git add starfetch-investment-backend/package.json starfetch-investment-backend/package-lock.json starfetch-investment-backend/src/config/configuration.ts starfetch-investment-backend/src/config/env.validation.ts starfetch-investment-backend/src/config/env.validation.spec.ts starfetch-investment-backend/src/modules/corporate-onboarding/corporate-onboarding.module.ts starfetch-investment-backend/src/modules/corporate-onboarding/crypto/corporate-tin-encryption.ts starfetch-investment-backend/src/modules/corporate-onboarding/crypto/corporate-tin-encryption.spec.ts starfetch-investment-backend/src/modules/corporate-onboarding/services/corporate-o2-availability.service.ts starfetch-investment-backend/src/modules/corporate-onboarding/services/corporate-o2-availability.service.spec.ts starfetch-investment-backend/scripts/generate-corporate-o2-hmac-keyring.mjs starfetch-investment-backend/docs/operations/CORPORATE-O2-PRODUCTION-READINESS.md
git diff --cached --check
git commit -m "Harden Corporate O2 production readiness"
git fetch origin
git rebase origin/main
git push --set-upstream origin feature/corporate-o2-production-readiness
```

If `git rebase` reports conflicts, stop and resolve/retest before pushing; do not force-push. No commit, push, merge, deployment or O2 activation was performed in this correction pass.
