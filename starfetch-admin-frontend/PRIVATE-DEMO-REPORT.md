> Historical report: for current six-page behavior, see README.md and SIX-PAGE-REFINEMENT-REPORT.md.

> Historical report: subsequent transaction and dashboard changes are described in README.md and REVISED-TRANSACTIONS-REPORT.md.

# Private demo login — implementation and verification

Baseline: `G305-dev/starfetch` branch `admin-portal` at commit `509a82f7ca05d878383776448a667bd99a48c577`. The admin-only source in this package retains the prior TypeScript cleanup and demo fixtures. No investor frontend or backend files were modified. No commit, push, merge or deployment was performed.

## Implementation

- Central server environment gate in `lib/admin-demo-mode.ts` is used by middleware and server pages. Both the explicit demo flag and an allowed deployment environment are required; production is denied even if the flag is present.
- `next.config.ts` derives a non-secret build-time switch from the same environment decision. Normal production builds eliminate demo imports; preview builds require the flag and Vercel system variables during build, and the runtime gate must also permit access.
- Login and seven admin pages are dynamic, avoiding static prerendering and stale cached demo-state decisions. Login retains its design, accepts only disclosed placeholders, and does not authenticate, transmit or save them. These placeholders are not a security boundary.
- Preview requires Vercel Deployment Protection. The application does not detect whether protection is enabled; it is an operator prerequisite. A tester admitted by Vercel can go directly to routes without using the form. Preview build bundles can include synthetic fixtures and must not be promoted to production or hosted without protection.
- The existing fixtures, navigation, synthetic demo behavior and production fail-closed blocker remain in place. No live backend was connected.

## Verification

- Clean dependency install: `npm ci --no-audit --no-fund` passed.
- `npm run typecheck` passed; `npm run build` passed. Logs are included in the ZIP.
- A production build with `ADMIN_DEMO_MODE=1 VERCEL=1 VERCEL_ENV=production` succeeded; selected synthetic name, reference and financial value markers were absent from `.next/static` and `.next/server/app`. This targeted scan is not a full security audit.
- A build with simulated Vercel Preview settings succeeded. Against that build, browser tests confirmed placeholder validation, login navigation, all seven pages and demo labels, with no `/api/` requests, browser page errors or storage entries during those checks. With runtime `VERCEL_ENV=production`, or with the runtime demo flag unset, login controls were disabled and all seven routes returned 503. Simulated enabled Preview returned 200 on all seven.
- Local development with the flag enabled: browser placeholder login reached the dashboard with a Demo Data notice.
- A real Vercel Preview and Deployment Protection were not deployed or verified. Follow README.md and verify signed-out access before sharing.

## Changed files

- `BACKEND-INTEGRATION.md`, `CHANGES.md`, `FILES.md`, `README.md`, `RESTORATION-REPORT.md` — current setup and historical-document notices.
- `app/admin/layout.tsx`, `app/admin/login/page.tsx`, and `app/admin/{dashboard,users,kyc,investments,transactions,portfolios,settings}/page.tsx` — consistent server-side gate and dynamic rendering.
- `components/admin/AdminShell.tsx`, `components/admin/login/AdminLoginForm.tsx`, `components/admin/login/admin-login-validation.ts` — demo labels and placeholder-only form validation.
- `lib/admin-demo-mode.ts` — new shared server environment gate.
- `middleware.ts`, `next.config.ts` — route gate and build-time demo bundle switch.
- `PRIVATE-DEMO-REPORT.md` — this report.

No existing source files were deleted. Build artifacts and dependencies are excluded from the ZIP. The tracked baseline `tsconfig.tsbuildinfo` is also excluded because it is a generated incremental cache, not application source; it need not be replaced when applying the changes.
