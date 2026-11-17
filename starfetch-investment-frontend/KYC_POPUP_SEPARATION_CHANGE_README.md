# Individual / Corporate KYC Popup Separation — Change Package (frontend only)

Branch: `corporate-work` (local branch; changes left uncommitted for manual review — nothing pushed, committed, merged or deployed).

## Objective

Both Individual and Corporate investors get a KYC reminder on their own dashboard, and Complete KYC always opens the correct account-specific profile. Neither account type can navigate into the other's KYC flow.

## Behaviour

### Individual (`/dashboard`)
- Popup: `components/portal/IndividualKycPrompt.tsx`
- Complete KYC → `/profile` (Individual KYC form)
- Maybe Later → dismisses for the current visit (in-memory, no storage)
- Visibility from authenticated Individual KYC status (`getIndividualKycProfile()` / `/me/kyc-profile`): shows unless SUBMITTED / UNDER_REVIEW / APPROVED / COMPLETE; fails closed on load error.
- Never links to `/corporate/profile` or any Corporate route.

### Corporate (`/corporate/dashboard`)
- Popup: `components/corporate/CorporateKycPrompt.tsx` (new, Corporate-specific)
- Complete KYC → `/corporate/profile` (Corporate Profile, stays in Corporate Portal)
- Maybe Later → dismisses for the current visit (in-memory, no storage)
- Receives Corporate account context via `useAuth()` (company name + authenticated status); renders only for authenticated users.
- Never calls Individual KYC endpoints (`getIndividualKycProfile` / `/me/kyc-profile`), never links to `/profile` or `/dashboard`.
- Never falsely marks Corporate KYC complete: no approved backend Corporate KYC completion signal exists and the Corporate Profile is local-only (current-session preview), so the reminder shows on every fresh authenticated dashboard entry until dismissed.

## Files

- `components/corporate/CorporateKycPrompt.tsx` (new)
- `app/corporate/dashboard/page.tsx` (renders `<CorporateKycPrompt />` inside `CorporatePortalLayout`)
- `scripts/kyc-dashboard-prompt-check.ts` (new — separation regression tests, `npm run test:kyc-dashboard-prompt`)
- `app/dashboard/page.tsx`, `components/portal/IndividualKycPrompt.tsx`, `lib/individual-kyc-prompt.ts` — unchanged in this batch (verified independent)

## Individual KYC client on this branch

`lib/api/client.ts` already exports `getIndividualKycProfile` and `IndividualKycProfile` (plus all Individual KYC mutations) alongside the Corporate API functions (`getMyCorporateApplications`, etc.). No client merge was needed on this checkout; the regression check asserts both sides remain present. Note: no `corporate-work` branch exists on `origin` (only `main`), so this work was done on a local `corporate-work` branch from `main` for manual review.

## Validation

```bash
npm run typecheck                    # PASS
npm run test:individual-kyc-prompt   # PASS
npm run test:kyc-dashboard-prompt    # PASS (new)
npm run build                        # PASS
```

Plus: `test:corporate-dashboard`, `test:corporate-verification`, `test:corporate-post-login-routing`, `test:dashboard-greeting`, `test:mobile-menu-visibility` — all PASS.

## Remaining Corporate KYC backend limitations

1. No approved backend Corporate KYC/KYB completion signal — the Corporate popup cannot auto-hide for completed users; it shows until dismissed each visit.
2. Corporate Profile (`/corporate/profile`) is local-only (current-session preview, no GET/PUT, no persistence) — completing it does not persist or submit anything server-side.
3. Corporate onboarding/verification (O2/O3/O4/O11) remains the authoritative backend flow; the popup is a routing reminder only and submits no data.
4. When an approved Corporate KYC status endpoint lands, wire `CorporateKycPrompt` visibility to it (hide only on confirmed COMPLETE, fail closed otherwise) — mirroring the Individual pattern.
