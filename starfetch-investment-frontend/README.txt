Starfetch homepage and About page updates

Changes included
- Moved the slow rotating circular orbit decorations from the homepage value-proposition strip to the Company Credentials section immediately below it.
- Removed the supporting subtext from all three value-proposition items while keeping their headings and static icons.
- Removed the stale “Starfetch Board” link from the About navigation menu; the About page no longer renders that section. The global Starfetch logo/home link is unchanged.
- Updated Sylvia Igwe-Okparaeke’s team-section designation to “Managing Director Designate*”.
- Updated Toluwani Adeseri’s team-section designation to “Executive Director Designate*”.
- Added the SEC approval footnote after the career-institution logos: “These positions are pending SEC approval which is currently in progress.”
- Added or updated regression checks for these changes.

Files
- app/globals.css
- components/ValueProposition.tsx
- components/CompanyCredentials.tsx
- components/Navbar.tsx
- components/about/Team.tsx
- scripts/about-profile-cards-check.ts
- scripts/homepage-value-proposition-check.ts
- package.json

Validation completed in the workspace
- npm run test:homepage-value-proposition
- npm run test:about-profile-cards
- npm run typecheck
- npm run build

No changes were deployed to Vercel. Apply the included files to the matching paths in the frontend project, then deploy through the project's normal process when ready.
