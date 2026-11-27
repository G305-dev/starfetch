import type { Metadata } from "next";

/**
 * ADMIN PORTAL LAYOUT — isolated from the public website and investor portal.
 *
 * One codebase now serves two products with two different security boundaries.
 * The isolation is structural, not cosmetic:
 *
 *  - No investor chrome is rendered here: no Navbar, no Footer, no PortalSidebar,
 *    no marketing components. Staff are a separate security principal.
 *  - `AuthProvider` sits in the root layout because the investor portal needs it
 *    app-wide. Next.js cannot opt a child segment out of a parent layout, so the
 *    admin segment cannot simply "not inherit" it. It is instead made inert on
 *    admin routes through `skipInitialSessionRefresh` in AuthProvider, which
 *    already existed for the public calculators. Without that, a staff page would
 *    fire an investor `/me` request and mount an investor-session code path on
 *    the staff surface.
 *  - `noindex` is set at this level so every admin page inherits it. robots.txt
 *    is explicitly NOT relied on for protection.
 *
 * This layout performs NO authorization. A layout cannot. Every protected page
 * independently verifies the staff session and permission with the backend via
 * `ProtectedPage`, and the BFF gateway re-checks both per request. Treating a
 * rendered page as proof of authorization is the failure this portal exists to
 * avoid.
 */
export const metadata: Metadata = {
  title: "Starfetch Admin Portal",
  description: "Staff-only Starfetch investment administration.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
