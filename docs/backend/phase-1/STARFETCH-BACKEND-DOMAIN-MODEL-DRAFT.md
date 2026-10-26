# STARFETCH INVESTMENT LIMITED — BACKEND DOMAIN MODEL (DRAFT)

> **Status:** DRAFT — REQUIRES TEAM APPROVAL  |  **Review outcome:** ACCEPTED WITH CORRECTIONS (corrections applied in this revision)
> **Companion to:** `STARFETCH-BACKEND-PHASE-1-ARCHITECTURE.md`
> **D-06:** **v1 — BASELINE ESTABLISHED / LIVING FRONTEND-BACKEND REQUIREMENTS HANDOFF** (change-controlled; future updates arrive as v1.1+ — see decisions register D-06).
> **Purpose:** Logical data-model design for the MVP — entities, purpose, relationships, ownership, MVP/future classification. This is a **design artifact only**: no database was created, no migrations were written. Field lists are proposals to be finalized in the Day-2 ERD/contract agreement together with Emmanuel's portal field requirements (Decision D-06).
> **Conventions (DRAFT):** UUID primary keys; ISO-8601 UTC timestamps (`created_at`, `updated_at` on all business tables); money as integer minor units + `currency` code; synthetic data labelled `is_demo = true`; append-only history/audit tables are never updated by application code.

---

## 1. MVP entities — overview

| # | Entity | Purpose | MVP / Future |
|---|--------|---------|--------------|
| 1 | `users` | Account identity, credentials, role for every platform user. | MVP |
| 2 | `investor_profiles` | Personal/profile data for users with role `INVESTOR`. | MVP |
| 3 | `applications` | An investor's onboarding application to Starfetch. | MVP |
| 4 | `application_status_history` | Append-only record of every status transition of an application. | MVP |
| 5 | `application_notes` | Internal staff notes on an application. | MVP |
| 6 | `documents` | Metadata + authorization anchor for private files (objects in Firebase Cloud Storage later). | MVP |
| 7 | `investment_solutions` | Public catalogue of the three Starfetch solutions (names/slugs frozen). | MVP |
| 8 | `products` | Investable-product records surfaced in the investor portal (seeded demo; no financial terms). | MVP (minimal) / FUTURE rich attributes |
| 9 | `portfolios` | Synthetic demo portfolio per investor. | MVP (synthetic) |
| 10 | `holdings` | Synthetic positions inside a demo portfolio. | MVP (synthetic) |
| 11 | `transactions` | Synthetic demo transaction history. | MVP (synthetic) |
| 12 | `statements` | Sample statement records/references. | MVP (synthetic) |
| 13 | `audit_events` | Append-only audit trail of material actions. | MVP |
| — | (auth sessions/refresh tokens) | Deliberately not modelled: per the approved auth direction a revocable server-side session/refresh record is expected; its exact shape is settled with the pre-implementation mechanics. | MVP-era, pre-implementation |

### Roles (approved evaluation set)

`INVESTOR` — self-service portal user. `STAFF` — internal reviewer. `ADMIN` — staff plus staff/user administration and audit oversight. No further roles; additions require `PROPOSED — REQUIRES TEAM APPROVAL`.

---

## 2. Relationship map (logical)

```text
users 1 ─── 0..1 investor_profiles
users 1 ─── * applications
applications 1 ─── * application_status_history
applications 1 ─── * application_notes        (author → users, role STAFF/ADMIN)
applications 1 ─── * documents                (uploader → users)
users 1 ─── * portfolios                      is_demo
portfolios 1 ─── * holdings                   is_demo
portfolios 1 ─── * transactions               is_demo
users 1 ─── * statements                      is_demo
investment_solutions  (standalone public catalogue; seeded)
products 0..* ─── 0..1 investment_solutions   (optional link; DRAFT — see §5)
audit_events  ─── actor → users,  references (entity_type, entity_id)

documents.metadata  ──(storage_path)──►  object in Firebase Cloud Storage (later phase)
```

---

## 3. Entity details (fields are DRAFT proposals)

### 3.1 `users` — account identity
| Field (draft) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `email` | citext unique | Login identifier; normalized/lowercased. |
| `password_hash` | text | Never returned by any API; never logged. |
| `role` | enum | `INVESTOR`, `STAFF`, `ADMIN`. |
| `status` | enum (DRAFT) | e.g. `ACTIVE`, `DISABLED` — final vocabulary pending contracts. |
| `last_login_at` | timestamptz null | |
| `created_at` / `updated_at` | timestamptz | |

### 3.2 `investor_profiles` — investor profile (1:1 with `users`)
Field set per **D-06 v1 baseline** (living handoff; later updates as v1.1+ under change control): first name, last name, and optional mobile phone where collected/approved. Email is the account identifier on `users` (its edit behaviour is a frontend/backend coordination decision — not silently implemented). The split-name direction is now aligned with Emmanuel's registration UI. **No identity/KYC-shaped, date-of-birth, address, nationality/residency, tax, consent or other unapproved fields exist here** (the D-06 v1 unapproved list in the decisions register must not enter this schema). Profile-completion information is optional and its calculation is **unapproved**.

**Registration mapping (D-06 v1):** a successful investor registration conceptually creates (1) the `users` account record (email + credentials) and (2) the associated `investor_profiles` record carrying `first_name` / `last_name` — to be written **atomically in one database transaction** when implemented (later phase; not now, no phone/KYC/compliance fields are added). **Registration session issuance / auto-login is a frontend/backend coordination decision — not yet approved** (D-06 v1 flow: success → confirmation → `/login`).

| Field (draft) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users, unique | Ownership anchor. |
| `first_name` | text | D-06 v1 (registration + profile; split-name direction aligned with the frontend). |
| `last_name` | text | D-06 v1 (split-name direction aligned with the frontend). |
| `phone` | text null | Optional mobile phone number, where collected/approved — D-06 v1. |
| `updated_at` | timestamptz | |

### 3.3 `applications` — onboarding application
| Field (draft) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `investor_user_id` | uuid FK → users | Ownership anchor; all investor queries scope by this. |
| `investment_solution_id` | uuid FK null → `investment_solutions` | D-06 v1 onboarding **solution selection** (one of the three frozen solutions). A selection is **not** an investable-product purchase, trade, investment instruction, mandate or IMS operation. No amount/rate/yield/fee/tenor/minimum/liquidity/return/settlement/execution fields exist; `investment_solutions` is **not** merged with `products`. |
| `status` | enum (DRAFT) | Candidate vocabulary: `DRAFT`, `SUBMITTED`, `IN_REVIEW`, `INFO_REQUESTED`, `APPROVED`, `REJECTED`. **OPEN ITEM (Decision D-08):** the candidate transition actions (APPROVE / REQUEST_INFO / REJECT) do not produce `IN_REVIEW`; the complete state map — a `START_REVIEW`-style action, another approved mechanism, or removal of `IN_REVIEW` — is **DRAFT — REQUIRES TEAM APPROVAL**. No application state-transition logic is implemented until the complete state map is approved. |
| `submitted_at` | timestamptz null | Set on first submit; also the derivation source for the staff investor-list `submittedAt` display (read/derived — never duplicated). |
| `created_at` / `updated_at` | timestamptz | |

**API ↔ model mapping:** the contract exposes `investmentSolutionSlug` (allowed values: `fixed-note`, `discretionary-portfolios`, `execution-mandate`), persisted as `investment_solution_id` referencing `investment_solutions` (slug-keyed seed rows). `investment_solution_id` **MAY remain unset** while the application is an initial empty DRAFT shell; a valid selection is **required before the application can be successfully submitted** (D-06 v1 baseline). This does **not** make documents, consent text, KYC fields or other still-unapproved items mandatory, and submit-validation is not implemented while **D-08** and the completeness decisions remain open.

### 3.4 `application_status_history` — append-only transitions
| Field (draft) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `application_id` | uuid FK | |
| `from_status` / `to_status` | enum | Same vocabulary as applications. |
| `actor_user_id` | uuid FK → users | Investor (submit) or staff (review). |
| `note` | text null | Optional transition note (e.g., info request reason). |
| `created_at` | timestamptz | No `updated_at`: immutable. |

### 3.5 `application_notes` — internal staff notes
| Field (draft) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `application_id` | uuid FK | |
| `author_user_id` | uuid FK → users | Must be `STAFF`/`ADMIN` (enforced server-side). |
| `body` | text | Internal-only; never exposed to investors in MVP contracts. |
| `created_at` | timestamptz | Immutable. |

### 3.6 `documents` — private document metadata (object storage = Firebase Cloud Storage, later)
| Field (draft) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `owner_user_id` | uuid FK → users | Investor who owns the document. |
| `application_id` | uuid FK null → applications | Optional association. |
| `category` / `category_key` | text — vocabulary **TBD** | **Vocabulary TBD through approved document requirements / future D-06 change.** Concrete values (e.g., `IDENTIFICATION`, `PROOF_OF_ADDRESS`, `APPLICATION_SUPPORTING`, `OTHER`) are **not approved** and must not become implementation truth. Exact document inventory, requiredness and categories are business/compliance decisions. |
| `storage_provider` | text (DRAFT) | e.g. `firebase_cloud_storage` (target), `local_dev` (dev adapter). |
| `storage_path` | text | Internal object key; **never** a public URL; never derivable by other users. |
| `original_filename` | text | |
| `mime_type` | text | Validated server-side against an allowlist — **file policy (allowed types, size caps) remains subject to contract approval**; any example types/sizes are illustrative only, not approved values. |
| `size_bytes` | bigint | Validated server-side — **final size cap remains subject to contract approval**. |
| `checksum` | text null | Optional integrity hash. |
| `uploaded_by_user_id` | uuid FK → users | Investor or staff-on-behalf (audit distinguishes). |
| `review_status` | text — vocabulary **TBD** | Review labels/outcomes: **TBD — BUSINESS / COMPLIANCE + CONTRACT APPROVAL REQUIRED**. Concrete values (`PENDING_REVIEW`, `ACCEPTED`, `REJECTED`) are **not approved**. |
| `status` | text — vocabulary **TBD** | Lifecycle, replacement and retention/deletion rules are business/compliance decisions (**TBD — BUSINESS / COMPLIANCE + CONTRACT APPROVAL REQUIRED**); access must remain revocable. |
| `created_at` / `updated_at` | timestamptz | |

Binary content is **never** stored in PostgreSQL. `storage_path` + provider adapter resolves the object at access time, behind authorization. **Approved MVP direction (recorded post-review):** uploads are backend-mediated through the API; downloads require backend authorization and short-lived authorized access; there are no permanent public document URLs. Firebase Cloud Storage is configured only in a later approved phase — not yet.

### 3.7 `investment_solutions` — public catalogue (seeded; slugs/names frozen)
| Field (draft) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text unique | **`fixed-note`, `discretionary-portfolios`, `execution-mandate` — frozen.** |
| `name` | text | **Starfetch Fixed Note / Starfetch Discretionary Portfolios / Starfetch Execution Mandate — frozen.** |
| `short_description` | text | Public copy sourced from approved marketing text. |
| `long_description` | text null | |
| `category` | text null | Descriptive grouping only. |
| `risk_description` | text null | Qualitative copy only — **no ratings invented.** |
| `typical_use` | text null | |
| `display_order` | int | |
| `active` | boolean | |

**Deliberately absent:** rates, yields, fees, tenors, minimums, returns, guarantees. None have been supplied; none will be added silently.

### 3.8 `products` — investable-product records (portal)
| Field (draft) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `solution_id` | uuid FK null → investment_solutions | Optional association; `DRAFT` (see §5). |
| `name` | text | Seeded demo names only. |
| `description` | text null | |
| `currency` | char(3) null | No values asserted yet. |
| `status` | enum (DRAFT) | e.g. `ACTIVE`, `INACTIVE`. |
| `is_demo` | boolean | Synthetic records only in MVP. |

Financial-term attributes (rates, fees, tenors, minimums, liquidity) are **FUTURE** additions, introduced only when the business supplies real values and contracts are updated through the change process.

### 3.9 `portfolios` / 3.10 `holdings` — synthetic demo
`portfolios`: `id`, `investor_user_id` FK (ownership anchor), `name`, `currency` null, `is_demo = true`, timestamps. No computed valuations; any value display comes from seeded fields, not calculations.
`holdings`: `id`, `portfolio_id` FK, `instrument_label` (text), `quantity` null, `value_minor` null + `currency` (seeded demo values), `as_of` date, `is_demo = true`.

### 3.11 `transactions` — synthetic demo history
| Field (draft) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `portfolio_id` | uuid FK | Ownership resolved via portfolio → investor. |
| `direction` | enum (DRAFT) | `CREDIT`, `DEBIT` — deliberately generic; no invented financial semantics. |
| `label` | text | Display description of the demo entry. |
| `amount_minor` | bigint | |
| `currency` | char(3) | |
| `status` | enum (DRAFT) | e.g. `POSTED`, `PENDING` (synthetic only). |
| `occurred_at` | timestamptz | |
| `is_demo` | boolean | Always true in MVP. |

D-06 v1 display needs map as: Date → `occurred_at`; Description → `label`; Direction/type → `direction`; Amount (where supplied) → `amount_minor`; Status (where supplied) → `status`; persistent sample indicator → `is_demo`.

### 3.12 `statements` — sample statements
`id`, `investor_user_id` FK (ownership anchor), `period_label` (text — retained), **`display_name`** (text — human-readable statement name shown in the UI; D-06 v1; "View"/"Download" action labels come from the UI), `document_id` FK null → `documents` (if a statement file object exists, it reuses the document security model), `is_demo = true`, timestamps. All MVP statements remain **SAMPLE / SYNTHETIC** (view/download of seed references only). **No statement-generation, production financial-statement formatting, or accounting/reporting logic is designed.**

### 3.13 `audit_events` — append-only audit
| Field (draft) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `actor_user_id` | uuid FK → users | |
| `actor_role` | enum | Snapshot of role at action time. |
| `action` | text | Stable machine-readable verb, e.g. `application.transitioned`, `document.downloaded`, `document.reviewed`. |
| `entity_type` / `entity_id` | text / uuid | Subject of the action. |
| `metadata` | jsonb null | Minimal safe context (e.g., from/to status). **Never** secrets, tokens, or file contents. |
| `created_at` | timestamptz | Immutable; no update/delete paths in application code. |

---

## 4. Ownership and access model (summary)

- Every investor-owned record chain resolves to a `users.id`: profile (`user_id`), applications (`investor_user_id`), documents (`owner_user_id`), portfolios → holdings/transactions (`investor_user_id` via portfolio), statements (`investor_user_id`).
- Investor queries are **scoped by the authenticated user id**; staff queries are role-gated. This is the structural defence against investor-to-investor access.
- Staff-authored content (`application_notes`, transitions) records `actor_user_id`; audit events mirror material actions.

---

## 5. Public Investment Solution vs Investable Product (documented, not finalized)

- **`investment_solutions`** = public, marketing-level descriptions consumed by the website. Three rows, frozen names/slugs.
- **`products`** = internal investable-product records consumed by the investor portal.
- They are **not assumed to be the same entity**. A nullable `products.solution_id` link is proposed to express "this product belongs to this solution family" if the business later wants that relationship — `DRAFT — REQUIRES TEAM APPROVAL`.
- Phase 1 does not collapse, split, or enrich either entity beyond this; the distinction is documented here for team review exactly as instructed.

---

## 6. Future entities (named only — NOT modelled, NOT MVP)

Listed so nobody mistakes them as missing from MVP scope; each arrives with its own approved contracts/design phase:

- External-provider references: identity-verification records, notification deliveries, payment/banking/virtual-account records, market-data snapshots.
- **Future proprietary IMS entities, rules and persistence structures: TBD** — these will be defined only from the approved Starfetch IMS specification when it is provided. No IMS entities, tables, fields or rules are designed, modelled or anticipated in this document; §7 of the architecture document reserves only a service/integration boundary, not a persistence topology (TBD — REQUIRES FUTURE IMS ARCHITECTURE).

---

## 7. PostgreSQL suitability

- Relational integrity: ownership chains (users → profiles/applications/documents/portfolios…), status history and audit fit foreign keys and transactional writes naturally.
- Consistency: multi-write use cases (transition + history + audit) commit atomically.
- Query patterns: staff review queues (filter by status/date/paginate), investor dashboards scoped by owner — straightforward indexed relational queries.
- Auditability: immutable history/audit tables, check constraints, and enum domains.
- Growth: PostgreSQL fully serves the MVP and is expected to host future provider-reference data. **Future proprietary IMS persistence/deployment topology: TBD — REQUIRES FUTURE IMS ARCHITECTURE.** Whether the IMS uses the same database, separate schemas, separate persistence, or another internal architecture is decided only from the approved IMS specification — not selected here.

**Reminder:** this document is a logical model only. No database, schema, or migration exists yet.
