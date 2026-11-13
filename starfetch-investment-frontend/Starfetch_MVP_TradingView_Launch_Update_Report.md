# Starfetch MVP Launch Update — TradingView Markets and Account Journeys

**Project:** Starfetch Investment Limited  
**Frontend stack:** Next.js, TypeScript, Tailwind CSS  
**Report date:** 22 October 2026  
**Launch deadline supplied:** 13 November 2026, before the 5 PM management demonstration

---

## 1. Scope and preservation confirmation

The supplied `Starfetch_About_Us_Today_Completion_Report.md` was reviewed before making changes.

The project directory does not contain a usable Git worktree, so no Git operation, reset, checkout, merge, or replacement from another source was performed. The work started from the existing working copy and was limited to the existing market components, a reusable TradingView script wrapper, the market-data notice, and an additive regression check.

The following completed About Us work was not changed:

- `components/about/PeopleSection.tsx`
- `components/about/StarfetchBoard.tsx`
- `components/about/Team.tsx`
- Board/Leadership portraits and institutional logo assets
- About Us profile-card regression checks

The About Us regression check passed after the market work, and desktop/mobile browser checks confirmed the profiles, qualifications, portraits, logos, and responsive card presentation remain present without horizontal overflow.

---

## 2. TradingView integration completed

### Moving ticker tape

`components/MarketTicker.tsx` now renders TradingView’s official **Ticker Tape** widget directly below the existing Navbar and above the existing hero section.

Configured instruments:

- S&P 500 — `FOREXCOM:SPXUSD`
- NASDAQ 100 — `FOREXCOM:NSXUSD`
- Dow Jones — `FOREXCOM:DJI`
- EUR/USD — `FX:EURUSD`
- Gold — `TVC:GOLD`
- Bitcoin — `BITSTAMP:BTCUSD`
- Ethereum — `BITSTAMP:ETHUSD`

The ticker uses TradingView’s own native motion and live/delayed values. It does not animate local numbers or fabricate market prices.

### Market at a glance

`components/MarketOverview.tsx` now uses TradingView’s official **Market Overview** widget inside the existing market-section layout. The original section heading and Starfetch visual treatment remain in place.

TradingView’s current free-widget market listing for Middle East/Africa does not list Nigerian Exchange (NGX) data. Therefore, the former Selected NGX Equities placeholder table was replaced in its existing location with a clearly labelled **Supported global markets** overview. It explicitly explains that it does not show global figures as NGX prices.

### Market Pulse

Market Pulse remains separate from TradingView market prices. Inflation, Monetary Policy Rate, and Cash Reserve Ratio now state **Pending** with an accurate official-source integration status. No unrelated TradingView figures were mapped to policy indicators.

### Attribution and notice

- Native TradingView attribution remains inside both official widgets.
- The footer notice now says that selected global data is supplied through TradingView widgets, that availability and delay vary by instrument, and that NGX prices are not displayed through these widgets.
- The previous unsupported claim that TradingView was a licensed redistributor of Nigerian Exchange data was removed.

Official references reviewed:

- https://www.tradingview.com/widget-docs/widgets/tickers/ticker-tape/
- https://www.tradingview.com/widget-docs/widgets/watchlists/market-overview/
- https://www.tradingview.com/widget-docs/markets/mea

---

## 3. Implementation details

A reusable client-only `TradingViewWidget` component mounts each official TradingView embed script after hydration, clears the widget container on unmount, and serialises the supplied official configuration into the script element. This prevents SSR/hydration mismatches, avoids React rendering third-party widget DOM, and avoids duplicate script insertion on normal rerenders.

The ticker has a fixed 56px wrapper and the Market Overview has a reserved fixed-height wrapper. This prevents layout shifts while widget content loads. The ticker parent is overflow-clipped, and desktop/mobile browser measurements confirmed that the document has no horizontal page overflow.

---

## 4. Account-opening journeys review

No account-authentication or API-client code was rebuilt or changed. The existing flows were reviewed and their existing contract tests passed.

### Individual

- Individual registration route remains available.
- Browser check confirmed `/register/individual` renders its registration form.
- Individual dashboard remains protected and redirects an unauthenticated visitor to `/login?next=%2Fdashboard`.

### Joint

- Joint registration remains protected for a verified Investor session.
- Browser check confirmed an unauthenticated visit to `/register/joint` is redirected to `/login?next=%2Fregister%2Fjoint`, preserving the intended continuation path.
- The Joint contract test passed, covering account creation, a pending invitation, invitation accept/decline, CSRF handling, token refresh, and session isolation.

### Corporate

- Corporate registration remains available at `/register/corporate` and browser testing confirmed it renders **Create your Corporate login**.
- Corporate applicant login remains available through `/login?next=%2Fregister%2Fcorporate` and uses the existing `INVESTOR` authentication service.
- The Corporate registration test passed the exact `{ registrationType: "CORPORATE", email, password }` registration body and verified profileless Corporate users can authenticate with intentionally empty first/last names without calling `/api/v1/me/profile`.
- Corporate dashboard routes remain protected and redirect an unauthenticated visitor to `/login?next=%2Fcorporate%2Fdashboard`.
- O2 Corporate DRAFT remains server-feature-gated. The frontend continues to display the genuine `FEATURE_UNAVAILABLE`/onboarding-pending outcome and does not simulate a DRAFT success or persist TIN data.

### Live-backend limitation

No live backend credentials, test email inbox, or enabled O2 environment was provided. As a result, the email-verification, second-holder acceptance, and Corporate server-gate paths were validated through the existing frontend/API contract tests and protected-route browser checks, not through a real remote user account. This work does not claim a live account creation, email delivery, invitation delivery, or Corporate DRAFT creation.

---

## 5. Exact modified files

### Modified

- `components/MarketTicker.tsx`
- `components/MarketOverview.tsx`
- `components/site-data.ts`
- `components/Footer.tsx`
- `package.json`

### Added

- `components/TradingViewWidget.tsx`
- `scripts/market-widgets-check.ts`

### New browser-validation evidence

- `artifacts/mvp-ticker-final-t1.png`
- `artifacts/mvp-ticker-final-t2.png`
- `artifacts/mvp-market-overview-final-desktop.png`
- `artifacts/mvp-market-overview-final-mobile.png`
- `artifacts/mvp-about-board-desktop.png`
- `artifacts/mvp-about-leadership-desktop.png`
- `artifacts/mvp-about-board-mobile.png`
- `artifacts/mvp-about-leadership-mobile.png`

---

## 6. Validation results

All requested validation commands passed after the final market implementation:

| Command | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run test:market-widgets` | Passed — added widget/placeholder/NGX-notice regression check |
| `npm run test:about-profile-cards` | Passed |
| `npm run test:auth-navigation` | Passed |
| `npm run test:joint-contract` | Passed |
| `npm run test:corporate-registration` | Passed |
| `npm run test:corporate-api` | Passed |
| `npm run test:corporate-verification` | Passed |
| `npm run build` | Passed — production build generated 43 static routes |

---

## 7. Real-browser verification

TradingView widgets were verified in Chromium at both desktop (`1440px`) and mobile (`390px`) viewport widths.

### Verified

- One TradingView ticker iframe renders at full available viewport width and a reserved 56px height.
- One TradingView Market Overview iframe renders in the existing market area.
- All seven configured instruments were visible in both native widget frames at desktop and mobile.
- Two screenshots of the final ticker taken three seconds apart differed by **14,847 pixels**, confirming the native ticker visibly moves rather than displaying a static local rendering.
- Desktop document width: `1440px` client / `1440px` scroll width — no horizontal overflow.
- Mobile document width: `390px` client / `390px` scroll width — no horizontal overflow.
- No browser page errors were observed from the widgets.
- About Us browser review confirmed all approved portrait and institution image elements render at both widths, and no horizontal overflow was introduced.

### Preview-only note

The standalone frontend preview does not include a live backend endpoint at `/api/v1/auth/refresh`; that expected preview request returns `404` when public pages initialise the existing authentication provider. It does not affect TradingView rendering or public-page layout. A configured deployment backend is required for live authentication end-to-end testing.

---

## 8. Current preview status

A fresh production preview is running on port **3000**.

---

## 9. Final status

The MVP market update is complete within the existing frontend: genuine native TradingView ticker and market data widgets replace the local market placeholders; NGX data claims are accurate; Market Pulse remains appropriately pending; the account-opening journeys retain their existing secure frontend boundaries; and the completed About Us work remains preserved.
