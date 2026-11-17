# KYC completion status API — completion report

**Repository:** `G305-dev/starfetch`  
**Scope:** backend only, `starfetch-investment-backend`  
**Endpoint:** existing authenticated `GET /api/v1/me`  
**Contract:** `docs/api/INVESTOR-ADMIN-MVP-v1.md` (`v1.1`)  
**Status:** implemented and unit/build-verified; not E2E-verified against PostgreSQL.

## Delivered behavior

`GET /api/v1/me` keeps the current `data` fields and adds only:

```json
"kycCompletion": {
  "individual": "REQUIRED",
  "corporate": "REQUIRED"
}
```

The only allowed public values are `REQUIRED` and `COMPLETE`. No identity numbers, KYC evidence, document content/references, staff notes, or provider details are serialized. The field is added only to `/me`; login and registration `SafeUser` responses are unchanged.

For a profileless Corporate applicant, the existing safe user projection remains (empty first/last name strings); completion assessment depends on the authenticated principal and owned Corporate applications, not an `InvestorProfile`. The endpoint accepts no target-user or dashboard-context selector; the Corporate query is scoped to `initiatingUserId = principal.userId` and requires a Corporate owner account.

## Evidence policy

- **Individual:** always `REQUIRED` in this release. The repository has no implemented, authorized Individual final-KYC approval record. A profile, registration/email verification, draft, ruleset snapshot, provider event alone, document event, or dashboard selection is not approval.
- **Corporate:** `COMPLETE` is possible only if at least one Corporate application exists for the authenticated initiator, every associated Corporate application is `APPROVED`, and every one passes the existing `CorporateInvestmentEligibilityService` current-evidence gate: matching current details version and pinned latest snapshot; approved and published ruleset; completed required evidence; and independent final compliance approval. Any missing, stale, unfinished, rejected, or uncertain record returns `REQUIRED`.
- The status read does not approve an application, activate O2, or grant Corporate investment access. Mono remains disabled. The default staff-review authorizer remains deny-all; document storage/scanning remain disabled.
- If the KYC-evidence lookup fails or cannot confirm status after the current user has loaded, both values fail closed to `REQUIRED`; only a generic warning is logged.

### Exact example response for Emmanuel

Synthetic profileless Corporate applicant with no qualifying completed Corporate application (illustrative values only):

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

A `corporate: COMPLETE` value may replace the Corporate `REQUIRED` value only when every criterion above is met. Individual remains `REQUIRED` until an approved Individual final-KYC source exists.

## Tests and checks

- **Unit tests:** pass — 41 suites, 216 tests. Includes no-record/unfinished/stale/uncertain cases; profileless Corporate applicant; evidence ownership scoping; approved/current Corporate eligibility; missing independent approval; no sensitive response fields; and existing auth unit tests.
- **Typecheck:** pass (`npm run typecheck`).
- **Build:** pass (`npm run build`).
- **Changed-file ESLint:** pass for the changed TypeScript files.
- **E2E/PostgreSQL:** not run. A positively identity-verified isolated local PostgreSQL database was not available. No Neon/shared/online database was accessed.
- **Migration:** none required; Prisma schema unchanged.
- **Dependency install/audit:** the unchanged lockfile reported 37 audit findings (11 low, 17 moderate, 9 high); dependency triage remains outstanding.

## Remaining dependencies for future manual-admin KYC

1. Approved Individual evidence requirements, decision vocabulary, final approval record, and lifecycle (including stale/revoked evidence handling).
2. Approved staff provisioning/grant/revocation process, current-role authorization grant, separation of duties, and auditable review policy. Existing production Corporate review authorization intentionally denies all by default.
3. Secure private encrypted document storage, malware scan/quarantine, and formally resolved data residency/cross-border transfer requirements before accepting real customer documents or TIN data.
4. If future review decisions are intended to affect eligibility, a reviewed migration and tested, authorized writer must produce immutable, correctly attributed decision evidence; the frontend must not write or manually toggle completion status.

## Change and deployment controls

- No frontend files, schema/migration files, production environment variables, O2 controls, or Mono settings were modified.
- No Git push, merge, deployment, or production database operation was performed.
- This report's `COMPLETE` definition is status-only; downstream investment access must continue to use its existing independent authorization/eligibility gates.
