"use client";

import { AlertCircle, LoaderCircle, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { authorizedPortals, describeContextAuthorization, isJointPathAllowed, portalDashboards, portalLabels, type PortalContext } from "@/lib/auth/account-context-access";
import { CORPORATE_CLASSIFICATION_NOTICE, shouldShowCorporateClassificationNotice } from "@/lib/auth/backend-authorization-parity";
import { useAuth } from "./AuthProvider";

/** Requires an authenticated backend session. It does not query or require an Individual InvestorProfile. */
export function RequireInvestorAuth({ children }: { children: ReactNode }) {
  const { status, refreshSession } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Redirect only when the backend has confirmed the session is invalid.
    // Loading (restoring) and error (transient failure) never redirect.
    if (status === "unauthenticated") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [pathname, router, status]);

  if (status === "loading") return <SessionLoading />;
  if (status === "error") return <SessionRestoreError onRetry={() => void refreshSession()} />;
  if (status === "unauthenticated") return null;
  return <>{children}</>;
}

/**
 * Requires an authenticated session whose backend projection proves a specific
 * portal context. Portal content is never mounted for an unauthorised account,
 * so a direct URL entry or a refresh cannot bypass the check.
 */
export function RequireAccountContext({ context, children }: { context: PortalContext; children: ReactNode }) {
  const { status, user, refreshSession, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [pathname, router, status]);

  if (status === "loading") return <SessionLoading />;
  if (status === "error") return <SessionRestoreError onRetry={() => void refreshSession()} />;
  if (status === "unauthenticated") return null;

  const authorization = describeContextAuthorization(user, context);
  if (authorization.authorized) {
    // The projection says CORPORATE but the backend's own applicant guard will
    // reject the entry calls (a mixed classification). Render the explanation
    // instead of a portal whose every request returns 403.
    if (context === "CORPORATE" && shouldShowCorporateClassificationNotice(user)) {
      return <ClassificationNotice message={CORPORATE_CLASSIFICATION_NOTICE} />;
    }
    return <>{children}</>;
  }
  // The Joint invitation inbox is legitimately reachable by an authenticated
  // Individual investor with no membership yet. Backend ownership/verification
  // of the invitation itself is unchanged.
  if (context === "JOINT" && isJointPathAllowed(user?.authorizedContexts, pathname)) return <>{children}</>;

  const portals = authorizedPortals(user);
  return (
    <AccountAccessNotice
      context={context}
      reason={authorization.reason}
      unverified={authorization.unverified}
      portals={portals}
      signingOut={signingOut}
      onGoToDashboard={portals.length ? () => router.replace(portalDashboards[portals[0]]) : null}
      onSignOut={async () => {
        setSigningOut(true);
        try { await logout(); } finally { router.replace("/login"); }
      }}
    />
  );
}

/**
 * For journeys that are authorised by a context but must not mount a portal
 * shell — notably /register/joint, which an Individual investor starts without
 * any Joint membership.
 */
export function RequireContextPermission({ context, children }: { context: PortalContext; children: ReactNode }) {
  const { status, user, refreshSession } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [pathname, router, status]);

  if (status === "loading") return <SessionLoading />;
  if (status === "error") return <SessionRestoreError onRetry={() => void refreshSession()} />;
  if (status === "unauthenticated") return null;

  const authorization = describeContextAuthorization(user, context);
  if (authorization.authorized) return <>{children}</>;

  const portals = authorizedPortals(user);
  return (
    <AccountAccessNotice
      context={context}
      reason={authorization.reason}
      unverified={authorization.unverified}
      portals={portals}
      signingOut={false}
      onGoToDashboard={portals.length ? () => router.replace(portalDashboards[portals[0]]) : null}
      onSignOut={null}
    />
  );
}

/**
 * Shown when the frontend and backend disagree about a mixed account
 * classification. No data is requested and nothing is changed: the portal is not
 * mounted, so no failing call is fired.
 */
function ClassificationNotice({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fffef9] px-5 py-10 text-center">
      <section className="w-full max-w-lg rounded-xl border border-[#f2d89d] bg-white p-6 shadow-card sm:p-8" role="alert" aria-labelledby="classification-notice-heading">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#fff9e8] text-star-700"><ShieldAlert size={24} aria-hidden="true" /></span>
        <p className="mt-4 text-[0.64rem] font-extrabold uppercase tracking-[0.18em] text-star-700">Account classification</p>
        <h1 id="classification-notice-heading" className="mt-2 text-xl font-extrabold text-star-900">Your Corporate portal is not available yet</h1>
        <p className="mt-2 text-sm leading-6 text-star-muted">{message}</p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={() => window.location.assign("/dashboard")} className="inline-flex min-h-10 items-center justify-center rounded-md bg-star-700 px-4 text-sm font-bold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Go to my Individual dashboard</button>
          <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-10 items-center justify-center rounded-md border border-star-300 px-4 text-sm font-bold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Reload</button>
        </div>
      </section>
    </main>
  );
}

function SessionLoading() {
  return <main className="grid min-h-screen place-items-center bg-[#fffef9] px-5 text-center"><div><LoaderCircle size={30} className="mx-auto animate-spin text-star-700" aria-hidden="true" /><p className="mt-4 text-sm font-semibold text-star-muted">Restoring your secure session…</p></div></main>;
}

function SessionRestoreError({ onRetry }: { onRetry: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-[#fffef9] px-5 text-center"><section className="max-w-md rounded-xl border border-star-200 bg-white p-6 text-center shadow-card" aria-labelledby="session-restore-error-heading"><span className="mx-auto grid size-12 place-items-center rounded-full bg-red-50 text-red-700"><AlertCircle size={24} aria-hidden="true" /></span><h1 id="session-restore-error-heading" className="mt-4 text-xl font-extrabold text-star-900">We couldn&apos;t restore your session</h1><p className="mt-2 text-sm leading-6 text-star-muted">Check your connection and try again. You have not been signed out.</p><div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" onClick={onRetry} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-star-700 px-4 text-sm font-bold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><RefreshCw size={17} aria-hidden="true" />Try again</button><Link href="/login" className="inline-flex min-h-10 items-center justify-center rounded-md border border-star-300 px-4 text-sm font-bold text-star-700 no-underline transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Back to login</Link></div></section></main>;
}

function AccountAccessNotice({ context, reason, unverified, portals, signingOut, onGoToDashboard, onSignOut }: {
  context: PortalContext;
  reason: string;
  unverified: boolean;
  portals: PortalContext[];
  signingOut: boolean;
  onGoToDashboard: (() => void) | null;
  onSignOut: (() => Promise<void>) | null;
}) {
  const label = portalLabels[context];
  return (
    <main className="grid min-h-screen place-items-center bg-[#fffef9] px-5 py-10 text-center">
      <section className="w-full max-w-lg rounded-xl border border-star-200 bg-white p-6 shadow-card sm:p-8" role="alert" aria-labelledby="account-access-heading">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#fff9e8] text-star-700"><ShieldAlert size={24} aria-hidden="true" /></span>
        <p className="mt-4 text-[0.64rem] font-extrabold uppercase tracking-[0.18em] text-star-700">Account access</p>
        <h1 id="account-access-heading" className="mt-2 text-xl font-extrabold text-star-900">{unverified ? "We couldn't confirm your portal access" : `No ${label} portal access`}</h1>
        <p className="mt-2 text-sm leading-6 text-star-muted">{reason}</p>
        <p className="mt-2 text-sm leading-6 text-star-muted">You are still signed in. Nothing has been changed.</p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          {onGoToDashboard ? <button type="button" onClick={onGoToDashboard} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-star-700 px-4 text-sm font-bold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Go to my {portalLabels[portals[0]]} dashboard</button> : null}
          {onSignOut ? <button type="button" onClick={() => void onSignOut()} disabled={signingOut} className="inline-flex min-h-10 items-center justify-center rounded-md border border-star-300 px-4 text-sm font-bold text-star-700 transition hover:bg-star-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">{signingOut ? "Signing out…" : "Sign in with another account"}</button> : null}
          {!onSignOut ? <Link href="/login" className="inline-flex min-h-10 items-center justify-center rounded-md border border-star-300 px-4 text-sm font-bold text-star-700 no-underline transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Back to login</Link> : null}
        </div>
      </section>
    </main>
  );
}

/** Legacy alias retained for existing Individual and Joint route imports. */
export const RequireIndividualAuth = RequireInvestorAuth;
