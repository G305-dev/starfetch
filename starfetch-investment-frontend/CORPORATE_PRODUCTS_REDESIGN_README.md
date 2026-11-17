# Corporate Products Redesign — Match Individual Products Inside the Corporate Portal

## Summary

The Corporate Investor Products page (`/corporate/products`) previously showed a
generic "Product actions are unavailable" placeholder. It now renders the same
approved product presentation as the Individual Products page — the three
Starfetch investment solutions with product images, descriptions, View Details
modals and Invest Now actions — while keeping Corporate investors strictly
inside the Corporate Portal.

## What changed

### 1. `components/corporate/CorporateProductsContent.tsx` (rewritten)

A dedicated Corporate-only component that reuses **only** the shared product
catalogue (`components/services/services-data.ts` → `serviceDetails`) and the
approved card/modal presentation:

- The same three products: Starfetch Fixed Note, Starfetch Discretionary
  Portfolios, Starfetch Execution Mandate — same names, descriptions, images,
  eyebrows and Starfetch green palette as Individual.
- Identical card layout, spacing, typography, hover effects and responsive
  behaviour (2-column grid on desktop, stacked on mobile).
- **View Details** opens the same modal format as Individual: description,
  supporting description, Typical use, Risk character and How it works.
- **Invest Now** matches the Individual visual presentation but opens a
  **Corporate-specific unavailable notice** ("Corporate investment actions are
  unavailable"). It creates no order, funding request, booking or enquiry and
  shows no success message. Corporate investment execution stays disabled
  until an approved backend workflow exists.
- **View Fixed Note** (Fixed Note card + modal) links to
  `/corporate/products/fixed-note` via `next/link` (client-side navigation).
- A Corporate availability notice states that online execution, funding,
  bookings and enquiry submission are not available in the Corporate Portal.
- No `Buy Now`, no `ProductEnquiryForm`, no Individual routes, no Individual
  APIs, no token storage, no network calls.

The legacy `requestedProduct` prop is retained as an optional, ignored shim so
the reference integration snapshot
(`Starfetch_Corporate_O2_O3_O4_O11_v0.6_Frontend_Integration/`) still
typechecks; it has no effect.

### 2. `components/corporate/CorporateFixedNoteInfo.tsx` (new)

Corporate Fixed Note information page content mirroring the approved
Individual Fixed Note informational format:

- Back destination defaults to `/corporate/products` (never `/products`).
- Displays the Fixed Note product information; states that terms, rates,
  minimums and availability are not published through the Corporate Portal.
- "Online booking is unavailable" notice: the page accepts no instructions,
  deposits, enquiries or company information, and creates no investment.
- No rates, minimums, returns or financial values are published or invented.

### 3. `app/corporate/products/page.tsx` (updated)

Renders `CorporateProductsContent` inside `CorporatePortalLayout` (auth guard
and Corporate shell preserved). Metadata updated for the Corporate Portal.

### 4. `app/corporate/products/fixed-note/page.tsx` (updated)

Renders `CorporateFixedNoteInfo` inside `CorporatePortalLayout` instead of the
old unavailable placeholder. The Individual Fixed Note page is not used as a
route. Metadata updated.

### 5. `scripts/corporate-products-check.ts` + `test:corporate-products` (new)

Regression check asserting: the three-product catalogue, Corporate page
wiring, approved presentation reuse, unavailable (non-transactional) Corporate
investment actions, strict route separation (no `/products`, `/profile` or
`/dashboard` links, no Individual portal imports), no Individual APIs or token
storage, Corporate Fixed Note behaviour with no invented rates, and that
Individual/Joint Products wiring is untouched.

## Why not reuse `ProductsContent.tsx` directly?

`ProductsContent.tsx` carries a legacy non-Individual branch ("Buy Now" →
`ProductEnquiryForm`, which shows an "Interest confirmed" success message).
That branch does not meet the Corporate safety requirements (no fake success,
no enquiry workflow, Corporate-specific unavailable notice), and its
account-type detection relies on the `fixedNoteHref` prefix rather than an
explicit account type. Per the task guidance, Corporate therefore gets its own
wrapper component that shares only the catalogue data and presentation
patterns. `ProductsContent.tsx`, `app/products/` and `app/joint/products/`
are **byte-for-byte untouched**, so Individual and Joint behaviour cannot
regress.

## Route separation (acceptance criteria)

| Interaction | Individual | Corporate |
|---|---|---|
| Products | `/products` | `/corporate/products` |
| Fixed Note | `/products/fixed-note` | `/corporate/products/fixed-note` |
| View Details | Modal in portal | Modal in Corporate Portal |
| Invest Now | Unavailable notice | Corporate unavailable notice |
| Profile | `/profile` | `/corporate/profile` |
| Dashboard | `/dashboard` | `/corporate/dashboard` |

Corporate navigation (Overview, Investments, Transactions, Products, Company
Profile) uses `next/link` client-side routing with the existing session
restore and guard behaviour from the previous navigation fix — no login
redirects while the session is valid, no localStorage tokens.

## KYC flows preserved

- Individual Dashboard (`/dashboard`): `IndividualKycPrompt` → Complete KYC
  opens `/profile`.
- Corporate Dashboard (`/corporate/dashboard`): `CorporateKycPrompt` →
  Complete KYC opens `/corporate/profile`.

Neither flow was modified by this batch; `test:kyc-dashboard-prompt` and
`test:individual-kyc-prompt` still pass.

## Validation

- `npm run typecheck` — passed.
- `npm run build` — passed; `/corporate/products` and
  `/corporate/products/fixed-note` prerender.
- `npm run test:corporate-products` — passed (new).
- Full regression suite passed, including `test:individual-products-invest-now`,
  `test:joint-contract`, `test:corporate-navigation`,
  `test:kyc-dashboard-prompt`, `test:individual-kyc-prompt`,
  `test:corporate-dashboard`, `test:corporate-verification`,
  `test:corporate-post-login-routing`, `test:corporate-api`,
  `test:corporate-registration`, `test:corporate-profile`,
  `test:general-corporate-login`, `test:auth-navigation`,
  `test:footer-navigation`, `test:dashboard-greeting`,
  `test:mobile-menu-visibility`, `test:homepage-value-proposition`,
  `test:market-widgets`, `test:about-profile-cards`.

## Restrictions honoured

No backend changes, no API contract changes, no fabricated investment data,
no Individual/Joint changes, no cross-account navigation, no security controls
removed, nothing committed, pushed, merged, deployed or PR'd.
