# Corporate onboarding backend — implementation status and Emmanuel handoff

**As of:** 2026-10-22
**Overall disposition:** the O2/O3/O11 foundation plus O4 amendment/discovery/snapshot-staging subset is implemented and tested. The expanded Corporate-onboarding assignment is **not complete and is not production-ready**: provider evidence, documents/scanning, staff review, conditional data collection, submission, final approval, and investment eligibility remain unimplemented or blocked on approved policy/operations. This record distinguishes working backend behavior from unavailable future capabilities; it does not imply business, legal, provider, or production approval.

## Implemented in this repository

The earlier O2/O3/O11 implementation is covered by `10-D06-CORPORATE-O2-ADDENDUM.md`. The additional O4 surface is formally recorded in `12-D06-CORPORATE-O4-OWNER-SCOPED-DRAFT-AMENDMENT-AND-SNAPSHOT-STAGING.md` and canonical OpenAPI v0.6.0.

- **O2**: authenticated owner-bound Corporate DRAFT creation from the original six fields, idempotent receipt, HMAC fingerprint/key digests, encrypted TIN envelope, and fail-closed privacy/KMS gate. O2 remains unavailable by default until its explicit operational/privacy gates pass.
- **O3/O11**: initiator-only details/status and safe history reads using explicit CorporateAccount IDs, generic non-owner 404s, and a masked-or-null TIN projection. History now includes safe immutable amendment metadata only.
- **O4**: partial edits to the same six original fields, verified initiating-applicant ownership, DRAFT/INFO_REQUESTED state checks, mandatory strong quoted `If-Match`, optimistic serializable update, immutable versioned before/after revision snapshots, encrypted TIN envelopes only, and atomic rollback on revision failure. TIN edits pass the existing privacy/KMS gate. Per-user keyed limit is 60/hour, process-local.
- **Corporate discovery**: `GET /me/corporate-accounts` includes only applications initiated by the authenticated verified investor; principal access and cross-user merging are not inferred.
- **Verification snapshot staging**: owner-scoped freshness assessment and append-only immutable generations tied to the exact published/bound ruleset and captured Corporate details version. Stale generations are retained. These snapshots create no evidence, do not imply verification, and always report `submissionEligible: false`.
- **Mono sandbox preparation**: an internal adapter, response validator, safe status mapper, shared-secret webhook processor, and test-only synthetic adapter are wired in a dedicated module. Default consent/evidence/replay providers deny operations; no route exists and no provider call can be made with the current defaults. See `14-MONO-PROVE-SANDBOX-ADAPTER-STATUS.md`.
- **Six-state lifecycle and Individual/Joint compatibility**: not changed by this implementation. The existing ruleset/snapshot substrate continues to pass Individual/Joint E2E regressions.

### Emmanuel contract handoff

Use `docs/api/openapi.yaml` v0.6.0 as the canonical API schema and the two D-06 addenda for operational semantics. In particular:

```http
PATCH /api/v1/corporate-accounts/{corporateAccountId}/onboarding/draft
If-Match: "<current-details-version>"
Cookie: __Host-sf_csrf=<session-bound-value>
X-CSRF-Token: <same-value>
```

Send only a partial patch of the six original Business Information fields; the path ID is the CorporateAccount UUID, not the application UUID. Reload after `409 CONFLICT` and use the current version. Never render or persist a TIN response value. `GET /me/corporate-accounts` means initiating applicant only. Snapshot endpoints are internal workflow staging signals, not verification, submission readiness, compliance approval, or investment eligibility. No frontend source was changed.

## Explicitly not implemented / blocked

1. **Tier 1 provider checks:** a sandbox-only Mono Prove adapter seam, provider-response validator, authenticated webhook processor, test-only synthetic adapter, and fail-closed environment gates now exist. However, no public initiation/webhook route, approved consent capture/store, append-only provider-evidence database model, or durable replay store is wired; deny-all defaults prevent any external call in the current build. No Mono request was sent and no credentials were configured or inspected. The documented webhook uses `mono-webhook-secret`; no HMAC signature is assumed. Automatic POST retries are withheld until Mono's idempotency semantics are established. See `14-MONO-PROVE-SANDBOX-ADAPTER-STATUS.md`. Actual sandbox enablement still requires approved consent/privacy/lawful-basis text, a persisted-consent and evidence/replay store, D-06 route review, and sandbox credentials from an approved secret store. Provider evidence remains distinct from final compliance approval.
2. **Tier 2 documents:** no upload endpoint, document metadata/version table, private storage adapter, quarantine workflow, scanner integration, or download endpoint exists. Do not choose mandatory categories or size limits in code. D-05 still needs an explicit storage-provider decision (existing Firebase direction vs proposed S3), document categories/limits/retention policy, encryption/KMS configuration, and an operational scanner. Until then, no document can satisfy a requirement.
3. **Tier 3 review and approval:** no staff queue/details/evidence APIs, information-request workflow, review or compliance-decision write path, or staff permission-grant records exist. Designated reviewer/final-approver rosters and permissions are not configured; no self-approval or ADMIN-role shortcut is available because no approval route has been created.
4. **Conditional Corporate collection:** related-person, director/beneficial-owner, authority/declaration, and bank-information capture is not implemented. No required-person thresholds, declarations, or bank fields were invented. They must come from an approved, versioned ruleset and business/legal contract.
5. **O5 submission:** no public submission route exists. Snapshot staging alone is insufficient. Submission must remain blocked until approved collection requirements exist and every required subject, Tier 1 evidence, Tier 2 document, declaration/conditional-data requirement, freshness condition, and server-side completeness check can be evaluated and atomically pinned.
6. **Final decision and investment access:** no independent final Corporate compliance-decision endpoint or investment-eligibility gate exists. No approval/access must be inferred from a provider response, document scan, account membership, or snapshot.

These boundaries are intentional, not successful/verified substitutes. The production provider/storage/scanner/staff/investment-dependent functions remain unavailable pending their external approvals and operational dependencies. The current source bundle must not be described as a complete Corporate onboarding implementation.

## Verification results

- Isolated PostgreSQL identity was positively verified as `starfetch_test` on loopback using non-superuser, non-createdb role `starfetch_test_role`; that role has no memberships and no persistent CREATE privilege on the other listed databases. E2E suites verify target identity before cleanup. No production, staging, shared, or unidentified database was used.
- Prisma validation and client generation: passed; migration status: all 11 existing migrations applied/up to date.
- Unit tests: 31 suites / 155 tests passed after adding the gated Mono adapter, webhook normalizer, synthetic adapter, and config-validation tests.
- Full PostgreSQL E2E: 16 suites / 179 tests passed for the O2/O3/O11, O4, snapshot-generation, and Individual/Joint source before the later internal Mono adapter module was added. Expected test-only negative-path exceptions were logged by fixtures; no suite failed. A post-Mono-module E2E rerun could not start: the refreshed workspace has no `postgres` OS account, `psql`, or `pg_isready`; no database was accessed or reprovisioned. The Mono module made no schema or public-route changes, but its integration with full app bootstrap remains to be rerun against a positively verified isolated DB.
- Typecheck: passed after the Mono module addition. Production build: passed after the Mono module addition.
- Focused ESLint on all changed TypeScript files: passed. Full repository lint remains blocked by 9 pre-existing errors in unrelated cookie/joint files and tests (`Request`/`Tx`/fixture values unused; two `require()` imports). Those unrelated files were not modified.
- OpenAPI 3.0.3 YAML parses; 18 paths and 19 unique operations; duplicate keys, path parameters, and local refs validated.
- No deployment, frontend change, Git operation, customer data use, credential inspection, or external provider request was performed.
