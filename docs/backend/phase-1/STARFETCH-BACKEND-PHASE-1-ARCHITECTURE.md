# STARFETCH INVESTMENT LIMITED — BACKEND PHASE 1 ARCHITECTURE

> **Status:** DRAFT — REQUIRES TEAM APPROVAL  |  **Review outcome:** ACCEPTED WITH CORRECTIONS (corrections applied in this revision). **Phase 2 implementation is NOT authorized by this document.**
> **Phase:** Backend Phase 1 — Backend Foundation, Domain Boundaries, Data Model & API Contract Preparation
> **Development sequencing:** Supports Development Days 1–2 alignment (scope, module list, ERD, contract agreement)
> **Owner:** David (Backend Developer)
> **Consumers of this document:** David, Emmanuel, ChatGPT (review/sync), management (acceptance)
> **Repository context supplied:** `G305-dev/starfetch`, branch `main` — contains `README.md` and `starfetch-investment-frontend/` only. **No backend exists yet.** This document creates design documentation only; it initializes no framework, database, or service.
> **Companion documents:** `STARFETCH-BACKEND-DOMAIN-MODEL-DRAFT.md`, `STARFETCH-API-CONTRACT-DRAFT.md`, `STARFETCH-FRONTEND-BACKEND-COMPATIBILITY.md`, `STARFETCH-PHASE-1-DECISIONS-NEEDED.md`
> **D-06:** **v1 — BASELINE ESTABLISHED / LIVING FRONTEND-BACKEND REQUIREMENTS HANDOFF** (change-controlled; future updates arrive as v1.1+ — see decisions register D-06 and contract draft §0).

---

## Approved technical direction (recorded after Phase-1 review)

The following is **David's current approved technical direction**, recorded so every later phase and every repository-sync prompt uses one source. **This approval does NOT authorize Phase 2 implementation.**

| Concern | Approved direction |
|---|---|
| Backend framework | **NestJS** (Node.js + TypeScript) |
| Primary structured database | **PostgreSQL** — system of record for the current MVP's structured data |
| ORM / migrations | **Prisma** |
| Canonical API specification | **`docs/api/openapi.yaml`** (schema-first, PR-reviewed) |
| Repository layout | `starfetch-investment-frontend/` (Emmanuel — untouched) · `starfetch-investment-backend/` (David) · `docs/api/` (shared API contracts) |
| Authentication | Short-lived access credential + rotating/revocable refresh credential; web transported via httpOnly/Secure cookie strategy where appropriate; Android/iOS via bearer access credential with refresh material in **platform-secure storage**; identical roles, permissions, payloads and business API across all clients. Exact expiry times, credential format and final CSRF/session mechanics are finalized **before auth implementation**, not here. |
| Private documents | PostgreSQL = metadata; Firebase Cloud Storage = private file objects (configured only in a later approved phase); MVP uploads **backend-mediated**; downloads require backend authorization + short-lived authorized access; **no permanent public document URLs**; file-size limits, MIME allowlist and final categories remain subject to contract approval. |
| Future IMS persistence / deployment topology | **TBD — REQUIRES FUTURE IMS ARCHITECTURE** (see §7, point 5). Not designed or selected here. |

---

## 1. Backend purpose

The Starfetch backend is the **single authoritative business layer** for the entire Starfetch platform:

- One versioned REST API (`/api/v1/...`) serving the public website, the investor web portal, the staff/admin web portal, and later the React Native Android/iOS applications.
- One system of record (PostgreSQL) for the current MVP's structured business data.
- One authorization authority: every protected decision (identity, role, ownership, document access, status transition) is made server-side.
- One governed set of contracts that web and mobile share, so that Emmanuel's three web surfaces and the future mobile app interpret every record identically.
- One extensible core into which the **future proprietary Starfetch Investment Management System (IMS)** and **future external providers** can be introduced without a platform rebuild.

The backend is deliberately a **separate layer** from Emmanuel's `starfetch-investment-frontend/` Next.js project. No backend logic is added to that project.

---

## 2. MVP boundaries

### 2.1 In scope for the MVP (Days 1–10 web; Days 11–15 mobile reuse)

| Area | MVP responsibility |
|---|---|
| System/health | Availability/integrity check endpoint for the Day-3 joint integration gate. |
| Authentication/authorization | Registration, login, logout, session/refresh handling, investor/staff/admin role separation. **Authentication direction is approved. Exact expiry times, credential format and final CSRF/session mechanics remain to be finalized immediately before authentication implementation.** |
| Users | Account identity and role. |
| Investor profile | Self-service profile data required by the MVP portal. Field baseline per **D-06 v1**: `firstName`, `lastName`, email (from the account), optional mobile phone where collected/approved; no unapproved regulatory fields. |
| Applications/onboarding | Internal Starfetch application workflow: draft, submit, track status; records the investor's **investment-solution selection** from onboarding (D-06 v1 — a selection referencing `investment_solutions`, **not** an investable-product purchase, trade or mandate). No external KYC verification. |
| Documents | Private document metadata + authorized access to file objects (objects stored in Firebase Cloud Storage in a later phase; not configured in Phase 1). |
| Investment solutions (public) | Backend-served public descriptions of the three existing solutions: **Starfetch Fixed Note** (`fixed-note`), **Starfetch Discretionary Portfolios** (`discretionary-portfolios`), **Starfetch Execution Mandate** (`execution-mandate`). Names/slugs frozen. |
| Products (portal) | Seeded, demo-labelled investable-product records for portal product views. **No rates, yields, fees, tenors, minimums or returns** — none have been supplied; none will be invented. |
| Application/review status | Simple internal status vocabulary with persisted transition history. |
| Portfolio / Transactions / Statements | Synthetic/demo read models for the investor dashboard. No live data, no real money, no investment calculations. |
| Staff/admin | Review operations: investor lists/details, application review, document review, internal notes, status transitions (approve / request-info / reject), audit display. |
| Audit | Append-only record of material actions (especially staff actions and status changes). |

### 2.2 Explicitly out of scope for the MVP

- Live external integrations of any kind (BVN/NIN, KYC/KYB/AML, banking, virtual accounts, payment gateways, custodians, brokers, market-data feeds, SMS/WhatsApp/push, production email, external IMS).
- Real funds, live trading, real settlement, real identity verification.
- Production financial reporting.
- The proprietary Starfetch IMS (future project; see §7).
- Free-tools calculation logic (Budget Planner, Portfolio Allocation Tool, Returns Calculator are presentational; no formulas are designed in Phase 1).
- **Google / Apple sign-in:** Emmanuel keeps "Continue with Google" / "Continue with Apple" as **non-functional frontend placeholders** — recorded only as `FUTURE AUTHENTICATION INTEGRATION — NOT MVP`. No OAuth API, provider configuration, database entities, callback endpoints or social-auth business logic. The MVP email/password authentication contract remains unchanged.
- Live market-data endpoint (future boundary documented only; current frontend placeholders remain valid).

---

## 3. Architectural principles

1. **Contract-first.** No endpoint is implemented without an approved contract (path, version, method, permissions, request/response schemas, nullable fields, enums, validation, errors, pagination, owner, consumers). All Phase-1 contracts are `DRAFT — REQUIRES TEAM APPROVAL`.
2. **Backend-authoritative security.** Frontend route guards are UX only. Authorization, ownership, validation, status transitions and document access are enforced only server-side.
3. **Client-neutral API.** Contracts must work identically for browser, Android and iOS. No browser-only assumptions (cookies, redirects, file inputs) appear in business payloads.
4. **PostgreSQL is the system of record for the current MVP's structured business data.** Future IMS persistence remains **TBD — REQUIRES FUTURE IMS ARCHITECTURE** (§7). Firebase Cloud Storage is future private-object storage only, fronted by the backend.
5. **Modular monolith.** One deployable backend, internally divided into modules with explicit ownership of tables and clear service boundaries. This is the right size for a two-developer MVP and decomposes naturally for the future IMS.
6. **Honest demo data.** Synthetic data is seeded server-side, labelled (`isDemo: true`, `meta.source`), and never presented as real financial truth.
7. **No external APIs now; clean seams for later.** Provider access, when approved, is introduced behind internal interfaces via adapters (see §8).
8. **Small, reviewable evolution.** The repository grows by adding sibling backend/docs folders; Emmanuel's frontend is never reorganized or edited by backend work.
9. **D-06 change control (living handoff).** Frontend requirement updates arrive as versioned D-06 drops (v1.1, v1.2, …): each new version is compared against the canonical contract; added/removed/renamed fields, validation, response, database and compatibility impacts are identified; an approved contract is never changed silently; coordinated change control precedes implementation. **Pure visual changes need no API/database changes.**

---

## 4. Repository evolution (APPROVED DIRECTION — implementation still gated on Phase-2 authorization)

Current repository:

```text
starfetch/
├── README.md
└── starfetch-investment-frontend/     # Emmanuel — untouched by backend work
```

Approved layout (recorded post-review), preserving Emmanuel's project exactly as it is:

```text
starfetch/
├── README.md
├── starfetch-investment-frontend/     # Emmanuel — untouched
├── starfetch-investment-backend/      # David — new backend service (Phase 2+)
└── docs/
    └── api/                           # canonical contracts (proposed openapi.yaml)
```

- The backend is a **sibling project** with its own toolchain, configuration and tests.
- `docs/api/` is the **approved** canonical contract location (`docs/api/openapi.yaml`); a future `packages/contracts`-style shared-types package can be added later if the team wants generatable TypeScript types shared with frontend.
- The layout above is approved and fixed; the module boundaries, contracts and data model below remain folder-agnostic. **Nothing may be scaffolded into it until Phase 2 is explicitly authorized.**

---

## 5. Backend module map

Each module owns its routes, validation (DTO schemas), service logic and tables. Cross-module access is via service interfaces, never direct table reads of another module's data.

| # | Module | Responsibilities | Owns (tables, draft) | MVP / Future |
|---|--------|------------------|----------------------|--------------|
| 1 | **System** | Health/status endpoint; operational integrity check used at the Day-3 gate. | none | MVP |
| 2 | **Identity (Auth)** | Registration, login, logout, session/refresh issuance and revocation, password security. **Direction approved (see "Approved technical direction"); final expiry/credential/CSRF mechanics finalized before auth implementation.** | `users` (shared with Users), future session/refresh table | MVP |
| 3 | **Users** | Account identity, role, lifecycle. | `users` | MVP |
| 4 | **Investor Profiles** | Investor profile CRUD for own account; server-side validation. | `investor_profiles` | MVP |
| 5 | **Applications** | Onboarding application create/edit/submit; investor-facing status; internal transition workflow with staff actions (complete state map = **D-08**); stores the onboarding investment-solution selection referencing `investment_solutions` (D-06 v1 — selection ≠ product purchase/trade/mandate; no amount/rate/fee/tenor fields). | `applications`, `application_status_history` | MVP |
| 6 | **Documents** | Document metadata; upload intake; authorization for downloads; review status. Storage of binary objects delegated to a storage provider seam (Firebase Cloud Storage adapter later). | `documents` | MVP |
| 7 | **Investment Solutions (public)** | Public read of the three solution descriptions; seeded; no financial terms. | `investment_solutions` | MVP |
| 8 | **Products** | Investable-product records for the portal; seeded demo data; no rate/fee/tenor attributes until supplied by the business. | `products` | MVP (minimal) / richer attributes FUTURE |
| 9 | **Portfolio (demo)** | Synthetic holdings read model for dashboards. | `portfolios`, `holdings` | MVP (synthetic) |
| 10 | **Transactions (demo)** | Synthetic transaction history read model. | `transactions` | MVP (synthetic) |
| 11 | **Statements (sample)** | Sample statement records/references (period + human-readable `displayName` per D-06 v1; view/download only). | `statements` | MVP (synthetic) |
| 12 | **Staff/Admin** | Review queues, investor lists/details, notes, document review actions, staff-only endpoints. | `application_notes` (shared with Applications) | MVP |
| 13 | **Audit** | Append-only audit events for material actions (staff actions, status changes, authorization-relevant events). | `audit_events` | MVP |
| 14 | **Platform/Common** | Configuration, request-id propagation, error normalization, pagination conventions, validation plumbing, RBAC guards, demo-labelling helpers. | — | MVP |
| 15 | **Integrations (future)** | Provider adapters behind internal interfaces (§8). No implementation now. | future provider-reference tables | FUTURE |
| 16 | **Investment Operations (future)** | The seam into which the proprietary IMS will later be introduced (§7). No design in Phase 1. | future IMS persistence/resources — TBD under the approved IMS architecture | FUTURE |

---

## 6. Service boundaries and layering rules

Per module, three layers (framework-independent):

```text
HTTP adapter (routes/controllers)  →  Application service (use cases)  →  Persistence (PostgreSQL)
```

Rules:

1. **Controllers are thin**: parse/validate input, call one application service, shape the response. No business rules in controllers.
2. **Application services own business rules and authorization decisions** (role checks, ownership checks, state-transition legality).
3. **Persistence is module-private.** Another module needing cross-module data calls that module's service interface.
4. **Side effects that must be recorded** (status transitions, staff review actions, document access) go through the Audit module's append-only writer.
5. **Domain models stay provider-neutral and storage-neutral**: no Firebase, vendor, or framework types leak into domain objects.
6. **Errors are normalized** at the HTTP edge into the proposed error envelope (see `STARFETCH-API-CONTRACT-DRAFT.md` §2) — `PROPOSED`.
7. **Validation happens at the boundary** via declared request schemas; database constraints are the second line of defence, not the first.
8. **Transactions** (database) wrap multi-write use cases (e.g., a status transition + history row + audit event is one atomic unit).

---

## 7. Future proprietary Starfetch IMS — extension points (no IMS design here)

Starfetch will build its **own** Investment Management System later. Phase 1 implements none of it and defines none of its rules (no NAV, no fund accounting, no ledger, no settlement, no reconciliation, no valuation, no trade lifecycle, no custodian workflows). What Phase 1 does is reserve clean seams:

1. **Onboarding/customer domain vs. investment-operations domain are distinct.** Modules 1–13 (identity, profiles, applications, documents, demo portfolio/transactions/statements) are customer-facing platform concerns. The IMS plugs into a future investment-operations boundary instead of entangling with onboarding.
2. **Demo read models are behind service interfaces.** `Portfolio`, `Transactions` and `Statements` modules expose contracts, not storage details. When the IMS exists, these modules can source real data through an approved internal interface **without breaking the `/api/v1` contracts** Emmanuel's web and mobile apps consume.
3. **Product modelling avoids premature financial modelling.** `products` intentionally carries no rate/yield/tenor/fee/computed fields. IMS-era attributes get added deliberately, versioned in contracts, once the business supplies real terms.
4. **Stable conventions now:** UUID identifiers, ISO-8601 UTC timestamps, minor-units money + currency code (`DRAFT` convention), one status vocabulary per entity, `requestId` on every error. These are the conventions an IMS will need anyway; fixing them now prevents retrofits.
5. **IMS persistence/deployment topology: TBD — REQUIRES FUTURE IMS ARCHITECTURE.** PostgreSQL is confirmed only as the system of record for the **current MVP's** structured data. Whether the future proprietary IMS later uses the same database, separate schemas, separate persistence, or another internal architecture is decided solely from the approved IMS specification. This document deliberately does not design or select it.
6. **No business calculations in clients or controllers**, so nothing needs to be "moved to the IMS" later; server-side services already own all rule execution.

```text
Web / Android / iOS
        │
Versioned Starfetch API (/api/v1)
        │
Current MVP modules (identity, profiles, applications, documents, solutions, products*, portfolio*, transactions*, statements*, staff, audit)
        │
Future internal investment-operations interface
        │
Future proprietary Starfetch IMS  (not designed or built in Phase 1)

* demo/synthetic implementations; contracts designed to survive later real data
```

---

## 8. Future external providers — adapter boundaries (no integration now)

Principle:

```text
Core Business Logic
        │
Internal Service Interface
        │
Provider Adapter          ← config-selected; demo/local implementations during MVP
        │
External Provider         ← deferred; requires explicit team approval
```

- **Only one provider seam is needed by the MVP:** file-object storage. The Documents module will depend on an internal `StorageProvider`-style interface; a Firebase Cloud Storage adapter is the intended implementation in a later approved phase (not configured in Phase 1). A local/dev adapter may serve development. Per the approved document direction, MVP uploads are **backend-mediated** through this seam and downloads are backend-authorized short-lived access — no permanent public URLs.
- Other examples are **future names only**, to be designed when a real feature requires them: `IdentityVerificationProvider`, `PaymentProvider`, `BankingProvider`, `MarketDataProvider`, `NotificationProvider`. Phase 1 does not create these abstractions.
- Rules: vendor SDKs never appear in domain logic; adapter selection is configuration-driven; contracts and domain models remain provider-neutral; no external credentials exist in the MVP configuration.

---

## 9. Web and mobile compatibility

- One API version namespace: `/api/v1/...`. Breaking changes enter as a new version after coordinated approval, never in place.
- JSON request/response bodies only; UTF-8; ISO-8601 timestamps; minor-units money + `currency` code (`DRAFT` convention).
- File flows are designed for both web and native clients: browser file inputs and native document pickers use the same metadata contract. Downloads require backend authorization and return short-lived authorized access; no permanent public document URLs are used. Final MIME allowlist, file-size limits and document categories remain subject to contract approval.
- Authentication direction is approved: web via httpOnly/Secure cookie strategy where appropriate; Android/iOS bearer access credential with refresh material in platform-secure storage — **with business payloads, roles, permissions and error shapes identical across clients**. Exact expiry times, credential format and final CSRF/session mechanics remain to be finalized immediately before authentication implementation.
- Uniform errors and pagination so Emmanuel builds one parser per platform.
- No browser-only concepts in contracts (no HTML, no redirect-based flows in business responses, no `window`/`localStorage` assumptions).

---

## 10. Security architecture principles

Implemented later; the boundaries below are how the design supports them.

1. **Server-authoritative authorization.** Every protected request passes: authentication resolution → role check (RBAC) → resource-ownership check where applicable. Investor A can never reach Investor B's profile, applications, documents, portfolio, transactions or statements — enforced by query scoping, not obscured URLs.
2. **Roles (minimum, approved set):** `INVESTOR`, `STAFF`, `ADMIN`. No further roles in the MVP. Any additional role would be marked `PROPOSED — REQUIRES TEAM APPROVAL`.
3. **Password security:** strong one-way hashing (modern memory-hard algorithm), per-user salting (algorithm-inherent), never logged, never returned in any response.
4. **Session security (approved direction):** short-lived access credential + rotating/revocable refresh credential; expiry enforced; web transported via httpOnly/Secure cookie strategy where appropriate; Android/iOS bearer access credentials with refresh material in platform-secure storage only; sensitive tokens never in URLs or logs; identical roles, permissions, payloads and business API across clients. Final expiry values, credential format and CSRF/session mechanics are settled immediately before auth implementation.
5. **Private documents:** private by default; MIME and size validated server-side; unsafe uploads rejected; buckets/objects non-public; downloads only via backend-authorized short-lived URLs; access revocable; staff document actions audited.
6. **Server-side validation everywhere**; client validation is convenience only.
7. **Safe errors:** stable codes, no stack traces, no internal identifiers beyond the record's own id, no leakage of other users' existence (404 over 403 where enumeration is a risk, applied case-by-case and recorded in contracts).
8. **Audit:** append-only; records actor, action, entity, timestamp and minimal context (see domain model). Audit rows are never updated or deleted by application code.
9. **Transport & headers:** HTTPS only; strict CORS allowlist; security headers via middleware; rate limiting on auth and upload endpoints.
10. **Secrets hygiene:** all secrets in environment configuration; nothing secret in the frontend, in Git, in URLs, or in logs. Request logs redact authorization headers and file payloads.
11. **Demo honesty:** synthetic records carry `isDemo: true` and responses may carry `meta.source` so no staging data is mistaken for real financial records.
12. **Least privilege:** database credentials scoped to the application schema; storage credentials scoped to the private bucket; no wildcard service accounts.

---

## 11. Backend framework — RESOLVED: NestJS approved at review

Phase 1 initialized nothing. The candidate comparison below is retained for the record; **David has since approved NestJS (backend framework) and Prisma (ORM/migration tooling)** — see "Approved technical direction" above. This approval does **not** authorize Phase 2 scaffolding. For the record, the two candidates originally compared:

### 11.1 Comparison

| Criterion | **NestJS (recommended)** | **Fastify (alternative)** |
|---|---|---|
| TypeScript support | First-class; decorators, DI, typed everything | Strong TS support; more manual composition |
| API structure | Built-in module/controller/provider structure matching §5's module map directly | Minimal core; structure created by convention/plugins we define ourselves |
| Validation support | `class-validator`/`zod` pipes at the boundary, exactly matching "validation at the edge" | JSON-Schema-native validation; equally capable, more assembly |
| Testing support | Testing utilities, DI mocks, Jest integration out of the box | Jest/Vitest integration straightforward; fewer provided helpers |
| PostgreSQL compatibility | Works with any ORM/tooling (Prisma, TypeORM, Drizzle) | Same ORM freedom |
| Future IMS suitability | **Best fit**: Domain-module isolation, DI, and clear service boundaries map cleanly to growing a modular monolith toward IMS-era modules | Suitable but requires hand-rolling the discipline NestJS provides |
| Android/iOS API suitability | Transport-agnostic HTTP layer; identical contracts for web/native | Same capability |
| Team velocity (2 devs, compressed plan) | Slightly steeper start, then conventions remove debate and review surface | Faster to start, more decisions re-litigated later under time pressure |

### 11.2 Outcome

**RESOLVED — NestJS approved** (with **Prisma** for ORM/migrations, also approved). NestJS suits Starfetch because the module map in §5 is essentially its native organizational unit; boundary validation, guards (RBAC/ownership), interceptors (audit/error normalization) and DI-based service seams (§7/§8) are first-class concepts, which reduces the risk of architectural drift during the compressed 15-day plan and leaves the cleanest runway for the proprietary IMS.

**Recorded alternative (superseded):** Fastify — retained above for the comparison record only.

**Implementation gate:** scaffolding inside `starfetch-investment-backend/` begins only when David explicitly authorizes Phase 2.

---

## 12. What Phase 1 deliberately did NOT do

- No backend framework initialized (not NestJS, Express, Fastify, Hono, Next API routes, Firebase Functions or anything else).
- No dependencies installed; no production code written.
- No PostgreSQL database created; no migrations written.
- No Firebase project created or configured; no files uploaded.
- No authentication/authorization implementation; auth design documented as a decision.
- No endpoints, uploads, portfolio/transaction logic, calculations, payments or integrations implemented.
- No IMS rules designed.
- No repository restructuring; no changes to `starfetch-investment-frontend/` whatsoever.
- No market data fabricated; no rates, fees, tenors, minimums or returns invented.
