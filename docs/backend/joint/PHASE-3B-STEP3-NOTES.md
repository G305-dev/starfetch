# Phase 3B Step 3 — Notes: Joint Investor READ APIs (Backend)

Status: **COMPLETE (locally, sandbox).** Built on Steps 1–2. Implements the four
read endpoints of `PROPOSED-JOINT-API-DRAFT.yaml` **v0.5.0-draft.3** exactly.
`docs/api/openapi.yaml` (v0.4.0) remains UNCHANGED pending coordinated contract
promotion. Frontend untouched.

## Endpoints delivered (all `GET`, base `/api/v1`)

| # | Route | Auth stack | Source of truth |
|---|---|---|---|
| R1 | `/me/joint-accounts` | AccessTokenGuard → RolesGuard(INVESTOR) | caller's `joint_account_members` rows only |
| R2 | `/joint-accounts/:jointAccountId` | + JointMembershipGuard → verified `@JointAccount()` ctx | account + member rows (existence + membership proven in guard) |
| R3 | `/joint-accounts/:jointAccountId/portfolio` | same as R2 | `Portfolio.jointAccountId` ONLY (queried by account ctx — never by `userId`) |
| R4 | `/joint-accounts/:jointAccountId/transactions` | same as R2 | transactions of the joint-owned portfolio; phase-2D pagination (`page` 1-based, `pageSize` ≤ 100, `occurredAt desc, id desc`) |

Empty/zero states are HONEST: `data: []` with `meta.total: 0`; portfolio
zero-state `{currency:"NGN", totalValueMinor:0, holdingCount:0, totalReturnMinor:null, holdings:[]}`
— whether the portfolio row exists-but-empty or is absent entirely. No seeding,
no valuation math — ever.

## Implementation structure

- `src/modules/joint/services/joint-read.service.ts` — new, joint-owned reads
  only; individual code paths untouched.
- `src/modules/joint/joint.controller.ts` — R1–R4; handlers return draft data
  payloads; envelope (`{data, meta{requestId}}`) applied by the existing global
  interceptor; R3 adds `meta.asOf` exactly as `/me/portfolio` does.
- `src/modules/me/dashboard.service.ts` — the ONLY change: `toHoldingView` /
  `toTransactionView` are now **exported** (zero behavior change) and reused so
  joint rows serialize byte-identically to the approved individual contract.
- `src/modules/joint/joint.module.ts` — controller + service registered.

## Documented draft↔implementation decisions (for review, not silent changes)

1. **R1 ordering**: draft does not pin ordering → deterministic `joinedAt ASC`
   (oldest membership first). Stable for UI.
2. **`holderNames` format**: `"<firstName> <lastName>"` from `InvestorProfile`
   (single space, trimmed). Draft pins items as strings, not the format.
3. **Draft↔reality parity, not divergence**: `quantity` serializes via Prisma
   Decimal `.toString()` → trailing zeros normalize (`"1.500000"` becomes
   `"1.5"`). This is the SAME behavior as the approved v0.4.0 `/me/portfolio`
   serializer (shared function) — the draft's "Decimal serialized as string"
   remains truthful.
4. **Precision caveat (documentation for approval, NOT a change)**:
   BigInt → `Number` in the shared serializer is exact only up to 2^53−1 minor
   units (≈ ₦90 quadrillion kobo — far beyond realistic values). Any stronger
   guarantee (string-serialized money) would ALTER the approved v0.4.0 contract
   — flagged for contract review; current behavior intentionally matches the
   approved individual endpoints bit-for-bit.
5. **Error order on R4**: membership guard executes BEFORE query validation
   (Nest guard-before-pipe), so a non-member with `page=0` receives the generic
   404 — validation shape cannot be used to probe account existence.
6. **R2 `members[].email`**: full email as the draft schema specifies
   (`format: email`); restricted to co-members of the same account by the
   guard. No phone/role/verification/session fields are ever included.
7. **`awaitingSecondHolder`** is a display/UX state only (`memberCount === 1`).
   It implies NOTHING about KYC, account approval, mandate authority, or
   funding; the API carries no such claims.

## Handoff notes for Emmanuel (frontend)

Available NOW (local/dev): four read endpoints above. Data you can rely on:

- List items: `jointAccountId, displayName (≤60 chars), memberCount (1|2),
  holderNames ("First Last"), myJoinedAt (ISO), isFull, awaitingSecondHolder`.
  Render `awaitingSecondHolder: true` as "awaiting second holder" — NEVER as
  "verified/active/approved/funded".
- Detail: `members[]` rows = `{userId, firstName, lastName, email, joinedAt}`
  only; `membership = {capacity:2, activeCount, awaitingSecondHolder}`.
- Portfolio: identical shape to `/me/portfolio` (`currency, totalValueMinor,
  holdingCount, totalReturnMinor, holdings[]`), plus same meta (`requestId, asOf`).
  `totalReturnMinor` is ALWAYS null — do not render a returns percentage.
- Transactions: identical rows & pagination meta to `/me/transactions`;
  ordering newest-first with stable `id desc` tie-break.
- Money = signed minor units (kobo) as JSON numbers; NGN only. Pagination:
  `?page=1&pageSize=20` defaults; invalid page/pageSize → 400 VALIDATION_FAILED;
  unknown OR unauthorized account → identical 404 (do not distinguish).
- NOT available yet: account creation, invitations, accept/decline (Step 4).

## Validation results (this step)

`prisma validate` ✔ · `prisma generate` Client ✔ · `npm run typecheck` 0 errors ·
`npm run build` clean · unit **35/35** · e2e **100/100** = 68 pre-existing +
16 Step-2 security + 16 new Step-3 · `migrate status` up-to-date (no new
migrations) · openapi.yaml v0.4.0 & frontend unchanged.

## Remaining risks

- Process-local in-memory rate limiter (documented in Step 2) — shared store
  before horizontal scaling. Read endpoints are deliberately NOT rate-bound
  beyond the existing IP-level global guard.
- R2 emails visible to co-members — approved by draft; reconsider masking at
  contract review if product prefers.
- J-01…J-08 business parameters still pending — read APIs carry no mandates,
  KYC, or funding semantics regardless.
