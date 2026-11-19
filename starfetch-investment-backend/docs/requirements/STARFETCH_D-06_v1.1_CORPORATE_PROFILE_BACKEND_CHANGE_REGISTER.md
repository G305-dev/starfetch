# STARFETCH D-06 v1.1 — Corporate Applicant/Profile Backend Change Register

**Date:** 18 November 2026  
**Status:** Incremental frontend-to-backend synchronization record for SF-CORP-PROFILE-01-R2. It records the checked-in frontend requirements and backend contract implementation; it is not an approval of submission/KYB policy or a claim of frontend integration.  
**Source baseline:** `G305-dev/starfetch` commit `2c461d6df7d471ce91f83af5a770554d21278333`.

## Change register

| Area | Previous requirement / observed baseline | New synchronized requirement | Why changed | Backend impact |
|---|---|---|---|---|
| Corporate registration | The v1 baseline documented Individual first/last name signup. The pinned frontend actually sends `registrationType:"CORPORATE"`, `companyName`, `companyPhoneNumber`, `email`, `password`. | Accept both company fields only for Corporate signup; atomically persist a user-linked applicant display identity and verification challenge; do not create `InvestorProfile` or `CorporateAccount`. | Adapt the backend to the checked-in fixed Corporate form without changing UI. | YES |
| Account context | `UserRole.INVESTOR` was the only shared portal role. Login sends only email/password; the selected portal is not transmitted. | Add separate immutable `primaryAccountType`, safe optional login/`GET /me` account context, and server-side account-boundary checks. Preserve actual Joint membership as a separate membership resource. Legacy no-O2 registrations stay NULL; only two-person, support-evidence-backed, audited operator recovery may classify them. | A role is not an account kind, and client selector state cannot be inferred server-side. Existing no-O2 records do not persist registration intent; absence of a profile is not proof. | YES |
| Corporate form storage | Current Company Profile UI keeps four steps in page memory; no profile GET/PATCH calls. | Define owner-scoped profile GET plus four PATCH operations with exact existing field names/options, server progress, quoted optimistic versions, and encrypted bank account number. | Provide a backend integration contract for the existing form without editing it. | YES |
| Company Details/O2 | Existing O2/O3/O4/O11 own the canonical six business fields; the current Company Details Save combines canonical RC/date/TIN with registered address/city/state. | Keep O2 details as the only legal-field master; provide one atomic combined Company Details save that reuses O4 canonicalization/encryption/revision rules and separately stores address fields. | Preserve the existing UI's single save action and the canonical O2/O4 contract. | YES |
| Completion meaning | No four-section persistence API existed in the backend. | `NOT_STARTED | DRAFT | COMPLETE` denotes saved-form validation only; 25% per committed section; no submit/review/verification/approval/eligibility meaning. | Prevent a progress indicator from implying a compliance outcome. | YES |
| Security/data protection | Corporate O2 is disabled by default and account access is initiator-scoped. | Keep O2 gates; require a real existing CorporateAccount/application for profile routes; generic 404 for non-owned UUIDs; dedicated KMS purpose/key/context for 10-digit bank account data; expose masks only. | Avoid fabricated Corporate identities and plaintext sensitive identifiers. | YES |

## Frontend-first mapping carried forward

- Corporate registration request remains exactly the currently checked-in request; `confirmPassword` is not sent to the backend.
- Login remains `{email,password}`. No `requestedPortal`, Referer, Origin, URL, or `UserRole.INVESTOR` inference is used to fake the missing selected portal.
- The four UI sections and options are pinned in `docs/operations/CORPORATE-PROFILE-API-HANDOFF.md` and the additive OpenAPI contract.
- The O2 legal fields remain canonical and independent from `companyName`/`companyPhoneNumber` applicant display fields.

## Explicit integration and release limitations

1. `CorporateProfileContent.tsx` sends **no** GET/PATCH requests in the pinned frontend. This backend patch cannot make its page persist until a frontend call path is separately delivered; no frontend file is modified here.
2. `SignInForm.tsx` sends **no selected account type**. Backend protections now guard resources from persisted identity/ownership/membership, but cannot reject a valid email/password login because a user clicked a different portal button.
3. The backend snapshot includes no owner-scoped CorporateAccount ID before a real O2/approved Corporate account-creation flow commits. The four-section routes intentionally do not create one. O2 remains disabled by default and must not be enabled just to make the profile form appear saved.
4. The exact canonical D-06 Revision 8 and OpenAPI v0.6.1 files referenced by operational docs were absent from this pinned source tree. The only D-06 document found is v1 and the only OpenAPI file reports 0.4.0. The v1.1 change register and OpenAPI addendum update those found sources, but **do not assert they supersede the latest canonical publication**. Maintainers must reconcile release lineage before merge/publication.

## Change control

This is a narrow v1.1 incremental record. Any UI payload/label/option change requires an additional D-06 entry and a coordinated OpenAPI/backend review. Submission, KYB review, consent/legal text, evidence, or approval workflows remain outside this change and require business/compliance approval.
