# Homepage + About Fixes — Change Package (frontend only)

## 1. Aligned divider lines (Value Proposition + Company Credentials)

**Problem:** The dark-green strip (`ValueProposition`) used `max-w-7xl` + `lg:px-8` + `sm:px-5 lg:px-8` cells, while the white strip below (`CompanyCredentials`) used `max-w-[1100px]` + `lg:px-7` + `sm:px-7 first:sm:pl-0` cells — so the vertical dividers landed at different x-positions.

**Fix:** Both strips now share the exact same container and cell padding:
- Container: `mx-auto grid max-w-[1100px] px-5 sm:grid-cols-3 lg:px-7`
- Cells: `sm:px-7 first:sm:pl-0`

The dividers now line up vertically across the two strips on desktop/tablet. Mobile stacking (`divide-y`) is unchanged.

Files: `components/ValueProposition.tsx`, `components/CompanyCredentials.tsx`

## 2. NGX markets at a glance — subset, no search, no official link

**Fix in `components/MarketOverview.tsx`:**
- Shows only the first **5** listings (`AT_A_GLANCE_LIMIT = 5`, `markets.slice(0, AT_A_GLANCE_LIMIT)`) instead of all 14. Header now reads "Showing 5 of 14 listings". The full 14-row directory in `components/ngx-market-directory.ts` is untouched (the top NGX ticker slider still uses it).
- **Search bar removed** (input, `Search` icon, query state/filtering gone).
- **"Official NGX listings" link removed** (anchor, `ArrowUpRight`, `ngxListedEquitiesUrl` import gone).
- Market Pulse card and the "starter directory, not live market data" footer note are unchanged.

To show a different count later, change `AT_A_GLANCE_LIMIT` in `MarketOverview.tsx`.

## 3. Team roles — removed "Designate" and asterisk

**Fix in `components/about/Team.tsx`:**
- `Managing Director Designate*` → `Managing Director`
- `Executive Director Designate*` → `Executive Director`
- Removed the footnote "* These positions are pending SEC approval which is currently in progress." (no longer needed without the asterisk).

## Checks updated

- `scripts/homepage-value-proposition-check.ts` — now asserts both strips share container width/padding.
- `scripts/market-widgets-check.ts` — now asserts no search bar, no official NGX link, and the at-a-glance slice limit.
- `scripts/about-profile-cards-check.ts` — now asserts roles have no "Designate"/SEC footnote.

## Verify

```bash
npm install
npm run typecheck
npm run test:homepage-value-proposition
npm run test:market-widgets
npm run test:about-profile-cards
npm run build
```

Manual QA: homepage — dividers align across the dark/white strips; "NGX markets at a glance" shows 5 rows, no search box, no NGX link; `/about` team cards show "Managing Director" / "Executive Director" with no footnote.

## 4. Institution logos — United Capital + Renaissance Capital replaced

The two logos in **Careers built at leading institutions** (`components/about/Team.tsx` → `Institutions()`) were replaced with the supplied images:

- `public/images/institution-united-capital.png` ← supplied United Capital logo (white padding auto-trimmed, 900×150)
- `public/images/institution-renaissance-capital.png` ← supplied Renaissance Capital Africa logo (white padding auto-trimmed, 900×452)

Filenames are unchanged, so `Team.tsx` needed no code change — the tiles (`max-h-10 max-w-[125px] object-contain`) pick up the new artwork automatically. Alt text remains "United Capital" / "Renaissance Capital".
