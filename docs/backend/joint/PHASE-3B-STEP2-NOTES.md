# Phase 3B Step 2 — Notes: Authorization & Security Foundation (Backend)

Status: **COMPLETE (locally, sandbox).** Depends on Phase 3B Step 1 (schema/migration).
Implements the *authorization/security* layer approved for joint accounts — **no
business REST endpoints yet** (invitation create/accept/decline land in a later
approved step and will NOT re-derive locking/queries; they compose these pieces).

## What exists now (backend only)

| Component | File | Purpose |
|---|---|---|
| `JointMembershipGuard` | `src/modules/joint/guards/joint-membership.guard.ts` | Post-auth guard; reads account id from **route param `:jointAccountId` ONLY** (UUID-validated), verifies account existence AND caller membership **on PostgreSQL on every request**. Unknown / inaccessible / malformed / pending-invitee all get the **identical** 404 envelope (`NOT_FOUND` / "Account not found.") — anti-enumeration. No createdBy/inviter-based authorization anywhere. |
| `@JointAccount()` decorator | `src/modules/joint/decorators/joint-account-context.decorator.ts` | Injects validated `{jointAccountId, memberUserId}` (`req.jointContext`); fails closed 500 if misused without the guard. Service layers must consume ONLY this context (`ctx.jointAccountId`, `ctx.memberUserId`). |
| `JointModule` | `src/modules/joint/joint.module.ts` | Imports DatabaseModule + AuthModule; provides/exports the guard. Registered in `AppModule`. No controllers. |
| `CookieMutationGuard` | `src/common/security/cookie-mutation.guard.ts` | For cookie-authenticated state-changing routes, AFTER `AccessTokenGuard`: (1) delegates Origin/Referer allowlist policy to existing `CookieOriginGuard` — **origin validation is NOT a CSRF check and is never treated as one**; (2) verifies signed double-submit CSRF (`sf_csrf` cookie == `X-CSRF-Token` header, session-bound HMAC via existing `CsrfService`). 403 `FORBIDDEN` / `CSRF_VALIDATION_FAILED`; missing principal → 401. Reusable beyond joint. |
| `KeyedRateLimit` + `KeyedRateLimitGuard` | `src/common/rate-limit/keyed-rate-limit.decorator.ts`, `keyed-rate-limit.guard.ts` | **Post-auth** throttling (`identity: 'user' \| 'user+account'`). See rationale below. |
| Tx locking utilities | `src/modules/joint/joint-membership-tx.ts` | `lockJointAccount` (SELECT … FOR UPDATE on parent FIRST), `lockJointInvitation` (rows SECOND — global lock order per doc 03 §3), `countActiveMembers` (capacity check inside lock), `probeInvitationAccountId` (non-authoritative id discovery). Utilities only — no service/endpoints. |

AuthModule now also **exports** `CsrfService`, `CookieMutationGuard`,
`KeyedRateLimitGuard`, `RATE_LIMITER` (consumers do not modify auth posture).
`cleanDatabase` (test util) extended: joint tables pruned FK-safely
(invitations → members → holdings/transactions → portfolios → accounts — the
`Portfolio→JointAccount` link is `ON DELETE RESTRICT` by design).

## Why a separate keyed-rate-limit guard (ordering fact)

`RateLimitGuard` is a global `APP_GUARD` → it executes **before** any
controller-level `AccessTokenGuard`, so it can never safely see the principal;
correctly it keeps doing **IP-keyed** throttling (preserved, untouched).
Per-user / per-account keys are only trustworthy **after** auth + membership,
so `@UseGuards(AccessTokenGuard, RolesGuard, JointMembershipGuard?, KeyedRateLimitGuard)`
order is mandatory on protected routes. The keyed guard **fails closed**
(500 INTERNAL_ERROR) if identity/context is missing — never a silent bypass,
never trusting untrusted input.

## Dev-only rate-limit thresholds (PENDING business approval)

| Bucket | Limit | Key |
|---|---|---|
| joint account creation | 5 / hour / user | user |
| invitation creation | 5 / hour / user+account | user+account |
| invitation accept/decline | 20 / hour / user | user |

These are dev **conventions for later endpoint wiring**, not yet bound to any
production route (no joint REST endpoints exist in this step).

## Rate-limiter storage — known limitation (process-local)

`InMemoryRateLimiter` (unchanged, behind the `RATE_LIMITER` port) keeps buckets
**per server process**. Limits fragment under horizontal scaling and reset on
restart. MVP single-instance acceptable; multi-instance production requires a
shared store (Redis) injected behind the same `RATE_LIMITER` interface — no
guards or interfaces change. Same convention as before (tests disable
throttling via `auth.rateLimit.enabled`; the keyed guard honors the same flag).

## Concurrency protocol preserved (doc 03 §3)

Parent account lock → then invitation rows (no invitation-first ordering → no
lock cycle). Capacity `<2` evaluated **inside** the lock; duplicate-joint-edge
unique constraint still guards `ON CONFLICT` insertion / conditional UPDATE.
e2e case 16 proves two concurrent capacity-guarded inserts serialize to
exactly `['CAPACITY_FULL','INSERTED']` (≤2 members, no deadlock).

## Session-security preservation

Access denied immediately after logout/revocation: `AccessTokenGuard`
validates session expiry/revocation per request **before** any joint guard;
e2e case 7 pins it (reused access token + cookies → 401 after logout).

## Individual↔joint isolation proof

`/me/portfolio` & `/me/transactions` resolve portfolios by `userId` only;
joint portfolios have `userId = NULL` and are structurally unreachable from
`/me/*`. e2e case 8 pins it: member's individual total is `100` kobo while a
joint holding of ₦999,999.00 and a `JOINT-ONLY-SECRET-TRANSACTION` exist —
neither leaks. No joint fields were added to any existing response contract.

## Security test inventory (test/joint-security.e2e-spec.ts, real PostgreSQL, rate limits ON)

1. member passes + context injected · 2. unauth → 401 · 3. non-member → 404
4. unknown/inaccessible/malformed → byte-identical 404s (requestId stripped)
5. STAFF → 403 pre-membership · 6. pending invitee → 404
7. logout → immediate 401 · 8. /me isolation (portfolio+holdings+transactions)
9. valid origin + valid CSRF pass; no-origin + CSRF passes · 10. cross-site Origin → 403
11. missing/mismatched/forged CSRF → 403 · 12. cross-session CSRF → 403
13. keyed user bucket: 401 ordering proof, per-principal isolation, 429 w/ retryAfter
14. user+account bucket: per-account keys, 404-before-consume, fail-closed 500
15. global IP limiter preserved (auth-login trips) · 16. lock-order concurrency serialization

Probes are **test-only controllers** mounted via a test module importing the
real `AuthModule`/`JointModule` — production wiring untouched.

## Validation results (run this step)

`tsc --noEmit` 0 errors · `nest build` clean · `prisma validate` ✔ ·
`migrate status` up-to-date (dev+test, 4 migrations) · unit **35/35** · e2e
**84/84** (68 pre-existing + 16 new) · `openapi.yaml` v0.4.0 & frontend
**untouched** · no new migrations · no Git/deploy.

## Sandbox note

Sandbox reset again between turns (PG binaries + role/DBs + node_modules
vanished). Bootstrap: `sudo apt-get install -y postgresql postgresql-client` →
`sudo service postgresql start` → role `starfetch` + DBs
(`starfetch_dev/test/shadow`) → `npm ci` → `prisma migrate deploy`
(dev+test) → reseed fixture (users `acceptance@starfetch.dev` /
`empty.newinvestor@starfetch.dev`, pw `portal-acceptance-8chars`).

## NOT done (by design / on hold)

- No invitation/membership REST endpoints; no KYC claims; no JOINT role;
  controllers for joint arrive only in the next approved step.
- Business parameters J-01…J-08 remain pending management approval; the dev
  thresholds above additionally need business sign-off before production use.
