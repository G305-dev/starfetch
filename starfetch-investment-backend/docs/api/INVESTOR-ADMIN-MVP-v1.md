# Starfetch `GET /api/v1/me` KYC completion contract — v1.1

**Status:** implemented additive response field; no new route.  
**Endpoint:** `GET /api/v1/me` (existing route; authenticated bearer token and live session required)  
**Response change:** `data.kycCompletion` with the only public values `REQUIRED` and `COMPLETE`.  
**Schema/migrations:** none.  
**Production readiness:** the status is read-only and is not an investment authorization.

## Response contract

The existing `data` fields remain unchanged: `id`, `firstName`, `lastName`, `email`, `emailVerified`, and `role`. This adds one field:

```json
{
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "firstName": "",
    "lastName": "",
    "email": "corporate.applicant@example.invalid",
    "emailVerified": true,
    "role": "INVESTOR",
    "kycCompletion": {
      "individual": "REQUIRED",
      "corporate": "REQUIRED"
    }
  }
}
```

The UUID and email above are synthetic example values. Corporate applicants without an `InvestorProfile` keep the existing empty-name safe projection; no Individual profile is created or required.

```ts
type KycCompletionValue = 'REQUIRED' | 'COMPLETE';
interface KycCompletion {
  individual: KycCompletionValue;
  corporate: KycCompletionValue;
}
```

No identity numbers, evidence content, document references, approval details, or other KYC fields are returned. Login/register responses are unchanged; the additive field is only on `GET /api/v1/me`.

## Completion rules implemented

### Individual

`individual` is always `REQUIRED` in this version. The backend has no implemented, approved Individual final-KYC decision record that can legitimately establish completion. Registration, email verification, profile data, a published ruleset, a verification snapshot, provider events alone, or a document event are not an Individual approval. Mono remains disabled. A future authorized Individual manual-review/final-approval workflow is required before this value can become `COMPLETE`.

### Corporate

`corporate` can be `COMPLETE` only when all of the following hold for every Corporate application associated with the authenticated initiator:

1. The authenticated user is the current `INVESTOR`, email-verified principal; the application is fetched using the principal's `initiatingUserId` and has an actual Corporate account owner. No dashboard selection, request parameter, profile existence, or caller-supplied account ID is used.
2. At least one associated Corporate application exists, and all such applications are `APPROVED`. Any draft, submitted, in-review, information-requested, rejected, or uncertain sibling keeps the aggregate `REQUIRED`.
3. The existing `CorporateInvestmentEligibilityService` confirms the app is Corporate and approved, its latest verification snapshot matches the current pinned/published ruleset and Corporate-details version, the ruleset has genuine approval/publication metadata, all configured requirements have accepted current evidence, and an independent final compliance approval event exists.
4. Every associated application passes that current eligibility evaluation. Stale or missing evidence fails closed to `REQUIRED`.

The status projection delegates to the existing eligibility gate but does not grant investment access, create eligibility records, approve applications, or alter O2. The default Corporate staff authorizer remains deny-all; document storage/scanning remain disabled; no KYC data is synthesized.

If a KYC-evidence query fails or a result cannot be confirmed after the authenticated user is loaded, the projection logs a generic warning and returns both values as `REQUIRED`. It never logs applicant identity/evidence and never emits an optimistic status on an uncertain read.

## Compatibility and security

- The route remains protected by the existing session-aware `AccessTokenGuard`; ownership is derived from the validated principal.
- The live database role must equal the access-token role, as already enforced by the backend guard. Public registration and existing `INVESTOR`/`STAFF`/`ADMIN` vocabulary are unchanged.
- The existing safe user projection remains unchanged. No TIN, BVN, NIN, document contents, hashes, raw provider details, or staff notes are serialized.
- Individual, Joint, and Corporate login, profile, portfolio, transaction, and other dashboard contracts are unchanged. This field does not reinterpret Joint eligibility or Corporate investment access.
- Existing Corporate O2/O3/O4/O11 boundaries, provider/document gates, approval switches, and deny-by-default staff authorization remain unchanged.

## Still withheld

No manual KYC submission/review API, document upload API, funding API, product API, investment request API, or admin API is introduced by this contract. Manual-review endpoints remain dependent on an approved staff grant/provisioning policy and audit/segregation rules. Customer documents remain gated pending private encrypted storage, malware scanning/quarantine, and data residency/transfer approval.

## Versioning

This additive response-field revision is `v1.1`. The endpoint path and existing safe user fields are unchanged. The completion values are intentionally conservative: only verified backend evidence can transition a context to `COMPLETE`; every unsupported context remains `REQUIRED`. Any future change that permits Individual completion requires a separately approved evidence source, implementation, tests, and contract revision.
