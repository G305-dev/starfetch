# Emmanuel handoff — public market snapshot API

Backend PR #76 and frontend PR #75 have been merged into main.

Production testing on November 24, 2026 confirmed HTTP 200 and all 14 approved NGX equities. The frontend integration is complete, and the NGX prices have been displayed on the website.

The market summary date correction is pending deployment.

Public redistribution must remain disabled until the required NGN Market permission is confirmed. Both activation safeguards remain in place.

## Update â€” `fix/market-data-summary-date` (base `b876df5`)

Backend-only fix; **no contract change and nothing for you to change.**
- Production returned `marketSummary: null` even though all 14 equities were OK. NGN Market sends the summary
  trading date as UTC midnight (`"2026-11-24T00:00:00.000Z"`), but the backend accepted only `"2026-11-24"`.
- The backend now accepts both forms and always returns `marketSummary.tradingDate` as `YYYY-MM-DD` (`"2026-11-24"`),
  taken exactly as written with no timezone shift. Other times or offsets are still rejected, so
  `marketSummary` can still be `null`; keep the "â€”" fallback.
- Field names, types, `isStale`, the 7-day rule and the equities are unchanged. Keep `equityMarketCapitalisation`
  hidden (unit still unconfirmed).
- After deployment, `marketSummary` fills in at the next scheduled refresh (â‰¤30 min during weekday trading
  hours, â‰¤4 h otherwise, plus up to 60 s CDN cache).

## 1. Endpoint and auth

`GET {API_BASE}/public/market-snapshot`, for example
`https://starfetch-api.vercel.app/api/v1/public/market-snapshot`.

- Public, no login, no cookies or CSRF, read-only. CORS follows the existing API allow-list.
- Call it from the browser or from Next.js server code. **Never call NGN Market directly and never handle an
  NGN Market key in the frontend.**
- Rate limit: 120 requests/min per IP (429 `RATE_LIMITED` beyond that).

## 2. What changed since v1 (all backward compatible)

All v1 field names, the 14-symbol order, the envelope and the error codes are unchanged. Additions:

| Change | Where | What to do |
|---|---|---|
| New field `quoteAgeSeconds: number \| null` | each `equities[]` item | Optional to use: the quote's age at `generatedAt`. Null when unavailable. |
| New `unavailableReason` values: `MISSING_QUOTE_TIMESTAMP`, `INVALID_QUOTE_TIMESTAMP`, `FUTURE_QUOTE_TIMESTAMP`, `INVALID_PRICE`, `QUOTE_EXPIRED` | `equities[].unavailableReason` | Treat **any** unknown/new value as generic "unavailable". The reason is informational only. |
| New 503 reason `QUOTES_EXPIRED` | `error.context.reason` | Same handling as other 503s. |
| Success `Cache-Control` max-age is now **â‰¤ 60 s** (shorter only when a quote is close to its 7-day limit) | header | Nothing; just don't assume exactly 60. |
| Each quote is checked against a **7-day maximum from its own `quoteTimestamp`** | backend | Old quotes arrive as `available: false` (`QUOTE_EXPIRED`), never as current values. |
| Strict timestamp validation: a quote with a missing, malformed or future timestamp is unavailable | backend | Nothing; only that row is affected. |

Your `validation.ts` already uses `FUTURE_TOLERANCE_MS = 0` and rejects prices â‰¤ 0. The backend now matches
that (zero future tolerance, positive prices). Two differences:
- The backend caps prices at â‚¦10,000,000 (yours at 1e9).
- The backend nulls `dailyChangePercent` outside Â±100 % (yours allows âˆ’100â€¦1000). A nulled percent arrives as
  `null`, which your validator should accept.

## 3. Field mapping to the existing display model (no redesign)

| Existing field (`ngx-market-directory.ts`) | API field | Notes |
|---|---|---|
| `NgxEquityListing.symbol` | `data.equities[].symbol` | Always all 14 homepage symbols, same order as `featuredNgxEquities`. |
| `NgxEquityListing.companyName` | `data.equities[].companyName` | Same display names as the directory. |
| `NgxEquityListing.lastPriceNgn` | `data.equities[].lastPriceNgn` | NGN. `null` â†’ keep the existing "Quote pending" / "â€”". |
| `NgxEquityListing.dailyChangePercent` | `data.equities[].dailyChangePercent` | Percent (e.g. `1.01` = +1.01 %). `null` â†’ "â€”". Provider value, never computed. |
| `ngxMarketSnapshot.allShareIndex` | `data.marketSummary.allShareIndex` | `marketSummary` may be `null` â†’ keep "â€”". |
| `ngxMarketSnapshot.allShareIndexChangePercent` | `data.marketSummary.allShareIndexChangePercent` | |
| `ngxMarketSnapshot.marketCapitalisationNgn` | `data.marketSummary.equityMarketCapitalisation` | **Do not display.** The provider does not document the unit. Keep "â€”". |
| `ngxMarketSnapshot.dateLabel` | `data.marketSummary.tradingDate` | Provider trading date, always `YYYY-MM-DD` (calendar date; do not parse it as an instant or shift it). |
| `ngxMarketSnapshot.sourceLabel` | `data.provider.attribution` + "Delayed" | Attribution to NGN Market is **required** on any public display. |

## 4. Timestamps and freshness (read this before the UI work)

There are **three different timestamps**. They are not interchangeable:

| Field | Meaning | Use it for |
|---|---|---|
| `equities[].quoteTimestamp` | When NGN Market last updated that equity's price (per equity, may differ between equities). | "As of â€¦" next to prices. |
| `cache.refreshedAt` | When Starfetch last fetched from NGN Market. | Stale banner ("last refreshed â€¦"). Never as the quote time. |
| `generatedAt` | When the backend produced this response. | Debugging; ages are computed against it. |

`marketSummary` has its own `providerUpdatedAt`, `refreshedAt` and `isStale`.

**Cache freshness vs quote freshness:**
- *Cache freshness*:
  - `status: "stale"` / `cache.isStale: true` means Starfetch missed a scheduled refresh (in progress, failed or
    paused); `cache.staleReason` says which.
  - Refreshes run every 30 min on weekdays 09:00â€“16:30 WAT and every 4 h otherwise.
  - Stale data is still real, labelled data.
- *Quote freshness* (the 7-day rule):
  - Each equity is served only while its own `quoteTimestamp` is at most 7 days old. This is checked when
    fetched and again on every response.
  - Older quotes come back as `available: false`, `unavailableReason: "QUOTE_EXPIRED"` with nulls.
  - If no equity is left, the endpoint returns 503. The limit is never extended during provider outages.
- *Market closures*:
  - The backend does not know NGX holidays and does not invent a calendar. On weekends and holidays, the latest
    close stays available (under 7 days) with its real `quoteTimestamp`.
  - Show "As of Fri 23 Oct, 15:30" (from `quoteTimestamp`). Do not show "Market closed" unless you have your own
    source for it.
- The data is **delayed**, never live: NGN Market updates about every 20 minutes during trading hours, and
  Starfetch caches it.

## 5. Response examples

Shapes below were captured from the real NestJS app (real controller, filter and envelope) with **synthetic**
provider and Redis data. Prices are fake, and timestamps are shown on a fixed date for readability. `equities`
is abridged; the API always returns 14 rows. The constant fields are elided after the first example:
- `provider`: `{"name":"NGN Market","url":"https://ngnmarket.com","attribution":"Market data provided by NGN Market (ngnmarket.com)."}`
- `delayNotice`: "Delayed data. NGN Market refreshes prices approximately every 20 minutes during NGX trading
  hours; outside trading hours prices reflect the latest available close. Starfetch caches provider data and
  refreshes it periodically. Not investment advice."

### 5.1 Success (`200`, `status: ok`). Headers: `Cache-Control: public, max-age=60, s-maxage=60`

```json
{
  "data": {
    "status": "ok",
    "provider": { "name": "NGN Market", "url": "https://ngnmarket.com", "attribution": "Market data provided by NGN Market (ngnmarket.com)." },
    "dataType": "delayed",
    "delayNotice": "Delayed data. NGN Market refreshes prices approximately every 20 minutes during NGX trading hours; outside trading hours prices reflect the latest available close. Starfetch caches provider data and refreshes it periodically. Not investment advice.",
    "cache": {
      "refreshedAt": "2026-10-22T10:00:00.000Z", "ageSeconds": 300, "refreshIntervalSeconds": 1800,
      "nextRefreshDueAt": "2026-10-22T10:30:00.000Z", "isStale": false, "staleReason": null
    },
    "equities": [
      { "symbol": "ACCESSCORP", "companyName": "Access Holdings Plc", "lastPriceNgn": 100, "dailyChangePercent": 1.01,
        "quoteTimestamp": "2026-10-22T09:40:00.000Z", "available": true, "unavailableReason": null, "quoteAgeSeconds": 1500 },
      { "symbol": "AIRTELAFRI", "companyName": "Airtel Africa Plc", "lastPriceNgn": 101, "dailyChangePercent": -0.4,
        "quoteTimestamp": "2026-10-22T09:40:00.000Z", "available": true, "unavailableReason": null, "quoteAgeSeconds": 1500 }
    ],
    "marketSummary": {
      "tradingDate": "2026-10-22", "allShareIndex": 100000.5, "allShareIndexChange": 500.25, "allShareIndexChangePercent": 0.5,
      "equityMarketCapitalisation": 50000, "totalMarketCapitalisation": 60000,
      "providerUpdatedAt": "2026-10-22T09:40:00.000Z", "refreshedAt": "2026-10-22T10:00:00.000Z", "isStale": false
    },
    "generatedAt": "2026-10-22T10:05:00.000Z"
  },
  "meta": { "requestId": "3f6b9f1e-2c4d-4a5b-9c8e-7d6f5a4b3c2d" }
}
```

### 5.2 Partial availability (`200`, `status: ok`, some rows unavailable)

```json
"equities": [
  { "symbol": "ACCESSCORP", "companyName": "Access Holdings Plc", "lastPriceNgn": 100, "dailyChangePercent": 1.01,
    "quoteTimestamp": "2026-10-22T09:40:00.000Z", "available": true, "unavailableReason": null, "quoteAgeSeconds": 1500 },
  { "symbol": "ARADEL", "companyName": "Aradel Holdings Plc", "lastPriceNgn": null, "dailyChangePercent": null,
    "quoteTimestamp": null, "available": false, "unavailableReason": "INVALID_PRICE", "quoteAgeSeconds": null },
  { "symbol": "NB", "companyName": "Nigerian Breweries Plc", "lastPriceNgn": null, "dailyChangePercent": null,
    "quoteTimestamp": null, "available": false, "unavailableReason": "NOT_IN_PROVIDER_RESPONSE", "quoteAgeSeconds": null },
  { "symbol": "SEPLAT", "companyName": "Seplat Energy Plc", "lastPriceNgn": null, "dailyChangePercent": null,
    "quoteTimestamp": null, "available": false, "unavailableReason": "QUOTE_EXPIRED", "quoteAgeSeconds": null }
]
```

### 5.3 Stale (`200`, `status: stale`): refresh failed, last good data served

```json
{
  "data": {
    "status": "stale",
    "dataType": "delayed",
    "cache": {
      "refreshedAt": "2026-10-22T05:05:00.000Z", "ageSeconds": 18000, "refreshIntervalSeconds": 1800,
      "nextRefreshDueAt": "2026-10-22T05:35:00.000Z", "isStale": true, "staleReason": "REFRESH_FAILED"
    },
    "equities": [
      { "symbol": "ACCESSCORP", "companyName": "Access Holdings Plc", "lastPriceNgn": 10, "dailyChangePercent": 0.5,
        "quoteTimestamp": "2026-10-21T14:30:00.000Z", "available": true, "unavailableReason": null, "quoteAgeSeconds": 70200 }
    ],
    "marketSummary": null,
    "generatedAt": "2026-10-22T10:05:00.000Z"
  },
  "meta": { "requestId": "â€¦" }
}
```

### 5.4 Disabled (`503`, the default until approved). Headers: `Cache-Control: no-store`, no `Retry-After`

```json
{ "error": { "code": "FEATURE_UNAVAILABLE", "message": "Market data is not available.", "context": { "status": "disabled" }, "requestId": "â€¦" } }
```

### 5.5 Provider unavailable (`503`, nothing servable). Headers: `Cache-Control: no-store`, `Retry-After: 300`

```json
{ "error": { "code": "SERVICE_UNAVAILABLE", "message": "Market data is temporarily unavailable.",
  "context": { "status": "unavailable", "reason": "REFRESH_FAILED", "retryAfterSeconds": 300 }, "requestId": "â€¦" } }
```

### 5.6 Redis unavailable (`503`). Headers: `Cache-Control: no-store`, `Retry-After: 60`

```json
{ "error": { "code": "SERVICE_UNAVAILABLE", "message": "Market data is temporarily unavailable.",
  "context": { "status": "unavailable", "reason": "CACHE_UNAVAILABLE", "retryAfterSeconds": 60 }, "requestId": "â€¦" } }
```

All 503 reasons and their `Retry-After` values (seconds):

| Reason | Retry-After |
|---|---|
| `REFRESH_IN_PROGRESS` | 5 |
| `REFRESH_FAILED` | 300 |
| `REFRESH_PAUSED` | 300 |
| `CACHE_UNAVAILABLE` | 60 |
| `QUOTES_EXPIRED` | 300 |

## 6. Status codes

| Code | When | Frontend action |
|---|---|---|
| 200 `status: ok` | Fresh cache | Render values; show "Delayed" + attribution + "as of {quoteTimestamp}". |
| 200 `status: stale` | Cache missed its refresh, last good data served | Render values + visible "Delayed â€” last refreshed {cache.refreshedAt}". |
| 503 `FEATURE_UNAVAILABLE` | Disabled (default) | Static directory, null prices ("Quote pending"). Don't retry in a loop. |
| 503 `SERVICE_UNAVAILABLE` | No servable data (see reasons) | Same fallback; optionally retry once after `Retry-After`. |
| 429 `RATE_LIMITED` | > 120/min per IP | Same fallback. |
| 5xx other / network error / timeout | Unexpected | Same fallback. |

## 7. UI guidance

- **Ticker / slider:**
  - Show only rows with `available: true`. Hide unavailable rows, or render "â€”"; don't show a stale number.
  - If no row is available or the response is non-200, hide the ticker or show the static list with "Quote
    pending". **Never** show mock prices.
- **Market at a Glance:**
  - Use `marketSummary.allShareIndex` / `allShareIndexChangePercent` and `tradingDate` as the date label.
  - `marketSummary: null` â†’ "â€”".
  - Do not show market capitalisation until the unit is confirmed.
  - If `marketSummary.isStale`, add the stale label.
- **Market Pulse:** Preserve Emmanuel's existing manually curated indicators. Do not replace them with NGX market summary data.
- **Unavailable / stale / disabled / failure:** see Â§6. All failure states fall back to today's static
  directory with null prices.
- **Labels:** always "Delayed". Never "Live" or "Real-time". Always show `provider.attribution` (NGN Market
  Terms Â§8) and keep `delayNotice` available (tooltip or footnote is fine).
- **Timeouts:**
  - The backend answers a cache hit in milliseconds.
  - A request that triggers a provider refresh is bounded by a **6 s server-side deadline** (+ â‰¤0.5 s lock
    release). Measured worst cases: â‰ˆ5.0 s when the provider hangs, â‰ˆ6.5 s when Redis hangs.
  - **Recommended client timeout: 10 s.** Your current 8 s works for the backend bound, but leaves only â‰ˆ1.5 s
    for network and a Vercel cold start.
  - On timeout, use the fallback. The next request is normally a fast cache hit.
- **Retry / cooldown:**
  - Don't retry more than once per page view, and respect `Retry-After`.
  - Polling faster than every 60 s yields nothing new (CDN `max-age â‰¤ 60`).
  - The backend pauses provider calls itself after failures: 10 min after errors, 1 h after auth errors, and
    until the provider reset when quota is low. During a pause you get stale data or 503s, not errors.
- **Quota exhaustion:** the backend stops calling the provider and serves cached data as `stale`
  (`staleReason: REFRESH_PAUSED`) until each quote's 7-day limit. After that it returns 503. No frontend
  action is needed beyond the stale/fallback states.

## 8. Test configuration

- Against a running backend with defaults, you get the disabled 503 (Â§5.4). That is the expected state today.
- The backend e2e suite (`test/market-data.e2e-spec.ts`) boots the real app with synthetic Redis and provider.
  Use the examples above as fixtures for your adapter tests: success, partial, stale, disabled, provider
  unavailable, Redis unavailable.
- Do not set the market-data env vars locally with a real key for UI work. Synthetic fixtures are enough.

## 9. Pending before go-live (not frontend blockers)

- **Licensing:** written NGN Market permission or a redistribution-rights plan. Until then both flags stay
  unset and the endpoint stays disabled.
- **Live checks (David):**
  - All 14 symbols present.
  - Timestamp format.
  - `reset_at` = billing renewal date.
  - `market_cap` unit.
  - Upstash Lua on the production database.
  - Observed refresh duration on Vercel.

## 10. TypeScript shape

```ts
type EquityUnavailableReason =
  | 'NOT_IN_PROVIDER_RESPONSE' | 'INVALID_PROVIDER_DATA' | 'DUPLICATE_IN_PROVIDER_RESPONSE'
  | 'MISSING_QUOTE_TIMESTAMP' | 'INVALID_QUOTE_TIMESTAMP' | 'FUTURE_QUOTE_TIMESTAMP'
  | 'INVALID_PRICE' | 'QUOTE_EXPIRED'
  | (string & {}); // additive: treat unknown values as "unavailable"

type MarketSnapshotResponse = {
  data: {
    status: 'ok' | 'stale';
    provider: { name: string; url: string; attribution: string };
    dataType: 'delayed';
    delayNotice: string;
    cache: {
      refreshedAt: string; ageSeconds: number; refreshIntervalSeconds: number;
      nextRefreshDueAt: string; isStale: boolean;
      staleReason: 'REFRESH_IN_PROGRESS' | 'REFRESH_FAILED' | 'REFRESH_PAUSED' | null;
    };
    equities: Array<{
      symbol: string; companyName: string;
      lastPriceNgn: number | null; dailyChangePercent: number | null;
      quoteTimestamp: string | null; available: boolean;
      unavailableReason: EquityUnavailableReason | null;
      quoteAgeSeconds: number | null; // added in v2
    }>;
    marketSummary: null | {
      tradingDate: string; allShareIndex: number | null; allShareIndexChange: number | null;
      allShareIndexChangePercent: number | null; equityMarketCapitalisation: number | null;
      totalMarketCapitalisation: number | null; providerUpdatedAt: string | null;
      refreshedAt: string; isStale: boolean;
    };
    generatedAt: string;
  };
  meta: { requestId: string };
};
// Non-200: { error: { code: 'FEATURE_UNAVAILABLE' | 'SERVICE_UNAVAILABLE' | 'RATE_LIMITED' | string,
//   message: string, context?: { status: 'disabled' | 'unavailable'; reason?: string; retryAfterSeconds?: number },
//   requestId: string } }
```

Full contract: `docs/api/openapi.yaml` â†’ `/public/market-snapshot`. Operations runbook:
`docs/operations/MARKET-DATA-NGN-MARKET-INTEGRATION.md`.
