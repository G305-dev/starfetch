# 08 — Decisions Register (REVISED after David's review)

**Nothing below is formally approved.** Each entry is a review-aligned
*recommendation*, pending David's final sign-off before Phase 3B.

[EXISTING — preserved, untouched: **D-08** application status vocabulary ·
**D-09** one-active-application semantics.]

| # | Register entry | Current recommendation (pending approval) |
|---|---|---|
| **J-01** | Portfolio ownership model | **Option B** — nullable `userId` + nullable unique `jointAccountId` + XOR CHECK (doc 02 §2, illustrative SQL §2.2, rollback analysis §2.4) |
| **J-02** | Authorization model | Keep **INVESTOR** as the sole customer role; joint access via membership data + JointMembershipGuard |
| **J-03** | Schema set | Simplified `JointAccount` / `JointAccountMember` / `JointAccountInvitation` (login-only inbox — token mechanics **removed**; `acceptedByUserId` audit/idempotency column **added** with named `User` FK relations) |
| **J-04** | Capacity & concurrency | Max 2 ACTIVE members via **account-row lock (SELECT … FOR UPDATE) in one transaction** + UNIQUE pair + idempotent double-accept + single live PENDING invitation (doc 03 §3) |
| **J-05** | Per-user joint-account count | **No assumed business restriction** — a user may belong to multiple joint accounts unless Starfetch management later decides otherwise; capacity limits apply per-account, not per-user |
| **J-06** | Invitation delivery | **Login-only inbox**: email contains only a page link, no authorization credentials; verified-email address match is the acceptance gate |
| **J-07** | Removal & mandates | Member removal and financial signing mandates **deferred post-MVP** (no storage of mandate authority; no removal endpoints) |
| **J-08** | Endpoint set | **Nine operations** (R1–R4, M1–M5) per validated draft YAML v0.5.0-draft.3 — security AND-combined, Phase-2D-mirrored financial schemas, server-side identity lookup, idempotent replay — subject to final corrected-contract review |

### Remaining business decisions for David / Starfetch management

1. Invitation **expiry length** (proposed 7 days).
2. Rate-limit numeric thresholds (proposed 5/h account create, 5/h invitations,
   20/h accept/decline) — tune to real traffic expectations.
3. Invitation **email copy/template** approval (product/compliance).
4. Whether the frontend `/register/joint` Applicant-1 step requires prior login
   (recommended: yes) or offers register-then-invite inline (more complex).
5. Copy for the one-member account state (proposed flag label
   `awaitingSecondHolder`) — management sign-off so it is never presented as a
   fully established or KYC-verified account.

### Boundary reaffirmed

No KYC/BVN/NIN, bank accounts, documents, applications, booking/execution,
payments/deposits/withdrawals, statements, live valuations/returns, or IMS —
deferred for Individual **and** Joint; no mock substitutes will be implemented.
