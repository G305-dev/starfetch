# Market data on the homepage — CURRENT STATE

> **This document described the 17 November 2026 hardcoded snapshot. That
> approach has been REPLACED and the hardcoded prices are gone.**
>
> Read [`MARKET_DATA_INTEGRATION.md`](MARKET_DATA_INTEGRATION.md) instead — it is
> the current integration reference, including what David's backend must return
> and how to connect a commodity provider.
>
> The sections below are kept only as a record of the values the earlier snapshot
> contained and how they were sourced. **Do not re-add them to the code.** With a
> backend feed in progress, a forgotten hardcoded price would silently look like
> current market data — which is exactly what the new implementation prevents.

---

# Market at a Glance — Real Data Snapshot (17 November 2026)

## Summary

The landing-page "NGX markets at a glance" section previously showed blank
("—") quote values pending a backend market-data feed. It now displays a
**dated snapshot of real NGX closing prices** for all 14 selected equities,
plus real official Market Pulse indicators (NBS inflation, CBN policy rates).
The snapshot is clearly labelled with its date and sources, and the UI states
it is not a live feed.

## Data sources (cross-checked)

- **Equities**: Mansa Markets (mansamarkets.com/nigeria) and Kobo Terminal
  (koboterminal.com) — two independent NGX data providers that agreed on
  every listing to the kobo for the Tuesday, 17 November 2026 close.
- **Session context**: NGX All-Share Index 249,318.65 (−1.38%), market
  capitalisation ₦161.88T, Dangote Cement leading decliners (−9.99% to
  ₦1,323.00) — corroborated by same-day Nigerian market reporting
  (Nairametrics, Tribune, Western Post: "NGX sheds N2.27trn as heavyweight
  stocks drag ASI down 1.38%").
- **Inflation**: 14.06% headline, October 2026 (NBS CPI report released
  16 November 2026; September: 14.63%).
- **Monetary Policy Rate**: 23% (CBN 307th MPC, 22 September 2026 — cut from
  26.5%; next MPC scheduled 24 November 2026).
- **Cash Reserve Ratio**: 45% for Deposit Money Banks (retained at every
  2026 MPC meeting; merchant banks 16%, non-TSA public sector 75%).

No values were invented or estimated. Every number above was retrieved from
the cited public sources on 17 November 2026.

## Snapshot values (17 November 2026 close)

| Symbol | Company | Last price (₦) | Daily change |
|---|---|---|---|
| ACCESSCORP | Access Holdings Plc | 26.90 | −0.37% |
| AIRTELAFRI | Airtel Africa Plc | 6,258.20 | 0.00% |
| ARADEL | Aradel Holdings Plc | 1,296.00 | 0.00% |
| BUACEMENT | BUA Cement Plc | 298.00 | 0.00% |
| BUAFOODS | BUA Foods Plc | 760.60 | 0.00% |
| DANGCEM | Dangote Cement Plc | 1,323.00 | −9.99% |
| FIRSTHOLDCO | First HoldCo Plc | 109.00 | +0.09% |
| GTCO | Guaranty Trust Holding Company Plc | 117.00 | −0.68% |
| MTNN | MTN Nigeria Communications Plc | 837.00 | 0.00% |
| NB | Nigerian Breweries Plc | 70.00 | 0.00% |
| NESTLE | Nestlé Nigeria Plc | 2,650.00 | 0.00% |
| SEPLAT | Seplat Energy Plc | 16,241.90 | 0.00% |
| UBA | United Bank for Africa Plc | 40.50 | +0.25% |
| ZENITHBANK | Zenith Bank Plc | 116.00 | −0.86% |

Market Pulse: Inflation (Headline) 14.06% · Monetary Policy Rate 23% ·
Cash Reserve Ratio 45%.

## What changed

- `components/ngx-market-directory.ts` — all 14 listings populated with the
  snapshot quotes; new `ngxMarketSnapshot` export (date, source, ASI,
  market capitalisation) with provenance comments.
- `components/MarketOverview.tsx` — section description now states the
  snapshot date, ASI close/move, market capitalisation and source; table
  footer states the snapshot is dated and not a live feed; Market Pulse
  shows the real NBS/CBN values with source details.
- `components/NgxMarketTicker.tsx` — ticker label changed from "Backend
  data" to "17 Nov snapshot"; screen-reader text updated to describe the
  dated snapshot. The "Quote pending" fallback remains for any unquoted
  listing.
- `components/Footer.tsx` — market-data notice rewritten: dated snapshot
  from public sources, not a live feed, live prices pending the authorized
  backend feed. The "general awareness only — not investment advice"
  disclaimer is retained.
- `scripts/market-widgets-check.ts` — updated to assert the real snapshot
  (all 14 quotes, spot-checked values, snapshot metadata, Market Pulse
  values) while keeping the existing guards (no Fixed Note popup, slider
  position/animation, no TradingView, no search bar, no NGX link, 5-row
  subset).

## Important caveats

- **This is a snapshot, not a live feed.** Prices are the 17 November 2026
  close and will go stale. The UI says so explicitly. When the backend
  market-data endpoint is ready, replace the seed values in
  `ngx-market-directory.ts` with the live feed (the components already
  accept backend-supplied rows via props).
- **Not investment advice.** The footer disclaimer is retained; snapshot
  prices are for general awareness only.
- The 5-row at-a-glance subset and the 14-stock ticker are unchanged in
  structure — only the data and copy changed.

## Validation

- `npm run typecheck` — passed.
- `npm run test:market-widgets` — passed (updated assertions).
- Full regression suite (20 checks) — passed.
- `npm run build` — passed.

No backend changes, no API contract changes, nothing committed, pushed,
merged, deployed or PR'd.
