Starfetch — Fixed Note Rates Landing Page Popup Patch

Files included
- app/page.tsx — mounts the popup on the public landing page.
- components/FixedNoteRatesPopup.tsx — responsive, accessible popup with Close, Escape, and backdrop dismissal.
- public/images/fixed-note-rates-popup.png — the supplied rates image.

Apply
Copy the included paths into the frontend project root, preserving the directory structure.

Behavior
The popup opens automatically on the landing page. Closing it does not save a browser preference, so it appears again on a later homepage load. The supplied rates image is displayed unchanged.

Validation
TypeScript check and Next.js production build passed in the workspace. No backend changes, Git push, or deployment are included.
