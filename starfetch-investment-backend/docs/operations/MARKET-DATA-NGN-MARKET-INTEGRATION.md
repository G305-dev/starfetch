# Public market data — NGN Market integration (backend)

Status: **implemented, disabled by default, NOT production-ready.** Public enablement is blocked until
NGN Market redistribution rights are confirmed in writing (see §9) and the live checks in §10 pass.

## 1. What it does

`GET /api/v1/public/market-snapshot` (public, no login, read-only) returns a delayed snapshot of the 14
homepage NGX equities plus NGX summary indicators **only** where NGN Market supplies them. The response is
served from a shared Upstash Redis cache. The provider is called only when the cache is due, by a single
instance holding a distributed lock, within a hard, attempt-counted budget and one overall deadline.

Module: `src/modules/market-data/` (isolated; depends only on `ConfigModule`, the global rate-limit guard and
the shared error envelope). Nothing else imports it.

| Provider call | Purpose | Plan |
|---|---|---|
| `GET https://api.ngnmarket.com/v1/companies?limit=200&sort=market_cap&order=desc` | equities (one call covers all listed companies) | Free |
| `GET https://api.ngnmarket.com/v1/market/snapshot` | ASI, ASI change/%, market capitalisation (latest trading day) | Free |

The base URL is a code constant, so a bad environment variable cannot send the key to another host.
Redirects are refused.

## 2. Environment variables (server-side only; never `NEXT_PUBLIC_*`)

| Variable | Required to enable | Default | Notes |
|---|---|---|---|
| `MARKET_DATA_ENABLED` | yes (`true`) | off | Master switch. Only the exact string `true` enables. |
| `MARKET_DATA_REDISTRIBUTION_APPROVED` | yes (`true`) | off | Set **only** after written NGN Market permission or a plan that includes redistribution rights. Keep unset/false until then. |
| `NGN_MARKET_API_KEY` | yes | — | Mark as *Sensitive* in Vercel. Never logged or returned. |
| `MARKET_DATA_REDIS_REST_URL` | yes | — | HTTPS Upstash REST URL of the **existing** Upstash database (the same value as `CORPORATE_O2_RATE_LIMIT_REDIS_REST_URL`). No new database. |
| `MARKET_DATA_REDIS_REST_TOKEN` | yes | — | Token for that same database (≥16 chars). |
| `MARKET_DATA_REFRESH_INTERVAL_SECONDS` | no | `1800` | Trading-window interval, 1200–7200. Out of range or malformed = disabled (fail closed). |
| `MARKET_DATA_MONTHLY_CALL_BUDGET` | no | `2400` | 100–2700. Above the 2,700 code ceiling = disabled (fail closed). |

Missing or invalid values **never break startup**. The module resolves to `disabled`, logs one warning
with a reason code (never a value), and the endpoint returns 503 `FEATURE_UNAVAILABLE`. Nothing is called
at startup: the Upstash client connects lazily and the provider is only called from a request.
`validateEnv` is unchanged, and the health endpoint does not depend on this module.

Dedicated `MARKET_DATA_REDIS_*` names (pointing at the same Upstash instance) keep this feature's enablement
and rotation independent of Corporate O2. Without Redis the integration stays disabled; it never calls the
provider without a shared lock and budget.

## 3. Redis key namespace (isolated)

Every key is under `sf:market-data:v1:`. Other prefixes (e.g. the Corporate O2 limiter's
`sf:corporate:o2:rate:v1:`) are never read or written.

| Key | Type / TTL | Purpose |
|---|---|---|
| `sf:market-data:v1:snapshot` | JSON string, 8 days | Normalised 14 equities + optional summary, with Starfetch refresh timestamps. |
| `sf:market-data:v1:snapshot-version` | epoch ms, 8 days | `refreshedAt` of the stored snapshot; the write script only accepts strictly newer snapshots. |
| `sf:market-data:v1:refresh-lock` | `SET NX PX 15000` (token) | Single-flight refresh across Vercel instances. Never renewed. Owner-only (compare-and-delete) release. |
| `sf:market-data:v1:cooldown` | string reason, PX | Pauses all provider calls (auth failure, rate limit, quota, budget, failure backoff, manual stop). Only ever extended, never shortened. |
| `sf:market-data:v1:budget:month:YYYY-MM` | counter, 40 days | Attempts in the Africa/Lagos calendar month. |
| `sf:market-data:v1:budget:day:YYYY-MM-DD` | counter, 2 days | Attempts in the Africa/Lagos day. |
| `sf:market-data:v1:budget:provider-period` | hash, 40 days | Attempts in the provider's quota period: `end` (validated `reset_at`, epoch ms; 0 = unknown), `count`, `next`, `start`. |

Preview and Production deployments that point at the same Upstash database share these keys. This is
intentional: every NGN Market key on the account draws from one quota pool, so the budget must be shared too.

## 4. Refresh cadence, deadline and lock

- **Cadence:** 30 min during the weekday 09:00–16:30 WAT window, 4 h otherwise (weekends included). Public
  holidays are not modelled; they cost a few extra calls.
- **Overall deadline: 6 s from the start of the request** that triggers a refresh. It covers the cache read,
  cooldown check, lock acquisition, double-check under the lock, every provider attempt and retry, budget
  reservations, provider-period recording, cooldown writes and the cache write. Every Redis step is raced
  against the remaining time. No step starts after the deadline, and a step that settles after it stops the
  refresh.
- **Provider attempts:** each attempt's timeout is `min(5 s, time left − 1 s write reserve)`. An attempt (or a
  retry, including its 500 ms backoff) only starts if at least 1.5 s of that window remains. The window is
  re-checked after the budget reservation. In practice a timed-out first attempt ends the refresh (no retry),
  and the optional `/market/snapshot` call is skipped when `/companies` was slow. The previous summary is then
  kept, with its own refresh time.
- **Lock:** TTL 15 s, which is more than the 6 s deadline + 0.5 s release wait + 8 s margin. It is never
  renewed. The budget reservation script refuses an attempt (`LOCK_LOST`) unless the caller still owns the
  lock, so an instance whose lock expired makes no further provider call. The cache write script checks
  ownership **and** that the snapshot is newer, so an expired holder cannot overwrite newer data. Release is
  owner-only, so it cannot delete another instance's lock. A crashed refresh is recovered automatically when
  the lock expires (≤15 s). Attempts it already reserved stay counted.
- **Double-check, atomic reservation, fail-closed:** unchanged. Any Redis error means no provider call.

Measured with real timers through the real `AppModule` (synthetic provider and Redis):

| Case | Backend time |
|---|---|
| Cache hit | ≈ 6 ms |
| Successful refresh (fast provider) | ≈ 50 ms |
| 5xx then retry | ≈ 0.5 s |
| Provider hangs | ≈ 5.0 s (one attempt, no retry) |
| Redis hangs mid-refresh | ≈ 6.5 s (deadline + bounded release wait) |
| **Worst case (design bound)** | **≤ 6.5 s** plus framework overhead |

**Vercel:** the repository has no `vercel.json`/`maxDuration`, so the project default applies. Vercel
documents a 300 s default for current Hobby and Pro projects. The 6.5 s bound also fits a legacy 10 s limit.
No Vercel configuration change is needed or made. If the function were ever killed mid-refresh, the lock
expires, the cache is untouched (writes are atomic and guarded) and the next request recovers.

## 5. Quote freshness vs cache freshness

Two independent checks:

1. **Per-quote maximum (7 days, from each equity's own `quoteTimestamp`)**, enforced when the provider
   response is normalised **and** on every response:
   - Exactly 7 days old is served. 1 ms older becomes `available: false`,
     `unavailableReason: "QUOTE_EXPIRED"`, with nulls.
   - A fresh fetch containing an old quote does not make that quote look fresh.
   - If no equity in a response remains available, the endpoint returns 503 (`QUOTES_EXPIRED`, or the refresh
     reason). Old quotes are never shown as current.
   - Not extended while the provider is down.
2. **Cache-age safeguard (7 days from `cache.refreshedAt`)**: a cached document refreshed more than 7 days ago
   is never served. `status: "stale"` / `cache.isStale` means the cache missed its refresh (interval + 10 min
   grace).

**Timestamp validation:** quote timestamps must be strict ISO-8601/RFC 3339 instants. That means a full
date, `T`, seconds, and an explicit `Z` or `±HH:MM` offset. Rolled-over calendar dates (31 April, 29 February
in a non-leap year, leap seconds) are rejected, and the instant may not be later than the server clock by
even 1 ms (zero tolerance, never clamped).
- A missing, invalid or future timestamp makes **only that equity** unavailable
  (`MISSING_QUOTE_TIMESTAMP` / `INVALID_QUOTE_TIMESTAMP` / `FUTURE_QUOTE_TIMESTAMP`).
- An invalid price gives `INVALID_PRICE`.
- Nothing is substituted: never `generatedAt`, `refreshedAt`, the current time or another equity's timestamp.

**Market closures:** no trading or holiday calendar is assumed. Weekend and holiday quotes under 7 days old
stay available, labelled delayed, with their real `quoteTimestamp` and `quoteAgeSeconds`. Data is never
labelled live.

The market summary is withheld when its trading date is later than today (Lagos) or more than 7 days earlier,
or when its `updated_at` is older than 7 days.

**Summary trading date format:** `/v1/market/snapshot` returns `date` as UTC midnight of the trading day
(`2026-11-24T00:00:00.000Z`, observed in a private provider test). The backend also accepts a plain `2026-11-24`.
Both are normalised to `tradingDate: "2026-11-24"`; the calendar date is taken as written, with no timezone
conversion. Any other time or offset (e.g. `T09:40:00.000Z`, `T00:00:00+01:00`) is rejected, never truncated;
the summary is then `null` while the equities are unaffected.

## 6. Budget strategy (Free plan: 3,000 calls per quota period, 30/min, shared by all keys)

- **Every attempt is reserved before it is made** in one atomic Lua `EVAL`. The order is: lock ownership,
  cooldown, Lagos monthly cap, provider-period cap, Lagos daily cap, then increment. Failures, timeouts and
  retries all count.
- Monthly cap 2,400 (code ceiling 2,700), so at least 600 calls stay as headroom for other keys and manual use.
  Daily cap = ceil(monthly/20) = 120. No cap was raised.
- **Provider billing period:**
  - NGN Market documents that quotas reset on the account's **billing renewal date**, reported in
    `meta.reset_at` (an ISO 8601 UTC timestamp), not at the calendar month start.
  - The module therefore keeps the Lagos-month counter **and** a provider-period counter. The stricter wins,
    so a calendar-month rollover before renewal adds no capacity.
  - `reset_at` is used only if it is a strict instant in the future and at most 32 days ahead. Anything else is
    ignored and logged with a reason code only.
  - The first valid `reset_at` is adopted as the period end. A known end can only be extended (a later value),
    never shortened or replaced early.
  - The period rolls over only at `reset_at + 1 h` (a conservative window for clock skew). Calls made after
    `reset_at` but before then are carried into the new period.
  - If no valid `reset_at` is ever seen, the period counter rolls over at most once per 31 days + 1 h, and the
    calendar caps still apply.
- **Provider guard:** if any response reports `meta.calls_remaining ≤ 300`, refreshes pause until the validated
  `reset_at` + 1 h (24 h if `reset_at` is missing or malformed). Re-checked every 24 h at most.
- **Error handling:**
  - Companies: at most 1 retry (timeouts, network errors, 5xx only, and only within the deadline). Snapshot:
    single attempt.
  - 401/403 → 1 h pause.
  - 429 `RATE_LIMITED` → pause for `Retry-After` (≤1 h).
  - 429 `QUOTA_EXCEEDED` → pause until `reset_at` + 1 h (24 h if malformed).
  - Other failures → 10 min pause.
  - No polling: refreshes happen only on demand when the cache is due.

Estimated **provider** calls, assuming continuous traffic (less traffic means fewer calls):

| Scenario | Calls |
|---|---|
| Weekday: ≤15 trading-window refreshes + ≤5 off-hours, × 2 calls | ≤ 40 / day |
| Weekend day: ≤6 refreshes × 2 | ≤ 12 / day |
| Month (23 weekdays + 8 weekend days), all calls succeed | **≈ 1,016** |
| Same month, every refresh also needs one retry (3 calls) | ≈ 1,524 |
| Sustained outage | bounded by daily cap 120 and monthly cap 2,400 |

Estimated **Upstash** commands (shared database with the Corporate O2 limiter):

| Item | Commands |
|---|---|
| Successful refresh: GET cache, GET cooldown, SET NX lock, GET double-check, 2× reserve EVAL, 1× period EVAL, write EVAL, release EVAL | ≈ 9 per refresh, ≈ 4,600 / month at ≈ 508 refreshes |
| Request reaching the origin with no warm 15 s memo | 1 GET |
| Origin requests | bounded by the CDN (`s-maxage` ≤ 60 s per cache key/region), the 15 s per-instance memo and the 120/min per-IP limit. Continuous traffic through one region ≈ 1 GET/min ≈ 45,000 / month |

Compare the total with the plan of the existing Upstash database in its dashboard before enabling.

## 7. Response semantics

- `equities[].quoteTimestamp` = provider `last_updated` (normalised to UTC). `cache.refreshedAt` = when
  Starfetch fetched it. `generatedAt` = when this response was produced. `quoteAgeSeconds` (additive field) =
  `generatedAt − quoteTimestamp`.
- **Cache-Control:**
  - Success: `public, max-age=N, s-maxage=N` with N ≤ 60. N is reduced so that no browser or CDN can serve a
    response after any quote in it passes 7 days, or after the cache passes the 7-day safeguard. If N would be
    0, the success response carries `no-store`.
  - Errors are always `no-store`.
- **Status codes:**
  - No servable data → 503 `SERVICE_UNAVAILABLE`, with `context.reason` and `context.retryAfterSeconds` plus a
    matching `Retry-After` header:

    | Reason | Retry-After |
    |---|---|
    | `REFRESH_IN_PROGRESS` | 5 |
    | `REFRESH_FAILED` | 300 |
    | `REFRESH_PAUSED` | 300 |
    | `CACHE_UNAVAILABLE` | 60 |
    | `QUOTES_EXPIRED` | 300 |

  - Disabled → 503 `FEATURE_UNAVAILABLE`.
- Redis failure → no provider call ever. Cached data already read is served as stale; otherwise
  `CACHE_UNAVAILABLE`.
- No mock or fallback prices, no computed summaries, no assumed `market_cap` unit. Unavailable symbols carry
  nulls and an `unavailableReason`. New reason values are additive.
- Labelled `dataType: "delayed"`; never "live" or "real-time". Attribution is in every success response.
- Per-IP rate limit 120 requests/min (existing in-memory guard). There is a 15 s per-instance memo of Redis
  reads.

## 8. Activation, health checks, emergency stop and rollback

Activation (only after §9 and §10):
1. In Vercel (Production only first), add the variables in §2. Use the existing Upstash URL and token.
2. Redeploy. Call `GET /api/v1/public/market-snapshot` once. Expect `200`, `status: ok`, 14 equities, and
   `Cache-Control: public, max-age≤60`.
3. Check Upstash: only `sf:market-data:v1:*` keys added. `budget:month:*` ≈ 2 after the first refresh.
   `budget:provider-period` has `end` = the provider renewal time.
4. Health: `GET /api/v1/health` must stay `200` whatever the market-data state. Watch logs for
   `Market data …` warnings and the NGN Market dashboard usage for 24 h.

Emergency stop (no redeploy): `SET sf:market-data:v1:cooldown MANUAL PX <ms>`.
- All provider calls pause. Cached data keeps being served (labelled stale), and each quote still expires
  after 7 days.
- To lift the stop early, `DEL sf:market-data:v1:cooldown`. Cooldowns are never shortened by the code.

Rollback (no code deploy required):
- Set `MARKET_DATA_ENABLED=false` (or remove it) and redeploy. The endpoint returns 503 `FEATURE_UNAVAILABLE`
  (`no-store`), with zero Redis or provider calls.
- **CDN effect:** a success response cached before disabling can still be served by browsers or the Vercel CDN
  for at most its `max-age`/`s-maxage` (≤ 60 s). Expect up to 60 s of previously cached data after disabling.
  No error response is ever cached.
- Optional cleanup: delete `sf:market-data:v1:*` keys (including `snapshot-version`). Do not touch other
  prefixes. If you delete `snapshot`, also delete `snapshot-version`.
- Full removal: revert the module, the `marketData` config block and the `MarketDataModule` import.

## 9. Licensing, attribution and redistribution (blocking)

From the NGN Market Terms of Service (updated January 2026), read in full:
- §8 API: keys are non-transferable and must not be in public code. No selling, sublicensing or **transferring
  API data to third parties**. **Public-facing products must clearly attribute NGN Market as the data source.**
- §10 Prohibited conduct includes "resell, sublicense, **redistribute**, or commercially exploit" Content.
- §11 licence is for "personal or internal business purposes" only.
- §14 data is provided "as received", with no accuracy or timeliness warranty. §13 not financial advice.
- Pricing lists **"data redistribution rights"** as a Business-plan feature.

Showing NGN Market prices on the public Starfetch website is therefore likely to need **written permission
from NGN Market or a plan that includes redistribution rights.** Keep `MARKET_DATA_ENABLED` and
`MARKET_DATA_REDISTRIBUTION_APPROVED` unset or false until that is confirmed in writing, and record the
approval reference. There is no bypass and no hardcoded approval. Any display must show the
`provider.attribution` text and keep the delay notice.

## 10. Live verification still required (not testable offline)

Pending (not performed; no credentials were used):
- Real `/companies` and `/market/snapshot` responses match the documented shapes. Check that `last_updated`
  and `updated_at` carry an explicit `Z`/offset, as the docs show (`2026-04-21T14:30:00.000Z`). The code makes
  any other format unavailable.
- All 14 symbols appear in the live `/companies` response. API coverage is confirmed only for DANGCEM, GTCO,
  MTNN, ZENITHBANK, UBA and ACCESSCORP.
- Unit of `market_cap` values (undocumented) before any market-cap display.
- `meta.calls_remaining`/`reset_at` behaviour, and that `reset_at` equals the account's billing renewal date.
- Upstash EVAL/HSET/SET NX behaviour on the production database. Validated locally against Redis 8, not
  against Upstash itself.
- CDN honouring the dynamic `s-maxage`, and the observed backend duration of a refresh on Vercel.

**Private provider check for David (2 provider calls, no deployment, no flag changes, nothing written to
Redis):**

```bash
# In a private terminal. The key is read from a prompt and never echoed or stored in history.
read -rs NGN_MARKET_API_KEY && export NGN_MARKET_API_KEY
curl -sS -H "Authorization: Bearer $NGN_MARKET_API_KEY" \
  'https://api.ngnmarket.com/v1/companies?limit=200&sort=market_cap&order=desc' \
  | jq '{success, meta, n: (.data.data|length),
         missing: (["ACCESSCORP","AIRTELAFRI","ARADEL","BUACEMENT","BUAFOODS","DANGCEM","FIRSTHOLDCO","GTCO","MTNN","NB","NESTLE","SEPLAT","UBA","ZENITHBANK"] - [.data.data[].symbol]),
         sample: [.data.data[] | select(.symbol=="DANGCEM") | {symbol, price, price_change_percent, last_updated, market_cap}]}'
curl -sS -H "Authorization: Bearer $NGN_MARKET_API_KEY" 'https://api.ngnmarket.com/v1/market/snapshot' \
  | jq '{success, meta, date: .data.date, asi: .data.asi, updated_at: .data.updated_at, market_cap: .data.market_cap}'
unset NGN_MARKET_API_KEY
```

Record the following, and **do not share the key or full responses publicly**:
- `missing` should be `[]`.
- The `last_updated`/`updated_at` format.
- `meta.reset_at` vs the billing date in the NGN Market dashboard.
- `calls_remaining`.

End-to-end endpoint verification needs both flags, so it waits for the licensing decision. Never enable on
Production for testing.
