# Corporate Profile backend validation report — correction pass

**Baseline:** latest observed `main` commit `2c461d6df7d471ce91f83af5a770554d21278333`, same as prior ZIP.  
**Workspace run:** 22 October 2026. No migration applied, no database accessed.

## Passed

| Check | Result |
|---|---|
| `DATABASE_URL=<dummy loopback-form URL> npx prisma validate` | PASS — schema valid; this does not connect to PostgreSQL or validate SQL migration syntax. |
| `npx prisma generate` | PASS — Prisma Client generated. |
| `npm run typecheck` | PASS. |
| `npx tsc --noEmit --incremental false -p tsconfig.json` | PASS — includes application and E2E TypeScript. |
| `npm run build` | PASS — Prisma generate + Nest build. |
| `npm test -- --runInBand` | PASS — 55 suites passed, 287 tests passed, 2 skipped (289 total). |
| Targeted ESLint on corrected Corporate service/tests, auth registration tests, Corporate E2E, shared DB test helper and Corporate E2E fixtures | PASS. |

The two skipped tests are optional external integrations: S3-compatible provider and real ClamAV; they are not Corporate Profile database tests.

## PostgreSQL validation: not available here

The workspace had no `psql`, `pg_isready`, Docker/Podman binary, or configured database URL. Therefore the migration SQL, DB triggers, data backfill, real registration/profile transactions, and new PostgreSQL E2E suite **were not run** here. This is a pre-merge gate. `CORPORATE-PROFILE-MIGRATION-AND-DEPLOYMENT.md` contains the exact isolated `starfetch_test` setup, migrate, unit, and E2E commands. It also calls for synthetic pre-upgrade backfill fixtures, since the normal E2E run starts from an empty migrated test DB.

New coverage delivered but not executed in this environment:

- `test/corporate-profile-recovery.e2e-spec.ts`: PostgreSQL registration classification, one-time recovery audit trigger, profile save/reload, non-owner denial, submitted-state rejection and a concurrent submit/amendment race.
- `src/modules/corporate-onboarding/services/corporate-profile.service.spec.ts`: every save section rechecks status in the transaction; also stale ownership, rejected amendments, and deterministic submission-wins behavior.

## Notes

- The full repository lint command had 13 errors on the previous validation pass in other Individual KYC, Joint, Verification Documents and E2E files. This correction pass linted all touched feature/auth/test-helper files directly; no unrelated flows were altered.
- `npm ci --ignore-scripts` reported 68 lockfile advisories (3 low, 15 moderate, 50 high); no dependency remediation was made.
- AWS KMS was not called. Unit tests use test adapters. Separate-bank-key provisioning, IAM/OIDC permissions and actual ciphertext round-trip remain operator checks.
- No production/shared DB read/write, migration apply, deploy, push, merge, or frontend edit occurred.
