# D-06 Addendum — Corporate O2/O3/O11 API Contract and Handoff

**Date:** 2026-10-22  
**Status:** Historical O2/O3/O11 subset promoted in canonical `docs/api/openapi.yaml` v0.5.0; O2 TIN writes/decryption remain gated by explicit privacy/KMS approvals. The current combined contract is v0.6.0; O4, owner discovery, and snapshot staging are recorded separately in `12-D06-CORPORATE-O4-OWNER-SCOPED-DRAFT-AMENDMENT-AND-SNAPSHOT-STAGING.md`.

This addendum records the exact O2/O3/O11 backend/frontend contract and remains unchanged for those routes. It supersedes only the older O2/O3/O11 examples in D-06 and the wider proposal document. Individual and Joint contracts, other endpoints, and business/compliance decisions are unchanged. Production activation approvals remain gates; do not infer approval from engineering implementation.

## Endpoint

`POST /api/v1/corporate-accounts/applications`

- Success status: `201 Created`.
- The route exists but is **unavailable by default**, including in production. Before the explicit feature switch can pass, the server requires all three deployment approvals, an environment-specific AWS KMS key/version/region, and a valid dedicated O2 HMAC keyring. Missing or false gate settings return `503 FEATURE_UNAVAILABLE` before authentication is evaluated.
- No Individual/Joint route or existing endpoint is changed.

## Exact request

Headers:

```http
Authorization: Bearer <session-bound-access-token>
Origin: https://<allowlisted-browser-origin>
Cookie: __Host-sf_csrf=<signed-session-bound-csrf-value>
X-CSRF-Token: <same-signed-session-bound-csrf-value>
Idempotency-Key: <opaque-client-generated-value>
Content-Type: application/json
```

In non-production, the existing CSRF cookie name is `sf_csrf`; in staging/production it is `__Host-sf_csrf`. A browser `Origin` (or fallback `Referer`) must match configured CORS origins. The authenticated bearer token must refer to a live session and an INVESTOR whose email is verified. Missing/invalid `Idempotency-Key` is a validation error; accepted length is 1–255 characters. The raw key is not persisted.

The JSON body accepts exactly these six fields; unknown fields (including actor, ownership, submission, authority, approval, or lifecycle fields) are rejected:

```json
{
  "institutionName": "Synthetic Example Holdings Ltd",
  "dateOfIncorporation": "2020-01-02",
  "rcNumber": "RC-SYNTHETIC-001",
  "taxIdentificationNumber": "<TIN supplied over TLS>",
  "businessPhoneNumber": "+2348000000000",
  "businessEmail": "accounts@example.invalid"
}
```

Structural validation only: `institutionName` 1–255 chars; `dateOfIncorporation` a real calendar date in `YYYY-MM-DD`; `rcNumber` 1–255 chars; `taxIdentificationNumber` 1–256 chars with no registry-specific format or eligibility inference; `businessPhoneNumber` 1–64 chars with no unapproved format policy; `businessEmail` valid email, at most 254 chars and normalized to lowercase. Whitespace is trimmed. TIN is encrypted before its database write and is never returned, logged, or stored as plaintext. On O3 reads the TIN projection is `null` while the full KMS/privacy activation gate is closed; when the gate is open, values up to 8 code points are fully masked and longer values reveal at most 25% of a suffix, capped at four code points.

## Exact success response

The normal application interceptor wraps the receipt. Creation, exact idempotency replay, and same-initiator/same-six-field duplicate-content replay use `201`; replay preserves the original receipt IDs while `meta.requestId` belongs to the current HTTP request.

```json
{
  "data": {
    "corporateAccountId": "<uuid>",
    "applicationId": "<uuid>",
    "applicationStatus": "DRAFT",
    "detailsVersion": 1
  },
  "meta": {
    "requestId": "<request-uuid>"
  }
}
```

No TIN, masked TIN, ciphertext, encrypted data key, key ID, HMAC, email-verification secret, authority declaration, compliance status, submission field, or investment-access field appears in the creation receipt. DRAFT rows have `submittedByUserId = NULL` and `submittedAt = NULL`; they do not grant principal rights, approval, or investment access.

## Errors and feature availability

All errors keep the existing envelope shape:

```json
{"error":{"code":"<CODE>","message":"<safe message>","requestId":"<request-uuid>"}}
```

For validation failures, `fields` may also be present with field names/messages only; request values are not echoed.

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Invalid/missing fields, unknown extra fields, invalid date/email, or missing/invalid `Idempotency-Key`. |
| 401 | `UNAUTHENTICATED` | Missing/invalid bearer token, expired/revoked session. |
| 403 | `EMAIL_NOT_VERIFIED`, `FORBIDDEN`, or `CSRF_VALIDATION_FAILED` | Email unverified, non-investor, disallowed browser origin, or missing/mismatched/session-invalid CSRF pair. |
| 409 | `CONFLICT` | Same initiator and O2 key reused for a different canonical six-field payload. Message is generic; no resource is disclosed. |
| 429 | `RATE_LIMITED` | Post-authenticated O2 throttle: 5 create requests/hour/user. No O2-specific IP-keyed limit is currently configured. The adapter is process-local in-memory: limits are per instance and reset on restart; horizontally scaled production requires a shared/distributed `RATE_LIMITER` or a deliberately single-instance deployment. |
| 503 | `FEATURE_UNAVAILABLE` | O2 switch, privacy approvals, KMS configuration, or HMAC configuration is not ready. |
| 503 | `SERVICE_UNAVAILABLE` | KMS/HMAC cryptographic dependency unavailable; the transaction is rolled back. Safe generic message only. |
| 500 | `INTERNAL_ERROR` | Unexpected persistence/transaction failure; details are not returned. |

Same authenticated user + same key + same payload returns the original receipt. Same user + a different key + identical canonical payload also returns that user's original receipt and records an alias. A cross-user match is **not** searched, merged, detected for disclosure, or returned: it creates a separate Corporate account/application. There is no global RC uniqueness constraint. Cross-user possible-duplicate review remains a restricted future staff/compliance capability requiring separate approval; no applicant-facing match result or automatic rejection is implemented. Fingerprints and idempotency-key digests use a dedicated, versioned HMAC-SHA-256 key hierarchy separate from JWT, CSRF, and email-verification secrets. Old key versions must remain configured for duplicate/replay detection until the associated approved retention period ends.

## Production activation prerequisites

The endpoint cannot be activated merely by setting the feature switch. Operators must provide:

- `CORPORATE_O2_ENABLED=true` only after sign-off;
- `CORPORATE_O2_LAWFUL_BASIS_APPROVED=true`, `CORPORATE_O2_PRIVACY_NOTICE_APPROVED=true`, and `CORPORATE_O2_RETENTION_APPROVED=true` after the respective approvals;
- environment-specific `AWS_REGION`, `CORPORATE_O2_KMS_KEY_ID`, and `CORPORATE_O2_KMS_KEY_VERSION`; deploy a distinct KMS key per environment and use the AWS SDK default workload credential chain (for example, the platform role), never embedded credentials;
- `CORPORATE_O2_HMAC_ACTIVE_KEY_VERSION` and `CORPORATE_O2_HMAC_KEYS_JSON` containing at least 32-byte, base64-encoded, purpose-specific O2 HMAC keys, held in an approved secret store and version-retained for replay lookup;
- least-privilege DB role, KMS encrypt/decrypt permission scoped to the expected key/context, monitoring without request bodies, and a reviewed TIN masking/authorized-access policy;
- keep O2 on one backend instance unless the replaceable `RATE_LIMITER` is backed by a shared atomic store; the present in-memory user limit fragments across instances and resets on restart. No Redis/distributed infrastructure was added, and no separate O2 IP tier is currently active.

The code provides encrypted writes, KMS-bound context, application-level decryption only through a masked read service, and synthetic-only test crypto. It does not grant broad staff decryption access. The deployment remains disabled until lawful-basis, privacy-notice, retention and KMS controls are operationally approved. O3 can read non-TIN approved details while O2 is gated; the masked TIN field remains `null` and performs no decryption until that same gate passes.

## Corporate O3/O11 authenticated applicant reads

Both routes accept a **Corporate account UUID** in the path; it is not the application UUID. The backend maps `corporateAccountId` to the Corporate application and then checks `kind=CORPORATE` plus the immutable `initiatingUserId` against the current authenticated investor on every request. The returned `applicationId` is the distinct application identifier. Passing an application ID as the path account ID does not find the resource. Missing, malformed and non-owned IDs all return the same generic `404 NOT_FOUND` envelope. No separately authorized principal/staff read is exposed.

### O3 — details and current status

`GET /api/v1/corporate-accounts/{corporateAccountId}/onboarding`

Requires a live session-bound bearer token and a verified INVESTOR initiating applicant. This safe read requires no CSRF token. It exposes all six lifecycle states without filtering and returns only the permitted projection:

```json
{
  "data": {
    "corporateAccountId": "<corporate-account-uuid>",
    "applicationId": "<distinct-application-uuid>",
    "status": "DRAFT",
    "createdAt": "<ISO-8601>",
    "updatedAt": "<ISO-8601>",
    "details": {
      "institutionName": "Synthetic Example Holdings Ltd",
      "dateOfIncorporation": "2020-01-02",
      "rcNumber": "RC-SYNTHETIC-001",
      "businessPhoneNumber": "+2348000000000",
      "businessEmail": "accounts@example.invalid",
      "taxIdentificationNumberMasked": null,
      "version": 1,
      "createdAt": "<ISO-8601>",
      "updatedAt": "<ISO-8601>"
    }
  },
  "meta": { "requestId": "<request-uuid>" }
}
```

`status` is one of `DRAFT`, `SUBMITTED`, `IN_REVIEW`, `INFO_REQUESTED`, `APPROVED`, `REJECTED`. The example's `null` TIN field is returned when O2's privacy/KMS gate is closed; after approved activation, that field contains only the documented proportion-limited mask. No ciphertext, encrypted key, KMS key ID/version, payload fingerprint, actor ID, internal authorization record, verification result or compliance outcome is returned. This route does not edit, submit, approve or activate an application.

### O11 — permitted application history

`GET /api/v1/corporate-accounts/{corporateAccountId}/onboarding/history`

Uses the same authentication, verified-applicant and per-request ownership checks as O3. Response:

```json
{
  "data": {
    "corporateAccountId": "<corporate-account-uuid>",
    "applicationId": "<distinct-application-uuid>",
    "history": [
      { "id": "<event-uuid>", "event": "CREATED", "fromStatus": null, "toStatus": "DRAFT", "createdAt": "<ISO-8601>" }
    ]
  },
  "meta": { "requestId": "<request-uuid>" }
}
```

History is ordered oldest-first and includes only permitted lifecycle event/status/time fields. Actor IDs and staff/compliance authorization records are not selected. Missing/non-owned history access uses the same generic 404 as O3. No mutation, submission, approval or investment endpoints are introduced.

### Shared errors

The standard envelope is `{"error":{"code":"<CODE>","message":"<safe message>","requestId":"<request-uuid>"}}`. O2 additionally uses `400 VALIDATION_FAILED`, `401 UNAUTHENTICATED`, `403 EMAIL_NOT_VERIFIED|FORBIDDEN|CSRF_VALIDATION_FAILED`, `409 CONFLICT`, `429 RATE_LIMITED`, and `503 FEATURE_UNAVAILABLE|SERVICE_UNAVAILABLE`. O3/O11 use `401 UNAUTHENTICATED`, `403 EMAIL_NOT_VERIFIED|FORBIDDEN`, generic `404 NOT_FOUND`, and safe `500 INTERNAL_ERROR`; O3 may return `503 SERVICE_UNAVAILABLE` if an enabled KMS envelope cannot be safely decrypted for masking. A closed O2 gate never blocks the other approved O3 fields and never triggers decryption: the masked TIN is `null`.

## C1.4 freshness and the pre-C1.7 amendment boundary

Current freshness safeguards are read-only: immutable verification snapshots retain the Corporate details version and Joint membership revision captured at creation; applicant-authorized assessment reports missing or stale context; a changed context does not rewrite the old snapshot. Joint member insert/update/delete advances a database-maintained `membershipVersion`, while direct revision writes and TRUNCATE are guarded. These checks do not authorize submission and do not mark a snapshot approved.

**Earlier C1.7 prerequisite statement — implementation status superseded:** the authorized O4 extension in `12-D06-CORPORATE-O4-OWNER-SCOPED-DRAFT-AMENDMENT-AND-SNAPSHOT-STAGING.md` now provides append-only monotonically versioned Corporate detail amendments and immutable verification snapshot generations, retaining TIN only as its encrypted envelope. New generations bind to the captured Corporate details version and exact bound ruleset; stale generations are never overwritten. This staging mechanism does not define post-submission edits, does not itself approve an amendment policy, and does not enable submission. O5 remains disabled/unimplemented until the remaining approved ruleset, required evidence, document/declaration completeness, and formal submission contract are satisfied.

## Emmanuel — frontend handoff

Use the endpoint, six field names, exact envelope and 201 receipt above. Send the authenticated access token, the existing CSRF cookie/header pair, an allowlisted Origin, and a fresh `Idempotency-Key` for each logical create action; reuse the same key and same body only for retries. Expect generic 503 while the feature gate is closed. The UI must not send caller IDs/roles, submitter/status values, authority declarations, or approval claims, and must not expect or render a TIN in the response. No frontend source was changed in this implementation.
