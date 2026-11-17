# C1.3 — Versioned Verification Rulesets and Application Binding

**Status:** Implemented and tested as dormant internal infrastructure. PostgreSQL migration applied only to the verified local `starfetch_test` database. No publication, rebinding, submission, or public API is enabled.

## Implementation

- Added `VerificationRuleset` identity and monotonically numbered `VerificationRulesetVersion` models scoped to the existing Individual/Joint/Corporate account-kind enum. Version lifecycle is DRAFT/PUBLISHED with separate approval and publication actor/time fields.
- Added data-driven definitions for required subject keys, check-kind keys, accepted evidence-source keys, and conditional document keys/JSON conditions. The implementation defines no actual KYC/business categories and does not interpret conditions.
- Added database constraints/triggers for stable version identity, explicit approval/publication attribution, non-empty publication completeness, and preventing changes to published versions or their child definitions—including moving child definitions out of a published version.
- Added application binding, binding-operation audit events, and a separate submission-pin record. Composite foreign keys enforce that the application and ruleset version account kinds match. A binding is one-time, DRAFT-only, version-specific, and transactional with its audit event.
- Added internal ruleset draft/version authoring and initial-binding services. The production binding-authorizer provider denies all requests; no publication or rebinding method, submit/pin service, or controller exists. No approved/default ruleset is seeded.
- Test cleanup verifies live DB identity and truncates only the new ruleset tables within the already guarded isolated test-database transaction; this is test cleanup, not a production operation.

## Changed files

Repository-relative paths:

- `prisma/schema.prisma`
- `prisma/migrations/20261108103000_verification_ruleset_binding_foundation/migration.sql`
- `src/app.module.ts`
- `src/modules/verification-rulesets/dto/ruleset-draft-definitions.input.ts`
- `src/modules/verification-rulesets/dto/ruleset-draft-definitions.input.spec.ts`
- `src/modules/verification-rulesets/security/ruleset-binding-authorizer.ts`
- `src/modules/verification-rulesets/services/verification-ruleset-draft.service.ts`
- `src/modules/verification-rulesets/services/verification-ruleset-draft.service.spec.ts`
- `src/modules/verification-rulesets/services/application-ruleset-binding.service.ts`
- `src/modules/verification-rulesets/services/application-ruleset-binding.service.spec.ts`
- `src/modules/verification-rulesets/verification-rulesets.module.ts`
- `test/utils/test-app.ts`
- `test/verification-ruleset-binding.e2e-spec.ts`
- `docs/PHASE-C1.3-IMPLEMENTATION-HANDOFF.md`

No C1.1A migration, frontend, OpenAPI, lockfile, or Individual/Joint implementation files were changed.

## Validation actually run

- `npm ci` — passed from the checked-in lockfile. npm reported 37 audit findings (11 low, 17 moderate, 9 high); no automatic audit fix or dependency upgrade was run.
- `npx prisma format`, `npx prisma validate`, `npx prisma generate` — passed (Prisma Client 5.22.0).
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `npm test -- --runInBand` — **19 suites, 97 tests passed**.
- Targeted ESLint on changed application/module/test files — passed.
- `npm run lint` — still fails on 9 unrelated existing findings: unused `Request` in `src/common/security/cookie-mutation.guard.ts` and `src/modules/joint/guards/joint-membership.guard.ts`; unused `Tx` in `src/modules/joint/services/joint-mutation.service.ts`; unused `repl` and two forbidden `require()` calls in `test/joint-mutations.e2e-spec.ts`; unused `idD` in `test/joint-read.e2e-spec.ts`; unused `outsiderId` and `pendingId` in `test/joint-security.e2e-spec.ts`.
- Explicit C1.3 E2E run — **8 tests passed**.
- Full PostgreSQL E2E run — **12 suites, 151 tests passed**, including existing auth, dashboard, Joint, Corporate C1.1A/C1.2A and new C1.3 scenarios. Expected error logs correspond to negative integrity/security assertions and injected rollback failures; the suites passed.
- `npx prisma migrate deploy` — applied the five prerequisites and C1.3 migration to an empty, locally provisioned PostgreSQL 17 test DB. `npx prisma migrate status` reports up to date; Prisma schema-to-live-database diff is empty. Final test cleanup left zero rulesets, bindings, pins, or onboarding applications.

The live DB identity was checked before migration and destructive cleanup as `starfetch_test|127.0.0.1|starfetch`. No production, staging, shared, or unidentified database was contacted. Prisma tooling reported loading `.env`; its contents were not inspected or copied.

## Disabled functionality and approvals still required

- **Publication/approval:** no publication service or real approval authority exists. Approval/publication fields are schema metadata only. Synthetic published versions are created directly inside isolated E2E fixtures; no approved ruleset exists by default.
- **Binding/rebinding:** production default authorization is deny-all. There is no rebinding method; a unique application binding plus immutable update trigger prevents silent replacement. A test-only allowlist is used only in synthetic E2E.
- **Submission/pinning:** no submission endpoint/service or pin operation exists. Binding and the separate future submission pin remain distinct. Corporate DRAFT can be created with no ruleset.
- No verification result, compliance clearance, subject-resolution operation, document upload, external verification, TIN, banking, or investment activation was added.
- Business/compliance must still approve actual ruleset content, authority grants, and any future publication/rebinding/submission behavior. Do not infer roles or categories from the schema keys.

## Reproducible local checks

Use only a local PostgreSQL cluster and the dedicated `starfetch_test` database. Never run these commands against a shared or managed URL.

On Debian with PostgreSQL 17 packages available, a fresh local setup can use:

```sh
sudo apt-get install -y postgresql-17 postgresql-client-17
sudo pg_ctlcluster 17 main start
sudo -u postgres createuser --login --no-superuser --no-createdb --no-createrole starfetch
sudo -u postgres createdb --owner=starfetch starfetch_test
```

Set a **local test-only** password interactively from a `sudo -u postgres psql` session; keep the value out of source, handoffs and ZIPs. Configure `DATABASE_URL` in the local shell (not a committed file), then positively verify before migration or any test cleanup:

```sh
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atc \
  "SELECT current_database() || '|' || host(inet_server_addr()) || '|' || current_user"
# Continue only if the exact result is: starfetch_test|127.0.0.1|starfetch
```

From the backend repository root:

```sh
npm ci
npx prisma migrate deploy
npx prisma format && npx prisma validate && npx prisma generate
npm run typecheck
npm run build
npm test -- --runInBand
npx eslint src/app.module.ts test/utils/test-app.ts test/verification-ruleset-binding.e2e-spec.ts \
  $(find src/modules/verification-rulesets -type f -name '*.ts')
npm run test:e2e
```

The E2E cleanup helper independently verifies the live database identity before its transaction and refuses other targets. `test/setup-env.ts` supplies local test-only defaults; for an explicit local connection, export the verified `DATABASE_URL` before `npm run test:e2e`.

No Git operation, merge, deployment, automatic dependency update, or `.env` inspection/copy was performed.
