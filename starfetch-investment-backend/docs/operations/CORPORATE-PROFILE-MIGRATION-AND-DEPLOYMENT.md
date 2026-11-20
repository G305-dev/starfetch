# Corporate Profile migration and manual deployment notes

**No migration was applied. No production/shared database was contacted.**  
**PostgreSQL tooling was unavailable in this workspace** (`psql`, `pg_isready`, Docker/Podman and a configured `DATABASE_URL` were absent). SQL execution remains unverified here.  
Source baseline: latest observed `main` = `2c461d6df7d471ce91f83af5a770554d21278333`.

## Additive migration

`prisma/migrations/20261118120000_corporate_profile_persistence/migration.sql`

The migration:

1. Adds nullable `users.primaryAccountType`.
2. Backfills `INDIVIDUAL` only from an Individual profile with no Corporate-owned application. Backfills `CORPORATE` only from an existing Corporate-owned application with no Individual profile **and no Joint membership**. A user who has a Joint membership is left unclassified by this migration so a Corporate classification cannot disrupt membership-based Joint access.
3. Leaves legacy Corporate applicants with **no O2 application** and no persisted Corporate applicant profile as `NULL`. The previous Corporate registration path did not persist `registrationType`; that absence of an O2 row is not sufficient proof for an automatic classification. Such applicants are not permanently blocked: a securely reviewed manual recovery can set the type so they can continue the existing Corporate draft/onboarding flow.
4. Adds `account_type_recovery_audits`, a one-time, append-only operator recovery ledger with separate requester/approver, support-case/evidence reference, verification method, and applied timestamp. An UPDATE from NULL to a primary account type is rejected unless an unapplied matching audit record exists. Once set, primary type remains immutable. No applicant API writes this table or changes account type.
5. Adds Corporate applicant display identity and four-section profile tables. Corporate Profile still requires an existing owner-bound Corporate application; no profile route creates an account or O2 application.
6. Adds profile revision history, integer NGN-kobo fields, encrypted bank-account envelope constraints, and DB guards. Raw TIN remains exclusively in canonical O2 details and plaintext NUBAN is never stored.

No earlier migration file is edited. The migration is forward-only; do not improvise destructive rollback SQL.

## Manual legacy Corporate account recovery (operator-only)

Use only when the existing database does not prove original registration type. **Do not ask the applicant to choose or change their account type in the product.** A null account type denies Corporate access until this case is reviewed; this is an intentional fail-closed state, not permanent lockout.

1. Open a restricted support case. Verify the signed-in account holder through the approved account-recovery process and locate authoritative registration evidence (for example, historical registration/provider records outside this database). Do not treat “no `InvestorProfile`” by itself as proof.
2. Require two different authorized staff: one requester and an independent approver. Record the case ID, verification method, evidence reference, and staff identities. Keep underlying identity documents/evidence in the approved restricted case system, not in this audit table.
3. Before recovery, inspect that the row is an `INVESTOR`, `primaryAccountType IS NULL`, has no Individual profile, and has no Joint membership. If an Individual profile or any Joint membership exists, stop and route to identity/Joint support; do not reclassify it through this Corporate recovery path. Do not create an InvestorProfile, CorporateAccount or application during type recovery.
4. Use a controlled DBA/operator connection (not a user-facing/admin API). Runtime application code has no recovery endpoint. Restrict `INSERT` on `account_type_recovery_audits` to the designated recovery operator role; do not use an application connection that owns the recovery table for this manual procedure. Migration ownership and runtime DB privileges must be separated before production recovery is enabled.
5. In one transaction, insert a pending audit record and update the user from NULL to the verified type. The database trigger consumes the audit row and sets `appliedAt`; the update is immutable thereafter. If the UPDATE returns anything other than exactly one row, or any step errors, `ROLLBACK` and escalate; never commit a pending/partial audit. A successful Corporate classification enables the user to resume existing Corporate onboarding without fabricating an O2 account.
6. Keep the audit row and support case; do not edit/delete either. Record the recovered user ID and audit row ID in the ticket.

Example **operator SQL template** (run only after the above case approval, on the intended isolated/staging database first). Replace all placeholder literals; do not place sensitive evidence itself in this SQL:

```sql
BEGIN;

-- Confirm this is the intended unresolved investor and that no Individual/Joint
-- evidence would be disrupted. Exactly one row must be returned.
SELECT u."id", u."role", u."primaryAccountType",
       EXISTS (SELECT 1 FROM "investor_profiles" ip WHERE ip."userId" = u."id") AS has_individual_profile,
       EXISTS (SELECT 1 FROM "joint_account_members" jm WHERE jm."userId" = u."id") AS has_joint_membership
FROM "users" u
WHERE u."id" = 'REPLACE-USER-UUID'::uuid
FOR UPDATE;

-- The operator must verify role=INVESTOR, primaryAccountType=NULL,
-- has_individual_profile=false, has_joint_membership=false. Otherwise ROLLBACK.
INSERT INTO "account_type_recovery_audits"
  ("id", "userId", "assignedType", "supportCaseId", "verificationMethod",
   "evidenceReference", "requestedBy", "approvedBy", "createdAt", "appliedAt")
VALUES
  (gen_random_uuid(), 'REPLACE-USER-UUID'::uuid, 'CORPORATE',
   'REPLACE-RESTRICTED-CASE-ID', 'REPLACE-VERIFICATION-METHOD',
   'REPLACE-RESTRICTED-EVIDENCE-REFERENCE', 'REPLACE-REQUESTER',
   'REPLACE-INDEPENDENT-APPROVER', CURRENT_TIMESTAMP, NULL);

UPDATE "users"
SET "primaryAccountType" = 'CORPORATE', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'REPLACE-USER-UUID'::uuid
  AND "role" = 'INVESTOR'
  AND "primaryAccountType" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "investor_profiles" ip WHERE ip."userId" = "users"."id")
  AND NOT EXISTS (SELECT 1 FROM "joint_account_members" jm WHERE jm."userId" = "users"."id")
RETURNING "id", "primaryAccountType";

-- Confirm exactly one UPDATE row and exactly one matching audit row with
-- appliedAt IS NOT NULL before COMMIT. Otherwise ROLLBACK.
SELECT "id", "supportCaseId", "assignedType", "requestedBy", "approvedBy", "appliedAt"
FROM "account_type_recovery_audits"
WHERE "userId" = 'REPLACE-USER-UUID'::uuid;
COMMIT;
```

Do not run the template unreviewed or against production as part of this delivery. Add standard key management, approval and change recording required by operations.

## Before any staging/shared deployment

1. Resolve repository release lineage; see the correction report and existing blockers. No prod/shared database access occurred in this task.
2. Use the isolated local test database instructions below to apply all migrations and run Corporate/auth tests. Also test a pre-upgrade snapshot with synthetic legacy rows to confirm backfill outcomes; never seed or test against dev/shared/production data.
3. Review migration/schema and recovery runbook; use a recoverable database backup/snapshot under the approved change process.
4. Review data residency, lawful basis, privacy/retention and access policy for applicant/company/declaration/bank fields.
5. Configure a distinct dedicated bank KMS key, least-privilege GenerateDataKey/Decrypt, correct region/workload identity and independent effective key material from O2 TIN KMS. Vercel should use approved OIDC; static AWS access-key environment variables are rejected when bank KMS is configured.
6. Configure `CORPORATE_PROFILE_BANK_KMS_KEY_ID` and `_VERSION`; bank-detail writes remain fail-closed with `503` without them. Existing O2 TIN gates and disabled-by-default status remain unchanged.
7. Keep frontend unchanged in this backend package. The Profile page still needs separately approved GET/PATCH integration and the login selector still does not send the selected portal.

## Exact isolated local PostgreSQL commands

These commands target only a disposable loopback database named `starfetch_test`, matching the E2E destructive-cleanup fuse in `test/utils/e2e-db-guard.ts`. Do **not** substitute a development, shared, staging, or production URL. Use your approved local Postgres administrator account; the password below is test-only.

```bash
# From a local Postgres host. Create a dedicated disposable test role/database.
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE starfetch_test_role LOGIN PASSWORD 'local-only-test-password';"
sudo -u postgres createdb --owner=starfetch_test_role starfetch_test

cd starfetch-investment-backend
export DATABASE_URL='postgresql://starfetch_test_role:local-only-test-password@127.0.0.1:5432/starfetch_test?schema=public'

# Verify the resolved target before any destructive E2E cleanup.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT current_database(), host(inet_server_addr()), current_user;'

# Apply all migrations to this disposable database and generate the client.
npx prisma migrate deploy
npx prisma generate

# Unit tests: auth registration/classification, Corporate context and save concurrency/rejection behavior.
npm test -- --runInBand --runTestsByPath \
  src/modules/auth/auth.service.spec.ts \
  src/modules/auth/dto/register.dto.spec.ts \
  src/modules/corporate-onboarding/services/corporate-applicant-context.service.spec.ts \
  src/modules/corporate-onboarding/services/corporate-profile.service.spec.ts

# PostgreSQL E2E: the harness independently checks db=starfetch_test,
# host=loopback and current_user=starfetch_test_role before destructive cleanup.
npm run test:e2e -- --runTestsByPath \
  test/auth.e2e-spec.ts \
  test/corporate-profile-recovery.e2e-spec.ts \
  test/corporate-draft-bootstrap.e2e-spec.ts
```

The local test suite verifies Corporate registration, null-account fail-closed behavior, audited one-time classification trigger, profile save/reload, owner isolation, and stale/concurrent submitted-state rejection. It uses synthetic data and does not call AWS KMS. For true backfill validation, start from a disposable DB at the previous migration boundary, insert synthetic legacy rows, then apply this migration and assert: Individual evidence → INDIVIDUAL; unambiguous Corporate-owned application → CORPORATE; no-O2 legacy Corporate candidate and ambiguous/Joint rows → NULL. The E2E migration trigger test does not replace that pre-upgrade fixture test.

If the local DB role/database already exists, do not rerun CREATE commands blindly; inspect the target first and use a disposable instance. The fixture/E2E cleanup deletes records from `starfetch_test` only.

## Rollback / recovery

No destructive down migration is supplied. If application code must be reverted, disable new API entry points by rolling back application code while leaving additive schema and immutable audit records intact. Recover data only through approved backup/recovery or a reviewed forward migration. Preserve key access so ciphertext is not orphaned.
