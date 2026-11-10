# Phase C1.4 Backend Implementation Handoff

**Status:** implementation and isolated PostgreSQL verification complete; not deployed.

## Delivered

- Account-kind-scoped subject resolution from the application's exact, immutable published-ruleset binding:
  - Individual: only the application owner.
  - Joint: each current member is recorded separately from the joint-account membership row.
  - Corporate: the legal entity is resolved from the application's owner context; representatives and beneficial owners remain explicit unresolved placeholders when there is no approved identity source. No people or relationships are invented or merged.
- A serializable, owner-scoped snapshot materializer with a unique application snapshot, version-linked source definitions, retry-safe replay, mismatch conflicts, concurrency protection, and transaction rollback on partial failure.
- Immutable requirement snapshots classified as Tier 1 basic/Mono preparation, Tier 2 conditional documents, and two separate Tier 3 gates (staff review and independent compliance approval). All new requirements remain pending; unresolved subjects produce unresolved requirements. No verification result or completion is inferred.
- Tier 2 copies both the document category key and the approved ruleset's opaque completeness specification into the snapshot. The specification is preserved, not interpreted or marked satisfied. New ruleset authoring rejects a missing or empty completeness object.
- C1.3 authoring authorization fails closed and takes the actor from the authenticated principal; an arbitrary caller-supplied user ID does not confer staff/governance authority.
- Database guards for immutable published rulesets, bindings, binding audit events, pins, and C1.4 snapshots, including protection against direct `TRUNCATE` bypass. Negative PostgreSQL tests cover update/delete attempts and protected-table truncation.

No new API controller, frontend/OpenAPI change, sensitive-identity column, submission flow, Mono client, upload/evidence store, staff decision endpoint, compliance endpoint, or investment activation was added. The existing six-state onboarding lifecycle and C1.1A/C1.2A behavior remain unchanged.

## Forward-only migrations

Applied only to the positively verified isolated local database `starfetch_test|127.0.0.1|starfetch`:

1. `20261109123000_c13_append_only_c14_subject_snapshots` — C1.3 append-only hardening and initial C1.4 snapshot tables/guards. **Applied; do not edit.**
2. `20261109143000_c14_document_completeness_snapshots` — adds ruleset completeness and immutable Tier 2 completeness/category snapshots with database checks. **Applied; do not edit.**
3. `20261109160000_c14_prevent_protected_truncate` — adds statement-level truncate guards to ruleset, binding, pin, audit, and snapshot tables. **Applied; do not edit.**

Prisma reports nine migrations found and the database up to date. The live-schema diff against `prisma/schema.prisma` is empty. E2E cleanup temporarily disables only the named truncate guards, inside a transaction, and only after verifying the exact local test database identity; it re-enables the guards before commit.

## Validation results

All successful database operations/tests were run against the verified local test database. The full E2E suite completed and the database was left clean.

- Prisma 5.22.0 schema validation: **passed**.
- Prisma Client generation: **passed**.
- TypeScript typecheck: **passed**.
- Backend build: **passed**.
- Focused ESLint on touched ruleset, C1.3/C1.4 E2E, and test-helper files: **passed**.
- Unit tests: **20 suites, 102 tests passed**.
- Full PostgreSQL E2E: **13 suites, 158 tests passed**.
- Final DB verification: identity `starfetch_test|127.0.0.1|starfetch`; rulesets, bindings, events, pins, snapshots, subjects, requirements, and applications all had zero rows; all protected-table truncate guards were enabled; migration status up to date; schema diff empty.

`npm run lint` still exits nonzero on **9 lint errors in untouched existing files** under the common/joint guards, services, and joint E2E tests (unused imports/locals and two `require()` imports). None are in the changed implementation files; targeted lint for the changed paths passes.

Expected Prisma error logs during E2E are assertions for uniqueness, rollback, immutable-record, authorization, and protected-truncate failures; the suites passed. `npm ci` previously reported 37 audit findings (11 low, 17 moderate, 9 high); no dependency updates or audit fixes were made.

## Deliberately out of scope / prerequisites before enabling later phases

- Synthetic fixtures exercise the mechanics only; there is no approved production ruleset, subject policy, document-category catalog, or completeness vocabulary in this change. Those must be supplied and approved by the proper policy owners before conditional collection or eligibility decisions.
- Corporate related-person subjects remain unresolved until a separately approved identity/relationship source and controls exist. No TIN or new sensitive identity data is stored.
- Completeness remains opaque policy data. Evaluating evidence against it, scanning/classifying uploads, evidence storage, Mono integration, and requirement satisfaction are not implemented.
- Tier 3 rows express two independent pending gates only. Staff and compliance decision workflows/authorities are not enabled.
- Submission, pin-at-submission, rebinding/public ruleset management, and investment activation remain disabled; C1.7 must explicitly implement submission before any pin can occur.
- AES-256-GCM envelope encryption under AWS KMS and a separately versioned HMAC key for future idempotency fingerprints remain mandatory before future sensitive payload/fingerprint collection. This phase stores no document payload or new sensitive identity data and does not introduce those future key integrations.
- Production operations must use an application database role that is **not** table/schema owner and has no DDL or truncate-trigger-disabling privileges. The migrations/test role is privileged; PostgreSQL owners can alter/drop triggers and are trusted operators. No production role setup or deployment was performed.

## Implementation ZIP

The companion archive contains the backend source, schema, all migrations, tests, lockfile, and this handoff. It excludes environment files (including `.env.example`), credentials, dependency directories, build output, caches, archives, and unrelated workspace files.
