# 07 — Frontend Handoff for Emmanuel (read-only review — no frontend files touched)

## 1. Existing joint routes (all present in the restored baseline)

`/joint/dashboard`, `/joint/investments`, `/joint/transactions`, `/joint/products`
(+`/fixed-note`), `/joint/profile`; registration via `/register/joint` →
`JointApplicantDetailsForm.tsx`; joint chrome in `components/joint/*`
(`JointSidebar`, `JointHeader`, four Content components + four `joint-*-data.ts`
mock modules).

## 2. Mock-dependency inventory → backend requirement map

| Frontend surface | Currently fed by | Can MVP backend satisfy? | Notes for Emmanuel |
|---|---|---|---|
| Joint dashboard summary cards (`portfolioSummary`: ₦52,480,000, +14.8%…) | `joint-dashboard-data.ts` mock | **Partially** | R3 gives `totalValueMinor` + `holdings[]`. **"Total Invested", "Returns YTD", % vs. last year have no backend source — deferred (no valuation math)**. Render honest empty state ("No investments yet") until real rows exist. |
| Portfolio performance chart (1M/…/All series) | mock series | **No** | No performance series anywhere in approved schema. Feature must stay mock-labelled or be removed/hidden. |
| Account holders panel (`jointAccountHolders` Amara/Daniel) | mock | **Yes** | R2 `members[]` (names/email/joinedAt) + R1 for "my accounts" selection. |
| `signingMandate` card | mock | **No — by policy** | Unapproved business rule; if kept, must render as display-only "preference, not in effect" text. Backend stores nothing. |
| `accountVerification: "Verified"` badge | mock | **No — by policy** | Email verification ≠ KYC. Dashboard must not claim Verified. Suggested honest label: "Email verified for both holders" once 2 ACTIVE members exist (derivable from R2). |
| Joint investments list (`jointInvestments`, filter tabs, summary strip) | `joint-investments-data.ts` mock | **Partially** | R3 `holdings[]` per-item: `instrumentLabel`, `quantity?`, `valueMinor`, `currency`, `asOf`. **Filter tabs Active/Matured and "amount invested / returns %" have no source — hide until data exists; empty state copy exists in mocks and matches honest behavior.** |
| Joint transactions (`jointTransactions`, tabs/category/product/date filters, summary strip, **approvalStatus** column) | `joint-transactions-data.ts` mock | **Partially** | R4 gives `id, type, status, amountMinor(signed), currency, description, occurredAt` + pagination. **No filters, no summary strip, no `reference`, no `processingDate`, no requiresJointApproval/approvalStatus — none exist server-side; joint-approval columns must be dropped for MVP.** Pagination mirrors `/me/transactions`. |
| Joint profile (`jointProfile` applicant1/2 + 8 sections incl. identity-verification, next-of-kin, bank-details, pep-declaration, documents) | `joint-profile-data.ts` mock | **Partially** | R2 members covers names/emails only. The other sections are KYC/banking/documents — **deferred; render as "Not yet available" or hide.** Holder phone comes only from each holder's own `/me/profile` (own data, not co-holder data). |
| `/register/joint` two-person form | local state only | **Redesign needed** | Keep Applicant-1 = the signed-in user; reduce Applicant-2 to **email only** and call M1 (initiate + invite). DOB/middleName have no approved backend field — collect nothing else in MVP. Login still goes through existing `/login`. |

## 3. New UI elements Emmanuel will likely need (if endpoints approved M1–M5)

- Account switcher/entry: call R1 on joint-portal load; if `[]` → CTA "Open a joint account" → M1 flow.
- Invitation inbox: surface `GET /me/joint-invitations` (badge on profile or dashboard) + accept/decline (M4/M5).
- After acceptance: the new account appears via R1 — no special "second login"; each holder uses their own session.

## 4. Honesty rules the frontend must keep (mirrors Individual experience)

- Empty joint portfolio → `"₦0.00" + "No investments yet"`, never mock zeros-plus-decorations.
- Empty transactions → mock emptyTitle copy is already correct ("No transactions yet").
- Currency pinned per record (`currency` field); minor units; no client-side return math.
- Error states: `404` on joint paths means "not accessible", not "does not exist" — avoid existence-confirming copy.

## 5. Contract-shape reuse

R3/R4 intentionally reuse the Phase 2D `PortfolioResponse`/transaction envelope —
if Emmanuel's individual integration already has typed parsers for those, the joint
surfaces can reuse them unchanged.
