# 06 — Backward Compatibility & Individual Regression Safety (REVISED)

## 1. Preserved surfaces [EXISTING — must not drift]

Authentication (/auth/register, /auth/email/verify, /auth/email/resend,
/auth/login, /auth/refresh, /auth/logout), sessions/refresh rotation, CSRF +
origin posture, GET `/me`, GET/PUT `/me/profile`, GET `/me/portfolio`,
GET `/me/transactions`, all envelopes, error codes, pagination defaults — and
every existing database record.

## 2. Every existing model/service the future migration would touch — impact table

| Existing element | Change | Behavioral impact on Individual Investor |
|---|---|---|
| `Portfolio.userId` (required, unique) | becomes **nullable**, stays **unique** | None — existing rows unchanged; `/me` queries filter `userId = principal` exactly as today |
| `Portfolio.user` relation | becomes optional (`User?`) | None — Prisma read path identical for non-null rows |
| `Portfolio` table | + nullable unique `jointAccountId` + FK + XOR CHECK | None — new column NULL on all existing rows; not read by any existing code path |
| `User` | + back-relations only (`jointMemberships[]`), no scalars | None — `SafeUser` projection unchanged |
| `InvestorProfile` | none | None |
| `Holding`/`Transaction` | none | None — queried via resolved portfolio id |
| `AuthSession`/`RefreshToken`/`EmailVerificationChallenge` | none | None |
| `DashboardService/ProfileService` | code stays; Phase 3B only **extracts shared queries** behind owner-strategy | Guardrail: existing 35 unit + 68 e2e must pass **unmodified** |
| `AccessTokenGuard`/`RolesGuard`/`CsrfService`/`CookieOriginGuard` | none (reused) | None |
| `RateLimitGuard` | + key-strategy metadata (`ip`/`user`/`user+account`) | Existing buckets keep `ip` default → byte-identical behavior; new strategies apply only to joint endpoints |

## 3. Structural isolation guarantees

- XOR CHECK: `(userId IS NOT NULL) <> (jointAccountId IS NOT NULL)` — a joint row
  can never satisfy an individual query and vice versa, even under a dropped
  application filter.
- `onDelete: Restrict` on the joint link prevents accidental cascade-deletion of
  financial records.
- Rollback procedure + post-financial-row limits documented in doc 02 §2.4.

## 4. Required regression suite (Phase 3B acceptance gate)

Existing: 35 unit + 68 e2e — **run unmodified, must pass.**

New joint tests (each maps to a security requirement):

1. **Cross-account authorization**: member A of account X gets 404 for account Y
   (exists or not — identical body); `/me/portfolio` of a joint member never
   returns joint rows and vice versa.
2. **Concurrent membership acceptance**: two parallel accept requests for the
   second slot (e.g. via `Promise.all` e2e against the real Postgres) → exactly
   one success; the loser gets 409; DB ends with exactly 2 ACTIVE rows.
3. **Double acceptance by the same user** → idempotent 200, one membership row.
4. **Expired/revoked/declined invitations** cannot be accepted (410 / 404 rules).
5. **Invitation replacement** (same-email reinvite) revokes prior PENDING
   transactionally; different-email reinvite on a full/pending account → 409.
6. **Rate limiting**: keyed buckets (`user`, `user+account`) enforce; existing
   IP buckets unchanged.
7. **CSRF/origin**: mutating joint endpoints reject missing/mismatched
   X-CSRF-Token and untrusted origins, exactly like existing `/auth` mutations.
8. **Session revocation/logout** immediately ends joint access.
9. **Identity gates**: unverified-email principal cannot accept; accept by a
   different email owner → 404.
10. **Empty-state honesty**: new joint account (1 member) → portfolio 0/holdings
    `[]`; transactions `[]`/`total:0`; `awaitingSecondHolder: true`.
11. **Financial data stays real, read-only, scoped**: no WRITE endpoints exist;
    rows come only from real future flows.
12. **Accept-vs-reinvite race**: concurrent M4 and M2 on the same account —
    both serialize on the account row; final state is exactly one coherent
    outcome, never a deadlock (assert no `40P01` errors under stress loop).
13. **Decline-vs-reinvite race**: same serial guarantee; the declined email may
    be reinvited afterward through the documented path.
14. **Sequential repeated acceptance** by the same holder: first returns 200 and
    creates membership; every repeat returns the SAME 200 with zero row changes
    (`accepted_by_user_id` replay path), and repeated accepts by a DIFFERENT
    verified user (if link re-issued) hit capacity 409 cleanly.
15. **Identity lookup**: accept with a forged/altered request body email field is
    ignored/rejected (unknown-body 400); the decisive check uses the DB record
    only.

## 5. Deployment note

The migration can ship **before** any joint code: after it, every existing query
must produce byte-identical responses — measured by replaying the 68 e2e cases
against the migrated schema with joint tables empty.
