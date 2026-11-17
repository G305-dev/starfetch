Starfetch homepage and About navigation visual update

What changed
- Moved the slow rotating circular orbit decorations from the homepage value-proposition strip to the Company Credentials section immediately below it.
- Removed the supporting subtext from the three value-proposition items while keeping their headings and static icons.
- Removed the stale “Starfetch Board” link from the About navigation menu; the About page had already stopped rendering that section. The global Starfetch logo/home link is unchanged.
- Added regression checks for the homepage layout and About navigation.

Files
- app/globals.css
- components/ValueProposition.tsx
- components/CompanyCredentials.tsx
- components/Navbar.tsx
- scripts/about-profile-cards-check.ts
- scripts/homepage-value-proposition-check.ts
- package.json

Validation completed in the workspace
- npm run test:homepage-value-proposition
- npm run test:about-profile-cards
- npm run typecheck
- npm run build

No changes were deployed to Vercel. Apply the included files to the matching paths in the frontend project, then deploy through the project's normal process when ready.
