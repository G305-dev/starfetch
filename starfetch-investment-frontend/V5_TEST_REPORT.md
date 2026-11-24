> **Integration update (24 Nov 2026):** This is the original V5 test report prepared against `main` at `bb2ae82`. The present Starfetch backend on `main` has since aligned `safeUser()` Individual/Corporate/Joint projections with its guards. See the updated `scripts/backend-parity-check.ts` and `BACKEND_AUTHZ_DISCREPANCIES_FOR_DAVID.md`. Re-run all local checks before relying on current status.

# V5 — Regression Fixes: Test Report & Delivery Notes

**Base:** `origin/main` @ `bb2ae82` (re-checked with `git fetch` this round — main has not
moved since V4, so nothing from a `corporate-work` snapshot is involved).
**Scope:** frontend only. No backend, database, Prisma, migration, password or
authentication-service change. Nothing pushed, merged or deployed.

---

## Note on the three approval issues

This review was written against the **round-1** ZIP. Issues 1 and 2 were
already corrected in V3 and hardened in V4, so V5 verifies them rather than
re-does them. Issue 3 (mixed account-type inconsistency) was only *reported* in
previous rounds and is now **implemented and tested**. Issue 4 was verified
mechanically.

| Issue | Status in V5 | Evidence |
|---|---|---|
| 1. Preserve Joint invitation acceptance | Already fixed (V3/V4) — **verified against backend source** | `test:access-control:runtime`, `test:access-control:provider` |
| 2. Refresh permissions after membership change | Already fixed (V4) — **verified** | `test:access-control:provider`, 8 groups |
| 3. Mixed account-type inconsistencies | **NEW in V5** | `test:backend-parity`, + Corporate notice in the guard |
| 4. Protect latest production functionality | Verified byte-for-byte | `test:backend-parity` protected-surface assertions |
| 5. Regression verification | Full sweep | below |

### Issue 1 — verified against the real backend

The claim that the invitation inbox may be opened without a Joint membership is
now proven from the backend, not assumed:

- `joint/joint-invitations.controller.ts` uses
  `AccessTokenGuard, RolesGuard, IndividualAccountGuard` and its own comment
  states *"JointMembershipGuard is therefore intentionally absent on these
  routes."* `grep JointMembershipGuard` on that file matches **only that comment**.
- `joint/joint.controller.ts` uses
  `..., IndividualAccountGuard, JointMembershipGuard` on account detail,
  portfolio, transactions and invitation creation.

So the frontend exception on the exact path `/joint/invitations`, and the
requirement of `JOINT` everywhere else, mirrors the backend exactly. The
assertion is now automated (it fails if someone adds `JointMembershipGuard` to
the inbox route).

---

## Issue 3 in detail — what was implemented

New `lib/auth/backend-authorization-parity.ts` models four real backend rules:

| Frontend model | Mirrors |
|---|---|
| `backendSafeUserContexts` | `auth.service.ts#safeUser` |
| `individualAccountGuardAllows` | `common/guards/individual-account.guard.ts` |
| `corporateApplicantServiceAllows` | `corporate-applicant-context.service.ts#requireVerifiedInvestor` |
| `jointMembershipGuardAllows` | `joint/guards/joint-membership.guard.ts` |

It is **read-only**: it never grants access, is not imported by any route guard
for authorisation decisions, and cannot change a decision. It detects two things:

**A. Promise/denial mismatches** — the projection promises a portal whose entry
calls the backend rejects. Both examples from the review reproduce:

| Account | `authorizedContexts` | Guard verdict | Finding |
|---|---|---|---|
| Primary CORPORATE + Individual profile | `INDIVIDUAL, CORPORATE` | `IndividualAccountGuard` = **deny** | Individual portal promised but denied |
| Primary INDIVIDUAL + Corporate evidence | `INDIVIDUAL, CORPORATE` | `CorporateApplicantContextService` = **deny** | Corporate portal promised but denied |

**B. Classification asymmetries** — reported separately, as instructed.
`safeUser()` suppresses `JOINT` only for `primaryAccountType === CORPORATE`, so a
legacy `null`-primary account with identical Corporate evidence **keeps** Joint
access while a CORPORATE-classified one loses it. The frontend cannot normalise
this without second-guessing the backend, so it is reported, not "fixed".

**User-facing consequence (only where it is safe to act):** when the projection
grants `CORPORATE` but the applicant guard would refuse every data call, the
Corporate guard now renders a classification notice instead of mounting a portal
that would fail on every request. The portal is not mounted, so **no** failing
Corporate call is fired (asserted in the tests). The Individual direction is left
alone — telling an investor their account is misclassified is a support decision,
not a frontend one — and is reported to the backend owner instead.

No backend file was modified. `git status starfetch-investment-backend` is empty.

---

## Test report — static checks vs. real execution, kept separate

### A. STATIC checks (source text + pure functions; no rendering, no network)

| Command | What it asserts |
|---|---|
| `npm run test:account-context-access` | Wiring, fail-closed rules, shared login/guard predicate, no cookie/storage logic added |
| `npm run test:backend-parity` | The guard model still matches the real backend expressions; the behaviour table below; Corporate KYC document APIs intact |

`test:backend-parity` reads the backend files on every run and **fails if a
backend change makes the model stale** — proven by editing
`individual-account.guard.ts`, which produced
`Error: IndividualAccountGuard still rejects CORPORATE-classified accounts…`,
then restoring it. When the backend source is absent (e.g. a frontend-only
clone) the provenance assertions skip and state so; the behaviour table always runs.

**Behaviour table (actual output):**

```
Individual-only                            contexts=[INDIVIDUAL]            IND=Y CORP=N inbox=Y jointScoped=N mismatches=0
Individual + Joint member                  contexts=[INDIVIDUAL,JOINT]      IND=Y CORP=N inbox=Y jointScoped=Y mismatches=0
Primary CORPORATE with an Individual profile  contexts=[INDIVIDUAL,CORPORATE] IND=N CORP=Y inbox=N jointScoped=N mismatches=1
Primary INDIVIDUAL with Corporate evidence    contexts=[INDIVIDUAL,CORPORATE] IND=Y CORP=N inbox=Y jointScoped=N mismatches=1
Primary CORPORATE, no Individual profile      contexts=[CORPORATE]            IND=N CORP=Y inbox=N jointScoped=N mismatches=0
Legacy null primary, Individual profile only  contexts=[INDIVIDUAL]           IND=Y CORP=N inbox=Y jointScoped=N mismatches=0
Legacy null primary, Corporate evidence only  contexts=[CORPORATE]            IND=N CORP=Y inbox=N jointScoped=N mismatches=0
Legacy null + Corporate evidence + Joint membership  contexts=[INDIVIDUAL,CORPORATE,JOINT] IND=Y CORP=Y inbox=Y jointScoped=Y mismatches=0  ← asymmetry
CORPORATE with Joint membership row        contexts=[INDIVIDUAL,CORPORATE]  IND=N CORP=Y inbox=N jointScoped=N mismatches=1
```

### B. REAL RENDERING (React components actually mounted, HTTP mocked)

| Command | Provenance |
|---|---|
| `npm run test:account-context-access:runtime` | `react-dom/server`: guard (11 groups), Joint access regression (16 checks), membership module (29 checks) |
| `npm run test:access-control:provider` | `react-test-renderer`: **real** `AuthProvider`, `JointAccountProvider`, `JointInvitationsContent`, `JointApplicantDetailsForm`, `RequireAccountContext`, `SignInForm` — 8 groups + 16 login scenarios |

Only four boundaries are substituted: `next/navigation`, `next/link`, the browser
`FormData` collection step, and `globalThis.fetch`. Access tokens, token
rotation, 401 retry, the session-expired listener and logout are the real
`lib/api/client` code.

### The review's required cases — all mapped

| Required test | Where | Provenance |
|---|---|---|
| Individual login | 16 login scenarios | REAL component |
| Corporate login | 16 login scenarios | REAL component |
| Existing Joint member login | 16 login scenarios | REAL component |
| Individual without membership opens `/joint/invitations` | provider group 6 + guard matrix | REAL component |
| Invitation acceptance → immediate Joint dashboard | provider groups 1–3, 6 | REAL component |
| Joint creation → immediate dashboard access | provider group 4 | REAL component |
| Unauthorised direct URL access | provider group 7, guard matrix (16 checks) | REAL component |
| Session refresh and page reload | provider group 7 (remount) + groups 1–5 | REAL component |
| Backend-denied mixed classifications | `test:backend-parity` + provider group 8 | static table + REAL component |
| Corporate Profile and document API compatibility | `test:backend-parity` protected-surface + `test:corporate-profile`, `test:corporate-api` | static + existing suites |

### C. NOT covered — stated plainly

There is **no real browser and no real backend** in any of this. Specifically
absent:

- no Playwright/Cypress/Selenium run; no real cookies, redirects or page loads;
- no live API calls, no database, no seeded accounts;
- `react-test-renderer` is deprecated in React 19 (works, emits a notice);
- **no end-to-end API integration test of the mixed classifications.** The
  promise/denial findings are derived from reading the backend guards, not from
  observing a live 403. A staging test with a real CORPORATE-plus-profile account
  is still needed before that finding is treated as confirmed in production.

---

## Results (fresh `bb2ae82` clone, packaged files applied)

- `npm run typecheck` → clean
- `npm run test:access-control` (all four suites) → PASS
- Full `test:*` sweep → **38 PASS / 1 FAIL**
- `npm run build` → `✓ Compiled successfully` (includes `/corporate/documents`)

The single failure, `test:about-profile-cards`, is **pre-existing on `bb2ae82`**
and deliberately not patched (`components/about/Team.tsx` comment contains
"SEC-approval asterisk"). Confirmed failing on the pristine clone.

---

## Changed files (40; vs pristine `bb2ae82`)

### New in V5 (2)

```
lib/auth/backend-authorization-parity.ts     guard model + parity findings + notice helper
scripts/backend-parity-check.ts              provenance, behaviour table, protected surface
```

### Modified in V5 (2)

```
components/auth/RequireIndividualAuth.tsx    + ClassificationNotice for mixed Corporate accounts
package.json                                 + test:backend-parity, aggregate chain
```

### Carried forward (36, unchanged this round)

```
.gitignore, app/corporate/layout.tsx, app/dashboard/layout.tsx, app/investments/page.tsx,
app/joint/layout.tsx, app/products/page.tsx, app/products/fixed-note/page.tsx,
app/profile/page.tsx, app/register/joint/page.tsx, app/transactions/page.tsx,
components/auth/AuthProvider.tsx, components/auth/JointApplicantDetailsForm.tsx,
components/auth/SignInForm.tsx, components/joint/JointInvitationsContent.tsx,
components/joint/JointPortalAccess.tsx, lib/api/client.ts, lib/auth/account-context-access.ts,
lib/auth/membership-context-refresh.ts, package-lock.json, scripts/account-context-access-check.ts,
scripts/corporate-applicant-registration-check.ts, scripts/corporate-application-creation-check.ts,
scripts/corporate-navigation-check.ts, scripts/corporate-post-login-routing-check.ts,
scripts/general-corporate-login-check.ts, scripts/harness/* (11 files)
```

**`lib/api/client.ts`**: the only change is the read-only `jointMembershipCount`
field on the user projection (13 added lines). Every Corporate KYC document
function — `getCorporateKycDocuments`, `uploadCorporateKycDocument` (including
`replacesDocumentId`), `submitCorporateApplication` (including `idempotencyKey`) —
is untouched, and all Corporate document components are byte-identical to `bb2ae82`.

---

## Remaining risks

1. **No browser E2E and no live API integration test.** Everything is component
   rendering with a mocked HTTP boundary plus source-level verification. Real
   cookie/CSRF/redirect behaviour and the real 403s are unverified against a
   running backend.
2. **The mixed-classification findings are derived from source, not observed.**
   If the guards behave differently at runtime (middleware, interceptors), the
   table could be wrong.
3. **`test:backend-parity` provenance assertions need the monorepo.** In a
   frontend-only checkout they skip (and say so). Run it from the monorepo root
   to get drift protection.
4. **The Corporate classification notice is a new user-visible screen.** It only
   appears for accounts whose projection and backend guard disagree. It has been
   tested for content and for not firing Corporate calls, but not reviewed visually
   in a browser.
5. **Three backend inconsistencies remain open** (reported separately for David in
   `BACKEND_AUTHZ_DISCREPANCIES_FOR_DAVID.md`, re-verified against source this
   round). Until one authority is chosen, frontend and backend can disagree for
   mixed accounts.
6. **Stale-refresh recovery is manual by design** — "Refresh access" or reload.
   Automatic retry was rejected: it risks duplicate submissions.
7. **`test:about-profile-cards` fails on `bb2ae82`** before any change.
