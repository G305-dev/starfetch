# Starfetch Investment Limited — Backend (`starfetch-investment-backend`)

**Phase 2A — backend foundation · Phase 2B — authentication & identity.** This service contains exactly the approved scope: project wiring, configuration, `/api/v1` prefix, health endpoint, global validation, safe centralized errors, request-ID propagation, HTTP security headers, allowlist CORS (+cookies), and — since Phase 2B — the authentication/identity flow:

```text
registration → email verification → login → session → refresh rotation → logout → GET /me
```

> ⚠️ **Scope statements (read first)**
> - **Only these endpoints exist:** `POST /auth/register`, `POST /auth/email/verify`, `POST /auth/email/resend`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /me`, `GET /health` (all under `/api/v1`).
> - **No other business APIs** — no applications, documents/KYC, products, portfolio, transactions, statements, staff or admin workflows. No OAuth (Google/Apple), no password reset, no email change.
> - **Firebase is NOT configured** (private-document storage arrives in a later approved phase).
> - **No external integrations** beyond the replaceable SMTP email adapter (no BVN/NIN/KYC, banking, payments, market data, SMS, push, custodians, external IMS).
> - **No IMS functionality** (`TBD — REQUIRES FUTURE IMS ARCHITECTURE`).
> - Prisma models are limited to the Phase-2B-authorized authentication/identity set (`User`, `InvestorProfile`, `EmailVerificationChallenge`, `AuthSession`, `RefreshToken` + `UserRole`). Business schema waits on **D-08** (OPEN), **D-09** (OPEN), and document/business vocabulary (TBD).
> - Security semantics are recorded in **`docs/backend/auth/AUTH-SECURITY-CONTRACT-v1.md`**, and implemented HTTP contracts in **`docs/api/openapi.yaml`**.

## Requirements

- Node.js **>= 20** · npm **>= 10**
- PostgreSQL **14+** (required since Phase 2B)
- Local email catcher for verification code delivery (e.g. **Mailpit**: `mailpit` → SMTP on `127.0.0.1:1025`)

## Installation & environment

```bash
npm install
cp .env.example .env   # then edit values locally — .env is gitignored
```

Generate strong local secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV` | defaults `development` | `development` / `test` / `staging` / `production` |
| `PORT` | defaults `4000` | API listen port (binds `0.0.0.0`) |
| `DATABASE_URL` | **Yes (since 2B)** | PostgreSQL system of record |
| `JWT_ACCESS_SECRET` | **Yes** | HS256 access-token signing (≥32 chars & non-placeholder in staging/production) |
| `CSRF_HMAC_SECRET` | **Yes** | CSRF token HMAC key |
| `EMAIL_VERIFICATION_HMAC_SECRET` | **Yes** | Verification-code HMAC key (secrets live outside the DB) |
| `ACCESS_TOKEN_TTL_SECONDS` | defaults `900` | Access JWT TTL (15 min) |
| `REFRESH_TOKEN_TTL_SECONDS` | defaults `604800` | Session absolute TTL (7 days) |
| `REFRESH_IDLE_TTL_SECONDS` | defaults `86400` | Sliding idle TTL (24 h) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | dev: optional (Mailpit default) · **staging/prod: required** | Verification-email transport |
| `SMTP_FROM` | defaults `Starfetch <no-reply@starfetch.local>` | Sender address |
| `SMTP_USER` / `SMTP_PASS` | optional | Authenticated relay only — never committed |
| `CORS_ORIGINS` | no | Browser origin allowlist (CORS + cookie-auth Origin policy). Empty = deny cross-origin browser access; mobile doesn't use CORS |
| `RATE_LIMIT_ENABLED` | defaults `true` (`false` under `NODE_ENV=test`) | Auth-route throttling |
| `API_VERSION` | defaults `0.0.1` | Version string from `GET /api/v1/health` |

Startup validation is **fail-fast**: missing/weak required configuration aborts boot (staging/production enforce secret strength).

## Database / migrations (Prisma)

```bash
# Create the local database, then apply the approved migration history:
createdb starfetch_dev
npx prisma migrate deploy          # applies prisma/migrations/* (Phase 2B: init_auth_identity)

# Evolve schema during development (only after phase authorization):
npm run prisma:migrate:dev         # prisma migrate dev (creates + applies new migration)
```

- The first and only migration so far: `*_init_auth_identity` (5 identity tables + `UserRole`). **No business tables exist.**
- `prisma:generate` regenerates the client after pulling new migrations.

### Application runtime vs Prisma CLI (`DATABASE_URL`)

- **Application runtime (Phase 2B):** `DATABASE_URL` is required at startup; a live connection is required for auth flows (registration/login/…). The app still **boots** if the DB is briefly unreachable, logging a loud warning — health stays up and auth endpoints fail safely via the error envelope.
- **Prisma CLI:** schema commands (`npx prisma validate`, and later `generate`/`migrate`) parse the datasource **without needing a live database**, but require a **syntactically valid, non-empty PostgreSQL URL** — an empty `DATABASE_URL=` fails validation with Prisma error **P1012** ("You must provide a nonempty URL").
- For schema validation, supply a **temporary, local-only placeholder URL**. It is **not a real credential**, does **not** mean a database exists or has been provisioned, and authorizes no migration.

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

## Email delivery (local development)

Authentication talks to an `EmailProvider` port only. Default adapter is generic SMTP — point it at a local catcher and read verification codes from its UI:

```text
Mailpit:  docker run -p 8025:8025 -p 1025:1025 axllent/mailpit
.env:     SMTP_HOST=127.0.0.1 SMTP_PORT=1025 SMTP_SECURE=false
UI:       http://localhost:8025
```

No authentication business logic changes between local Mailpit and staging SMTP. Never commit real SMTP credentials.

## Running

```bash
npm run start:dev     # watch mode
npm run start:prod    # after: npm run build
```

Health: `GET http://localhost:4000/api/v1/health` → `{ "data": { "status": "ok", "version": "…" }, "meta": { "requestId": "…" } }`

## Tests

```bash
npm test             # unit suites (no DB needed)
npm run test:e2e     # e2e against a REAL test PostgreSQL
npm run lint && npm run typecheck && npm run build
```

E2E requirements: create a dedicated **`starfetch_test`** database and apply migrations to it:

```bash
createdb starfetch_test
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/starfetch_test" npx prisma migrate deploy
```

The e2e bootstrap (`test/setup-env.ts`) defaults `DATABASE_URL` to the test database for tests and honours your own env vars (`??=`) — and tests truncate identity tables between cases. Throttling is disabled in the main suite for determinism; `test/rate-limit.e2e-spec.ts` re-enables it to verify the safe 429 envelope. Email delivery is driven through the `FakeEmailProvider` adapter (outbox inspection), so no SMTP server is needed in tests.

## Project layout

```text
src/
  main.ts / app.setup.ts / app.module.ts
  config/                 # configuration + fail-fast env validation
  common/                 # request-ID middleware, safe error filter, response envelope,
                          # rate-limit port + in-memory adapter + guard, utils
  infrastructure/database # PrismaService (PostgreSQL)
  modules/
    health/               # GET /api/v1/health
    auth/                 # controller (cookie transport only) + client-neutral services:
                          #   password (argon2id), access-token (jwt), session (rotation +
                          #   reuse detection), csrf (signed double-submit), email-verification
                          #   (HMAC-bound 6-digit codes) + EmailProvider port (SMTP + fake)
    me/                   # GET /api/v1/me (reusable bearer guard)
prisma/                   # schema.prisma + migrations (auth/identity only)
docs/                     # (repo root) api/openapi.yaml · backend/auth/AUTH-SECURITY-CONTRACT-v1.md
```

## Phase roadmap (implementation phases, authorized work only)

| Phase | Scope | Status |
|---|---|---|
| 2A | Backend foundation | ✅ Implemented & approved |
| 2B | Authentication & identity | ✅ Implemented (this state) |
| Later | Business APIs (applications/documents/products/portfolio/…, staff, admin) | ⛔ Not started — pending explicit authorization + D-08/D-09 and vocabulary decisions |
| Later | React Native mobile client (Android/iOS) consuming these same contracts | ⛔ Not started |

**Never** add endpoints, models, integrations or authorized-scope changes without an explicit task assignment from David/Emmanuel.
