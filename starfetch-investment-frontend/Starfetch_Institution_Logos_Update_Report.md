# Starfetch About Us — Institution Logos Update Report

**Date:** 22 October 2026  
**Scope:** The “Careers built at leading institutions” area within the existing About Us Leadership section only.

## Summary

The institution-logo strip was refined to make the marks more legible, reduce their visual footprint, and remove the supporting copy beneath it.

## Implemented changes

- Replaced unclear/screenshot-derived logo assets with clearer web-sourced logo artwork for:
  - United Capital
  - ARM
  - Nigerian Exchange Group (NGX)
  - KPMG
  - Renaissance Capital
  - Renmoney
  - Accelerex
  - Aipec
- Retained the existing supplied Page Asset Management and ACA marks, because the searched web results were not reliable matches for the approved institutions.
- Preserved the approved institution order:
  1. Page Asset Management
  2. United Capital
  3. ARM
  4. Nigerian Exchange
  5. KPMG
  6. Renaissance Capital
  7. Renmoney
  8. Accelerex
  9. Aipec Group
  10. ACA
- Reduced each logo placeholder from the prior 72px treatment to a compact **58px** height.
- Limited logos to a maximum rendered width of **125px**, using `object-contain` so they remain proportionate and uncut.
- Constrained the desktop logo grid to **920px** so the smaller placeholders retain a deliberate, compact presentation.
- Kept the responsive grid at two columns on mobile, three on tablet, and five on desktop.
- Removed the supporting text below the logos:
  > The management team is supported by an experienced and professional advisory board.

## Exact modified files

- `components/about/Team.tsx`
  - Reduced the logo-tile dimensions and rendered logo dimensions.
  - Removed the supporting-text paragraph.
- `scripts/about-profile-cards-check.ts`
  - Updated the regression assertion to verify the compact institution treatment and the absence of the removed paragraph.
- `public/images/institution-united-capital.png`
- `public/images/institution-arm.png`
- `public/images/institution-ngx.png`
- `public/images/institution-kpmg.png`
- `public/images/institution-renaissance-capital.png`
- `public/images/institution-renmoney.png`
- `public/images/institution-accelerex.png`
- `public/images/institution-aipec.png`

## Content and scope confirmation

- Only the Leadership section’s institution-logo treatment was changed.
- Board, Leadership profile-card content, headings, biographies, qualifications, portraits, navigation, footer, backend, API, authentication, and unrelated pages were not changed in this update.
- The section heading, **“Careers built at leading institutions,”** remains unchanged.

## Validation

All checks passed after the update:

```text
npm run typecheck
npm run test:about-profile-cards
npm run build
```

The production build completed successfully and generated **43 static routes**.

## Preview

The rebuilt production preview is currently available on port **3000**.

## Remaining limitation

Page Asset Management and ACA continue to use the approved supplied local marks. The web search did not provide sufficiently reliable matching replacements, so they were not substituted with potentially incorrect branding.
