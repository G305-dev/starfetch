# STARFETCH — Corporate Verification and Approval Completion Report

**Date:** 22 October 2026
**Scope:** Backend-only implementation and verification in `starfetch-investment-backend`.

## Executive summary

The safely implementable Corporate verification infrastructure is present in the backend: durable consent/evidence journals, sandbox-gated Mono adapters, quarantined document workflows, internal Corporate staff review, and an internal fail-closed investment-eligibility service. No public route, frontend change, deployment, production credential use, or customer-data operation was added.

The remaining operational paths are intentionally disabled pending approved provider/legal configuration, document policy and infrastructure, and staff authority. O5 submission is not exposed or activated. The final new PostgreSQL synthetic journey spec was added and type-transformed by Jest, but could not execute against PostgreSQL in this turn because `127.0.0.1:5432` was unavailable. The test’s live identity check is before cleanup, and no destructive SQL or migration was run in this turn.

## Implementation versus blockers

| Workstream | Implemented | Not enabled / blocker |
|---|---|---|
| Tier 1 — Mono Prove | Durable versioned consent grants/withdrawals; owner/application/subject/requirement authorization; separate versioned HMAC operation-key digests; append-only provider attempt/evidence rows; sandbox-only Prove adapter; documented webhook-secret authentication; atomic replay deduplication; sanitized persistence and no customer identifier in evidence results/logs. | Provider calls remain off unless approved sandbox configuration and consent/privacy/lawful-basis versions are all enabled. No production/live key path is enabled. No real Mono call was made. The newly added PostgreSQL journey test awaits an available, positively verified isolated database. |
| Tier 1 — Mono Lookup | Separate CAC/TIN adapter and Corporate-only service; server-side CAC/TIN lookup; TIN decrypted transiently and not returned or logged; consent and evidence gates; sanitized outcome persistence. | Sandbox credentials, approved consent/privacy/legal text, and feature configuration remain prerequisites. No real provider call was made. |
| Tier 2 — Documents | Internal service for private object-storage ports, quarantine metadata, hashes/size/media type, append-only event audit, scanner gate, clean/rejected state, owner-scoped download, access audit, and replacement versioning. Isolated in-memory storage and synthetic scanner exist for test injection only. | Production module binds deny-all storage and scanner. Collection also remains gated off pending D-05/document policy and approved private storage plus malware-scanning infrastructure. No upload/download route exists. |
| Tier 3 — Staff/compliance | Internal Corporate-only queue/review service, information requests, review and decision audit events, independent final compliance approval/rejection, and eligibility checks that require an independent actor. | Production staff authorizer denies by default. Staff review and final decisions remain unavailable until an explicit least-privilege authority is configured. Individual/Joint staff workflows were not added. |
| O5 — Submission/eligibility | Internal investment eligibility assessment checks approved application state, current pinned/published ruleset snapshot, required verification evidence, clean documents, review decision, and independent final approval; `assertEligible` fails closed. | No O5 submission route/service was added because all mandatory evidence/document/subject/compliance requirements cannot yet be operationally checked. No automatic investment activation occurs. |
| API contracts | No public API endpoints were added; internal services are not routes. | Therefore no OpenAPI or D-06 endpoint contract was changed. No canonical OpenAPI/D-06 file was present in this backend workspace search. If routes are proposed later, contract change control remains required first. |

## Verification results

### Passed in this turn

- `npm ci --no-audit --no-fund` — restored dependencies strictly from the existing lockfile; no dependency upgrade was requested.
- `npm test -- --runInBand` — **32/32 suites, 161/161 tests passed**.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `npx prisma validate` — schema valid.
- Changed-scope ESLint on verification-provider, verification-document, Corporate review/eligibility/lookup services, the new journey spec, and test DB cleanup — passed.

### E2E status and limits

- Previous full PostgreSQL E2E run (before adding the new journey spec) passed **16/16 suites, 179/179 tests** after the immutable-table cleanup correction. It used the positively verified `starfetch_test|starfetch_test_role|127.0.0.1|5432` target.
- The new `test/verification-provider-journey.e2e-spec.ts` was attempted. The current local PostgreSQL server was unavailable at `127.0.0.1:5432`; an earlier attempt using the app’s test default also showed the configured `starfetch` user is not the required `starfetch_test_role`. The new spec’s identity check occurs before `cleanDatabase`, so this failure did not run destructive cleanup.
- No migration was reapplied or edited. The infrastructure migration remains applied to `starfetch_test` from the earlier verified run.
- **Full-repository lint is not clean:** it reports 9 existing errors outside the changed verification scope: unused `Request` in `src/common/security/cookie-mutation.guard.ts` and `src/modules/joint/guards/joint-membership.guard.ts`; unused `Tx` in `src/modules/joint/services/joint-mutation.service.ts`; unused `repl` and two forbidden `require()` calls in `test/joint-mutations.e2e-spec.ts`; unused `idD` in `test/joint-read.e2e-spec.ts`; and unused `outsiderId`/`pendingId` in `test/joint-security.e2e-spec.ts`. These unrelated Individual/Joint files were not modified. Changed-scope lint passed.

## Required before activation

1. Start/provision the isolated loopback PostgreSQL test service and provide its test-only connection configuration so the live identity is exactly `starfetch_test`, `starfetch_test_role`, and loopback. Then rerun the new journey spec and complete E2E suite. Do not reset or migrate any other database.
2. Provision approved Mono sandbox credentials via the secret store, and approve/version consent text, privacy notice, and lawful-basis copy before enabling either provider.
3. Approve D-05 document categories/policy and provide private storage plus malware scanning before enabling document collection.
4. Configure explicit staff capabilities and independent compliance authority before enabling decisions.
5. Keep O5 submission and investment access closed until all ruleset-driven requirements can be assessed against current evidence and a pinned snapshot.

## Relevant implementation files

- `src/modules/verification-providers/` — consent, Mono Prove/Lookup adapters, webhook processor, evidence journals, keyring, and synthetic tests.
- `src/modules/verification-documents/` — storage/scanner ports, deny-all production bindings, and internal document lifecycle service.
- `src/modules/verification-rulesets/` — versioned policy, binding, snapshot, and freshness foundation.
- `src/modules/corporate-onboarding/services/corporate-staff-review.service.ts` and `corporate-staff-review-authorizer.ts` — internal Corporate review and authority gate.
- `src/modules/corporate-onboarding/services/corporate-investment-eligibility.service.ts` — fail-closed eligibility check.
- `src/modules/corporate-onboarding/services/corporate-mono-lookup-verification.service.ts` — owner-scoped Corporate CAC/TIN operation.
- `prisma/schema.prisma` and `prisma/migrations/20261112120000_corporate_verification_infrastructure/migration.sql` — durable tables, constraints, append-only guards, and event sequencing.
- `test/verification-provider-journey.e2e-spec.ts` — new synthetic PostgreSQL journey; pending an available isolated DB.
- `test/utils/test-app.ts` and `test/utils/e2e-db-guard.ts` — identity-guarded test cleanup.
