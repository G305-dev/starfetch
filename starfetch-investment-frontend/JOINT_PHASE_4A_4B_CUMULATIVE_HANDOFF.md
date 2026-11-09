# Starfetch — Cumulative Phase 4A + Phase 4B Joint Investor Frontend Handoff

**Status:** Frontend implementation is complete for the approved Phase 4A and Phase 4B scope, including the final CSRF/session, safe-return navigation, Joint registration entry, Windows test-runner, and Joint Investor Portal UX refinements. This document supersedes the need to read the phase reports separately; the original phase records remain available in the workspace.

**Scope boundary:** Frontend only. No backend source, API contract, authentication service, Prisma/schema/migration, proxy configuration, database record, production environment, Git remote, commit, push, PR, merge, deployment, or external financial/KYC/banking integration was changed.

---

## 1. Phase 4A foundation retained

Phase 4A established the secure Joint Investor entry, account-discovery, and invitation lifecycle on the existing Investor authentication model.

- Joint users remain authenticated `INVESTOR` users; no `JOINT` role or parallel authentication system exists.
- `/joint/*` and `/register/joint` remain protected by the shared auth flow. Unauthenticated users are redirected only to local `/login?next=...` destinations.
- Access tokens are memory-only. Existing HttpOnly refresh-cookie behavior, CSRF double-submit handling, refresh rotation, safe logout, auth-generation protections, and session-expiry handling remain intact.
- R1 validates selectable Joint Account IDs; R2 confirms selected account details; M1–M5 continue through the centralized same-origin `/api/v1` client.
- Explicit invitation acceptance/decline, anti-enumerating error handling, invitation expiry/rate-limit behavior, and stale selection/session protections remain preserved.
- The original Joint mock-data modules remain removed. No fabricated financial records, account holders, KYC claims, financial operations, or mock activity were reintroduced.

### Existing Joint APIs remain unchanged

| Operation | Endpoint | Current frontend use |
| --- | --- | --- |
| R1 | `GET /me/joint-accounts` | Account discovery, safe selection, and Joint context refresh. |
| R2 | `GET /joint-accounts/:jointAccountId` | Joint Profile holder/account details. |
| R3 | `GET /joint-accounts/:jointAccountId/portfolio` | Dashboard and Investments portfolio/holdings display. |
| R4 | `GET /joint-accounts/:jointAccountId/transactions` | Dashboard activity and Transactions history/pagination. |
| M1 | `POST /joint-accounts` | Existing protected Joint Account creation. |
| M2 | `POST /joint-accounts/:jointAccountId/invitations` | Profile-based send/re-invite action while awaiting a second holder. |
| M3 | `GET /me/joint-invitations` | Dedicated invitation route, Joint bell, and Individual bell. |
| M4 | `POST /me/joint-invitations/:invitationId/accept` | Explicit notification/route confirmation and account refresh. |
| M5 | `POST /me/joint-invitations/:invitationId/decline` | Explicit notification/route confirmation and invitation refresh. |

---

## 2. Phase 4B portfolio, transaction, profile, and safety work retained

- Dashboard and Investments consume only R3 portfolio values, holdings, currency, as-of dates, nullable quantities, and nullable total return.
- Dashboard and Transactions consume only R4 transaction description/type, amount/currency, status, date, and pagination metadata.
- `totalReturnMinor: null` renders as **Not available**, never zero.
- Financial minor units are formatted only when safe; null, malformed, missing-currency, or precision-unsafe values display as **Not available**.
- Account-specific dashboard, portfolio, transactions, and profile requests keep request-version/account-key guards so prior account data cannot render during account switching.
- R2-backed Profile keeps member name, email, joining date, account creation date, active-holder count, and pending-second-holder status. It does not claim KYC, bank verification, suitability approval, signing mandate, or compliance clearance.

---

## 3. Final CSRF rotation and safe return-navigation corrections retained

### CSRF rotation

`authenticatedRequest()` now rebuilds authenticated headers for every request attempt. `authenticatedMutation()` supplies the CSRF helper as a per-attempt header factory, so a bounded mutation retry after successful refresh reads the newly rotated CSRF cookie and current in-memory access token.

- One retry is allowed only after explicit 401/`UNAUTHENTICATED` plus successful refresh.
- Network errors and non-401 server errors do not replay mutations.
- Concurrent refreshes remain single-flight.
- Logout/user-switch auth-generation protections remain in force.

The persistent Joint contract test proves this behavior for M1, M2, M4, and M5, including a rotated CSRF cookie/header and new bearer token after the initial 401.

### Safe post-login navigation

After successful login, a validated same-origin `next` path is honored; otherwise Individual defaults to `/dashboard` and Joint defaults to `/joint/dashboard`.

The pure validator accepts appropriate internal destinations such as `/joint/invitations` and `/register/joint`, and rejects external URLs, protocol-relative paths, backslash/encoded redirect variants, malformed paths, control characters, and auth-loop destinations.

---

## 4. Final Joint registration entry and Windows test-runner corrections retained

### Joint registration entry

The existing `/open-account` Joint option now gives unauthenticated visitors a branded explanation before sign-in:

- **Sign In** → `/login?next=%2Fregister%2Fjoint`
- **Create an Individual Account** → `/register/individual`

Authenticated investors still go directly to `/register/joint`; the existing Individual registration/email-verification process remains required for unregistered visitors.

### Cross-platform TypeScript runner

`scripts/run-typescript-check.cjs` invokes Node with `node_modules/typescript/bin/tsc` rather than executing `node_modules/.bin/tsc` directly. The runner preserves its compiler arguments and disposable temp-output cleanup, avoiding the Windows `spawnSync ...\.bin\tsc ENOENT` launcher issue without adding dependencies.

---

## 5. Joint Investor Portal UX refinement

### Dashboard — before and after

**Before:** The dashboard fetched R2 and displayed two large account-membership/access panels containing account name, holder emails, joining dates, capacity, authorization language, and M2 invite controls. This duplicated the Profile and took priority over portfolio information.

**After:** The dashboard now starts with **Joint Portfolio Overview** and prioritizes:

1. Existing selected Joint Account controls (header and multi-account dashboard selector)
2. R3 portfolio summary cards
3. R3 holdings overview
4. R4 recent transactions
5. Truthful loading, empty, error, and retry states

The oversized R2 membership/access panels were removed. Dashboard no longer fetches or renders R2 member cards. When R1 indicates that the second holder is pending, it shows a compact contextual message linking to Joint Profile for holder management. It does not display invented charts, balances, returns, transactions, or performance information.

### Profile — before and after

**Before:** Profile already fetched R2 but used account-access-oriented language and did not contain the M2 invitation action.

**After:** Joint Profile is the single detailed membership location. It displays only R2-backed facts:

- Selected Joint Account name and opened date
- First account holder’s name, contact email, and joining date
- Second account holder’s name, contact email, and joining date when present
- Active holder count/capacity
- Second-holder-pending status

For one-holder accounts, the M2 send/re-invite form now lives in Profile under **Invite a second account holder**. The page keeps a clear factual notice that identity verification and other unsupported personal/compliance information are not yet available; it does not equate membership or email verification with KYC.

### Customer-facing language

Joint Dashboard, Profile, Investments, Transactions, Sidebar, and invitation copy were reviewed and revised to remove implementation-facing phrases such as backend confirmation/authorization, server-reported values, API references, membership-based access, and frontend-only explanations. Customer copy now uses concise messages such as “View your investment portfolio and holdings,” “No transactions yet,” and “Identity verification is not yet available.”

---

## 6. Invitation notification experience

### Reusable notification component

New `components/joint/JointInvitationNotifications.tsx` is used in both the Joint and Individual Investor headers.

- It makes authenticated M3 requests on signed-in user/session entry and when the bell is opened or manually refreshed; it does not poll.
- Badge/count appears only after a successful real M3 response with one or more pending invitations. No fabricated unread dot/count is displayed.
- The responsive popover shows only invitation data returned by M3: account display name, inviter first name, sent date, expiry date, and pending status.
- It supplies genuine loading, empty, error/retry, and success states.
- Accept/Decline actions require a confirmation dialog, block duplicate submission, use the existing M4/M5 client calls, and use safe existing error mapping for expiry, conflict, access, rate limit, and network/server errors.
- Successful actions refresh M3. In the Joint header, successful acceptance also refreshes R1/Joint context and selects the joined account when present. In the Individual header, successful acceptance proceeds to `/joint/dashboard`, where the protected Joint context reloads membership data.
- Data is reset on logout/user-session change. It does not retain another user’s invitation state.
- Keyboard behavior: bell and controls are normal buttons; panel close receives focus on open; Escape closes the popover; confirmation focuses Cancel and also supports Escape when not submitting. Mobile uses the same responsive overlay/panel.

### Navigation behavior

- **Invitations** was removed from `JointSidebar.tsx`.
- The Joint header bell no longer links to the route; it opens the notification experience.
- `PortalHeader.tsx` replaces the previous Individual placeholder bell with the real notification component.
- Corporate pages do **not** render this notification component or a fake active notification badge.
- `/joint/invitations` remains protected and functional for the approved email-link route and continues to require explicit M4/M5 confirmation. It is simply no longer a primary sidebar item.

---

## 7. Exact frontend files changed in this refinement

### Created

- `components/joint/JointInvitationNotifications.tsx`
- `components/joint/JointInvitationSender.tsx`
- `lib/auth/joint-notification-session.ts`
- `scripts/joint-ui-isolation-check.ts`

### Modified

- `components/joint/JointDashboardContent.tsx`
- `components/joint/JointProfileContent.tsx`
- `components/joint/JointHeader.tsx`
- `components/joint/JointSidebar.tsx`
- `components/joint/JointInvitationsContent.tsx`
- `components/joint/JointInvestmentsContent.tsx`
- `components/joint/JointTransactionsContent.tsx`
- `components/portal/PortalHeader.tsx`
- `app/joint/dashboard/page.tsx`
- `app/joint/profile/page.tsx`
- `package.json`
- `JOINT_PHASE_4A_4B_CUMULATIVE_HANDOFF.md`

No backend file, client contract, Prisma schema, migration, environment file, Corporate feature behavior, or remote GitHub state was modified.

---

## 8. Validation evidence

The following final commands passed after a clean `npm ci`:

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run test:joint-contract` | Passed |
| `npm run test:auth-navigation` | Passed |
| `npm run build` | Passed; 36 routes generated |

Additional final production-server route smoke validation returned HTTP 200 for Individual dashboard/profile/investments/transactions, Joint dashboard/profile/invitations/investments/transactions/products, protected Joint registration, login return route, and selected Corporate pages.

Persistent mocked/offline coverage continues to test R1–R4 and M1–M5 parsing, M1–M5 authorization/CSRF headers, M4/M5 behavior, nullable return display conditions, pagination parsing, privacy/error mapping, rotated-CSRF mutation retry, refresh single-flight, refresh failure, logout/user-switch isolation, and safe login navigation. The new notification UI reuses those existing typed M3/M4/M5 calls; static source and route checks verify both header integrations, sidebar removal, exact invitation actions, and absence of the prior Individual placeholder bell.

`npm run test:joint-contract` now also runs `scripts/joint-ui-isolation-check.ts`. It verifies that the Dashboard financial snapshot and Profile invitation sender are keyed to the selected Joint Account, stale notification mutation sessions cannot commit after logout/user/revision change, and a successful accept/decline remains a success when the later inbox refresh fails.

---

## 9. Live integration status and remaining limitations

**No new real backend/browser E2E success is claimed from this Arena workspace.** `BACKEND_API_ORIGIN` is not configured here; local `/api/v1/me/joint-invitations` returns HTTP 404. The production preview, typecheck, build, route checks, and persistent fetch-mocked contract tests are not a substitute for a live two-user session.

Still recommended in a safe non-production environment with two independently verified disposable Investor users:

1. M1 account creation and M2 re-invite from the Profile holder-management area.
2. Individual-header M3 badge/panel visibility, empty state, retry state, and M4/M5 confirmations.
3. Joint-header M3 badge/panel visibility and R1/selected-account refresh after acceptance.
4. Expired invitation, verified-email requirement, conflict, rate-limit, CSRF failure, non-member denial, and duplicate-click behavior.
5. Logout/login as a different user and multiple-Joint-Account switching while a notification panel is open.
6. Direct `/joint/invitations` email-link navigation through safe login and explicit consent.

Prior backend/contract coordination items remain: canonical OpenAPI promotion for Joint endpoints, documented M3/M5 verified-email behavior, a configured validated invitation URL, a safe test environment, and review of the previously reported money-int64 serialization limitation.

---

## 10. Dependency audit status

`npm ci` reports the previously reviewed audit aggregate of **3 vulnerabilities: 2 high and 1 critical**. No `npm audit fix`, forced update, dependency upgrade, or lockfile change was made as part of this UI refinement. The existing report section covering `next`, `postcss`, and transitive `sharp` remains applicable and requires maintainer review before unrelated dependency updates.

---

## 11. Final review isolation patch

### Account switching

`FinancialSnapshot` is now keyed with the selected `jointAccountId`. React unmounts the prior snapshot and mounts a fresh loading instance synchronously when the selection changes, while the existing request-version guard continues to reject old R3/R4 completions. This prevents prior holdings, values, and transactions from rendering for a newly selected account, including rapid A → B → A switching.

`JointInvitationSender` in Profile is likewise keyed by its R2 account ID. An email input, pending M2 request state, result message, or error from one selected account cannot carry into the next account’s profile.

### Notification mutation isolation

The notification component now captures `{ userId, revision }` at confirmation/mutation start. It checks that snapshot before any post-M4/M5 state update, account-context refresh, list refresh, panel close, or Individual-to-Joint navigation. The active session revision is advanced synchronously when the auth user changes; the session cleanup then closes the panel/dialog and clears all invitation state.

After a confirmed M4/M5 result, the component immediately removes that invitation locally and attempts a protected M3 refresh. If that later inbox refresh fails, it keeps a success message such as “Your notifications may take a moment to update” rather than incorrectly reporting the already-completed mutation as failed. M4/M5 failures continue to show safe error copy for the current session only.

### Invitation wording

The Profile M2 success copy now says: **“Invitation created for [masked recipient]. It expires on [date].”** It reports the backend-confirmed creation result without claiming independent email delivery.

## 12. Deliverables and final confirmation

- **Clean cumulative frontend source ZIP:** `/home/user/starfetch-investment-frontend-current-update.zip`
  - Contains cumulative Phase 4A + 4B source, all final corrections, and persistent test source.
  - Excludes `node_modules`, `.next`, runtime `.env` files/secrets, generated artifacts, archive files, and handoff/report files.
  - Archive integrity and hygiene verification passed.
- **This report:** `JOINT_PHASE_4A_4B_CUMULATIVE_HANDOFF.md`

The completed frontend remains truthful about financial data and unavailable capabilities. It does not fabricate portfolio values, returns, activity, invitation status, account holders, KYC, banking, or investment operations. All existing Joint account/invitation APIs remain unchanged. No additional development phase was started.
