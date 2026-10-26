# Starfetch Investment Limited — Backend (`starfetch-investment-backend`)

**Phase 2A — Backend Foundation Scaffolding.** This service intentionally contains **only** the API foundation: project wiring, configuration, `/api/v1` prefix, health endpoint, global validation, safe centralized errors, request-ID propagation, HTTP security headers, CORS-by-config, and Prisma/PostgreSQL **tooling** (no business models).

> ⚠️ **Scope statements (read first)**
> - **Authentication is NOT implemented** (approved direction recorded in Phase-1 docs; implementation belongs to a later phase).
> - **No business endpoints exist** — no registration/login, applications, documents, products, portfolio, transactions, statements, staff or admin APIs.
> - **Firebase is NOT configured.** Private-document storage (Firebase Cloud Storage) arrives in a later approved phase.
> - **No external integrations** (BVN/NIN/KYC, banking, payments, market data, messaging, custodians, external IMS).
> - **No IMS functionality** (proprietary Starfetch IMS is a future project; its persistence topology is `TBD — REQUIRES FUTURE IMS ARCHITECTURE`).
> - **No Prisma business models or migrations** — business schema waits on open decisions **D-08** (application state map) and **D-09** (one-active-application semantics), plus document-vocabulary and business/compliance approvals.
> - **PostgreSQL configuration is required for database work**, but the Phase 2A scaffold boots and passes health checks **without** a database.

## Requirements

- Node.js **>= 20** (tested on v20).
- npm **>= 10**.
- PostgreSQL 14+ **only for later phases** (not needed to run this scaffold).

## Installation

```bash
npm install
```

(Phase 2A: no `prisma generate` runs at install time — the schema intentionally has zero business models; see "Prisma" below.)

## Environment setup

```bash
cp .env.example .env
```

| Variable | Required now? | Purpose |
|---|---|---|
| `NODE_ENV` | No (defaults `development`) | `development` / `test` / `staging` / `production` |
| `PORT` | No (defaults `4000`) | API listen port (binds `0.0.0.0`) |
| `DATABASE_URL` | **No** | PostgreSQL connection string; validated for shape when provided; required only for later database phases |
| `CORS_ORIGINS` | No | Comma-separated browser origins; empty = deny cross-origin browser access (mobile does not use CORS) |
| `API_VERSION` | No (defaults `0.0.1`) | Version string returned by `GET /api/v1/health` |

Invalid values (bad `NODE_ENV`, bad `PORT`, malformed `DATABASE_URL`) fail fast with a clear error at boot. **Never commit `.env` or any real secrets** (see `.gitignore`).

## Run

```bash
npm run start:dev      # watch mode (development)
npm run start          # one-shot (development)
npm run build          # compile to dist/
npm run start:prod     # run compiled output
```

Verify (default port `4000`):

```bash
curl -i http://localhost:4000/api/v1/health
# 200 OK
# { "data": { "status": "ok", "version": "0.0.1" }, "meta": { "requestId": "…" } }
```

Every response carries an `x-request-id` header; clients may supply their own (safe values only) and it is echoed back.

## Test / verify

```bash
npm run typecheck       # tsc --noEmit
npm run lint            # eslint (flat config)
npm test                # unit tests (jest)
npm run test:e2e        # e2e: health envelope, 404 safety, request-ID behaviour
```

## Prisma (safe commands at this stage)

```bash
npx prisma validate     # validate schema.prisma (passes in Phase 2A)
npm run prisma:generate # regenerates the client once models exist
```

Note: in Phase 2A the schema intentionally contains **zero business models**, so `prisma generate` exits with a "no models defined" notice **by design** — there is nothing to generate until the first approved model lands (after D-08/D-09 and vocabulary approvals). `PrismaService` therefore loads the generated client lazily.

### Application runtime vs Prisma CLI (`DATABASE_URL`)

- **Application runtime (Phase 2A):** the NestJS service boots and serves `/api/v1/health` **without** `DATABASE_URL`; an empty or unset value (`DATABASE_URL=` in `.env`) is treated as "not configured". This behaviour is intentional and must not change.
- **Prisma CLI:** schema-level commands such as `npx prisma validate` (and later `generate`/`migrate`) parse the datasource **without needing a live database connection**, but still require a **syntactically valid, non-empty PostgreSQL URL** — an empty `DATABASE_URL=` fails validation with Prisma error **P1012** ("You must provide a nonempty URL").
- For schema validation, supply a **temporary, local-only placeholder URL**. It is **not a real credential**, does **not** mean a database exists or has been provisioned, and does **not** authorize any migration (`prisma migrate*` remains forbidden in this phase).

Windows PowerShell example:

```powershell
$env:DATABASE_URL="postgresql://user:password@localhost:5432/starfetch_phase2a"
npx prisma validate
Remove-Item Env:DATABASE_URL
```

bash/sh example:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/starfetch_phase2a" npx prisma validate
```

**Not safe yet / do not run:** `prisma migrate dev/deploy/reset` — there are intentionally **no business models** and **no provisioned database**. Business models arrive only after D-08/D-09 and the document/business-vocabulary approvals.

## Structure

```text
src/
├── main.ts                        # bootstrap (thin)
├── app.setup.ts                   # shared wiring (prefix/pipes/filter/interceptor/helmet/CORS/body limits)
├── app.module.ts                  # root module (+ request-ID middleware)
├── config/                        # configuration.ts + env.validation.ts (fail-fast, optional-later services)
├── common/
│   ├── middleware/request-id.middleware.ts
│   ├── filters/all-exceptions.filter.ts      # { error: { code, message, fields?, requestId } }
│   ├── interceptors/transform-response.interceptor.ts  # { data, meta }
│   ├── errors/error-codes.ts                 # foundation error-code vocabulary
│   └── types/request-with-id.ts
├── modules/
│   └── health/                    # GET /api/v1/health (+ unit test)
└── infrastructure/
    └── database/                  # PrismaService (connects only when configured; never crashes scaffold)
prisma/schema.prisma               # datasource+generator ONLY — no business models
test/health.e2e-spec.ts            # e2e foundation checks
docs at ../docs/api/openapi.yaml   # canonical contract (Phase 2A scope)
```

## Contract

Canonical API contract: **`../docs/api/openapi.yaml`** (Phase 2A scope: `/health` + common error envelope + request-ID conventions). The full business contract draft (`STARFETCH-API-CONTRACT-DRAFT.md`, Phase 1) is folded in endpoint-by-endpoint as each feature is approved and implemented — never sooner.

## Next phases (not started)

- Phase 2B+: authentication (approved direction), investor profiles, applications & documents (subject to D-08/D-09 and document-vocabulary approvals), staff workflow, demo portfolio/transactions/statements, audit.
