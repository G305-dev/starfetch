# 04 — Registration & Membership Workflow (REVISED — login-only inbox [J-06 recommendation, pending approval])

## 1. The MVP flow (all five review steps)

1. **Register independently (if necessary)** — the second applicant signs up via
   existing `/auth/register` if they have no account. The backend NEVER
   pre-creates accounts from someone else's form submission.
2. **Verify email** — existing `/auth/email/verify` challenge (HMAC code flow).
   No verification ⇒ invitations remain visible-but-unacceptable (403
   `EMAIL_NOT_VERIFIED` evaluate → recommend `403 FORBIDDEN` with clear message
   [pending J-08 contract sign-off]).
3. **Log in with their own credentials** — their own session/token; nothing
   shared with the primary holder.
4. **See invitations addressed to their verified email** —
   `GET /me/joint-invitations`: the backend loads the caller's **current User
   record by session principal** (userId/sessionId — the JWT carries NO email
   claim) and returns PENDING rows where
   `invitedEmailNormalized = users.normalizedEmail` and `emailVerifiedAt` is set.
   Email values are never accepted from request bodies as identity proof.
5. **Explicitly accept or decline** — transactional flow in doc 03 §3 (parent-row
   lock order everywhere; **authorized replay**: repeating accept on an invitation
   you already accepted returns the same 200 without side effects).

### Flow for the primary holder

Authenticated + verified INVESTOR → `POST /joint-accounts { displayName?, inviteeEmail }`
→ account created with the primary as its single ACTIVE member → PENDING
invitation issued. The account honestly shows **"Awaiting second holder"** —
one active member is a valid intermediate state; **not fully established**,
never KYC-verified (email verification ≠ KYC).

**Self-invite rejected** (`inviteeEmail == own normalized email` → 400).
**Already-member invite rejected** (409). **Account full → no new invitations**
(409 + revoke-on-full at accept time).

## 2. Anti-abuse / anti-disclosure properties

| Threat | Control |
|---|---|
| Access via bare email entry | Impossible — ACTIVE only via the locked accept transaction |
| User enumeration via invite | M2 returns the **same generic 201** whether or not the email exists; delivery happens out-of-band |
| Account-existence disclosure | 404-for-non-member and "same shape" invitation inbox (list enumerates *mine* only) |
| Duplicate membership | UNIQUE(jointAccountId,userId) + lock-checked capacity (03 §3) |
| Racing accepts/replaces | Account-row lock serializes; idempotent double-accept |
| Unauthorized creation | Authenticated + verified + INVESTOR + keyed rate limits |

## 3. Removed from MVP per review — no invitation bearer-token mechanics

- **`tokenHash`, attempt counters, `?token=` accept: removed.** The invitation
  requires an authenticated session of the email's owner; the email itself
  carries **no membership-authorization credential** — only a link to
  `/login` / the invitations page. Token linkage would add value only if
  accepts were allowed pre-authentication; they are not.
- If David later approves email-link authorization, tokens get reintroduced as a
  *separate* approved change with hash/single-use/expiry discipline — not now.

## 4. Failed email delivery

- The invitation exists server-side with status PENDING regardless of SMTP
  success (delivery failure is logged masked + retried on manual re-invite).
- The primary sees `deliveryState`? **No — choice:** delivery outcome is NOT
  surfaced in the success envelope (avoids email-existence inference); the
  invitee can self-serve via login inbox. If delivery failed, the primary may
  re-invite (M2) — replacement flow below. [Open copy-delivery decision is part
  of J-08 contract review.]

## 5. Invitation replacement

M2 on an account with a live PENDING invitation for a *different* email:
**409 CONFLICT** until the old one expires or a primary-initiated revoke exists
(post-MVP J-07). Re-inviting the *same* email = allowed: in the account-row lock
the old row → REVOKED, new PENDING row created (fresh expiry window). Only one
PENDING row per account at any moment — enforced transactionally (03 §3).

## 6. Abandoned / expired invitations

- `expiresAt` = creation + 7 days (config-guessable constant, [pending J-08]).
- Status transitions to EXPIRED at first relevant contact (list/accept/decline/
  invite scan), no background job needed for correctness.
- Expired invitation → accept returns `410 GONE` to the addressee only;
  primary can then M2 again.
- Declined invitations cannot be revived (DECLINED is terminal); the primary may
  issue a fresh invitation to the same email via M2 once no live one exists.

## 7. What stays front-and-center for Emmanuel

`/register/joint` form rework: Applicant-1 = current session identity;
Applicant-2 = **email only**. DOB/middleName/phone for applicant 2 are not
collectable — no approved backend fields.
