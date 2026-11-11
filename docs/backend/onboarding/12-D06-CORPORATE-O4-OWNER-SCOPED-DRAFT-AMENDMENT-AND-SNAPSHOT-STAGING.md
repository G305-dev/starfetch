# D-06 Change Record — Corporate O4 amendments, owner discovery, and snapshot staging

**Change ID:** D06-CORP-O4-SNAPSHOT-STAGING
**Date:** 2026-10-22
**Disposition:** Backend implementation authorized as part of the coordinated Corporate-onboarding assignment; these exact operations are promoted in canonical `docs/api/openapi.yaml` v0.6.0. No frontend source was changed. Emmanuel coordination/review remains a handoff item; this record does not imply business/legal approval for provider use, documents, submission, compliance decisions, or investment access.

This record adds only the O4/D-06 surface below to the earlier O2/O3/O11 contract in `10-D06-CORPORATE-O2-ADDENDUM.md`. The six O2 Business Information fields and the six-state application lifecycle remain unchanged. The applicant identity, account ownership, verification tier, lifecycle state, and compliance decision are separate concepts. No Corporate principal access or permission is created by these routes.

## 1. Owner-scoped discovery

### `GET /api/v1/me/corporate-accounts`

Requires a live session-bound bearer token for a verified INVESTOR. Returns only Corporate applications whose immutable `initiatingUserId` equals the authenticated user. It is safe for an empty list. Principals are not inferred, and applications are never merged across users.

Each row contains `corporateAccountId`, the distinct `applicationId`, the six-state `status`, current `detailsVersion`, `createdAt`, `updatedAt`, and `accessVia: "INITIATING_APPLICANT"`. Business details, TIN, verification evidence, staff fields, and compliance outcomes are not returned. A principal who did not initiate an application does not gain access through this endpoint.

## 2. O4 DRAFT amendment

### `PATCH /api/v1/corporate-accounts/{corporateAccountId}/onboarding/draft`

The path parameter is a **CorporateAccount UUID**, not an application UUID. The server resolves it to a Corporate application and re-proves verified-investor and immutable initiating-user ownership on every request. Missing, malformed, or non-owned IDs return the same generic `404 NOT_FOUND`. Only `DRAFT` and `INFO_REQUESTED` are editable; other lifecycle states fail with `409 CONFLICT`.

Headers:

```http
Authorization: Bearer <session-bound-access-token>
Origin: https://<allowlisted-browser-origin>
Cookie: __Host-sf_csrf=<signed-session-bound-csrf-value>
X-CSRF-Token: <same-signed-session-bound-csrf-value>
If-Match: "<current-positive-details-version>"
Content-Type: application/json
```

The non-production CSRF cookie name is `sf_csrf`; secure environments use `__Host-sf_csrf`. The strong quoted `If-Match` value is mandatory. A missing/malformed value returns `400 VALIDATION_FAILED`; a stale version returns `409 CONFLICT` without changing canonical details or history.

The JSON body is a non-empty partial patch over the existing six O2 fields only:

```json
{
  "institutionName": "Synthetic Example Holdings Revised Ltd",
  "dateOfIncorporation": "2020-01-02",
  "rcNumber": "RC-SYNTHETIC-001",
  "taxIdentificationNumber": "<TIN supplied over TLS>",
  "businessPhoneNumber": "+2348000000000",
  "businessEmail": "accounts@example.invalid"
}
```

Any subset may be supplied; unknown fields, empty patches, and empty/invalid values are rejected. No status, actor, owner, authority declaration, related-person, bank, submission, staff, or compliance fields are accepted. TIN is write-only: the existing privacy/KMS activation gate must pass before encryption/persistence; plaintext is not returned, logged, or stored. If the gate is closed/unavailable, a TIN amendment fails closed and the whole patch rolls back. Other permitted details remain the same canonical O2 row, not duplicate fields.

A successful patch atomically increments `CorporateOnboardingDetails.version` and appends an immutable revision containing version, field-name metadata, before/after snapshots, and authenticated actor attribution. Snapshots retain TIN only as its existing encrypted envelope. Append failure rolls back the canonical update. Public history exposes only version, changed field names, and timestamp; it omits before/after values and actor IDs. The application remains in its existing lifecycle state; O4 performs no submission, verification, approval, or investment activation.

Rate limit: 60 requests/hour per authenticated user, using the keyed process-local limiter. It is per instance and resets on restart; horizontally scaled production requires a shared atomic limiter or a deliberately single-instance deployment. This limit is distinct from O2's existing five-create/hour/user limit.

## 3. O11 safe amendment metadata

`GET /api/v1/corporate-accounts/{corporateAccountId}/onboarding/history` remains read-only and initiator-scoped. Its response continues to include the permitted lifecycle `history` array and now includes `detailsAmendments`, an oldest-first array of `{version, changedFieldNames, changedAt}`. Neither amendment snapshots, TIN values/ciphertext, nor actor identifiers are returned.

## 4. Snapshot freshness and generation staging

### `GET /api/v1/corporate-accounts/{corporateAccountId}/onboarding/verification-snapshot/freshness`

Safe owner-scoped read. Reports the newest immutable snapshot `snapshotId`, `generation`, `isFresh`, and safe issue codes. Freshness compares captured account/details context to current authoritative context; a stale snapshot is retained unchanged. With no prior snapshot, the result is safely stale with `SNAPSHOT_MISSING`.

### `POST /api/v1/corporate-accounts/{corporateAccountId}/onboarding/verification-snapshot`

Requires session-bound authentication, verified initiating-applicant ownership, allowed Origin/Referer, and the same signed CSRF cookie/header pair as other browser mutations. This is an append-only **staging** operation, not a verification check. It requires an exact approved and published ruleset version already bound to the application. Replaying against unchanged captured context returns the existing generation idempotently; changed details append a new generation and do not overwrite old snapshots.

A staged snapshot records safe rule/requirement/subject counts and tier summaries. Requirements without evidence remain pending/unresolved; no document/provider/manual evidence is created or treated as verified. `submissionEligible` is always `false`. No route for O5 submission is introduced, and a snapshot is not a compliance decision or investment-access grant.

## 5. Safe errors and operational boundaries

- `400 VALIDATION_FAILED`: malformed/missing `If-Match`, empty patch, unknown field, or invalid patch value.
- `401 UNAUTHENTICATED`; `403 EMAIL_NOT_VERIFIED`, `FORBIDDEN`, or `CSRF_VALIDATION_FAILED` as applicable.
- `404 NOT_FOUND`: generic missing/malformed/non-owned Corporate account ID.
- `409 CONFLICT`: stale version, non-editable application state, or missing exact ruleset binding where staging requires one.
- `429 RATE_LIMITED`: O4 user-keyed rate limit.
- `500 INTERNAL_ERROR`: unexpected persistence/transaction failure; no database or sensitive payload details returned.
- `503 SERVICE_UNAVAILABLE` / `FEATURE_UNAVAILABLE`: required cryptographic/privacy dependency unavailable for TIN handling. The amendment is rolled back.

There is no Mono provider invocation/webhook, document upload/storage/scanning, representative/director collection, declaration capture, staff queue, staff decision, submission, final approval, or investor/investment eligibility route in this change. These remain default-disabled/unimplemented pending their own approved policy, operational prerequisites, and D-05/D-06 contracts. Individual and Joint APIs remain unchanged.

## 6. Synthetic acceptance coverage

The isolated PostgreSQL E2E journey creates an O2 DRAFT, publishes/binds a synthetic ruleset in test setup, stages generation 1, performs an O4 optimistic edit, detects the stale captured details version, appends generation 2, verifies amendment metadata and owner-scoped history/discovery, and asserts `submissionEligible: false`. Additional tests cover TIN encryption/non-disclosure, cross-user isolation, stale-version conflict, concurrent edits, and atomic rollback. Test-only ruleset authorization and cryptography do not enable production policy or secrets.

## 7. Emmanuel handoff

Use the exact paths and response schemas promoted in OpenAPI v0.6.0. Send the CorporateAccount UUID (not application UUID), include the current quoted details version in `If-Match`, and send only the changed subset of the original six business fields. Do not display/retain a TIN from any response. Discovery represents the initiating applicant only. Snapshot freshness/regeneration are technical staging signals and must not be described as verification completion, submission readiness, compliance approval, or investment eligibility. No frontend code was modified.
