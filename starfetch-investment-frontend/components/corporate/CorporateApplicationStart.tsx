"use client";

import { AlertCircle, ArrowRight, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { CorporateOnboardingFlow } from "@/components/auth/CorporateOnboardingFlow";
import { getMyCorporateApplications, getSafeErrorMessage, isApiError } from "@/lib/api/client";

type StartState = "loading" | "empty" | "existing" | "error";

/** Safe support reference (status, backend code, request ID). Never includes request data. */
function supportReference(error: unknown) {
  if (!isApiError(error)) return "";
  const parts = [error.status ? `HTTP ${error.status}` : null, error.serverCode ?? null, error.requestId ? `request ${error.requestId}` : null].filter(Boolean);
  return parts.length ? ` Reference: ${parts.join(" · ")}.` : "";
}

function discoveryErrorMessage(error: unknown, primaryAccountType: "INDIVIDUAL" | "CORPORATE" | null | undefined) {
  if (!isApiError(error)) return "We could not check your Corporate applications. Please try again.";
  const reference = supportReference(error);
  if (error.code === "EMAIL_NOT_VERIFIED") return `Verify your email address before starting a Corporate application.${reference}`;
  if (error.code === "FORBIDDEN") {
    if (primaryAccountType === "INDIVIDUAL") return `Starfetch did not authorise Corporate applications for this signed-in account because it is classified as an Individual account. Contact Starfetch support if this account should be a Corporate account.${reference}`;
    if (primaryAccountType === null) return `Starfetch did not authorise Corporate applications because this signed-in account has not yet been classified as a Corporate account. Contact Starfetch support to review the account classification.${reference}`;
    return `Starfetch did not authorise Corporate applications for this signed-in account.${reference}`;
  }
  if (error.code === "RATE_LIMITED") return `Corporate application checks are temporarily rate limited.${error.retryAfterSeconds ? ` Try again in ${error.retryAfterSeconds} seconds.` : " Please try again later."}${reference}`;
  return `${getSafeErrorMessage(error)}${reference}`;
}

/**
 * Protected entry point for O2 creation. The existing CorporateOnboardingFlow
 * is rendered only when authenticated owner-scoped discovery confirms that the
 * applicant has no Corporate application yet. The backend remains the
 * authority: O2 itself re-checks activation, authentication, Corporate
 * classification, email verification, CSRF and rate limits.
 */
export function CorporateApplicationStart() {
  const { status, user } = useAuth();
  const [state, setState] = useState<StartState>("loading");
  const [error, setError] = useState<string | null>(null);
  const activeUserId = useRef<string | null>(null);
  const epochRef = useRef(0);

  async function checkDiscovery(ownerId: string) {
    const epoch = epochRef.current + 1;
    epochRef.current = epoch;
    setState("loading");
    setError(null);
    try {
      const accounts = await getMyCorporateApplications();
      if (epochRef.current !== epoch || activeUserId.current !== ownerId) return;
      setState(accounts.length ? "existing" : "empty");
    } catch (caught) {
      if (epochRef.current !== epoch || activeUserId.current !== ownerId) return;
      setState("error");
      setError(discoveryErrorMessage(caught, user?.primaryAccountType));
    }
  }

  useEffect(() => {
    activeUserId.current = status === "authenticated" && user ? user.id : null;
    epochRef.current += 1;
    setState("loading");
    setError(null);
    if (status === "authenticated" && user) void checkDiscovery(user.id);
  }, [status, user?.id]);

  if (status !== "authenticated" || !user || state === "loading") return <section className="grid min-h-56 place-items-center rounded-xl border border-star-200 bg-white" aria-busy="true"><div className="text-center"><LoaderCircle size={28} className="mx-auto animate-spin text-star-700" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-star-muted">Checking your Corporate applications…</p></div></section>;

  if (state === "error") return <section className="rounded-xl border border-red-200 bg-red-50 p-5" role="alert"><div className="flex gap-3"><AlertCircle size={21} className="shrink-0 text-red-700" aria-hidden="true" /><div><h1 className="text-base font-extrabold text-star-900">A Corporate application cannot be started right now</h1><p className="mt-1 text-sm leading-6 text-red-700">{error}</p><p className="mt-1 text-xs leading-5 text-star-muted">No application was created and no details were sent.</p><div className="mt-3 flex flex-wrap gap-4"><button type="button" onClick={() => { void checkDiscovery(user.id); }} className="inline-flex items-center gap-2 text-sm font-extrabold text-star-700 underline decoration-star-lime decoration-2 underline-offset-3"><RefreshCw size={15} aria-hidden="true" />Retry</button><Link href="/corporate/dashboard" className="text-sm font-extrabold text-star-700 underline decoration-star-lime decoration-2 underline-offset-3">Back to dashboard</Link></div></div></div></section>;

  if (state === "existing") return <section className="rounded-xl border border-star-200 bg-white p-6 text-center shadow-[0_2px_12px_rgba(14,62,46,0.04)]"><ShieldCheck size={26} className="mx-auto text-star-700" aria-hidden="true" /><p className="mt-3 text-xs font-extrabold uppercase tracking-[0.12em] text-star-700">Corporate application</p><h1 className="mt-2 text-lg font-extrabold text-star-900">You already have a Corporate application</h1><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-star-muted">Starfetch returned an existing Corporate application for this signed-in account, so a new one is not started. Continue with the four-section Company Profile.</p><Link href="/corporate/profile" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Continue to Company Profile<ArrowRight size={16} aria-hidden="true" /></Link></section>;

  return <CorporateOnboardingFlow />;
}
