# Market data — integration requirements and current status

> **V3.2 (17 November 2026).** A percentage change is now discarded whenever its
> price is unusable — a change is derived from a price and cannot outlive it. See
> `MARKET_DATA_V3_2_TEST_REPORT.md`.
>
> **V3.1 (17 November 2026).** Two corrections to V3: (a) the generic `id` field
> can no longer identify an instrument — V3 matched quotations on either `id` or
> `symbol`, so a quotation carrying `id: "brent"` bypassed every symbol check;
> (b) future-dated quotations are now rejected outright rather than tolerated for
> 30 seconds. See `MARKET_DATA_V3_1_TEST_REPORT.md`.
>
> **V3 (17 November 2026).** This document was updated for the V3 corrections:
> `BZ`/`BB` can no longer populate the ICE Brent row, untrustworthy timestamps now
> discard the prices themselves (not just the status), and the clock-skew policy
> tightened from 10 minutes to 30 seconds. See `MARKET_DATA_V3_TEST_REPORT.md`.
>
> **V2 (17 November 2026).** This document was updated for the V2 corrections.
> Still pending: David's endpoint and an authorised commodity provider. Nothing
> below claims a price is live.
>
> Corrections applied in V2: validation hardening (timestamp/price),
> bounded provider timeout, Brent symbol corrected from `BZ` to ICE `B`,
> a working "View All NGX Stocks" control, independent per-feed availability in
> the ticker, verified production path resolution for the Market Pulse JSON, a
> real loading state, and browser-verified layout/animation/reduced-motion.
> See `MARKET_DATA_V2_TEST_REPORT.md`.

## Status at a glance

| Feed | Status | What renders today |
|---|---|---|
| **Market Pulse** (NBS/CBN indicators) | **DONE** — manual JSON, verified, path resolution covered by a deployment check | The three figures, each with its reporting period |
| **NGX equities** | **PENDING** — waiting on David's endpoint | 14 listings with an explicit `Unavailable` price and a "Waiting for backend feed" label |
| **Global commodities** | **BLOCKED** — no approved provider | Gold, Brent, Silver, Cocoa with `Unavailable` prices and an explanation |
| Unified slider | **DONE** | One continuous track; NGX and commodity availability reported **independently** |
| Loading state | **DONE** | Matched skeleton per section behind its own Suspense boundary |
| Market at a Glance | **DONE** | Three cards: NGX Stocks, Commodities, Market Pulse |

**Nothing on the homepage currently presents an invented market price.** The
previous hardcoded 17 November 2026 NGX snapshot has been removed from the code
rather than left in place to look current.

---

## 1. For David — NGX snapshot endpoint

### The contract the frontend is waiting on

```
GET /api/v1/public/market-snapshot
```

The adapter is isolated in `lib/market/market-snapshot-adapter.ts`. It currently
assumes this shape and **tolerates either a bare object or a `{ data: ... }`
envelope**:

```jsonc
{
  "asOf": "2026-11-17T15:30:00.000Z",   // ISO-8601 instant, provider's own timestamp
  "source": "NGN Market",                // shown as attribution
  "delayed": false,                      // true if the provider flags delay
  "quotations": [
    {
      "symbol": "DANGCEM",
      "companyName": "Dangote Cement Plc",
      "lastPrice": 1323.00,             // number or numeric string
      "changePercent": -9.99            // number or numeric string
    }
  ]
}
```

### What the frontend needs from that response

1. **`asOf`** — the provider's real quotation timestamp, not the server's clock.
   It drives the "As of …" label and the stale warning. If it is missing the UI
   says the provider did not report a timestamp.
2. **`symbol`** — must match the NGX ticker so it can be merged onto the existing
   14-row directory. Unmatched symbols are ignored; unquoted directory rows show
   `Unavailable`.
3. **`lastPrice`** — in naira. Do not send formatted strings like `"₦1,323.00"`;
   the frontend does the formatting.
4. **`changePercent`** — already a percentage (`-9.99`), not a fraction
   (`-0.0999`).
5. **`delayed`** — pass through the provider's own delay flag if it has one.

### Timestamp requirements (V3.1 — strict)

A quotation timestamp must be **present, readable and not in the future**. If it
is not, the frontend **discards the prices entirely** — it does not merely
relabel them. A figure without a trustworthy "as of" is not a price.

| `asOf` state | Result |
|---|---|
| Valid, at or before our clock | `live` (or `delayed` if the provider flags it) |
| Valid, older than 30 minutes | `stale` — real value, real timestamp, both shown |
| Missing | **No prices.** `unavailable`, `withheld: true` |
| Unreadable (`"soon"`, month 13, a number) | **No prices.** `unavailable`, `withheld: true` |
| Any amount in the future (even 1ms) | **No prices.** `unavailable`, `withheld: true` |

**Clock-skew policy (final, V3.1): zero tolerance for future timestamps.**

Any `asOf` ahead of our clock is rejected and its prices are withheld. V3 allowed
30 seconds and still printed `live`; that was the same error as V2's ten minutes,
only smaller — a price stamped ahead of now asserts a moment that has not
happened.

**Why zero is correct rather than merely strict:** `asOf` is struck by the
provider *before* the response reaches us, so network latency can only make a
quotation look **older**, never newer. A future value therefore cannot be
explained by latency or by jitter on our side; it means the provider's clock is
ahead of ours, or the value is wrong. A tolerance would not absorb jitter — it
would only excuse a drifting provider clock while still printing `live`.

**Handling a drifting provider:** the feed fails closed with a note naming the
fault ("The provider's clock is ahead of ours; it must be synchronised before its
prices can be published"), so an operator sees the cause instead of a mislabelled
price. Any provider we integrate must run NTP-synchronised time.

**One-sided:** only *future* timestamps are rejected. A four-hour-old quote is
valid data that is out of date, so it becomes `stale` with its real timestamp.
Rejecting old data would hide a working feed during a market holiday.

### Price and change are one fact (V3.2)

A daily percentage change is **derived from a price**, so it may not exist without
one. If `priceUsd` is null — missing, zero, negative, non-finite or unreadable —
then `changePercent` is null and `direction` is `"unknown"`, whatever the provider
sent in `changePercent`.

This applies **per row and unconditionally**: a valid price for another commodity
in the same payload does not license a change on an unpriced row. A change with no
price reads as a movement in a figure the feed never supplied, and a visitor cannot
tell it apart from a real one.

### Instrument identification (V3.1)

A quotation identifies itself with `symbol` and/or `id`. **`symbol` is
authoritative; `id` is a generic label that carries no instrument identity.**

| Payload | Result |
|---|---|
| `symbol: "B"` | Accepted — approved exchange symbol |
| `symbol: "BRN"` | Accepted — confirmed ICE display root |
| `id: "brent", symbol: "B"` | Accepted — the fields agree |
| `id: "brent", symbol: "BZ"` | **Refused** — `symbol` is a NYMEX contract, and a generic id cannot override it |
| `id: "brent", symbol: "UNKNOWN"` | **Refused** — unknown symbol |
| `id: "cocoa", symbol: "C"` | **Refused** — London cocoa is a different contract in GBP |
| `id: "gold", symbol: "XAU"` | **Refused** — spot gold, not the COMEX future |
| `id: "brent"` alone | **Refused** — a generic id cannot distinguish ICE `B` from NYMEX `BZ` |
| `symbol: "brent"` alone | **Refused** — same reason; a label is not a ticker |
| Two quotations claiming one row | **Withheld** — an ambiguous feed is not resolved by picking a winner |

An id-only quotation is accepted only when the configured provider has been
explicitly approved to publish that generic label for that row
(`approvedProviderIds` in `commodity-directory.ts`). **No provider is approved
today**, so id-only quotations are refused and reported. Adding one is a
deliberate act requiring the provider's own documentation.

Refusals are never silent: `refused[]` on the feed result names each refused
symbol and why, and when every quotation is refused the visitor-facing note says
the provider sent quotations that cannot be verified — not that the feed was
empty.

### What the frontend does NOT need

- The All-Share Index, market capitalisation or breadth. They are not displayed.
- Any caching decisions — the page revalidates every 120 seconds server-side.
- Provider credentials. **No provider API key may be placed in frontend code or
  in any `NEXT_PUBLIC_` variable.** The frontend calls only the backend route.

### Frontend behaviour against that contract (already implemented and tested)

| Backend response | Frontend result |
|---|---|
| 200 + valid quotations | Prices shown with `As of …` and the source |
| 200, `delayed: true` | Same prices, labelled "delayed" |
| 200, `asOf` older than 30 min | Same prices, labelled **stale**, genuine timestamp kept |
| 200, no `quotations` / all unusable | All cells `Unavailable`, page intact |
| non-2xx | All cells `Unavailable`, page intact |
| timeout (5s) | All cells `Unavailable`, page intact |
| `BACKEND_API_ORIGIN` unset | All cells `Unavailable`, page intact |

### To switch it on

1. David ships the route.
2. Set `BACKEND_API_ORIGIN` in the frontend deployment environment (the existing
   `/api/v1/:path*` rewrite already forwards to it).
3. Set `MARKET_SNAPSHOT_INTEGRATION.status` to `"live"` in
   `market-snapshot-adapter.ts`.
4. Remove the "waiting for the backend" wording from the two market panels.
5. Run `npm run test:market` and re-verify against the live response.

---

## 2. Commodities — provider requirements (UNRESOLVED)

### Why there are no commodity prices

- **TradingView extraction is prohibited** by the brief and by TradingView's
  terms. It has not been used anywhere: `market-widgets-check.ts` fails the build
  if the string `tradingview` appears in any market component.
- **No permitted pricing API has been approved or budgeted.** The brief forbids
  adding a paid data service without approval, so none was added.
- **Inventing values is prohibited.** The design mockup's numbers were treated as
  design, not data.

### What a provider must supply

| Requirement | Reason |
|---|---|
| Server-side API key | The key must never reach the browser |
| HTTPS only | `readCommodityFeedConfig` rejects any non-HTTPS URL so a bearer token is never sent in clear |
| Redistribution licence for public display | Starfetch is publishing the price on a public site; a personal-use licence is not sufficient |
| Symbols `GC`, `B`/`BRN`, `SI`, `CC` (or a documented mapping) | The verified benchmarks listed below |
| Documented provider-to-benchmark mapping | Vendor roots differ; the mapping is recorded per instrument in `commodity-directory.ts` |
| `asOf` timestamp | Drives the stale label |
| Daily percentage change | Shown next to each price |

### The instruments, with verified symbols and units

| Commodity | Symbol | Exchange | Quotation | Verified against |
|---|---|---|---|---|
| Gold | `GC` | COMEX | USD per troy ounce | COMEX contract: 100 troy oz |
| Brent Crude Oil (ICE) | `B` (vendor root `BRN`) | ICE Futures Europe | USD per barrel | ICE contract: 1,000 barrels |
| Brent Last Day (NYMEX) | `BZ` | NYMEX / CME Group | USD per barrel | **DIFFERENT CONTRACT** — cash-settled to the ICE Brent Index |
| Silver | `SI` | COMEX | USD per troy ounce | COMEX contract: 5,000 troy oz |
| Cocoa | `CC` | ICE Futures U.S. | **USD per metric ton** | ICE contract: 10 metric tons |

> **Brent symbol correction (V2).** V1 recorded Brent as `BZ` while labelling the
> exchange "ICE Futures Europe". Those are two different contracts:
>
> - **ICE Brent Crude futures — symbol `B`** on ICE Futures Europe. Physically
>   deliverable via EFP with an option to cash settle against the ICE Brent Index.
>   This is the benchmark the homepage shows.
> - **Brent Last Day Financial — symbol `BZ`** on NYMEX (CME Group). Cash-settled
>   to the ICE Brent Index published a day after the final trading day. A
>   financial copy, not the benchmark.
>
> **V3 mapping policy.** Every provider symbol now carries an explicit status:
>
> | Status | Meaning | Accepted for the row? |
> |---|---|---|
> | `approved` | Denotes this exact instrument | **Yes** |
> | `different` | A different contract or instrument | **Never** |
> | `unconfirmed` | Believed correct, not yet verified | **No** |
>
> For ICE Brent the approved symbols are **`B`** (exchange) and **`BRN`** (ICE's
> display root, confirmed). `BZ` (Brent Last Day Financial, NYMEX) and `BB` (Brent
> Penultimate Financial, NYMEX) are `different` and are **refused**: a provider
> sending only `BZ` yields no ICE Brent price at all, and the refusal is reported
> on the result as `refused[]` with the reason, so an integrator sees why rather
> than assuming the provider sent nothing.
>
> The same rule protects the other rows: spot `XAU`/`XAG` cannot populate the
> COMEX futures rows, and ICE London cocoa `C` (GBP) cannot populate the New York
> `CC` row (USD).
>
> **To use any of these contracts deliberately**, it needs separate approval and
> its own labelled row — e.g. "Brent (NYMEX BZ)" with NYMEX attribution. It must
> never be presented as the ICE benchmark.
>
> **Note on cocoa.** The brief suggested "USD per applicable futures contract
> unit". The actual ICE quotation is **per metric ton**: a CC contract is 10
> metric tons but is priced per ton (a $1/ton tick is worth $10 per contract).
> Quoting per contract would overstate the price tenfold, so the frontend shows
> USD per metric ton. This is recorded in `lib/market/commodity-directory.ts`.

### To switch commodities on

1. Approve and contract a provider with redistribution rights.
2. Set two **server-only** environment variables in the frontend deployment:
   - `COMMODITY_FEED_URL` — https endpoint
   - `COMMODITY_FEED_TOKEN` — bearer token
3. If the provider's JSON differs from the expected shape, extend
   `parseCommodityFeed` in `lib/market/commodity-adapter.ts`. Nothing else in the
   app changes.
4. Run `npm run test:market`; the malformed-payload cases must still pass.
5. Confirm the provider sends `asOf`. Without a valid, non-future timestamp the
   adapter refuses to label the feed live and shows unavailable instead.

Without both variables the adapter returns an `unavailable` result and the page
explains it. It never falls back to a number.

---

## 3. Market Pulse

Manual JSON, not an API. Values, provenance and the update procedure live in
[`public/data/README.md`](public/data/README.md) and
[`public/data/market-pulse.json`](public/data/market-pulse.json).

The three figures were verified on 17 November 2026: headline inflation 14.06%
(NBS, October 2026 CPI, published 16 Nov 2026), MPR 23% and CRR 45% (CBN, 307th
MPC communiqué, 21–22 Sep 2026).

---

## 4. Files involved

| File | Role |
|---|---|
| `lib/market/types.ts` | Shared display types |
| `lib/market/market-snapshot-adapter.ts` | **David's contract lives here** |
| `lib/market/commodity-adapter.ts` | Provider config, fetch, parse, unavailable state |
| `lib/market/commodity-directory.ts` | Verified symbols and units |
| `lib/market/market-pulse.ts` | JSON load + validation |
| `public/data/market-pulse.json` | The manually maintained figures |
| `components/NgxMarketTicker.tsx` | The single unified slider |
| `components/MarketTickerItem.tsx` | NGX and commodity cells |
| `components/MarketOverview.tsx` | Market at a Glance (three cards) |
| `app/page.tsx` | Server-side loading, `revalidate = 120` |
