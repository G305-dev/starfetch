# Backend authorisation parity — updated handoff for David

**24 November 2026 — checked against Starfetch `main`** (after original V5 package baseline `bb2ae82`). This note supersedes the original V5 discrepancy claims; it does not change backend code.

## What changed since original V5

- `AuthService.safeUser()` now includes `INDIVIDUAL` only for INVESTOR users who have an `investorProfile` and are not primary `CORPORATE`. This agrees with `IndividualAccountGuard` for the reviewed mixed-classification case.
- `safeUser()` now includes `CORPORATE` only for verified INVESTOR users whose primary is not `INDIVIDUAL`, and who are primary `CORPORATE` or have applicant/application evidence. This agrees with `CorporateApplicantContextService` for the reviewed mixed-classification case.
- `safeUser()` now includes `JOINT` only when Individual access is allowed and a Joint membership row exists. This agrees with the Individual prerequisite on Joint routes; a named account still requires its own active membership check.

The original report's two projection/guard mismatch examples therefore **no longer reproduce** against current source. The V5 static test and parity model have been updated accordingly; they still fail if these predicate patterns drift.

## Remaining backend/product questions (not proven security bugs)

1. Does any initiated Corporate application, including a rejected/withdrawn application, remain enough evidence for Corporate context? The current projection and guard both use evidence presence; decide if status should constrain this.
2. Legacy `null` primary with a real Individual profile plus Corporate evidence can have both Individual and Corporate contexts (and JOINT if a member). Primary `CORPORATE` is excluded from Individual/Joint even if an old profile exists. Confirm this classification policy is intended.
3. Real-browser and live-API tests for Individual/Joint/Corporate login and membership changes remain necessary. Static source parity and mocked React tests do not prove production behavior.

## Scope

Frontend-side parity model/test/handoff only. No change to backend guards, auth endpoints, cookies, tokens, CSRF handling or Corporate document upload/submission APIs.
