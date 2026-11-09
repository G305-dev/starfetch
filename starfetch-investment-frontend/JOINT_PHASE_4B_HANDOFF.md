# Starfetch — Phase 4B Joint Investor Frontend–Backend Integration & Testing

**Status:** Phase 4B frontend work is complete. This handoff intentionally stops before any backend, deployment, or unapproved workflow work.

## 1. Exact frontend files created, modified, and removed

### Created

- `JOINT_PHASE_4B_HANDOFF.md` — this completion report.
- `scripts/joint-phase4-contract-check.ts` — persistent no-dependency mocked API/client test covering R1–R4, M1–M5, safe financial formatting, CSRF, refresh single-flight, and stale-session handling.
- `scripts/run-typescript-check.cjs` — small runner that type-compiles a TypeScript check into a disposable OS temp directory and executes it without adding a test framework dependency.

### Modified for Phase 4B

- `components/joint/JointDashboardContent.tsx`
  - Connects R2, R3, and R4 for the currently selected authorized account.
  - Shows actual membership data, portfolio total/count/return availability, holdings, and recent recorded transactions.
  - Keeps the Phase 4A M2 invite/re-invite flow.
- `components/joint/JointInvestmentsContent.tsx`
  - Connects R3 and renders actual holdings with loading, empty, error, retry, and account-switch states.
- `components/joint/JointTransactionsContent.tsx`
  - Connects R4 at `page=1&pageSize=10`, renders actual records, and uses server `page`, `pageSize`, and `total` for Previous/Next navigation.
- `components/joint/JointProfileContent.tsx`
  - Connects R2 and renders only real Joint account/member fields and membership facts.
- `components/portal/dashboard-formatters.ts`
  - Formats safe integer minor units without floating-point major-unit conversion. Invalid/null/precision-unsafe values render as `Not available` rather than being rounded into a financial display.
- `components/portal/InvestmentSummaryCards.tsx`
  - Renders `totalReturnMinor: null` as **Not available**.
- `components/portal/InvestmentStates.tsx` and `InvestmentHoldings.tsx`
  - Allow a caller-supplied informational products destination so the Joint empty state stays inside the Joint portal.
- `components/portal/TransactionStates.tsx` and `TransactionHistory.tsx`
  - Allow the same correct Joint informational-products destination for actual empty transaction pages.
- `package.json`
  - Adds the persistent `npm run test:joint-contract` command; no test framework or production dependency was added.

### Removed in Phase 4B

- None. The Phase 4A mock Joint data modules remain removed.

## 2. Phase 4A preservation

The following Phase 4A implementation remains present and was preserved:

- `JOINT_PHASE_4A_HANDOFF.md`
- `components/joint/JointAccountProvider.tsx`
- `components/joint/JointPortalAccess.tsx`
- `components/joint/JointInvitationsContent.tsx`
- `app/joint/invitations/page.tsx`
- Shared `AuthProvider`, in-memory access-token flow, secure refresh-cookie/CSRF handling, protected routes, M1–M5 integration, Joint login, registration, invitation acceptance/decline, account selection, and logout behavior.

No new JOINT user role, alternate auth system, frontend token persistence, endpoint, or backend business rule was introduced.

## 3. R3 portfolio integration

`getJointPortfolio(jointAccountId)` is now used by:

- **Joint dashboard:** actual total stored portfolio value, holdings count, `totalReturnMinor`, actual holdings, and an honest empty state.
- **Joint investments page:** actual holdings with supported instrument label, nullable quantity, stored minor-unit value, currency, and as-of date.

Rules implemented:

- Minor units are formatted as currency without float-based whole-value conversion.
- `null`, malformed, or precision-unsafe monetary values render as **Not available**.
- `totalReturnMinor: null` renders exactly as **Not available**.
- Empty server responses show `0.00` in the backend currency when total value is zero and show **No investments yet**; they do not fall back to mock data.
- No booking, funding, withdrawal, statement, product-status, return, performance, valuation, or filter workflow is exposed.

## 4. R4 transaction integration

`getJointTransactions(jointAccountId, page, pageSize)` is now used by:

- **Joint dashboard:** recent actual records from R4 page 1, page size 5.
- **Joint transactions page:** actual R4 records at page size 10 with server-controlled Previous/Next pagination.

Only approved fields are displayed:

- Description and/or type
- Amount and record currency
- Status
- Occurrence date
- Transaction ID where supplied by the approved response

The page has loading, empty, error/retry, pagination-boundary, inaccessible-account, and account-switch states. It does not expose mock references, processing dates, approval states, product/category filters, signing approvals, exports, or statement claims.

## 5. Joint dashboard implementation

The dashboard now displays only backend-supported data for the selected R1-authorized account:

- Account display name
- Active account holders, names, emails, and joined dates from R2
- Active membership count/capacity and awaiting-second-holder state from R2
- Stored portfolio total, holding count, nullable total return, and holdings from R3
- Recent transaction descriptions/types, amounts, currencies, statuses, and dates from R4

There are no performance charts, percentages, invented balances, return calculations, projections, KYC badges, signing mandates, or fake activity.

## 6. Joint profile implementation

The Joint Profile now fetches R2 for the selected account and renders only:

- Joint account display name and creation date
- Each active member’s first name, last name, email address, and membership date
- Active-count/capacity and awaiting-second-holder status

The page clearly labels unsupported identity verification, employment/source-of-funds, bank, PEP, risk, document, next-of-kin, and signing-mandate functionality as unavailable. It does not equate email/membership with KYC.

## 7. Account switching and stale-data controls

- The existing `JointAccountProvider` continues to accept a selected ID only when it is present in the current authenticated R1 list.
- Dashboard R2/R3/R4, investments R3, transactions R4, and profile R2 each use request-version guards.
- Every account-specific view is tagged with the account ID/key that produced its result. On a selection change, prior data fails the current-account/key check immediately and a loading state is shown; the prior account’s portfolio, transaction page, or holder details are not rendered while the next account loads.
- Transactions derive page 1 whenever the selected account changes, avoiding a stale page request for a newly selected account.
- The provider clears its account, invitation, and selected-ID state on logout/session change. Existing AuthProvider expiry logic still clears access authority before protected UI can be committed.
- R2/R3/R4 errors render safe no-data states. The backend remains the authorization authority for every account-scoped request.

## 8. Phase 4A live integration test results

**Not performed against a live backend.** `BACKEND_API_ORIGIN` is not configured in this Arena workspace, and the local preview returns HTTP 404 for `/api/v1/me/joint-accounts`.

Accordingly, no claim is made that M1–M5, R1–R4, login, creation, acceptance, decline, re-invitation, or two-holder access succeeded against a running backend. Phase 4A behavior remains source-reviewed and API-mocked only in this workspace.

## 9. Joint Investor E2E results

### Persistent automated/offline checks completed

1. **`npm run test:joint-contract` — passed**
   - Persistent frontend test source: `scripts/joint-phase4-contract-check.ts`.
   - Uses mocked fetch only; it does not claim a live backend result.
   - R1 account-list parsing; R2 member/detail parsing; R3 portfolio/holding parsing; R4 root `data` plus pagination `meta` parsing; and M1–M5 response parsing.
   - Mutation authorization and CSRF headers, M1 approved request body only, and `404 NOT_FOUND` non-enumerating error mapping.
   - `totalReturnMinor: null`, safe/unsafe minor-unit formatting, concurrent R3 refresh single-flight, R3/R4 bounded refresh/retry, and stale-session protection.
   - The runner compiles the test into a disposable system temp directory and removes the output afterward.

2. **Static Joint audit — passed**
   - No direct Joint API calls outside `lib/api/client.ts`.
   - No remaining mock Joint financial figures/data modules.
   - No raw internal Joint anchor navigation.
   - No Joint/API/auth client-side storage of access tokens or account selection.
   - No unsupported Joint transaction exports, filters, approvals, KYC forms, or banking forms.

3. **Production route smoke test — passed**
   - HTTP 200 for all Individual, Joint, and selected Corporate routes listed below.

### Live E2E scenarios still required

Use two disposable, independently verified non-production INVESTOR accounts with a safe backend origin:

1. Joint-option login for both users.
2. M1 account creation and first active-member state.
3. M3 invitation appearance for invitee.
4. Explicit M4 acceptance and both users reading the same R1/R2/R3/R4 data.
5. M5 decline and inbox update.
6. M2 same-email re-invite, different-email conflict, and capacity conflict behavior.
7. Non-member/unknown account R2/R3/R4 404 parity.
8. Expired invitation 410, email-not-verified 403, CSRF failure, 429 with retry seconds, and duplicate-submit prevention.
9. Multiple-account switching on all Joint pages.
10. Refresh, direct navigation, logout, user change, access-token expiry, and unauthenticated redirect behavior.

## 10. Individual and Corporate regression results

### Build/type regression

- TypeScript typecheck passed.
- Production Next build passed and generated 36 routes.

### Server smoke regression

The local production server returned HTTP 200 for:

- **Individual:** `/login`, `/register/individual`, `/dashboard`, `/investments`, `/transactions`, `/profile`, `/products`, `/products/fixed-note`
- **Joint:** `/register/joint`, `/joint/dashboard`, `/joint/invitations`, `/joint/investments`, `/joint/transactions`, `/joint/profile`, `/joint/products`, `/joint/products/fixed-note`
- **Corporate:** `/corporate/dashboard`, `/corporate/products`, `/corporate/products/fixed-note`

This is route/build validation only; authenticated Individual and Corporate API behavior remains unverified locally because no backend proxy origin or safe credentials are available.

## 11. TypeScript, build, and test output summary

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `NEXT_TELEMETRY_DISABLED=1 npm run build` | Passed; all 36 routes generated |
| Lint | No lint script is defined in `package.json` |
| `npm run test:joint-contract` (persistent Joint API, financial-safety, CSRF, and session check) | Passed |
| Static Joint mock/security/navigation audit | Passed |
| Local production route smoke test | Passed |

## 12. Backend issues / David coordination

1. **No live environment in this workspace:** a safe `BACKEND_API_ORIGIN` and non-production verified test users are required for true browser/E2E integration.
2. **Canonical OpenAPI still incomplete:** Joint endpoints remain in the draft fragment rather than `docs/api/openapi.yaml`.
3. **Documented draft mismatches remain:** M3 and M5 verification behavior (`403 EMAIL_NOT_VERIFIED`) needs explicit promotion into the canonical contract.
4. **Potential int64 precision limitation:** the reviewed merged backend’s `JointReadService` converts a stored portfolio `BigInt` total with `Number(total)`, while the API contract calls money fields `int64`. JavaScript JSON numbers cannot safely preserve values beyond `Number.MAX_SAFE_INTEGER`. The frontend refuses non-safe numeric values and displays **Not available**, but it cannot detect a value already rounded server-side. David should define/enforce a safe money bound or serialize int64 minor units as decimal strings before production use.
5. **Minor-unit scale assumption:** current Joint contract data is NGN and follows the documented 2-decimal minor-unit convention. If the backend later returns currencies with another minor-unit scale, the contract must declare that scale before frontend formatting is expanded.

No backend source, schema, migration, contract, environment variable, infrastructure, or production record was changed.

## 13. Exact real-backend versus mocked/offline testing

| Test category | Real backend | Mocked/offline |
| --- | --- | --- |
| R1–R4 response parsing | Not run | Passed by persistent `npm run test:joint-contract` |
| M1–M5 request/response and CSRF header behavior | Not run | Passed by persistent `npm run test:joint-contract` |
| Shared refresh single-flight and stale-session safety | Not run | Passed by persistent `npm run test:joint-contract` with mocked fetch |
| Protected route HTTP rendering | No authenticated backend | Passed as local Next route smoke test |
| Two-user creation/invitation/acceptance/decline | Not run | Manual scenario documented only |
| Account-scoped membership authorization | Not run | Client route/state safeguards and safe-error paths audited |
| Individual/Corporate authenticated regression | Not run | Build/type/route smoke only |

## 14. Financial-information confirmation

All Joint financial data rendered by Phase 4B is from R3/R4 through the centralized authenticated client:

- Dashboard portfolio summary/holdings: R3
- Investments page: R3
- Dashboard recent activity: R4
- Transactions page/pagination: R4

When the backend reports no records, the UI renders an honest empty state. When a supported value is null/unavailable/unsafe, the UI renders **Not available**. No fabricated balances, returns, trends, percentages, valuations, product status, transaction reference, approval, or financial operation is present.

## Scope boundary

No commit, push, branch, pull request, merge, deployment, backend change, database migration, production operation, external API integration, banking/payment/KYC/IMS capability, or investment execution was performed. Phase 4B is complete pending David and Emmanuel review and a safe live integration environment.
