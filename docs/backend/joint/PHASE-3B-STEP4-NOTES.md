# Phase 3B Step 4 — Notes: Joint Account Creation & Invitation Workflow (Backend)

Status: **COMPLETE (locally, sandbox) — final security/implementation
corrections applied.** Implements M1–M5 of `PROPOSED-JOINT-API-DRAFT.yaml`
v0.5.0-draft.3, completing the MVP backend. openapi.yaml remains v0.4.0
(no promotion). Frontend untouched. No migrations.

## Final corrections applied (review feedback)

1. **Verified-email enforcement on decline (M5).** `declineInvitation()` now
   loads `emailVerifiedAt` with the identity record and refuses unverified
   callers with 403 `EMAIL_NOT_VERIFIED` **before any invitation probing** —
   exact parity with accept, no enumeration signal, missed-by-review asymmetry
   removed. Verified-recipient idempotent decline and all 404/410 behavior
   preserved (regression-pinned by e2e).
2. **Invitation configuration validation.** `env.validation.ts` now hard-fails
   startup on: `JOINT_INVITATION_TTL_HOURS` that is zero/negative/NaN/Infinity
   or >720h; `JOINT_INVITATIONS_URL` that is malformed, non-http(s), or carries
   query/fragment/embedded credentials; and in staging/production additionally
   requires the URL to be explicitly configured, HTTPS, and non-localhost.
   `configuration.ts` independently clamps to the safe 168h default. Dev
   defaults preserved (localhost allowed in development/test only).
3. **Real endpoint rate-limit proof.** New `test/joint-rate-limit.e2e-spec.ts`
   runs the REAL mutation routes with limits enabled: M1 6th create → 429,
   M2 6th invite on same account → 429 while same user/other account → 201,
   M4 21st accept → 429, M5 21st decline → 429 (accept/decline share the
   `joint-invitation-respond` bucket), all 429s carry
   `context.retryAfterSeconds`; unauthenticated → 401 and non-member → 404
   BEFORE any bucket is touched; global IP login bucket behavior unchanged.
   Thresholds stay DEV values (pending business approval); none altered.
4. **Invitation email log protection.** The delivery-failure log line now uses
   a safe structured category (`ECONNREFUSED`-style `.code` whitelist or
   `send_failed`) plus the MASKED recipient. Raw SMTP exception
   messages/stacks — which can embed addresses, credentials, banners — are
   never logged. Verified by a synthetic-smtp-exception e2e test asserting
   neither logs nor API responses contain the planted secrets; post-commit
   persistence and "no delivery claim in the contract" behaviors unchanged.

## Current security guarantees (all e2e-proven on real PostgreSQL)

Full guard stack on every mutation (session-aware bearer → INVESTOR role →
cookie security: origin + session-bound signed CSRF → keyed throttle;
membership proof where an account is in play), consent-derived authorization
on accept/decline (verified email from the CURRENT DB record — never JWT or
body), anti-enumeration 404s/410 addressee-only, parent-first lock order with
capacity-checked-in-lock, ON-CONFLICT-backed single membership, conditional
status flips (rowcount=1), single-live-PENDING invariant, idempotent replay,
linearizable races, post-commit notification with preserved rows on failure.

## Operational distinctions

- Implemented: R1–R4 (Step 3) + M1–M5 (this step). Excluded/deferred: KYC,
  banking, funding, investment execution, statements, IMS, corporate APIs.
- Remaining business approvals: J-01–J-08, invitation email wording, keyed
  rate-limit thresholds (currently dev conventions), contract promotion.
- Rate limiting is PROCESS-LOCAL (in-memory adapter): per-instance, fragments
  under horizontal scale; shared store behind the RATE_LIMITER port required
  before multi-instance production. Not claimed otherwise.
- Invitation config (`joint.invitationTtlHours`, `joint.invitationsUrl`) is
  dev-defaulted; production/staging MUST set JOINT_INVITATIONS_URL to a real
  HTTPS page or startup fails. Email links never carry tokens/credentials/
  authorization parameters.
- Production deployment also requires: real SMTP (SMTP_HOST enforced), strong
  secrets (enforced), OpenAPI promotion, business sign-off above.

## Validation results (after corrections)

`prisma validate` ✔ · `generate` ✔ · `migrate status` up-to-date (4
migrations) · `typecheck` 0 errors · `build` clean · unit **39/39** (35
baseline + 4 config-validation cases) · e2e **126/126** (68 auth/individual +
16 Step-2 + 16 Step-3 + 21 Step-4 workflow + 5 real-endpoint rate-limit).
No existing assertion weakened; the only existing-fixture edit was adding the
now-required JOINT_INVITATIONS_URL to a production positive case.

## Operations delivered (base `/api/v1`)

| # | Route | Guard stack (order mandatory) | Notes |
|---|---|---|---|
| M1 | `POST /joint-accounts` → 201 | AccessToken → Roles(INVESTOR) → CookieMutation → KeyedRateLimit(`joint-account-create`, 5/h/user, DEV) | verified email enforced (403 EMAIL_NOT_VERIFIED); self-invite 400; account+member+invitation in ONE tx; notification after commit |
| M2 | `POST /joint-accounts/:jointAccountId/invitations` → 201 | … + JointMembership (before CookieMutation/keyed) + KeyedRateLimit(`joint-invitation-create`, 5/h/user+account, DEV) | capacity<2 in account lock; member-email → 409; live-pending-to-other-email → 409 (no cancellation policy yet); same-email replacement = REVOKE old + fresh PENDING; anti-enumeration shape |
| M3 | `GET /me/joint-invitations` | AccessToken → Roles (read: no CSRF) | caller email resolved from CURRENT User DB record — never JWT/body; live PENDING only; `[]` normal |
| M4 | `POST /me/joint-invitations/:invitationId/accept` → 200 | AccessToken → Roles → CookieMutation → KeyedRateLimit(`joint-invitation-respond`, 20/h/user, DEV) | §3.1 algorithm verbatim: identity(DB, verified) → probe → account lock → invitation lock → replay path (same-user ACCEPTED+membership ⇒ same 200, zero side effects) → address match ⇒ PENDING+unexpired → capacity<2 → insert member → conditional flip (rowcount=1) → revoke other PENDING. wrong-user/unknown/malformed/revoked/declined → identical 404; expired → 410 addressee-only; full → 409 |
| M5 | `POST /me/joint-invitations/:invitationId/decline` → 200 | same as M4 | PENDING→DECLINED (conditional updateMany, rowcount=1); repeat-decline by same addressee idempotent-200; declined cannot later be accepted (404); never writes membership |

## Email delivery capability

New, separate port `JOINT_INVITATION_MAILER` (`JointInvitationMailer`) — the
auth `EMAIL_PROVIDER` (verification codes) is untouched. Adapters:
`SmtpJointInvitationMailer` (reuses approved SMTP config; wording PROVISIONAL
pending template approval) and `FakeJointInvitationMailer` (tests). Rules
honored: sent AFTER commit; no tokens/credentials; content carries only
inviter first name, displayName, and a plain invitations-page URL
(`joint.invitationsUrl`, dev default `http://localhost:3000/login`); delivery
failure is logged with the MASKED address and does NOT sink the DB row or the
201 — the contract makes no delivery claim. Retry path today: safe replacement
via M2 (re-invite same email). Queued background retry is a candidate later
enhancement, pending approval.

## Config (dev defaults — pending business approval)

`joint.invitationTtlHours` = 168 (7 days) · `joint.invitationsUrl`. Keyed
limits: create 5/h/user · invite 5/h/user+account · accept/decline 20/h/user
(IP-level global limiter untouched as backstop; process-local limitation
documented in Step 2 — not globally distributed).

## Error vocabulary

`GONE` + 410→GONE mapping ADDED (new code for expired invitations). All other
conventions (`{data,meta}`, `{error:{code,message,requestId}}`, 400/401/403/404/
409/429/500) untouched. Errors map: 400 VALIDATION_FAILED (incl. self-invite,
unknown fields, over-60 displayName) · 401 UNAUTHENTICATED · 403 FORBIDDEN /
EMAIL_NOT_VERIFIED / CSRF_VALIDATION_FAILED · 404 anti-enumeration ·
409 CONFLICT · 410 GONE · 429 RATE_LIMITED (+retryAfterSeconds) · 500 INTERNAL_ERROR.

## Decisions documented (no silent contract changes)

1. **displayName default** when omitted: creator's `"First Last"` (trimmed,
   ≤60). The draft says "holder names server-side"; the second holder's name
   is unknowable (and must not be probed) at creation, so the creator's name
   is the truthful interim label — Emmanuel may re-label later via reads.
2. **Expired invitations keep status PENDING** and are filtered by time
   everywhere (M3 hides them; M4/M5 answer 410). A background sweep flipping
   them to EXPIRED is optional later — behavior for callers is identical now.
3. **M3 ordering**: `createdAt desc` (newest first) — draft does not pin order.
4. **M1 response** carries only `{jointAccountId, displayName, invitation{…}}`,
   invitation with masked email — no invitee existence signal.

## Emmanuel handoff (Step 4)

Available now (dev): POST /joint-accounts `{displayName?, inviteeEmail}`;
POST /joint-accounts/:id/invitations `{email}`; GET /me/joint-invitations;
POST /me/joint-invitations/:id/accept|decline. All four mutations require the
session cookie pair + `X-CSRF-Token: <sf_csrf cookie value>` (and same-origin
in browsers). Accept is safe to retry: double-submit returns the same 200.
Watch for: 403 EMAIL_NOT_VERIFIED (sender/invitee must verify email first),
409 (account full / other pending invitation / already a member), 410 (expired),
429 (retryAfterSeconds). `awaitingSecondHolder` remains the only "pending"
signal — emails say nothing about whether the address is registered.

## Concurrency proof (live PostgreSQL)

- accept ×2 concurrent (same addressee) → both 200, single membership.
- accept vs decline race → exactly (200, 404); final state consistent either way.
- accept vs reinvite race → linearizable: accept-wins ⇒ invite 409; reinvite-wins
  ⇒ accept 404 (old invitation revoked). No deadlocks (global parent-first lock
  order on every path).

## Pre-merge safety patch (final, applied and greengated)

1. **E2E cleanup fuse** (`test/utils/e2e-db-guard.ts`; `cleanDatabase` in
   `test/utils/test-app.ts` calls it FIRST): destructive test cleanup fails
   closed unless the resolved DATABASE_URL is `postgresql://<loopback>/starfetch_test`
   — scheme, loopback host and the exact, case-sensitive database name are all
   validated; NODE_ENV is NOT accepted as proof. starfetch_dev, Neon-style
   hosts, blank/parse-fail URLs are refused via `UnsafeTestDatabaseError`
   before any table is touched; the negative tests also prove zero rows are
   deleted while an unsafe target is configured, and the positive control keeps
   designated-database cleanup working.
2. **SMTP error-code allowlist** (`JointMutationService.deliveryCategory`):
   replaces arbitrary ALL-CAPS acceptance with an explicit recognized set
   (`ECONNREFUSED, ECONNRESET, ECONNABORTED, ETIMEDOUT, EHOSTUNREACH,
   ENETUNREACH, EAI_AGAIN, ENOTFOUND, EPROTO, ESOCKET, EAUTH, EENVELOPE,
   EMESSAGE`). Anything else — including fabricated uppercase codes such as
   `NEONSECRETKEY` — becomes `send_failed`; e2e proves fabricated codes never
   reach logs while recognized transport codes still classify.

Final gate state after the patch: `prisma validate` ✔ · `generate` ✔ ·
`migrate status` up-to-date · `typecheck` 0 errors · `build` clean · unit
**39/39** · e2e **133/133** (68 + 16 + 16 + 22 + 5 + 6).
