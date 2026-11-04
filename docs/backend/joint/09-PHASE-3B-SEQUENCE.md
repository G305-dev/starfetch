# 09 — Proposed Phase 3B Implementation & Testing Sequence

**Gate: all of J-01…J-08 approved per the REVISED register (doc 08), plus the
business decisions listed there. No step starts before that.**

## Step 1 — Schema migration (single, additive)

- `JointAccount`, `JointAccountMember` (+ unique pair), `JointAccountInvitation`
  (+ invitation statuses; NO bearer-token columns — login-only inbox),
  `portfolios.jointAccountId` nullable + unique +
  XOR CHECK; `portfolios.userId` becomes nullable (unique retained).
- Run against dev/test DBs first; prove existing 35/68 suites green **before**
  any code lands (migration-only deploy).

## Step 2 — Authorization & abuse layers

- `JointMembershipGuard` + account-context param resolution + identical-404
  behavior. Unit tests: member / non-member / unknown account / no-role.
- `RateLimitGuard` key-strategy extension (`ip`/`user`/`user+account`) —
  existing IP buckets untouched.
- Transactional membership acceptance with account-row locking (doc 03 §3),
  unique-pair idempotent double-accept, single-live-PENDING invariants.

## Step 3 — Read surfaces (R1–R4)

- Extract Phase 2D read services behind `byUserId` (existing) and
  `byJointAccountId` (new) — keep individual behavior provably unchanged.
- e2e: joint empty-state honesty; isolation (cross-account 404s; `/me` never
  returns joint rows); pagination parity with `/me/transactions`.

## Step 4 — Membership flows (M1–M5)

- Initiate + invite + inbox + accept/decline; DB-transactioned capacity and
  single-live-invitation invariants; invitation email via existing
  email-provider seams (fake provider in dev/test) — email carries only a
  link to the invitations page, no credentials (login-only inbox).
- e2e: full happy path (register second user → verify → accept → both read
  joint dashboard), decline, expiry, resend rotation, self-invite rejection,
  enumeration-shape assertions (identical 201/404 envelopes), keyed rate-limit
  hits, concurrent two-accept race (exactly one 200 + one 409, two ACTIVE rows),
  double-accept idempotency, expired/revoked acceptance rejection.

## Step 5 — Contract promotion

- After review + e2e green: promote the draft fragment into
  `docs/api/openapi.yaml` as version `0.5.0` (coordinated with Emmanuel), from
  the VALIDATED draft v0.5.0-draft.3 (Redocly-clean),
  leaving every existing path byte-identical.

## Step 6 — Handoff to Emmanuel

- Deliver finalized contract + seeded *synthetic* joint fixture in the dev DB
  only (real rows via the real flows — never faked), plus doc 07 mapping.
- Frontend integration belongs to Emmanuel end-to-end.

## Testing sequence summary

unit (guards, invitation state machine, parsers) → route e2e (authn/authz,
envelopes, errors) → isolation e2e (cross-contamination attempts) →
migration-reversibility check (down-migration on scratch DB) → final
35/68 + new joint suite gate.

## Out of Phase 3B regardless of approvals

Everything on the DEFERRED list (doc 01 §1, doc 08) stays unimplemented, unfaked.
