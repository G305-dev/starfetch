# Corporate O2 release blockers and Corporate applicant registration

**Assessment date:** 22 October 2026 (Africa/Lagos)  
**Baseline commit:** `5a674e35d8876972221472e91ec04c627fd00133` (reviewed readiness changes on latest checked `main`)  
**Scope:** backend only. No frontend, schema, migration, legal/privacy approval, deployment, push, merge, or O2 activation changes.

## Executive decision

**Corporate O2 remains unavailable and must not be activated.** The shared rate-limiter implementation and Corporate registration path are now present, but production blockers remain: Legal/Privacy/Retention approval and approval flags, KMS/IAM/Vercel OIDC setup and an authorized synthetic integration check, approval and provisioning of a Redis REST service and backend-only secrets, dependency-audit triage (the prior install reported 37 findings: 11 low, 17 moderate, 9 high; no audit fixes were applied), plus destructive O2/O3/O4 E2E verification against a positively identified isolated local PostgreSQL database. None of those external services or online databases was contacted. All approval and O2 switches remain false; no credentials were fabricated.

No Prisma schema change was needed: the existing `User` model permits `investorProfile` to be null, and Corporate application ownership is represented by the existing `CorporateAccount`/`OnboardingApplication` records. No migration was created.

## Corporate applicant registration contract for Emmanuel

This reuses the existing authentication and email-verification flow; it does not add a role, bypass verification, issue credentials at registration, or change frontend code.

### 1. Register the Corporate applicant

`POST /api/v1/auth/register` (public, existing auth rate limit applies)

```json
{
  "registrationType": "CORPORATE",
  "email": "applicant@company.example",
  "password": "at-least-8-characters"
}
```

`registrationType` is optional for backwards compatibility. Omitted means `INDIVIDUAL`; then `firstName` and `lastName` remain required and an `InvestorProfile` is created as before. Explicit `"INDIVIDUAL"` has the same requirements. With `"CORPORATE"`, names may be omitted (and are validated but not persisted if supplied) and the registration transaction creates an authenticated `User` and email-verification challenge **without** creating an `InvestorProfile`.

The canonical contract is documented in `docs/api/openapi.yaml` v0.6.1 under D-06 Revision 8. It is additive and preserves existing Individual callers; Emmanuel review is requested before frontend/mobile adoption. The existing operationId is deliberately retained for generated-client compatibility.

Success is HTTP `201`, with the established response shape (email is masked):

```json
{
  "data": {
    "userId": "<uuid>",
    "verificationId": "<uuid>",
    "email": "a***@company.example",
    "emailVerified": false,
    "nextAction": "VERIFY_EMAIL"
  }
}
```

Registration does not create a session, access token, refresh cookie, or CSRF cookie. The password is stored only as an Argon2id hash. Duplicate-email behavior remains the existing generic conflict response. `role`, `confirmPassword`, phone, and other unrecognized properties remain rejected; `registrationType` is an onboarding intent and **not** a role selector.

### 2. Verify email and log in

Use existing `POST /api/v1/auth/email/verify` with `{ "verificationId": "<uuid>", "code": "<emailed-code>" }`. On success the response says `emailVerified: true` and `nextAction: "LOGIN"`. Then use the existing `POST /api/v1/auth/login` with the registered email/password. Login establishes the normal session and returns the normal short-lived bearer `accessToken`; the refresh token remains in the existing HttpOnly cookie, with the existing CSRF cookie/header behavior unchanged.

Because there is no `InvestorProfile`, the auth `SafeUser` projection returns `firstName: ""` and `lastName: ""` in both the login response and authenticated `GET /api/v1/me`. This is expected, not an authentication failure: the user retains the existing `INVESTOR` auth role, email-verification and live-session checks still apply, and Corporate O2 authorization checks verified role/identity without querying for a profile. The Individual-only `GET/PUT /api/v1/me/profile` endpoints still require an actual profile and return the existing safe `404 NOT_FOUND` when it is absent; they do not create one implicitly. Profile access therefore has no regression for existing Individuals, while a Corporate applicant should not use the Individual profile endpoint. Unit regressions cover profileless login, the shared safe-user mapping, Corporate applicant authorization without a profile, and the profile-service 404.

The persisted authorization role remains `INVESTOR` because the current role enum has no Corporate role. For Corporate routes this is the existing verified-applicant role boundary, not proof that an Individual profile exists. The Corporate applicant authorization service checks the authenticated user ID from the validated session-bound principal, current database role, and verified email; it does **not** query or require `InvestorProfile`. It does not accept a caller-supplied owner ID or role. Corporate ownership is established only by the authenticated O2 creation transaction. There is no unauthenticated Corporate O2 path.

### 3. Create the Corporate O2 draft

After login and email verification, call the existing authenticated endpoint:

`POST /api/v1/corporate-accounts/applications`

Required headers: `Authorization: Bearer <accessToken>`, an allowed `Origin` (or existing allowed Referer fallback), the normal session-bound CSRF cookie plus matching `X-CSRF-Token`, and a unique/replay-stable `Idempotency-Key`. Request body remains the existing six-field Corporate O2 DTO (institution name, incorporation date, RC number, TIN, business phone, business email); no owner, user ID, role, status, or approval fields are accepted. Success remains HTTP `201` with the existing DRAFT receipt. Rate limiting is five requests per authenticated user per hour across instances.

### Compatibility and security boundaries

- Individual clients that omit `registrationType` retain the old register behavior and required names/profile creation.
- Joint account source and creation/membership/invitation behavior were not edited; new Corporate auth users retain the existing `INVESTOR` enum role. Dynamic Joint E2E compatibility remains unverified because destructive DB tests were withheld until an isolated local database can be positively identified.
- Corporate O3/O4/O11 authorization code was not broadened or weakened. Existing ownership checks remain in force.
- Staff review stays deny-all by default; O5 remains closed until its independent checks pass.
- No public provider, document, staff-review, or eligibility workflows were added.
- No frontend changes or schema/migration changes were made.

## Shared Redis rate-limiter implementation and setup guidance

### Implemented behavior

`src/modules/corporate-onboarding/rate-limit/corporate-o2-rate-limiter.ts` defines a replaceable `CorporateO2RateLimiter` port and an Upstash Redis REST adapter. One atomic Lua `EVAL` increments a fixed-window counter and sets its expiry on the first request. The quota is exactly 5 per authenticated user per 3600-second bucket. Redis keys contain an HMAC-SHA256 digest of the authenticated user ID, using a dedicated base64 secret and a domain-separated prefix; the raw user ID is not sent as the Redis key. A denied request reports `Retry-After` based on the remaining TTL. Missing client/config, timeout, Redis failure, malformed response, or invalid HMAC secret fails closed with a safe `503`; there is no process-local fallback.

The guard runs only after O2 availability, access-token, Corporate applicant, and cookie/CSRF guards. It verifies the expected bucket/identity/5-per-hour policy and refuses missing or altered policy metadata. O2 requests remain authenticated. Upstash client retries and telemetry are disabled and requests have a 1.5-second abort timeout. No Redis client is constructed without URL and token; module construction itself makes no connection. O2 readiness also requires the dedicated Redis settings. Environment validation requires an HTTPS REST URL without embedded credentials/query/fragment, a token, and a canonical base64 secret of at least 32 bytes when O2 is enabled.

### Operator actions still required (not performed)

1. Architecture/Security/Operations must approve the shared Redis provider, data region/residency, access model, availability, monitoring, budget, and outage response. The code uses the Upstash Redis client protocol; this does not constitute approval of Upstash as a vendor.
2. Create/provision an environment-isolated Redis REST database through the authorized provider console. Keep Preview/test and Production data/secrets separate. Do not reuse a personal or unrelated database.
3. Generate a dedicated random secret of at least 32 bytes using an approved secret-management process. It must be independent from `CORPORATE_O2_HMAC_KEYS_JSON`, KMS credentials, auth secrets, and any frontend key. Store it only in the approved vault and backend secret environment.
4. In the backend runtime only, configure:
   - `CORPORATE_O2_RATE_LIMIT_REDIS_REST_URL` — HTTPS REST URL, Config type.
   - `CORPORATE_O2_RATE_LIMIT_REDIS_REST_TOKEN` — provider token, Secret type.
   - `CORPORATE_O2_RATE_LIMIT_HMAC_SECRET` — base64 of at least 32 random bytes, Secret type.
5. Keep all three settings out of frontend projects, `NEXT_PUBLIC_*`, source control, logs, and release ZIPs. Never paste secret values into tickets or chat. Do not print CLI output that could include secrets.
6. In an authorized test environment with synthetic identities only, verify connectivity, concurrent increments, exactly-five allowance, correct reset/expiry, retry-after, unavailable-store 503, timeout, and instance-to-instance shared quota. Monitor for Redis service outages and latency; O2 must remain gated off until these checks and the rest of the release checklist pass.

No URL/token/HMAC value was supplied or created here, and no Redis request was made. Unit tests mock the Redis client and validate script arguments/response behavior; they do not prove vendor-side Lua support, credentials, network policy, shared service availability, or runtime permissions. The Corporate O2 E2E suite now overrides the rate-limit port with a deterministic fake so its tests never contact Redis.

## Updated release checklist

All checkboxes below remain unchecked until evidence is provided by the listed approver. This code change does not change approval values.

- [ ] Legal/Compliance document and approve the lawful basis and purpose for TIN processing.
- [ ] Privacy owner approves/version-controls notices, disclosure, data subject rights, processor terms, and access explanation.
- [ ] Records/Compliance approves retention and deletion periods, backup handling, and audit retention.
- [ ] Security approves AWS account/region, customer-managed KMS key, exact Vercel Production OIDC trust subject, least-privilege key/role policies, monitoring, and rollback/break-glass procedure; triages the outstanding npm audit findings before activation.
- [ ] Authorized synthetic KMS/OIDC test succeeds for GenerateDataKey/context-bound Decrypt and failure paths; no customer data used.
- [ ] Architecture/Security approves Redis provider, region, isolation, threat model, outage expectations, monitoring, and cost.
- [ ] Operations provisions Production Redis URL/token and a dedicated rate-limit HMAC secret in backend-only Secret/Config settings; a non-production environment uses separate resources.
- [ ] Authorized shared Redis integration test proves concurrency, global quota across instances, expiry, `Retry-After`, timeout, safe 503, and no identifiers/secrets in keys/logs.
- [ ] Backend/QA verify auth registration contract, Individual registration compatibility, email verification, login, authenticated O2, CSRF, idempotency, and role/ownership boundaries.
- [ ] Backend/QA run Individual, Joint, Corporate O2/O3/O4/O11 targeted security regressions; public staff/provider/document/eligibility surfaces remain unavailable and O5 closed.
- [ ] QA positively verifies the isolated local PostgreSQL test database identity before destructive E2E; never use Neon/online DB. Run only after identity is confirmed.
- [ ] Platform verifies Vercel Production OIDC, environment variables, exact deployment/source mapping, and Preview/Development isolation.
- [ ] Product/Legal/Compliance/Security sign off in writing; only then may authorized operators change approval flags and O2 enablement as a final separate controlled action.

## Verification status for this code change

- Baseline inspected at `5a674e35d8876972221472e91ec04c627fd00133`; no commit, push, merge, deployment, or activation performed.
- `@upstash/redis@1.41.0` was pinned. Installation used `--ignore-scripts`; package install made no Redis connection.
- Prisma schema is unchanged; no migration generated or run.
- Environment validation and O2 readiness now require the Redis REST URL/token and dedicated HMAC secret if O2 is enabled. O2 flags and approval values were not changed.
- Full unit suite: 37 suites / 192 tests passed. Targeted auth, profile, configuration, O2/O3/O4/O11 ownership/read/edit/encryption regressions: 17 suites / 100 tests passed. Targeted ESLint passed.
- `npm run typecheck`, `npm run build`, and `npx prisma validate` (synthetic loopback-only `DATABASE_URL`, validation only) passed. OpenAPI 3.0.3 YAML and request-variant assertions passed: 18 paths, version 0.6.1, three request variants, and no duplicate keys. The Prisma schema remains unchanged.
- Individual registration backward compatibility; Corporate registration without an `InvestorProfile`; profileless Corporate login with blank auth names; and safe `/me/profile` 404 handling were exercised by unit tests. O2/O3/O4/O11 service and controller unit regressions passed. Joint source was not modified, but Joint E2E runtime compatibility remains pending because destructive DB tests were withheld.
- Destructive PostgreSQL E2E tests were intentionally not run because no isolated DB identity was positively verified. Never point test setup at Neon or any online database.
- AWS/KMS/OIDC and Redis service integration were not run; no credentials or real customer/TIN data were accessed.
