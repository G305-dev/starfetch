# Corporate Backend — pre-merge correction report

**Requested corrections:** legacy Corporate recovery, transaction-time application authorization, PostgreSQL validation plan.  
**Base:** latest observed `main` remained `2c461d6df7d471ce91f83af5a770554d21278333` (same commit as the previous ZIP).  
**Scope:** backend and backend documentation/tests only. No frontend files changed; no push, merge, deployment or production resource access.

## Corrections made

1. **Legacy account recovery:** the migration still does not classify a no-O2/no-identity legacy user from absence alone. Unambiguous existing Corporate application evidence is backfilled only when no Individual profile or Joint membership conflicts. No-O2 users remain NULL rather than being permanently stranded: the migration now supplies a one-time DB audit ledger/trigger for support-reviewed, two-person operator recovery. There is no self-service type-change API; the trigger rejects unaudited NULL-to-type updates and keeps assigned type immutable. The runbook requires authoritative evidence, verified account ownership, distinct requester/approver, restricted case reference, and stops if an Individual profile or Joint membership exists.
2. **Transaction-time authorization:** all four Corporate Profile save methods now lock and re-read the matching Corporate application inside the serializable write transaction using `SELECT ... FOR UPDATE`, binding application ID, account ID, and authenticated initiator. Current status is rechecked against the established editable-state allowlist before any writes/revisions. Stale ownership returns generic 404; stale/non-editable status and serialization races return 409. TIN encryption/versioning and append-only Corporate details/Profile revisions remain in the same transaction.
3. **Tests and operational instructions:** added unit coverage across all save sections for stale/non-editable state, ownership recheck, rejected amendments, and a deterministic submit-wins race. Added an isolated-PostgreSQL E2E suite for Corporate registration/classification, recovery audit trigger, profile persistence/reload, owner restrictions and submitted-state behavior. Updated Corporate test fixtures; Individual KYC and Joint implementation files were not changed. The database cleanup helper now cleans the new audit/profile tables only after verifying the designated loopback test DB.

## Verification results in this workspace

- Prisma schema validation and client generation: **passed**.
- TypeScript application typecheck and full-project no-emit typecheck: **passed**.
- Focused Jest: **3 suites / 19 tests passed**.
- ESLint on the changed service, unit tests, Corporate E2E, auth E2E and relevant Corporate fixtures: **passed**.
- **PostgreSQL unavailable:** `psql`, `pg_isready`, Docker/Podman and a configured local database URL were absent. No SQL migration or PostgreSQL E2E ran here. Prisma validation does not validate/execute the migration SQL. Exact setup, migrate, and E2E commands are in `CORPORATE-PROFILE-MIGRATION-AND-DEPLOYMENT.md`.

## Remaining pre-merge gates

- Run the migration and E2E suite on the dedicated loopback `starfetch_test` database using the runbook commands; also verify backfill branches on a disposable pre-upgrade snapshot with synthetic fixtures.
- Have Security/Operations approve the manual recovery role separation and ensure the runtime DB role cannot insert recovery audit events. Do not apply recovery SQL with runtime credentials.
- Reconcile existing OpenAPI/D-06 release-lineage caveat before publication and retain the previous KMS/O2/data-protection gates.
