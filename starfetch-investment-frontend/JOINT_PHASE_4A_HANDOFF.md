# Starfetch — Phase 4A Joint Investor Frontend–Backend Integration

**Status:** Complete for the requested Phase 4A frontend scope. Financial dashboard integration has not been started.

## 1. Files created, modified, and removed

### Created

- `app/joint/layout.tsx` — applies authenticated Joint portal access protection and the in-memory Joint-account provider to every `/joint/*` route.
- `app/joint/invitations/page.tsx` — protected invitation inbox route.
- `components/joint/JointAccountProvider.tsx` — R1/M3 discovery, authenticated account-only selection, stale-response protection, refresh coordination, and in-memory state reset on session changes.
- `components/joint/JointPortalAccess.tsx` — composes existing shared auth protection with the Joint provider; no JOINT role/system was added.
- `components/joint/JointInvitationsContent.tsx` — M3 invitation inbox and explicit M4/M5 consent UI.
- `components/joint/joint-api-messages.ts` — safe, non-enumerating UI error copy and date formatting.

### Modified

- `lib/api/client.ts` — typed R1–R4 and M1–M5 functions, envelope normalizers, `NOT_FOUND`/`GONE` error mapping, and reuse of the existing authenticated/CSRF/single-flight-refresh client path.
- `components/auth/SignInForm.tsx` — Joint selection now uses the existing `/auth/login` flow and enters `/joint/dashboard`; Business remains explicitly unavailable.
- `components/auth/JointApplicantDetailsForm.tsx` — replaced the frontend-only two-person form with the authenticated M1 creation/invitation flow.
- `components/auth/AccountTypeSelection.tsx` — Joint account-opening copy now explains the verified-investor invitation model.
- `app/register/joint/page.tsx` — protected with the existing auth guard.
- `components/joint/JointDashboardContent.tsx` — R1 account-entry/selector, R2 detail/membership view, awaiting-second-holder state, and M2 invite/re-invite UI; no financial mock values.
- `components/joint/JointHeader.tsx` and `JointSidebar.tsx` — real account selector, invitation inbox navigation/count, logout, and Next `Link` navigation.
- `components/joint/JointInvestmentsContent.tsx`, `JointTransactionsContent.tsx`, and `JointProfileContent.tsx` — replaced mock content with honest Phase 4A unavailable/membership-only states.
- `app/joint/{dashboard,investments,transactions,profile}/page.tsx` — updated metadata to remove frontend-only mock claims.
- `components/portal/ProductsContent.tsx` and `app/joint/products/fixed-note/page.tsx` — Joint product surfaces are informational only and no longer expose the legacy rate/booking form. Corporate remains on its existing legacy branch.

### Removed

- `components/joint/joint-dashboard-data.ts`
- `components/joint/joint-investments-data.ts`
- `components/joint/joint-transactions-data.ts`
- `components/joint/joint-profile-data.ts`

## 2. Exact endpoints connected

All calls are made only through the centralized same-origin `/api/v1` client with the current in-memory bearer token and `credentials: "include"`.

| Endpoint | Phase 4A frontend use |
| --- | --- |
| `GET /me/joint-accounts` (R1) | Loads the active-account list, validates all account selection, drives empty/one/multiple-account states, and is refreshed after invitation actions. |
| `GET /joint-accounts/:jointAccountId` (R2) | Loads the selected authorized account’s display name, active members, and `awaitingSecondHolder` membership state. |
| `POST /joint-accounts` (M1) | Protected Joint registration form creates an account and one pending invitation. Only `inviteeEmail` and optional `displayName` are sent. |
| `POST /joint-accounts/:jointAccountId/invitations` (M2) | Dashboard’s one-member account state lets the active holder explicitly create/re-invite by email. |
| `GET /me/joint-invitations` (M3) | Loads the protected invitation inbox and actual invitation summary fields. |
| `POST /me/joint-invitations/:invitationId/accept` (M4) | Runs only after an explicit confirmation. On success, refreshes R1, validates the returned account against R1, selects it, then enters the Joint dashboard. |
| `POST /me/joint-invitations/:invitationId/decline` (M5) | Runs only after an explicit confirmation, then refreshes the inbox/account list. |
| `GET /joint-accounts/:jointAccountId/portfolio` (R3) | Typed reusable client function prepared only; no financial UI consumes it in Phase 4A. |
| `GET /joint-accounts/:jointAccountId/transactions` (R4) | Typed reusable client function prepared only; no financial UI consumes it in Phase 4A. |

M1, M2, M4, and M5 use the established authenticated mutation path, including the readable CSRF cookie’s `X-CSRF-Token` header. No separate refresh or cookie implementation was added.

## 3. Authentication and registration flow

- Joint users continue to be authenticated `INVESTOR` users; no JOINT role, localStorage token, or independent session system exists.
- Selecting **Joint** on `/login` submits the existing email/password payload to `/auth/login`, then enters `/joint/dashboard`.
- The protected Joint entry provider resolves R1 and M3 from the backend after login/session restoration.
- `/joint/*` and `/register/joint` use existing auth protection. Unauthenticated visitors are redirected to the local `/login?next=...` path only.
- The Joint registration form shows Applicant 1 from the authenticated user, requires verified email confirmation, accepts optional display name plus Applicant 2 email only, validates format and self-invitation, disables duplicate submission, and handles safe retryable errors.
- The success state displays the actual M1 display name, masked recipient, status, and expiry. It explicitly does **not** claim email delivery, create the invitee’s account, or grant them access.

## 4. Invitation inbox and consent

- `/joint/invitations` renders M3 invitation values: account display name, inviter first name, sent time, and expiry.
- Accept and decline require a separate confirmation dialog. An invitation link is never treated as authorization.
- Acceptance uses M4, refreshes R1/M3, confirms that the returned account exists in R1 before selecting it, and then navigates to the Joint account view.
- Decline uses M5, refreshes the inbox, and removes the completed invitation when the server no longer returns it.
- Safe UI handling exists for validation, unauthenticated, unverified-email, forbidden/CSRF, inaccessible/unknown, conflict, expired, rate-limited (`retryAfterSeconds` when present), and network/server errors. No raw server messages are displayed.

## 5. Selection, route protection, and stale-data safety

- Account IDs are selected only if they appear in the current user’s R1 response. The selector never trusts route/query/mock IDs.
- R2 remains the server-side membership confirmation for the selected account. Its 404/error state shows no account content and uses non-enumerating copy.
- The provider stores accounts, invitations, and selected ID in React memory only. It clears them when auth state changes and request-version guards prevent older account/invitation requests from committing after a newer refresh/logout/session change.
- The dashboard covers no account, pending invitations, one account awaiting a second holder, one full account, and multiple account selection.
- Joint investment and transaction pages intentionally show Phase 4A unavailable states. They do not display mock balances, holdings, returns, transactions, approval statuses, exports, charts, KYC status, or signing-mandate claims.

## 6. Validation results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `NEXT_TELEMETRY_DISABLED=1 npm run build` | Passed; 36 static routes generated, including `/joint/invitations` |
| Lint | No lint script is defined in `package.json` |
| Temporary API-client contract test | Passed: R1/R2/R3/R4 and M1–M5 `{data, meta}` parsing, authorization header, CSRF header, M1 approved body only, and `410 GONE` mapping |
| Static Joint audit | Passed: no remaining Joint mock-data modules, no raw internal Joint anchors, no persistent token/account-selection storage, and no financial/KYC mock output in Phase 4A surfaces |
| Production server smoke test | HTTP 200 for `/login`, `/register/joint`, `/joint/dashboard`, `/joint/invitations`, `/joint/investments`, `/joint/transactions`, `/joint/profile`, `/joint/products`, and `/joint/products/fixed-note` |

## 7. Manual verification: completed vs. pending

### Completed locally/offline

- Build/type validation and route smoke tests listed above.
- Mocked client contract checks against the documented/executable response envelopes, including mutation CSRF/header behavior.
- Source audit of protected routes, selection rules, stale-request versioning, mock removal, and Phase 4A financial deferral.

### Still pending against a real running backend

The Arena preview intentionally has no `BACKEND_API_ORIGIN`; `/api/v1/me/joint-accounts` returns local HTTP 404. Therefore no live authentication or mutation has been claimed.

David/Emmanuel should verify with two verified test investors:

1. Existing verified investor selects Joint at login and sees R1/M3-derived entry states.
2. Initiator opens a Joint Account through M1; verify response, pending state, and one active member.
3. Invitee independently logs in, sees M3 inbox, accepts M4, and is routed to the newly joined account.
4. Both investors can R1/R2-read the same account; a non-member/unknown account receives the same safe inaccessible state.
5. Decline, expired invitation (`410`), conflict (`409`), rate limit (`429` + retry seconds), self-invite validation, and M2 re-invite/conflict behavior.
6. Zero, one, multiple, one-member-awaiting, and two-member account selections.
7. Page refresh, direct `/joint/*` navigation, logout, expired session/refresh, and user/session switching do not retain another user’s selection/data.
8. Individual registration/login/dashboard/investments/transactions regression, and Corporate regression.

## 8. Backend/contract items for David

The main-branch backend implementation was reviewed as the executable reference (Joint controller, invitation controller, DTO, read service, and mutation service). Endpoint paths, request bodies, and success projections used here match that implementation.

Items to report/resolve before formal production handoff:

1. **Canonical OpenAPI gap:** `docs/api/openapi.yaml` still has no Joint operations. The reviewed `PROPOSED-JOINT-API-DRAFT.yaml` remains explicitly unpromoted; Phase 4A client code is based on the merged implementation plus the draft/Step 4 notes.
2. **M5 draft mismatch:** the merged backend requires verified email for **decline** and returns `403 EMAIL_NOT_VERIFIED`, but the draft YAML’s M5 response list omits that 403. The frontend handles it; the draft must be corrected on promotion.
3. **M3 verification behavior:** the merged backend also requires verified email for invitation listing and can return `403 EMAIL_NOT_VERIFIED`. The draft presents only a generic 403 response. This should be stated explicitly in the promoted contract.
4. **Deployment configuration:** staging/production must configure the validated HTTPS `JOINT_INVITATIONS_URL` to the approved frontend login/invitation-entry route. The backend intentionally disallows query/fragment credentials; the email link cannot confer authorization.
5. **Integration environment needed:** supply a safe backend origin and two non-production verified test investors (or a controlled backend fixture) for real browser validation. No proxy, backend, contract, database, or production setting was changed here.

## 9. Phase 4B remaining work

- Integrate R3 portfolio and R4 transaction pages after review, using the prepared typed functions.
- Render only supported minor-unit, currency, holdings, transaction, and server-pagination fields.
- Preserve `totalReturnMinor: null` as **Not available**; do not calculate performance/returns.
- Do not restore unsupported charts, summaries, filters, exports, approval columns, statements, KYC, banking, mandates, products execution, or mock data without approved backend contracts.

## Scope boundary

No backend source, database/migration, API contract, remote GitHub state, commit, branch, push, PR, production infrastructure, or external API integration was changed. Phase 4A stops before financial dashboard integration.
