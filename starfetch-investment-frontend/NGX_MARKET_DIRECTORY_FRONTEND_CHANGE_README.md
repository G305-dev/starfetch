# Landing Page Update — Fixed Note Banner and NGX Market Directory

This is a frontend-only update based on the requested landing-page changes.

## What changed

- Removed the Starfetch Fixed Note rates popup from the landing page. The hero carousel and other product content remain unchanged.
- Removed the TradingView ticker strip and market-overview embed from the landing page.
- Replaced the global-market panel with a searchable directory of 14 selected NGX-listed equities, showing company names and ticker symbols.
- Added `MarketOverview`'s `markets` prop and a small display type so a backend-provided list can be passed in when the API is ready.
- Left quote values blank (`null` rendered as an em dash). No prices, index values, percentage moves, volume, live feed, or backend route were invented.
- Updated the footer market-data notice to say that live figures await an authorized NGX feed through the backend.

The directory is a **selected starter list**, not a complete/current official universe. It is intended to demonstrate the frontend and should be replaced or populated from the backend's authoritative NGX listings response. The display type in `components/ngx-market-directory.ts` is a frontend view model, not a negotiated API contract.

## Backend handoff

The backend engineer can pass NGX rows to `MarketOverview` using the `NgxEquityListing` display shape: `symbol`, `companyName`, `lastPriceNgn`, and `dailyChangePercent`. Quote fields may remain `null` while unavailable. Adapt the backend's real response in the backend/client integration; this package adds no API route and makes no live-data request.

NGX's official market-data page describes authorized vendors and states that market-data redistribution requires the appropriate license. Confirm the authorized source and redistribution permissions before displaying live prices:

- https://ngxgroup.com/exchange/data/vendors-list/
- https://ngxgroup.com/exchange/data/x-dataportal/
- Official listed-equities page linked from the frontend: https://ngxgroup.com/exchange/trade/equities/listed-companies/

## Validation

Passed in the workspace:

- `npm run typecheck`
- `npm run test:market-widgets`
- `npm run build` — optimized build completed and generated 43 static routes

`npm ci` reported 3 audit findings (2 high, 1 critical). No dependencies or lockfile were changed and no audit fix was run.

## Files in the patch

- `app/page.tsx`
- `components/Footer.tsx`
- `components/MarketOverview.tsx`
- `components/ngx-market-directory.ts`
- `scripts/market-widgets-check.ts`
- `REMOVED_FILES.txt` — identifies the two unused TradingView-only components removed from the source tree
- This README

No backend files were changed. Nothing was pushed, merged, or deployed.
