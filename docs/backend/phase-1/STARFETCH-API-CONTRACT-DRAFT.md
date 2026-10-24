# STARFETCH INVESTMENT LIMITED — API CONTRACT DRAFT (v1 boundaries)

> **Status: DRAFT — REQUIRES TEAM APPROVAL.** Every contract below is proposed, not approved. Nothing here is implemented. Endpoint shapes marked `EXAMPLE / SYNTHETIC` contain demonstration data only.
> **Scope discipline:** focused on endpoints needed for the Days 1–10 website/web-portal MVP (and designed to be reused unchanged by Android/iOS on Days 11–15). Future boundaries are listed, not designed.
> **Review outcome:** ACCEPTED WITH CORRECTIONS (corrections applied in this revision). **Phase 2 implementation is NOT authorized.**
> **Canonical location (APPROVED):** `docs/api/openapi.yaml` in the repository. These draft contracts seed its first version; each contract still requires team approval before implementation.
> **D-06:** **v1 — BASELINE ESTABLISHED / LIVING FRONTEND-BACKEND REQUIREMENTS HANDOFF** (change-controlled; future updates arrive as v1.1+ — see §0).

---

## 0. D-06 v1 alignment (baseline established — living handoff)

Emmanuel's D-06 v1 frontend requirements are the current baseline for request/response shapes. D-06 is **not permanently closed**: later frontend changes arrive as D-06 v1.1, v1.2, … and pass through the D-06 change-control rule (decisions register) before any contract change. Approved contracts never drift silently.

**Applied from D-06 v1:**
- **Registration:** `firstName`, `lastName`, `email`, `password` only. `confirmPassword` is **frontend-only** — never transmitted, persisted or returned by the API.
- **Profile:** `firstName`, `lastName`, `email` (from `users`), optional `phone` where collected/approved. Profile-completion information is optional if later retained; its calculation is **unapproved**. Email-edit behaviour is a **frontend/backend coordination decision** and is not silently implemented.
- **Google / Apple sign-in:** retained in the UI as **non-functional frontend placeholders** — `FUTURE AUTHENTICATION INTEGRATION — NOT MVP`. No OAuth endpoints, providers, configuration, entities, callbacks or social-auth logic. MVP email/password contract unchanged.
- **Onboarding solution selection:** applications may carry `investmentSolutionSlug` ∈ { `fixed-note`, `discretionary-portfolios`, `execution-mandate` }, referencing `investment_solutions`. It is **not** an investable-product purchase, trade, investment instruction, mandate or IMS operation; no amount/rate/yield/fee/tenor/minimum/liquidity/return/settlement/execution fields exist. `investment_solutions` is **not** merged with `products`.
- **Statements:** `displayName` added; `periodLabel` retained; document/file reference where applicable. All MVP statements remain **SAMPLE / SYNTHETIC**; no statement-generation or accounting logic.
- **Staff investor list:** `submittedAt` (derived/read from `applications.submitted_at` — no duplicate storage) alongside investor name, email, application status and view action. If **D-09** permits multiple active applications per investor, WHICH application supplies `applicationStatus`/`submittedAt` requires the approved application-selection rule (part of D-09 — OPEN; no rule invented).
- **Documents:** upload/download/review boundaries retained; category vocabulary, review labels/outcomes, file policy, replacement/retention/access rules are **TBD through approved document requirements / future D-06 change + BUSINESS / COMPLIANCE + CONTRACT APPROVAL** — concrete values (e.g., `IDENTIFICATION`/`PROOF_OF_ADDRESS`; `PENDING_REVIEW`/`ACCEPTED`/`REJECTED`) must not become implementation truth.
- **Registration session behaviour:** successful registration returns the created account result; session issuance / auto-login is a **frontend/backend coordination decision — NOT YET APPROVED** (D-06 v1 flow: success → confirmation → `/login`). The login contract is unchanged.
- **Solution selection semantics:** `investmentSolutionSlug` **may remain unset** on an initial empty `DRAFT` shell; a valid selection is **required before successful submission** (D-06 v1 baseline). This alone does **not** make documents, consent text, KYC fields or other still-unapproved items mandatory; submit-gating implementation stays behind **D-08** and the completeness decisions.
- **Sample data (dashboard):** persistent synthetic/demo indicators retained on portfolio, holdings, transactions and statements; dashboard composites application status + optional (unapproved) profile completion + solution discovery + sample portfolio/holdings + recent sample transactions + statements. No live financial logic.
- **Status vocabulary:** unchanged; the complete transition map remains **D-08 — OPEN**; "one active application" remains **D-09 — OPEN**.

**Not approved by D-06 v1 — must not appear in contracts or models:** KYC/BVN/NIN/AML/PEP; date of birth; address; nationality/residency; tax; beneficial ownership; identity documents as mandatory requirements; consent/legal text; risk/suitability scoring; mandates; investment amounts; product rates/yields; fees; tenors; minimums; redemption/withdrawal rules; eligibility criteria; product disclosures; document requirements/policies; internal staff governance rules.

---

## 1. Conventions (PROPOSED)

- Base path: `/api/v1`.
- JSON only; ISO-8601 UTC timestamps; money as `{ amountMinor, currency }` (minor units); UUID ids.
- Success envelope (PROPOSED): `{ "data": …, "meta": { … } }`; `meta` may carry `source` (e.g. `"staging_seed"`), `asOf`, or pagination.
- Pagination (PROPOSED): query `?page=1&pageSize=20` (defaults page=1, pageSize=20, max 100); response `meta: { "page": 1, "pageSize": 20, "total": 0 }`.
- Demo data is always labelled: records carry `isDemo: true` and/or `meta.source` indicates seed origin.

## 2. Error contract (PROPOSED)

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "One or more fields require attention.",
    "fields": { "email": "Enter a valid email address." },
    "requestId": "EXAMPLE"
  }
}
```

| Code (PROPOSED) | HTTP | Meaning |
|---|---|---|
| `VALIDATION_FAILED` | 422 | Body/params failed schema validation; `fields` populated. |
| `UNAUTHENTICATED` | 401 | Credentials required/invalid/expired. Same message for unknown vs. bad password. |
| `FORBIDDEN` | 403 | Authenticated but role/ownership check failed. |
| `NOT_FOUND` | 404 | Resource absent — or not visible to this principal (anti-enumeration; case-by-case per contract). |
| `CONFLICT` | 409 | Illegal state (e.g., editing a submitted application). |
| `UNSUPPORTED_FILE_TYPE` | 415 | Upload MIME rejected. |
| `FILE_TOO_LARGE` | 413 | Upload exceeds size cap. |
| `RATE_LIMITED` | 429 | Throttled (auth + upload endpoints). |
| `INTERNAL_ERROR` | 500 | Unexpected; no internals leaked; `requestId` for support. |

---

## 3. Contract table — MVP boundaries

| # | Feature (owner) | Proposed path | Method | Auth required | Role | Request | Response (success) | Validation (server-side) | Errors | Data source | Frontend consumer | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Health check (David) | `/api/v1/health` | GET | No | — | — | `{ data: { status, version } }` | — | `INTERNAL_ERROR` | Runtime self-check (DB ping optional) | Emmanuel Day-3 integration gate; ops | **MVP** |
| 2 | Public investment solutions (David) | `/api/v1/public/investment-solutions` | GET | No | — | — | `{ data: [ { id, slug, name, shortDescription, longDescription, category, riskDescription, typicalUse, displayOrder, active } ], meta: { source } }` | — | `INTERNAL_ERROR` | PostgreSQL seed (3 frozen rows; slug set: `fixed-note`, `discretionary-portfolios`, `execution-mandate`) | Public website InvestmentServices/`/services` — **BACKEND API PLANNED — FRONTEND ADOPTION COORDINATED**: Emmanuel's working static implementation remains valid and is not required to be replaced immediately; adoption is coordinated when convenient | **MVP** |
| 3 | Register investor (David) | `/api/v1/auth/register` | POST | No | creates `INVESTOR` | `{ firstName, lastName, email, password }` — D-06 v1 baseline (`confirmPassword` is **frontend-only**: never transmitted, persisted or returned) | `201 { data: { user: { id, firstName, lastName, email, role } } }` — created account result only. **Registration session issuance / auto-login: FRONTEND/BACKEND COORDINATION DECISION — NOT YET APPROVED** (D-06 v1 flow: success → confirmation → `/login`); no session issuance promised | Required non-empty name fields; email format/unique; password policy (PROPOSED) | `VALIDATION_FAILED`, `CONFLICT` (email taken), `RATE_LIMITED` | PostgreSQL `users` + `investor_profiles` (created together in **one atomic DB transaction** — future implementation; not done now) | Portal Sign Up | **MVP** (auth direction approved; expiry/credential/CSRF mechanics finalized before implementation) |
| 4 | Login (David) | `/api/v1/auth/login` | POST | No | — | `{ email, password }` | `200 { data: { user: { id, email, role } } }` + session per D-02 | Schema only; credential check in service | `UNAUTHENTICATED` (uniform message), `RATE_LIMITED` | PostgreSQL | Portal + staff + future mobile login | **MVP** (auth direction approved; expiry/credential/CSRF mechanics finalized before implementation) |
| 5 | Logout (David) | `/api/v1/auth/logout` | POST | Yes | any | — | `204` | — | `UNAUTHENTICATED` | Server-side session record (revocable) | All authenticated clients | **MVP** |
| 6 | Refresh session (David) | `/api/v1/auth/refresh` | POST | Refresh credential | any | Refresh credential (rotating) | Rotated credentials | — | `UNAUTHENTICATED` | Server-side session record (revocable) | Web/mobile session continuity | **MVP** |
| 7 | Current identity (David) | `/api/v1/me` | GET | Yes | any | — | `{ data: { id, email, role, status } }` | — | `UNAUTHENTICATED` | PostgreSQL | Portal shells; role-aware nav | **MVP** |
| 8 | Read own profile (David) | `/api/v1/me/profile` | GET | Yes | `INVESTOR` | — | `{ data: { firstName, lastName, email, phone } }` (D-06 v1 baseline; `phone` optional where collected/approved) | — | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND` | PostgreSQL | Investor profile screen | **MVP** |
| 9 | Update own profile (David) | `/api/v1/me/profile` | PUT | Yes | `INVESTOR` (ownership = self) | `{ firstName, lastName, phone? }` updatable subset (D-06 v1; **email-edit behaviour = frontend/backend coordination decision — not silently implemented**; profile-completion display has no approved calculation) | `{ data: { …profile } }` | Field rules per contract; sanitized text | `VALIDATION_FAILED`, `FORBIDDEN` | PostgreSQL | Investor profile form | **MVP** |
| 10 | Create application (David) | `/api/v1/applications` | POST | Yes | `INVESTOR` | `{ investmentSolutionSlug? }` ∈ `fixed-note` \| `discretionary-portfolios` \| `execution-mandate` (D-06 v1; **selection only — not a product purchase/trade/instruction/mandate/IMS operation; no amount/rate/yield/fee/tenor/minimum/liquidity/return/settlement/execution fields** — see §0) | `201 { data: { id, status: "DRAFT", createdAt } }` | If supplied, `investmentSolutionSlug` must be one of the three allowed values; it may remain unset on the initial empty DRAFT shell — a valid selection is **required before successful submission** (D-06 v1; see #14). One open active application per investor — **PROPOSED — REQUIRES BUSINESS/TEAM APPROVAL** (Decision D-09); must NOT be implemented automatically | `CONFLICT`, `UNAUTHENTICATED` | PostgreSQL | Onboarding start | **MVP** |
| 11 | List own applications (David) | `/api/v1/me/applications` | GET | Yes | `INVESTOR` (scoped to self) | pagination | `{ data: [ { id, status, submittedAt, updatedAt } ], meta: pagination }` | — | `UNAUTHENTICATED` | PostgreSQL | Status tracking list | **MVP** |
| 12 | Get own application (David) | `/api/v1/me/applications/{applicationId}` | GET | Yes | `INVESTOR` (ownership-checked) | — | `{ data: { id, status, submittedAt, statusHistory: [...], documents: [...metadata] } }` | — | `FORBIDDEN`/`NOT_FOUND` | PostgreSQL | Application detail/status screen | **MVP** |
| 13 | Edit draft application (David) | `/api/v1/me/applications/{applicationId}` | PATCH | Yes | `INVESTOR` (owner; status `DRAFT` or `INFO_REQUESTED`) | Editable fields incl. `investmentSolutionSlug` (D-06 v1; state rules pending **D-08**) | `{ data: { …application } }` | Editable-state rule; field validation | `CONFLICT` (not editable), `VALIDATION_FAILED` | PostgreSQL | Onboarding form | **MVP** |
| 14 | Submit application (David) | `/api/v1/me/applications/{applicationId}/submit` | POST | Yes | `INVESTOR` (owner) | — | `{ data: { id, status: "SUBMITTED" } }` | A valid `investmentSolutionSlug` must be present for successful submission (D-06 v1 baseline — this does **not** make documents, consent text, KYC fields or other still-unapproved requirements mandatory); other completeness rules (required fields/documents) depend on outstanding D-06 items + contract approval; state rules pending **D-08** | `CONFLICT`, `VALIDATION_FAILED` | PostgreSQL + status history + audit | Submit CTA | **MVP** |
| 15 | Upload document (David) | `/api/v1/me/documents` | POST | Yes | `INVESTOR` (ownership = self) | multipart: `file`, plus `category`, optional `applicationId` | `201 { data: { id, category, originalFilename, mimeType, sizeBytes, reviewStatus } }` | File policy (MIME allowlist, size cap) — subject to contract approval (examples illustrative only, not approved values); category vocabulary **TBD through approved document requirements / future D-06 change**; applicationId must belong to caller | `UNSUPPORTED_FILE_TYPE`, `FILE_TOO_LARGE`, `VALIDATION_FAILED` | Metadata: PostgreSQL; object: storage provider (Firebase C.S. later) | Document upload UI | **MVP** (direction approved: backend-mediated upload; limits/categories via contract approval) |
| 16 | List own documents (David) | `/api/v1/me/documents` | GET | Yes | `INVESTOR` (scoped to self) | `?applicationId` optional + pagination | `{ data: [ { id, category, reviewStatus, createdAt } ] }` (category/reviewStatus values: vocabulary **TBD** — see #15/#29) | — | `UNAUTHENTICATED` | PostgreSQL | Document list/status UI | **MVP** |
| 17 | Download own document (David) | `/api/v1/me/documents/{documentId}/download` | GET | Yes | `INVESTOR` (owner) | — | `200` short-lived authorized file access (backend-authorized; final mechanics per approved document direction) | — | `FORBIDDEN`/`NOT_FOUND`, `CONFLICT` (revoked) | Object storage via adapter | View/download own file | **MVP** (backend-authorized, short-lived access; no public URLs) |
| 18 | List products (David) | `/api/v1/products` | GET | Yes | `INVESTOR`, `STAFF`, `ADMIN` | pagination | `{ data: [ { id, name, description, currency, status, isDemo: true } ], meta: source/pagination }` — **no rate/fee/tenor fields** | — | `UNAUTHENTICATED` | PostgreSQL seed (demo) | Portal product views | **MVP (synthetic)** |
| 19 | Own portfolio (David) | `/api/v1/me/portfolio` | GET | Yes | `INVESTOR` (owner) | — | `{ data: { id, name, currency, holdings: [ { id, instrumentLabel, quantity, valueMinor, currency, asOf, isDemo: true } ] }, meta: { source: "staging_seed" } }` | — | `UNAUTHENTICATED`, `NOT_FOUND` (none seeded yet → empty state) | PostgreSQL seed (synthetic) | Investor dashboard cards | **MVP (synthetic)** |
| 20 | Own transactions (David) | `/api/v1/me/transactions` | GET | Yes | `INVESTOR` (owner) | pagination | `{ data: [ { id, direction, label, amountMinor, currency, status, occurredAt, isDemo: true } ], meta: pagination }` | — | `UNAUTHENTICATED` | PostgreSQL seed (synthetic) | Dashboard transaction history | **MVP (synthetic)** |
| 21 | Own statements (David) | `/api/v1/me/statements` | GET | Yes | `INVESTOR` (owner) | pagination | `{ data: [ { id, periodLabel, displayName, documentId, isDemo: true } ] }` (SAMPLE / SYNTHETIC; D-06 v1) | — | `UNAUTHENTICATED` | PostgreSQL seed (sample) | Statement list UI | **MVP (synthetic)** |
| 22 | Get own statement (David) | `/api/v1/me/statements/{statementId}` | GET | Yes | `INVESTOR` (owner) | — | `{ data: { id, periodLabel, displayName, document } }` (SAMPLE / SYNTHETIC; file access reuses #17 rules) | — | `FORBIDDEN`/`NOT_FOUND` | PostgreSQL (+ storage) | Statement detail/download | **MVP (synthetic)** |
| 23 | Staff: list investors (David) | `/api/v1/staff/investors` | GET | Yes | `STAFF`, `ADMIN` | `?q`, pagination | `{ data: [ { userId, firstName, lastName, email, applicationStatus, submittedAt } ], meta }` (`submittedAt` read/derived from `applications.submitted_at` — no duplicate storage; D-06 v1. **If D-09 permits multiple active applications per investor, WHICH application supplies `applicationStatus`/`submittedAt` requires the approved application-selection rule — part of D-09, OPEN; no rule invented**) | Query length caps | `FORBIDDEN` | PostgreSQL | Admin investor list | **MVP** |
| 24 | Staff: investor detail (David) | `/api/v1/staff/investors/{userId}` | GET | Yes | `STAFF`, `ADMIN` | — | `{ data: { profile, applications, documents (metadata) } }` | — | `NOT_FOUND`, `FORBIDDEN` | PostgreSQL | Admin investor detail | **MVP** |
| 25 | Staff: list applications (David) | `/api/v1/staff/applications` | GET | Yes | `STAFF`, `ADMIN` | `?status`, pagination | `{ data: [ { id, investor: { userId, name }, status, submittedAt } ], meta }` | Status enum filter | `FORBIDDEN`, `VALIDATION_FAILED` | PostgreSQL | Review queue | **MVP** |
| 26 | Staff: application detail (David) | `/api/v1/staff/applications/{applicationId}` | GET | Yes | `STAFF`, `ADMIN` | — | `{ data: { application, statusHistory, notes, documents (metadata) } }` | — | `NOT_FOUND`, `FORBIDDEN` | PostgreSQL | Review screen | **MVP** |
| 27 | Staff: add note (David) | `/api/v1/staff/applications/{applicationId}/notes` | POST | Yes | `STAFF`, `ADMIN` | `{ body }` | `201 { data: { id, authorUserId, createdAt } }` | Non-empty, length cap | `VALIDATION_FAILED`, `NOT_FOUND`, `FORBIDDEN` | PostgreSQL + audit | Internal notes UI | **MVP** |
| 28 | Staff: transition application (David) | `/api/v1/staff/applications/{applicationId}/transitions` | POST | Yes | `STAFF`, `ADMIN` | `{ action: "APPROVE" \| "REQUEST_INFO" \| "REJECT", note? }` | `{ data: { id, fromStatus, toStatus } }` | Legal-transition map; `note` required when `REQUEST_INFO` (PROPOSED). **OPEN ITEM (Decision D-08):** `IN_REVIEW` appears in the candidate status vocabulary but none of these actions enters it — a `START_REVIEW`-style action, another approved mechanism, or removal of `IN_REVIEW` must be agreed. State-transition map is **DRAFT — REQUIRES TEAM APPROVAL**; NO transition logic is implemented until the complete state map is approved | `CONFLICT` (illegal transition), `VALIDATION_FAILED`, `NOT_FOUND` | PostgreSQL (atomic: application + history + audit) | Approve/Request-info/Reject controls | **MVP** |
| 29 | Staff: review document (David) | `/api/v1/staff/documents/{documentId}/review` | POST | Yes | `STAFF`, `ADMIN` | `{ outcome, note? }` — outcome vocabulary **TBD — BUSINESS / COMPLIANCE + CONTRACT APPROVAL REQUIRED** | `{ data: { id, reviewStatus } }` (vocabulary TBD) | Boundary planned only; outcome/status vocabulary must be approved before implementation; current-state check | `CONFLICT`, `NOT_FOUND`, `FORBIDDEN` | PostgreSQL + audit | Document review UI | **MVP (boundary planned; final vocabulary TBD)** |
| 30 | Staff: download document (David) | `/api/v1/staff/documents/{documentId}/download` | GET | Yes | `STAFF`, `ADMIN` | — | `200` short-lived authorized file access (per D-05) | — | `NOT_FOUND`, `FORBIDDEN` | Object storage via adapter (+ audit) | Staff document review | **MVP** (backend-authorized, short-lived access; audited) |
| 31 | Staff: audit events (David) | `/api/v1/staff/audit-events` | GET | Yes | `ADMIN` (PROPOSED) | `?entityType&entityId`, pagination | `{ data: [ { id, actorUserId, actorRole, action, entityType, entityId, createdAt } ], meta }` | — | `FORBIDDEN` | PostgreSQL (append-only) | Audit display | **MVP** |

### Field redactions (all endpoints, always)
Never emitted: `password_hash`, storage internals (`storage_path` is server-side; clients receive a download operation, not a path), tokens, secrets, other users' identifiers.

---

## 4. Future boundaries — recorded, NOT contracted in v1

| Boundary | Status | Note |
|---|---|---|
| Live market overview (`/api/v1/public/market-*`) | FUTURE EXTERNAL INTEGRATION | Requires approved `MarketDataProvider`; current frontend placeholders remain valid until then. No numbers will be fabricated. |
| Market Digest subscription (`POST /api/v1/public/newsletter-subscriptions`) | FUTURE (component **NOT CURRENTLY ACTIVE**) | Recorded as a potential dependency only; not built in Phase 1. |
| Google / Apple social sign-in | **FUTURE AUTHENTICATION INTEGRATION — NOT MVP** | "Continue with Google" / "Continue with Apple" remain **non-functional frontend placeholders**. No OAuth endpoints, provider configuration, entities, callbacks or social-auth business logic. Email/password contract unchanged. |
| Free-tools calculators (`POST /api/v1/tools/*`) | FUTURE PORTAL FEATURE | No formulas/rules exist; requires product + compliance decision before any calculation API. |
| Notifications (email/SMS/push) | FUTURE EXTERNAL INTEGRATION | Behind `NotificationProvider` seam when approved. |
| Identity verification (BVN/NIN/KYC) | FUTURE EXTERNAL INTEGRATION | Internal review workflow ships in MVP without claiming external verification. |
| IMS-facing investment operations | FUTURE (proprietary IMS) | Contract extensions after the IMS specification exists. |

---

## 5. Frontend consumers of v1 (summary for Emmanuel)

- **Public site:** #1 (health check for integration gate), #2 (solutions; **BACKEND API PLANNED — FRONTEND ADOPTION COORDINATED** — see compatibility doc).
- **Investor portal (web Days 6–8; mobile Days 11–14):** #3–#22.
- **Staff/admin portal (Day 8):** #23–#31.
- **Mobile (Android/iOS):** identical v1 contracts; no mobile-specific business endpoints will exist.

All subjects to change control: breaking changes require a coordinated version bump and approval — never silent field changes.
