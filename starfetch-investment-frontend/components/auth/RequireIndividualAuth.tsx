"use client";

import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
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

  if (status === "loading") return <main className="grid min-h-screen place-items-center bg-[#fffef9] px-5 text-center"><div><LoaderCircle size={30} className="mx-auto animate-spin text-star-700" aria-hidden="true" /><p className="mt-4 text-sm font-semibold text-star-muted">Restoring your secure session…</p></div></main>;
  if (status === "error") return <main className="grid min-h-screen place-items-center bg-[#fffef9] px-5 text-center"><section className="max-w-md rounded-xl border border-star-200 bg-white p-6 text-center shadow-card" aria-labelledby="session-restore-error-heading"><span className="mx-auto grid size-12 place-items-center rounded-full bg-red-50 text-red-700"><AlertCircle size={24} aria-hidden="true" /></span><h1 id="session-restore-error-heading" className="mt-4 text-xl font-extrabold text-star-900">We couldn&apos;t restore your session</h1><p className="mt-2 text-sm leading-6 text-star-muted">Check your connection and try again. You have not been signed out.</p><div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" onClick={() => void refreshSession()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-star-700 px-4 text-sm font-bold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><RefreshCw size={17} aria-hidden="true" />Try again</button><Link href="/login" className="inline-flex min-h-10 items-center justify-center rounded-md border border-star-300 px-4 text-sm font-bold text-star-700 no-underline transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Back to login</Link></div></section></main>;
  if (status === "unauthenticated") return null;
  return <>{children}</>;
}

/** Legacy alias retained for existing Individual and Joint route imports. */
export const RequireIndividualAuth = RequireInvestorAuth;
