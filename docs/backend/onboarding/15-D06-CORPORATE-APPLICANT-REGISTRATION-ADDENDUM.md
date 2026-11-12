# D-06 Revision 8 — Corporate applicant registration addendum

**Date:** 2026-10-22  
**Status:** Backend implementation-backed additive contract amendment; included in canonical OpenAPI v0.6.1. **David/Emmanuel coordination is pending before frontend/mobile adoption.** This record does not claim frontend approval or change-control sign-off.  
**Scope:** `POST /api/v1/auth/register` and its interaction with existing login, `/me`, and Individual profile APIs only.

## Change-control record

Revision 8 extends the existing D-06 v1 registration request with an optional `registrationType` and a Corporate applicant path. This is additive and non-breaking for existing Individual callers: omitting the field preserves the existing required `firstName`, `lastName`, `email`, and `password` contract. Explicit `INDIVIDUAL` also requires all four fields. `CORPORATE` requires `email` and `password`; names are optional and are validated if supplied. Unknown fields remain rejected.

The canonical OpenAPI contract is versioned `0.6.1` for this additive amendment. The existing operation ID `registerInvestor` is retained to avoid unnecessary generated-client renaming; the operation summary and request variants now describe both applicant types. No request path, response envelope, Individual behavior, Joint contract, or authentication role was changed. The handoff asks Emmanuel to review/coordinate adoption before clients send `registrationType: "CORPORATE"`; no frontend source was edited.

## Corporate applicant flow

1. Public `POST /api/v1/auth/register` accepts:

   ```json
   {
     "registrationType": "CORPORATE",
     "email": "applicant@company.example",
     "password": "at-least-8-characters"
   }
   ```

   `firstName` and `lastName` may be omitted. If provided, they must satisfy the same string and length validation as Individual names, but they are not persisted to an `InvestorProfile`; clients should omit them unless a coordinated client form requires them. Registration atomically creates the existing `User` with `role=INVESTOR` and the email-verification challenge. It does not create a session, access token, refresh cookie, or CSRF cookie and does not mark the address verified.

2. The response retains the existing `201` shape: `userId`, `verificationId`, masked email, `emailVerified: false`, and `nextAction: "VERIFY_EMAIL"`.
3. Use the existing email verification endpoint and then `POST /api/v1/auth/login`. There is no Corporate role. The existing session-bound access-token, email-verification, refresh, and CSRF requirements remain unchanged.
4. `POST /api/v1/corporate-accounts/applications` remains authenticated and requires the existing verified-applicant and CSRF/origin/idempotency checks. Its ownership identity is derived from the session principal, not the request body. `CorporateApplicantContextService` checks the current INVESTOR role and verified email; it does not require or query `InvestorProfile`.

## Profileless auth projection and profile endpoint behavior

Corporate applicants intentionally have no `InvestorProfile`. The existing shared `SafeUser` projection therefore returns:

```json
{
  "firstName": "",
  "lastName": "",
  "role": "INVESTOR"
}
```

for those name/role fields in both `POST /api/v1/auth/login` and authenticated `GET /api/v1/me`. The account remains fully authenticated; empty names are the safe display projection, not a login or token error. Existing Individual accounts continue to return their stored profile names.

`GET /api/v1/me/profile` and `PUT /api/v1/me/profile` are Individual profile-specific routes. For an authenticated Corporate account without an InvestorProfile, the existing service behavior is a safe `404 NOT_FOUND` (“Profile not found.”); these routes do not create a profile implicitly. This is an expected resource-absence response, not `401 UNAUTHENTICATED` or `403 FORBIDDEN`. Existing Individual profile GET/PUT behavior is unchanged. The Corporate O2 path does not depend on `/me/profile`.

## Compatibility and non-goals

- Legacy Individual registration that omits `registrationType` still requires names, creates `InvestorProfile`, and returns the same response envelope.
- Joint source/contracts are unchanged; no `JOINT` or `CORPORATE` auth role is introduced.
- Existing `UserRole` remains `INVESTOR | STAFF | ADMIN`; registration cannot select a role. STAFF/ADMIN self-registration remains impossible.
- Corporate users remain unverified until the existing email-verification flow succeeds. Authentication and session guards are not weakened.
- No schema or migration is required: `User.investorProfile` is already optional; Corporate ownership already uses the existing Corporate account/application records.
- No frontend, legal/privacy approval, O2 enablement, public staff/provider/document/eligibility flow, or O5 capability is added.

## Verification and handoff

Unit tests cover Corporate registration without a profile, Individual registration compatibility, profileless Corporate login with blank names, the shared `SafeUser` fallback, Corporate applicant authorization without a profile, and the expected `/me/profile` safe 404. Full test/build/typecheck results and remaining production blockers are maintained in `docs/operations/CORPORATE-O2-RELEASE-BLOCKERS-AND-REGISTRATION.md`.

**Emmanuel review requested:** confirm the registration type vocabulary and Corporate form payload, how the UI handles empty auth display names, and that Corporate flow does not call the Individual profile endpoint. Existing Individual and Joint clients need no request changes. Do not treat this handoff as authorization to change privacy/legal approvals or activate O2.
