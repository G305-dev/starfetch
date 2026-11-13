# Starfetch Board & Leadership profile-card refinement

## Scope completed

Redesigned only the Board of Directors and Leadership profile-card presentation on the existing About Us page. The wider About page, Navbar, Footer, investor portals, authentication, APIs, backend code, and data contracts were not changed.

## Profile-card structure changes

- Replaced the prior compact/four-column people treatment with a shared clean, vertical profile-card structure.
- At desktop width (`1024px` and above), cards use **two equal columns**.
- Each card now renders, in order:
  1. portrait
  2. full name
  3. official designation
  4. full approved biography, where supplied
  5. approved qualifications as compact wrapping badges
- Cards use white backgrounds, light pale-green borders, rounded portrait corners, comfortable padding, readable paragraph line height, and left-aligned content.
- Portraits are constrained to a consistent square `250px` maximum image frame. This avoids stretching and prevents low-resolution supplied source images from being enlarged across the full card width.
- Tablet and mobile retain one card per row until the `1024px` two-column breakpoint; the profile layout has no horizontal scroll.

## Approved content preserved

- Preserved the Leadership title: **“Led by industry trailblazers and experienced professionals”**, including the highlighted italic treatment for “trailblazers”.
- Preserved the supplied Leadership introduction.
- Added the approved supplied Sylvia Igwe-Okparaeke and Toluwani Adeseri designations, complete biographies, and qualification badges without rewriting or shortening their text.
- Preserved the distinct **Board of Directors** section and the existing approved Toluwani Adeseri / Co founder record.
- Removed unapproved “Name to be provided” placeholder people rather than rendering invented directors.
- Preserved the supplied institution-mark order: Page Asset Management, United Capital, ARM, Nigerian Exchange, KPMG, Renaissance Capital, renmoney, Accelerex, Aipec Group, and ACA.
- Retained the advisory-board supporting statement.

## Modified files

### Components and test configuration

- `components/about/PeopleSection.tsx`
- `components/about/StarfetchBoard.tsx`
- `components/about/Team.tsx`
- `scripts/about-profile-cards-check.ts`
- `package.json`

### Added approved supplied visual assets

- `public/images/sylvia-igwe-okparaeke.png`
- `public/images/toluwani-adeseri.png`
- `public/images/institution-page.png`
- `public/images/institution-united-capital.png`
- `public/images/institution-arm.png`
- `public/images/institution-ngx.png`
- `public/images/institution-kpmg.png`
- `public/images/institution-renaissance-capital.png`
- `public/images/institution-renmoney.png`
- `public/images/institution-accelerex.png`
- `public/images/institution-aipec.png`
- `public/images/institution-aca.png`

### Captured validation screenshots

- `artifacts/about-board-desktop.png`
- `artifacts/about-leadership-desktop.png`
- `artifacts/about-board-mobile.png`
- `artifacts/about-leadership-mobile.png`

## Validation results

| Command | Result |
|---|---|
| `npm run typecheck` | Passed — TypeScript `tsc --noEmit` |
| `npm run build` | Passed — Next.js production build; all 43 routes generated |
| `npm run test:about-profile-cards` | Passed — structure, approved profile text/credentials, Board/Leadership separation, institution assets and no placeholder personnel checked |
| `npm run test:auth-navigation` | Passed — authentication navigation regression |
| `npm run test:joint-contract` | Passed — Joint contract/session isolation regressions |
| `npm run test:corporate-registration` | Passed — Corporate applicant registration regression |
| `npm run test:corporate-api` | Passed — Corporate API/O2/O3/O4/O11/freshness regression |
| `npm run test:corporate-verification` | Passed — Corporate verification-boundary regression |

## Desktop/mobile verification

Playwright captures confirm:

- Board card portrait appears above name, designation, biography, and qualifications.
- Leadership displays Sylvia and Toluwani side-by-side at 1440px desktop width.
- Leadership switches to one full-width card per row at the 390px mobile capture.
- Qualification badges remain visible and wrap naturally.
- Institution marks remain below Leadership in their original supplied order.

## Remaining limitation

The repository did not contain standalone high-resolution source portrait files for the approved Leadership image treatment. The two supplied Starfetch portraits and institution marks were available within the approved attached Starfetch reference image, so they were reused as carefully cropped local frontend assets and rendered at a constrained 250px maximum frame without distortion.

For a future marketing-quality refresh, replace `sylvia-igwe-okparaeke.png` and `toluwani-adeseri.png` with the original high-resolution approved source photographs. No AI-generated portraits, GreenCity personnel images, invented biographies, or unverified qualifications were used.
