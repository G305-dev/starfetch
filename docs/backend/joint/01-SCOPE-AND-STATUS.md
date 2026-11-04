# Phase 3A — Joint Investor MVP: Scope & Status

**Status: PROPOSAL FOR REVIEW — nothing in this package is approved yet. No migrations,
no endpoints, no schema changes have been implemented. OpenAPI `docs/api/openapi.yaml`
remains the only approved contract (v0.4.0, 11 paths, all Individual).**

**Owner:** David (Backend). **Frontend:** Emmanuel.

## Legend used across this package

- **[EXISTING]** — already approved & implemented, must not change.
- **[PROPOSED]** — recommended new behavior; requires review before Phase 3B.
- **[DECISION]** — needs explicit approval (numbered J-**). See `08-OPEN-DECISIONS.md`.
- **[DEFERRED]** — explicitly out of scope for this MVP (and Individual MVP).

## 1. Joint Investor MVP scope

### In scope (proposed)

A. **Joint account identity** — a shared account belonging to exactly two verified
   holders, each with an independent authenticated identity.
B. **Joint account dashboard read** — shared account info, holder display, portfolio
   summary (reuse of Phase 2D read shape), honest empty states.
C. **Joint investments read** — read-only holdings from actual joint-owned records only.
D. **Joint transactions read** — paginated, real rows only, same conventions as
   `/me/transactions`.
E. **Joint profile read** — holder display + membership info.
F. **Registration/membership workflow** — primary applicant initiates, second holder is
   invited and must independently consent; nothing is granted on a bare email entry.
G. **Membership authorization layer** — account-scoped access control isolated from
   `/me` context.

### Explicitly NOT implemented in this phase

- Any database migration, any new endpoint, any write of financial data.
- Anything on the deferred list below.

### Deferred (post-MVP, for BOTH account types)

Full KYC, BVN/NIN, bank accounts, document upload/verification, investment
applications/workflow, booking/execution, funding/deposits/withdrawals, transaction
creation/settlement, statements, external banking/payment integrations, full IMS,
return calculations / live valuations. **No fake equivalents are introduced.**

## 2. Existing approved behavior that is preserved

[EXISTING] NestJS + PostgreSQL + Prisma 5.22.0; argon2id passwords; email-verification
HMAC challenges; AuthSession + RefreshToken rotation with reuse-revocation;
session-aware `AccessTokenGuard`; `RolesGuard` + `INVESTOR`; rate limiting;
`{ data, meta }` success envelope and `{ error: { code, message, requestId } }` error
envelope; `/api/v1` prefix; `/me`, `/me/profile` (GET/PUT), `/me/portfolio`,
`/me/transactions` — **unchanged in contract and behavior.**

[EXISTING] Open decisions **D-08** (application status vocabulary) and **D-09**
(one-active-application semantics) remain **OPEN and untouched** — the Joint MVP does
not introduce application status transitions or uniqueness rules.

## 3. What this package delivers

| Doc | Content |
|---|---|
| 02 | Proposed domain model (no migration written) + discriminator analysis |
| 03 | Security & membership authorization architecture |
| 04 | Registration / invitation / membership workflow |
| 05 | Proposed API contract + `PROPOSED-JOINT-API-DRAFT.yaml` (draft-only) |
| 06 | Backward compatibility & Individual regression risk |
| 07 | Frontend handoff for Emmanuel (Read-only review results) |
| 08 | Open decisions requiring approval (J-01…J-08) |
| 09 | Proposed Phase 3B sequence (gated on approval) |

## 4. Hard rules honored in this phase

Frontend (`starfetch-investment-frontend/`) untouched; Neon/production untouched;
no Vercel deploy; no Git operations; no Prisma migration; no new endpoints; Email
verification ≠ KYC — a joint account is **never** presented as KYC-verified merely
because both holders verified email addresses; the frontend's signing-mandate UI is
treated as an **unapproved business rule**, never as executable authority.
