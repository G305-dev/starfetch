# Corporate Profile — release blockers and explicit limitations

This report is scoped to the backend-only patch at `2c461d6df7d471ce91f83af5a770554d21278333`. It does not imply deployment readiness.

## P0 / integration blockers

1. **The current Corporate Profile page is not wired to the APIs.** The checked-in `CorporateProfileContent.tsx` sends no GET/PATCH requests and holds state locally. The page remains local-only after refresh until a separately approved frontend integration is delivered; no frontend file was changed or included.
2. **The login selector is not sent to the backend.** The checked-in `SignInForm.tsx` posts only email/password. Backend account boundaries now use persisted classification, current ownership and live Joint membership, but the server cannot reject a valid login solely because the user clicked the wrong portal. Do not claim this limitation is solved.
3. **Profile routes still require a real CorporateAccount/application ID.** Registration/recovery does not fabricate one. A legacy no-O2 applicant with verified manual recovery can resume Corporate draft/bootstrap onboarding and obtain a real owner-bound application; the four-section profile GET/PATCH routes then require that owned account/details row. O2 remains disabled by default and gated.
4. **Bank KMS is unprovisioned until the operator configures it.** Set `CORPORATE_PROFILE_BANK_KMS_KEY_ID` and `CORPORATE_PROFILE_BANK_KMS_KEY_VERSION` to a separately approved key, with correct region, OIDC/workload IAM policy and encrypt/decrypt rights. Without it, bank-detail writes fail closed with `503`; there is no plaintext fallback. Verify distinct effective key material from the O2 TIN key (aliases can resolve to the same key).
5. **TIN updates keep existing O2 gates.** A non-empty TIN on the combined Company Details route requires current O2 availability and KMS configuration. Existing disabled-by-default O2, legal/privacy/retention approvals, keyring and distributed rate-limit gates are intentionally not relaxed. An empty TIN keeps a current ciphertext and does not clear it.
6. **No PostgreSQL migration execution in this workspace.** No psql/pg_isready/Docker/Podman or configured database URL was available. Prisma schema validation is not SQL execution. The updated `test/corporate-profile-recovery.e2e-spec.ts` and exact loopback `starfetch_test` commands are documented in `CORPORATE-PROFILE-MIGRATION-AND-DEPLOYMENT.md`; run them before merge. Migration backfill branches still need synthetic pre-upgrade fixture validation.

## Additional security/compliance/release gates

- Review data residency, collection purpose, retention/deletion, access policy and lawful basis for Corporate applicant identity, investment declarations, source/inflow data and bank details.
- Validate the dedicated bank key's encryption context and effective key separation; review least-privilege AWS IAM/KMS key policy. Never use static AWS access keys for Vercel.
- Review legacy `primaryAccountType IS NULL` records under the two-person operator recovery runbook. Corporate users with no O2 app remain unclassified automatically; absent `InvestorProfile` alone is not proof. Recovery is tracked by a one-time DB audit record and cannot be requested through an account self-service type-change endpoint. Any Individual profile or Joint membership blocks this Corporate recovery path.
- Reconcile API/D-06 release lineage. The pinned root OpenAPI says v0.4.0 and root D-06 file is v1, while backend operations docs cite OpenAPI v0.6.1 and D-06 Revision 8. The latter canonical files were absent from the archive. Updated files preserve provenance and explicitly make no latest-release claim; maintainers must resolve before publication.
- Review the pinned lockfile's 68 npm audit advisories (3 low, 15 moderate, 50 high) and plan Node runtime upgrade before production. No unrelated dependency changes were made here.
- The existing O2/verification/ruleset/consent/compliance requirements for submission and investment eligibility remain untouched. The profile's `100%` is saved-form completion only; no submit, review, verification, approval, bank validation or investment capability is introduced.

## Not done

No production/shared DB read/write, migration apply, deployment, push, merge, frontend edit, live KMS call, verification call, bank/Mono integration, fake holdings or approval was performed.
