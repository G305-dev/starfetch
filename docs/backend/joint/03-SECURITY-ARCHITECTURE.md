# 03 — Security & Membership Authorization Architecture (REVISED)

## 1. Guard chain on every joint-scoped endpoint (review-corrected)

These are **four distinct mechanisms** — explicitly not interchangeable:

| Layer | What it does | What it does NOT do |
|---|---|---|
| **Bearer-token authentication** — `AccessTokenGuard` [EXISTING] | Validates the JWT, loads principal, rejects revoked/expired sessions | Says nothing about which account a caller may access |
| **`CookieOriginGuard`** [EXISTING] | If a browser `Origin`/`Referer` is present it must match the CORS allowlist; header-less non-browser requests pass by design | Is *not* CSRF-token validation |
| **CSRF-token validation** [EXISTING, via `CsrfService` on cookie-auth mutations] | Signed double-submit: `X-CSRF-Token` header must equal the readable cookie `<sessionId>.<token>.<hmac>`, embedded sessionId must match the current session, HMAC verified with CSRF_HMAC_SECRET; rotated on every refresh | Is *not* authentication |
| **`JointMembershipGuard`** [PROPOSED] | Resolves `{jointAccountId}` from the **path** and verifies `EXISTS(joint_account_members WHERE jointAccountId=param AND userId=principal)` | Not a role check; `@Roles(INVESTOR)` still applies |

**Mutating joint endpoints (M1–M5) run ALL of: AccessTokenGuard → RolesGuard →
CookieOriginGuard → CsrfService double-submit → JointMembershipGuard (account
endpoints) → keyed rate limit.** Reads (R1–R4) run the non-CSRF subset. None of
this weakens existing cookie/bearer behavior — all existing pieces are reused
unchanged.

### Anti-enumeration responses

- 401 `UNAUTHENTICATED` / 403 `FORBIDDEN` (non-INVESTOR) as existing.
- **Unknown account or non-member → identical `404 NOT_FOUND`** — same body
  shape, same message ("Account not found."), same timing budget. No 403 that
  would disclose existence. Same rule for invitations not addressed to the caller.

## 2. Account-context isolation

- `/me/*` [EXISTING]: `portfolio.userId = principal`; joint rows keep
  `userId NULL` → structurally unreachable from individual surfaces.
- Joint reads: resolve `Portfolio WHERE jointAccountId = :pathId` **after** the
  membership guard; `userId`/`accountId` never accepted from body/query.
- XOR CHECK (doc 02 §2.2) makes cross-contamination impossible at row level even
  if an application filter is ever dropped.

## 3. Concurrency-safe membership transactions (REVIEW CORRECTION §2/§3)

**Single global lock order: parent row FIRST, child rows SECOND. Every mutation
that touches both a JointAccount and its invitations/members locks the account
row before the invitation/member rows.** The earlier draft pinned the invitation
first while replacement locked the account first — a classic deadlock edge; that
ordering is corrected everywhere (accept, decline, invite/replace).

Prisma compatibility: all steps run inside one interactive transaction
(`prisma.$transaction(async (tx) => { … })`, READ COMMITTED default); row locks
are `tx.$queryRaw('SELECT id FROM "joint_accounts" WHERE id = $1 FOR UPDATE', …)`
and its invitation equivalent — no schema support needed.

### 3.1 Acceptance (with authorized replay)

```
acceptInvitation(principal /* {userId, role, sessionId} — no email claim */, invitationId):
  BEGIN
  1. identity = SELECT normalized_email, email_verified_at FROM users
     WHERE id = principal.userId                 -- server-side CURRENT record;
     assert identity.email_verified_at IS NOT NULL   -- no JWT email claim; body
                                                  -- never carries email proof
  2. probe = plain SELECT of invitation (account id ONLY; explicitly
     non-authoritative). Not found → 404.
  3. SELECT … FROM joint_accounts WHERE id = probe.accountId FOR UPDATE
     -- serializes ALL membership/invitation mutations for the account
  4. SELECT … FROM joint_account_invitations WHERE id = :invitationId
     FOR UPDATE; re-read and REVALIDATE inside the transaction:
       - invitation.joint_account_id == locked account
       - invitation.invited_email_normalized == identity.normalized_email
       - status, expires_at
  5. ── AUTHORIZED REPLAY PATH (review §3) ──────────────────────────
     IF invitation.status = 'ACCEPTED'
        AND invitation.accepted_by_user_id = principal.userId
        AND EXISTS(member row for (accountId, principal.userId)):
          COMMIT → 200 { jointAccountId, joinedAt }    -- idempotent same result,
          -- NO second insert. Everyone else sees only:
          -- 404 (not addressed / terminal-revoked / declined) or
          -- 410 GONE for expired — revealed only when the caller IS the addressee.
  6. assert status='PENDING' AND now() < expires_at   -- else 404/410 per rules
     assert invited_email_normalized == identity.normalized_email  -- else 404
  7. count = SELECT count(*) members FOR ACCOUNT → assert count < 2 -- capacity
     (concurrent accepts queue at step 3; the loser sees count=2 → 409 CONFLICT)
  8. INSERT joint_account_members  ON CONFLICT (joint_account_id,user_id) DO NOTHING
  9. UPDATE invitation SET status='ACCEPTED', accepted_by_user_id=principal.userId,
     responded_at=now() WHERE id=:invitationId AND status='PENDING'
     assert rowcount=1
  10. REVOKE all other PENDING invitations for this account (now full)
  COMMIT
```

### 3.2 Decline — same order

Load invitation account (non-authoritative) → lock account row → lock + re-read
+ revalidate invitation (address match via §3.1 identity lookup) → status guard
(`PENDING`+unexpired) → `UPDATE … status='DECLINED'` → commit. Decline never
creates/removes membership.

### 3.3 Invite / replace — same order

```
createOrReplaceInvitation(accountId path-resolved + membership-guarded):
  lock account row FOR UPDATE
  assert ACTIVE member count < 2            -- full account → 409
  lock/scan invitations for this account:
    live PENDING for the SAME email → REVOKE it, create fresh PENDING (new expiry)
    live PENDING for a DIFFERENT email → 409 until it expires/declines
    exactly one PENDING survives at all times   -- single-live-invitation invariant
```

Because every path locks the **account row first, invitation second**, the cycle
that deadlocked the earlier draft cannot form: accept-vs-reinvite,
decline-vs-reinvite, and accept-vs-accept all serialize on the account row.

### Properties (unchanged intent, now provably compatible)

- No third ACTIVE member; no duplicate membership (UNIQUE pair + idempotent
  insert); one effective PENDING; expired/revoked/declined cannot be accepted;
  **double accept by the same authorized holder returns the SAME successful
  response with zero DB change**; acceptance information is invisible to anyone
  else (an unrelated caller cannot distinguish ACCEPTED from REVOKED — both 404).
- One-member accounts are normal intermediate state — `awaitingSecondHolder`,
  never "fully established", never KYC-adjacent claims.

## 4. Rate limiting — corrected design (review §4)

The existing `RateLimitGuard` keys buckets as `${bucket}:${ip}` with the
**process-local in-memory adapter** (`RateLimiter` interface is swappable).
It therefore does **not** enforce per-user or per-account limits today, and this
proposal does not pretend otherwise.

[PROPOSED] `RateLimitGuard` extension (interface unchanged, adapter unchanged):
introduce a key strategy in the decorator metadata, e.g.
`@RateLimit({ bucket, identity: 'ip' | 'user' | 'user+account' })` and build
keys as `${bucket}:${strategyMaterial}` after the auth guard has attached the
principal. Keyed limits (initial proposal):

| Operation | Key | Limit |
|---|---|---|
| `POST /joint-accounts` | `user` | 5/hour |
| `POST /joint-accounts/{id}/invitations` | `user+account` (plus `ip` backstop) | 5/hour, and ≤1 PENDING per account (invariant, not just throttling) |
| accept/decline | `user` + `ip` backstop | 20/hour |
| joint reads | unchanged global posture | — |

Distribution note [recorded honestly]: the in-memory adapter is per-process —
limits fragment under horizontal scaling. Acceptable for MVP single-instance;
the `RATE_LIMITER` DI token already allows swapping a shared store (e.g. Redis)
without touching guards/endpoints. Flagged as pre-production hardening, not a
blocker for contract approval.

## 5. Data minimization & logging

Member surfaces expose only name + email + joinedAt of co-holders; emails masked
in invitation-management responses outside ACTIVE membership; logs carry ids and
masked emails (`email-mask` util) — no tokens, credentials, or personal content.

## 6. Consent precondition

ACTIVE membership is created **only** by the transactional accept in §3 —
authenticated, verified-email, address-matched. A typed email address never
grants access.
