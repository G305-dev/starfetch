# STARFETCH — PHASE 1 DECISIONS REGISTER

> **Status:** Updated after Phase-1 review (**ACCEPTED WITH CORRECTIONS**); synchronized with **D-06 v1** (baseline established — living handoff). This register records what is now **RESOLVED** (approved direction) and what remains **OPEN**.
> **Discipline:** Only decisions that genuinely block or gate development are listed. Recommendations were advisory; approval belongs to David and Emmanuel. **No resolution in this document authorizes Phase 2 implementation.**

---

## Register summary

| ID | Decision | State |
|----|----------|-------|
| D-01 | Backend framework | **RESOLVED — NestJS approved** |
| D-02 | Authentication / session architecture | **RESOLVED — direction approved** (fine mechanics finalized before auth implementation) |
| D-03 | ORM / database tooling | **RESOLVED — Prisma approved** |
| D-04 | API contract source-of-truth location | **RESOLVED — `docs/api/openapi.yaml` approved** |
| D-05 | Private-document access architecture | **RESOLVED — direction approved** (limits/allowlist/categories still subject to contract approval) |
| D-06 | Portal field requirements (living handoff) | **BASELINE ESTABLISHED (v1) — LIVING; not permanently closed** (updates arrive as v1.1, v1.2, …) |
| D-07 | Repository evolution (backend/docs folders) | **RESOLVED — layout approved** |
| D-08 | Application status / state-transition map | **OPEN** — added at review (unchanged by D-06 v1) |
| D-09 | "One active application per investor" rule | **OPEN** — business rule, added at review (unchanged by D-06 v1) |

---

## D-01 — Backend framework — **RESOLVED**

| | |
|---|---|
| **Decision** | Which backend framework is initialized in Phase 2. |
| **Resolution** | **NestJS approved** (Node.js + TypeScript). Recorded in `STARFETCH-BACKEND-PHASE-1-ARCHITECTURE.md` ("Approved technical direction" and §11). |
| **Why it matters** | Determines code structure, conventions, testing setup and review surface for every subsequent backend day. |
| **Effective gate** | Scaffolding may occur only when Phase 2 is explicitly authorized, targeting Day-3 setup. |
| **Recorded alternative** | Fastify (superseded; retained in the architecture document's comparison table for the record). |
| **Impact** | Unblocks Phase-2 setup **once authorized**; this resolution alone does not authorize it. |

## D-02 — Authentication / session architecture — **RESOLVED (direction)**

| | |
|---|---|
| **Decision** | Concrete auth/session design for web + Android + iOS. |
| **Resolution — approved direction** | Short-lived **access credential** + rotating, revocable **refresh credential**. **Web:** transported securely via httpOnly/Secure cookie strategy where appropriate. **Android/iOS:** bearer access credential, with refresh material stored in platform-secure storage (Keystore/Keychain). **Same roles, permissions, payloads and business API across all clients.** |
| **Remaining pre-implementation finalization** | Exact expiry times, credential format, and final CSRF/session mechanics — finalized immediately **before** authentication implementation. |
| **Why it matters** | Security-critical; touches every protected endpoint, portal shells, and mobile storage behavior. |
| **Effective gate** | Before Development Day 4 (auth build day). **Authentication is NOT to be implemented yet.** |
| **Recorded alternatives** | Server-side session + mobile token bridge (superseded); managed identity platform (rejected for MVP). |
| **Impact** | Contract rows #3–7 keep payloads business-identical across clients; the session/refresh table design belongs to the pre-implementation finalization, not to Phase 1. |

## D-03 — ORM / database tooling — **RESOLVED**

| | |
|---|---|
| **Decision** | Data-access/migration toolchain against PostgreSQL. |
| **Resolution** | **Prisma approved** for schema, migrations and typed data access. |
| **Why it matters** | Governs migration workflow, typed queries, seeding scripts and review ergonomics. |
| **Effective gate** | First migrations written on/after Day-3 setup, inside authorized Phase-2 work. |
| **Recorded alternatives** | TypeORM, Drizzle, plain SQL migrations (superseded). |
| **Impact** | Does not change the approved logical model; tooling only. |

## D-04 — API contract source-of-truth — **RESOLVED**

| | |
|---|---|
| **Decision** | Where canonical contracts live and how they flow. |
| **Resolution** | **`docs/api/openapi.yaml` approved** as the canonical, versioned, PR-reviewed specification. The Phase-1 draft contracts (`STARFETCH-API-CONTRACT-DRAFT.md`) seed its first version; each contract still requires team approval before implementation. TypeScript types for the frontend are generated/exported from the spec (exact mechanism chosen at setup time). |
| **Why it matters** | One authoritative interpretation across backend, web and mobile; the contract-first discipline depends on it. |
| **Effective gate** | `docs/api/openapi.yaml` is created during authorized Phase-2 work. |
| **Recorded alternative** | Code-first spec generation (superseded). |
| **Impact** | Contract change control applies: no silent field changes; breaking changes are coordinated and versioned. |

## D-05 — Private-document access architecture — **RESOLVED (direction)**

| | |
|---|---|
| **Decision** | Final mechanics for upload/download against private storage. |
| **Resolution — approved MVP direction** | PostgreSQL stores **document metadata**; **Firebase Cloud Storage** stores private file objects **when configured in the appropriate later phase** (not yet). **Uploads: backend-mediated** for simpler MVP authorization and validation. **Downloads: backend authorization required, short-lived authorized access.** **No permanent public document URLs.** |
| **Still subject to contract approval (business/compliance)** | Exact document inventory; document requiredness; categories; file policy (MIME types, size limits); review labels/outcomes; replacement rules; retention/deletion rules; access policy. All **TBD — BUSINESS / COMPLIANCE + CONTRACT APPROVAL REQUIRED** (categories also depend on a later D-06 version). Concrete example values in older drafts (e.g., IDENTIFICATION/PROOF_OF_ADDRESS; PENDING_REVIEW/ACCEPTED/REJECTED) are **not approved** and must not become implementation truth. |
| **Why it matters** | Documents are the most sensitive MVP data; flows must be identical for web and mobile and fully server-authorized. |
| **Effective gate** | Firebase configuration occurs only in the later approved phase; document endpoints land ~Day 6. **Firebase is NOT to be configured yet.** |
| **Recorded alternative** | Firebase client SDK direct access with Storage Rules (rejected for MVP: moves policy away from backend authority). |
| **Impact** | Contract rows #15–17, #22, #29–30 updated; the `documents` metadata model stands. |

## D-06 — Portal field requirements from Emmanuel — **BASELINE ESTABLISHED (v1) — LIVING HANDOFF**

| | |
|---|---|
| **State** | **D-06 v1 — BASELINE ESTABLISHED / LIVING FRONTEND-BACKEND REQUIREMENTS HANDOFF.** Not permanently closed: future Emmanuel changes that affect API/data requirements arrive as **D-06 v1.1, v1.2, …**. Backend contracts must not silently drift from the latest approved D-06 version. |
| **Delivered in v1** | **Registration:** `firstName`, `lastName`, `email`, `password` (`confirmPassword` is frontend-only — never persisted or returned). **Profile:** split name, email, optional mobile phone where collected/approved; optional profile-completion information only if later retained (its calculation is unapproved). **Onboarding:** investment-solution selection via `investmentSolutionSlug` ∈ { `fixed-note`, `discretionary-portfolios`, `execution-mandate` } — a selection only, **not** an investable-product purchase, trade, instruction, mandate or IMS operation; the `investment_solutions`/`products` distinction stands; no amount/rate/yield/fee/tenor/minimum/liquidity/return/settlement/execution fields. **Statements:** period, `displayName`, sample indicator, view/download (all SAMPLE/SYNTHETIC). **Staff investor list:** investor name, email, application status, `submittedAt` (derived from `applications.submitted_at`), view action. **Sample data:** transactions/statements/dashboard with persistent synthetic indicators. |
| **Recorded as placeholders — no backend work** | "Continue with Google" / "Continue with Apple": **non-functional frontend placeholders** — `FUTURE AUTHENTICATION INTEGRATION — NOT MVP`. No OAuth API, provider configuration, database entities, callback endpoints or social-auth business logic. MVP email/password contract unchanged. |
| **Still outstanding / unapproved in v1** | Document categories expected by the upload UI (subject to contract approval — later D-06 version); consent/legal text (**unapproved**); profile-completion calculation (**unapproved**); email-edit behaviour (**frontend/backend coordination decision** — not silently implemented); any further onboarding/profile detail fields; **registration session issuance / auto-login (frontend/backend coordination decision — NOT YET APPROVED)** — D-06 v1 flow is success → confirmation → `/login`, with automatic-login/session behaviour left to David + Emmanuel coordination (login contract unchanged). |
| **Change control (rule, applies from v1 onward)** | On each new D-06 version affecting backend data/API requirements: (1) compare the new version with the current canonical API contract; (2) identify added/removed/renamed fields; (3) identify validation changes; (4) identify response changes; (5) identify database impact; (6) identify compatibility impact; (7) do **not** silently change an existing approved contract; (8) apply coordinated version/change control before implementation. **Pure visual changes require no API/database changes.** |
| **Impact** | Synchronized into: contract draft §0 + rows #3/#8/#9/#10/#13/#15/#21/#22/#23 and §4 future-boundary table; domain model §3.2/§3.3/§3.11/§3.12; architecture §2.1/§2.2/§3/§5; compatibility doc rows 7/8/15/16 and §4. **D-06 v1 does not resolve D-08 or D-09.** |

## D-07 — Repository evolution — **RESOLVED**

| | |
|---|---|
| **Decision** | Repository layout accommodating the backend and contracts. |
| **Resolution — approved layout** | `starfetch-investment-frontend/` — Emmanuel, **untouched** · `starfetch-investment-backend/` — David · `docs/api/` — shared API contracts. |
| **Why it matters** | Gives Phase 2 a sanctioned home without restructuring Emmanuel's project; keeps ChatGPT's repo-sync prompts accurate. |
| **Effective gate** | The folders are created during authorized Phase-2 work (Git operations belong to David/Emmanuel). |
| **Recorded alternative** | Earlier `apps/`-style monorepo proposal (superseded by the approved layout). |
| **Impact** | Aligns with D-04 (`docs/api/openapi.yaml` lives inside the approved `docs/api/`). |

## D-08 — Application status / state-transition map — **OPEN**

| | |
|---|---|
| **Decision** | The complete, approved application state map: statuses, actions, and the legal-transition matrix. |
| **Context (raised at review)** | The draft vocabulary includes `IN_REVIEW`, but the draft transition endpoint offers only `APPROVE`, `REQUEST_INFO` and `REJECT` — no action enters `IN_REVIEW`. This was **not** silently resolved. Options: add a `START_REVIEW`-style action, adopt another approved mechanism, or remove `IN_REVIEW` from the vocabulary. |
| **State** | **DRAFT — REQUIRES TEAM APPROVAL.** **No application state-transition logic may be implemented until the complete state map is approved.** **D-06 v1 confirms the frontend needs application-status display and staff actions, but resolves nothing here — the complete state map remains OPEN.** |
| **Why it matters** | Status transitions drive investor-visible tracking, staff review workflow, history persistence and audit; an inconsistent map corrupts all four. |
| **When it must be decided** | Day-2 contract session at the latest; hard blocker before any transitions endpoint (~Day 8 staff workflow; also affects submit behavior on Day 6). |
| **Recommended option** | Minimal map agreed jointly: investor actions (`SUBMIT`, possibly `SAVE_DRAFT`/`RESPOND_TO_INFO_REQUEST`) and staff actions (start review, approve, request-info, reject) mapped explicitly onto the status vocabulary in `docs/api/openapi.yaml`. |
| **Alternatives** | Remove `IN_REVIEW` and track review purely via timestamps/history — acceptable if the team prefers fewer states. |
| **Impact** | Blocks contract rows #13–14 and #28; the `applications.status` enum and `application_status_history` semantics depend on it. |

## D-09 — "One active application per investor" rule — **OPEN**

| | |
|---|---|
| **Decision** | Whether an investor may hold only one open/active application at a time (`CONFLICT` on creating a second). |
| **State** | **PROPOSED — REQUIRES BUSINESS/TEAM APPROVAL.** It is **not** approved business logic and must **not** be implemented automatically during later development. **D-06 v1 does not resolve this; it remains OPEN.** |
| **Why it matters** | It constrains user behavior and error responses; if rejected, create-flow and conflict handling change. |
| **When it must be decided** | Before the applications endpoints are implemented (Day 6). |
| **Recommended option** | Defer to the business; if no decision arrives, implement without the uniqueness constraint and note the omission in the handoff. |
| **Alternatives** | Allow multiple concurrent applications; or replace with a softer warning. |
| **Impact** | Affects contract row #10 (validation + `CONFLICT` semantics) **and the staff investor-list contract (row #23):** if multiple active applications per investor are permitted, WHICH application supplies `applicationStatus` / `submittedAt` requires an approved application-selection rule that is part of this decision. No rule (latest / latest-submitted / first / active / most-recently-updated) may be invented; row #23's derivation semantics remain unspecified until D-09 is resolved. |

---

## Explicitly NOT approved — must not enter contracts or schemas

**Unapproved by D-06 v1 (and by standing project rules):** KYC/BVN/NIN/AML/PEP; date of birth; address; nationality/residency; tax; beneficial ownership; identity documents as mandatory requirements; consent/legal text; risk/suitability scoring; mandates; investment amounts; product rates/yields; fees; tenors; minimums; redemption/withdrawal rules; eligibility criteria; product disclosures; document requirements/policies; internal staff governance rules.

**Also not approved (standing):** Google/Apple or any OAuth — `FUTURE AUTHENTICATION INTEGRATION — NOT MVP` (frontend placeholders only); profile-completion calculation; email-edit flows (frontend/backend coordination decision); product rates/fees/tenors/minimums in any seed or schema; proprietary IMS entities/rules/persistence — **TBD — REQUIRES FUTURE IMS ARCHITECTURE**; IMS structures and external provider selections — future phases only.
