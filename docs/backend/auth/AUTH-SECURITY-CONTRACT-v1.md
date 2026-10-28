# STARFETCH — AUTH-SECURITY-CONTRACT-v1

**Status:** IMPLEMENTED (Phase 2B — Authentication & Identity Foundation)
**Owner:** David (backend) — review with Emmanuel for web/mobile adoption
**Date:** 2026-10-26 · **Applies to:** `starfetch-investment-backend` as of Phase 2B
**No secrets are contained in this document.**

This is the binding record of how Starfetch authentication behaves in Phase 2B.
Changes require coordinated change control (backend ↔ frontend ↔ mobile), as
per the platform contract rules.

---

## 1. Password algorithm & policy

| Item | Value |
|---|---|
| Algorithm | **Argon2id** (PHC string output) |
| Implementation | npm package **`argon2@0.45.1`** (native libargon2 binding; Node ≥ 20) |
| Parameters | `memoryCost = 19456` KiB · `timeCost = 2` · `parallelism = 1` (meets/exceeds approved minimums) |
| Policy | **15–128 characters**, passphrases allowed; **no** composition rules (no required uppercase/lowercase/digit/symbol) |
| Storage | Argon2id hash string only (never plaintext, never reversible encryption) |
| Exposure | Hashes are never returned by any API and never logged |

Timing: unknown-account logins run a **dummy Argon2id verification** so
response timing does not reveal whether an email is registered.

## 2. Access credential (JWT)

| Item | Value |
|---|---|
| Format | JWT, **HS256**, 15-minute TTL (`ACCESS_TOKEN_TTL_SECONDS=900`) |
| Implementation | **`@nestjs/jwt@10.2.0`** (jsonwebtoken underneath) |
| Claims | `sub` (user UUID), `role` (`INVESTOR`/`STAFF`/`ADMIN`), `sid` (session UUID), `iat`, `exp` — **minimal only** |
| Forbidden in claims | KYC data, phone, address, financial/portfolio/document data |
| Secret | `JWT_ACCESS_SECRET` from environment; ≥32 chars in staging/production; startup fails securely when missing |
| Algorithm pinning | Verification restricted to `HS256` (`alg:none` / cross-algorithm rejected) |

**Session binding (server-side revocation semantics):** a JWT alone is **not**
sufficient authorization. Every protected-route check also resolves the `sid`
claim against the server-side `auth_sessions` row: the session must exist,
belong to `sub`, be unrevoked, and be within both absolute and idle expiry.
Consequently **logout** and **refresh-credential reuse detection** terminate
that session's protected API access **immediately** — a still-unexpired access
JWT issued for it is rejected with `401 UNAUTHENTICATED`. This is deliberately
**not** JWT-only stateless authorization.

**Credential races are structurally impossible:** refresh rotation claims the
credential with a single atomic conditional `UPDATE` (used/revoked still null)
inside the rotation transaction — two concurrent presentations of the same
credential produce exactly one winner; the loser is treated as reuse and the
session is revoked. Email verification attempts/consumption and resend
rotation use the same atomic-conditional pattern (see §6).

## 3. Refresh credential & session model

| Item | Value |
|---|---|
| Format | Opaque, crypto-random, **384 bits** (`crypto.randomBytes(48)`, base64url) — **not** a JWT |
| Storage | Only **SHA-256(raw)** persisted (`refresh_tokens.tokenHash`); raw credential never hits the database or logs |
| Absolute lifetime | 7 days (`REFRESH_TOKEN_TTL_SECONDS=604800`) via `auth_sessions.expiresAt` |
| Idle timeout | 24 hours sliding (`REFRESH_IDLE_TTL_SECONDS=86400`) via `auth_sessions.idleExpiresAt`, extended on each successful refresh |

**Rotation (every successful refresh):** validate → mark current token `usedAt`
→ create replacement → chain via `replacedByTokenId` → slide `lastUsedAt`/
`idleExpiresAt` → issue new access JWT → set replacement cookie.

**Reuse detection:** presenting a used/revoked/rotated-out credential →
**the entire `AuthSession` is revoked** (`revokeReason = REFRESH_REUSE_DETECTED`)
and the request is rejected with a generic 401. The legitimate owner's current
credential also dies; sign-in is required again. Reuse is **never** silently
accepted and is logged as a security event (no token material in the log).

## 4. Cookies (browser transport)

| Cookie | Attributes |
|---|---|
| Refresh (`sf_refresh` dev / `__Host-sf_refresh` staging+prod) | `HttpOnly` · `SameSite=Lax` · `Path=/` · `Secure` outside local dev · no `Domain` (host-only) |
| CSRF (`sf_csrf` dev / `__Host-sf_csrf` staging+prod) | readable (not HttpOnly) · `SameSite=Lax` · `Path=/` · `Secure` outside local dev · no `Domain` |

- The refresh credential is **never** placed in JSON or readable by JavaScript.
- Frontend code must **not** depend on reading the cookie names; names are
  backend deployment details.
- CORS: explicit origin allowlist only, `credentials` enabled **only** when an
  allowlist is configured; `Access-Control-Allow-Origin: *` with credentials
  is never emitted.

## 5. CSRF scheme (signed double-submit)

- Cookie value: `<sessionId>.<token>.<hmac>` — 256-bit random token, and
  `hmac = HMAC-SHA-256(CSRF_HMAC_SECRET, "<sessionId>.<token>")`.
- Required on cookie-authenticated state-changing requests as header
  **`X-CSRF-Token: <cookie value>`**.
- Server validation: header == cookie (timing-safe compare) **and** HMAC valid
  **and** embedded `sessionId` matches the resolved session.
- **Rotated on every refresh.** Protected at minimum: `POST /auth/refresh`,
  `POST /auth/logout`.
- Additionally: browser `Origin` (or `Referer`) on those routes must match the
  configured allowlist. SameSite alone is not relied upon.

## 6. Email verification

| Item | Value |
|---|---|
| Code | **6 numeric digits**, generated via CSPRNG (`crypto.randomInt`) |
| Lifetime | **10 minutes** |
| Attempts | max **5** per code; exhaustion permanently kills the code |
| Resend | **60 s** cooldown; max **5 per hour** (rolling window); resend **rotates** code/verifier/timestamps (same `verificationId` may persist) and immediately invalidates the previous code |
| Storage | **keyed HMAC-SHA-256** over `challengeId + code`, keyed by `EMAIL_VERIFICATION_HMAC_SECRET` (env, outside the DB). Codes are never stored in plaintext and never logged |
| Usage | single-use; success sets `users.emailVerifiedAt` **atomically** with challenge consumption (same transaction) |
| Requiredness | email verification is mandatory **before login**; registration never auto-logs-in |

**Concurrency guarantees (all enforced by atomic conditional PostgreSQL
operations, not read-check-update patterns):** attempt increments are
generation-bound (`codeHmac` match required, so an in-flight request from a
pre-resend generation can never increment the new code's counter); increments
cannot be lost and the 5-attempt cap cannot be exceeded — the successful
**consume** itself requires `attemptCount < max`, so once a fifth incorrect
attempt commits, a correct code can never verify afterwards; a challenge can
be consumed by exactly one request (concurrent correct-code submissions yield
one success + one `EMAIL_VERIFICATION_CONSUMED`); concurrent resends serialize
through an atomic cooldown claim so only one code rotation occurs — at most
one code is valid for a challenge at any instant.

## 7. Email-provider abstraction

```
Auth/Identity core  →  EmailProvider port (sendEmailVerificationCode)  →  adapters
```

- **Port:** `EmailProvider` interface (`EMAIL_PROVIDER` DI token). Domain code
  never touches Nodemailer/SMTP/vendor types.
- **Adapters shipped:** `SmtpEmailProvider` (generic SMTP — local Mailpit/
  MailHog friendly: `SMTP_HOST=127.0.0.1 SMTP_PORT=1025`) and
  `FakeEmailProvider` (automated tests). Production vendor choice remains
  replaceable without touching auth logic.
- No SMS, no push, no marketing/newsletter/general messaging.

## 8. Login semantics (enumeration-resistant)

- Unknown email and wrong password → identical `401 INVALID_CREDENTIALS`
  ("We could not sign you in with those details.") with equalized timing.
- Correct password + unverified email → `403 EMAIL_NOT_VERIFIED` with safe
  context only (`verificationId`, masked email). No session is issued.
- Success creates `AuthSession` + `RefreshToken`, sets cookies, returns
  access JWT + safe user projection.

## 9. Registration semantics

- Fields: exactly `firstName`, `lastName`, `email`, `password` (D-06 v1
  baseline). `confirmPassword` is frontend-only and rejected as unknown.
  Phone is **not** collected at registration.
- Atomic creation of **User + InvestorProfile + EmailVerificationChallenge**
  in a single transaction.
- Role is hard-set to **INVESTOR**; there is **no** public STAFF/ADMIN
  self-registration path.
- Emails stored as `email` (display form) + `normalizedEmail` (trim+lowercase,
  unique). Duplicate accounts → same safe `409 CONFLICT` regardless of the
  existing account's verification state.

## 10. Authorization guard

- Reusable `AccessTokenGuard`: rejects missing/invalid/expired tokens and
  malformed claims with safe `401 UNAUTHENTICATED`; attaches `{ userId, role,
  sessionId }` to the request.
- Frontend route guards are UX only; this backend guard is the boundary.

## 11. Throttling

- Server-side fixed-window limiter on auth routes (register 5/10 min, login
  10/10 min, verify 10/10 min, resend 6/hour, refresh 60/10 min, logout
  60/10 min; per client IP) — MVP in-memory implementation behind the
  `RATE_LIMITER` port so a distributed store can replace it later.
- Disabled under automated tests by default (deterministic suites); a
  dedicated e2e spec re-enables it and verifies the 429 envelope.

## 12. Browser storage & mobile-ready boundary

- Browsers: tokens live as above (access token in JS memory per frontend
  choice; refresh in HttpOnly cookie; CSRF readable cookie + header echo).
- Mobile (React Native, Android+iOS, future): SAME registration, verification,
  login, claims, session/refresh model, roles — refresh credential and CSRF
  pair will be persisted in **platform-secure storage**; the backend core
  services do not depend on cookies (cookie handling is transport-layer only,
  isolated in the auth controller).

## 13. Logging restrictions

Never logged: passwords, password hashes, access tokens, refresh tokens, CSRF
tokens, verification codes, verification-code HMACs, session secrets, full
auth request bodies. Emails are **masked** (`u***@example.com`) wherever they
appear in auth/security logs. Every log line correlated via request ID;
unhandled 5xx log stack traces server-side only.

## 14. Operational configuration

Validated fail-fast at startup: `DATABASE_URL` (required), `JWT_ACCESS_SECRET`,
`CSRF_HMAC_SECRET`, `EMAIL_VERIFICATION_HMAC_SECRET` (staging/production
additionally reject short/placeholder values), `SMTP_HOST` (required in
staging/production). TTLs via `ACCESS_TOKEN_TTL_SECONDS`,
`REFRESH_TOKEN_TTL_SECONDS`, `REFRESH_IDLE_TTL_SECONDS`.

## 15. Separation of duties

Backend is the sole access-control authority. Phase 2B surfaces: RBAC
vocabulary defined (`INVESTOR`/`STAFF`/`ADMIN`); staff/admin workflows,
ownership/RBAC checks on business resources, documents/KYC, applications and
IMS remain **out of scope and unimplemented**. D-08 and D-09 remain OPEN and
untouched.
