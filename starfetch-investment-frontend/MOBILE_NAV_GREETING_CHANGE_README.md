# Mobile Menu Visibility + Time-Aware Greeting — Change Package (frontend only)

## 1. Mobile menu icon stays visible while scrolling

**Problem:** On mobile, the menu (hamburger) icon scrolled away with the page instead of staying pinned.

**Fixes (both menu icons):**

- **Public navbar** (`components/Navbar.tsx` + `app/globals.css`): the header is `sticky top-0`, but `overflow-x-hidden` on `<body>` creates a scroll container that breaks `position: sticky` on mobile browsers. Added `overflow-x: clip` after the existing rule — `clip` hides horizontal overflow without creating a scroll container, so the sticky navbar (and its hamburger button) now stays pinned while scrolling up/down. Older browsers without `clip` support fall back to `hidden`.
- **Dashboard/portal mobile toggle** (`components/portal/PortalSidebar.tsx`): the hamburger `<summary>` was `absolute left-5 top-4`, so it scrolled off-screen with the page. Changed to `fixed left-5 top-4` so it stays pinned over the sticky portal header while scrolling. The open menu panel was already `fixed`, so open/close behaviour is unchanged.

## 2. Dashboard greeting changes with time of day

**Problem:** The dashboard placard (`WelcomeBanner`) always said "Good morning".

**Fix:**

- New shared helper `lib/greeting.ts`:
  - `getGreetingForHour(hour)` — 00:00–11:59 "Good morning", 12:00–16:59 "Good afternoon", 17:00–23:59 "Good evening" (invalid hours fall back to morning).
  - `getTimeGreeting(date)` — same, using the visitor's **local browser time** (e.g. Africa/Lagos).
  - `getGreetingEmoji(greeting)` — 👋 morning, ☀️ afternoon, 🌙 evening.
- `components/portal/WelcomeBanner.tsx` (live dashboard placard) and `components/portal/DashboardGreeting.tsx` now render `{greeting}, {firstName}` from the helper. Both are client components that sync to local time after mount, so there is no server/client hydration mismatch.

Example: at 2pm in Lagos the placard reads "Good afternoon, Ada ☀️"; at 8pm "Good evening, Ada 🌙".

## Checks added

- `scripts/dashboard-greeting-check.ts` (`npm run test:dashboard-greeting`) — greeting boundaries, invalid-hour fallback, emoji pairing, and component wiring.
- `scripts/mobile-menu-visibility-check.ts` (`npm run test:mobile-menu-visibility`) — sticky navbar + `overflow-x: clip`, fixed portal toggle.

## Verify

```bash
npm install
npm run typecheck
npm run test:dashboard-greeting
npm run test:mobile-menu-visibility
npm run build
```

Manual QA (mobile viewport): scroll down then up on the homepage — the navbar hamburger stays visible. On `/dashboard` mobile — the portal hamburger stays pinned top-left while scrolling. Change your device clock (or test at different times) — the placard switches morning/afternoon/evening.
