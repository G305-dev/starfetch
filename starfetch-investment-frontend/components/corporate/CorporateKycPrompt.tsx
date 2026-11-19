"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * Corporate dashboard KYC popup (Corporate Portal only).
 *
 * Shows after login on `/corporate/dashboard` for authenticated Corporate
 * applicants. Offers two actions only:
 * - "Complete KYC" -> `/corporate/profile` (Corporate Profile, stays
 *   inside the Corporate Portal)
 * - "Maybe Later"  -> dismisses the popup for this dashboard visit
 *
 * Corporate KYC boundaries (deliberate):
 * - This popup NEVER calls the Individual KYC endpoints
 *   (`getIndividualKycProfile` / `/me/kyc-profile`) and NEVER links to
 *   `/profile` or `/dashboard`.
 * - No approved backend Corporate KYC completion signal exists yet. The
 *   Corporate Profile's saved-form `progress` is explicitly NOT KYC/KYB
 *   completion (`meaning: SAVED_FORM_COMPLETION_ONLY`), so it is not used
 *   here. The popup therefore shows on every fresh authenticated dashboard entry
 *   until dismissed with "Maybe Later" — it never falsely marks
 *   Corporate KYC complete.
 * - "Maybe Later" is in-memory only: refreshing or signing in again
 *   shows the popup again. No browser storage is used.
 */
export function CorporateKycPrompt() {
  const { status, user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const completeKycRef = useRef<HTMLAnchorElement>(null);
  const maybeLaterRef = useRef<HTMLButtonElement>(null);

  // Correct Corporate account context: only authenticated Corporate
  // applicants see the reminder. Loading/unauthenticated renders nothing.
  const isAuthenticatedCorporate = status === "authenticated";
  const companyName = user?.companyName?.trim() || "Corporate applicant";
  const visible = isAuthenticatedCorporate && !dismissed;

  const dismiss = useCallback(() => setDismissed(true), []);

  // Move focus to the primary action when the popup opens.
  useEffect(() => {
    if (!visible) return;
    completeKycRef.current?.focus();
  }, [visible]);

  // Lock background scroll while the popup is open.
  useEffect(() => {
    if (!visible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      dismiss();
      return;
    }
    // Keep Tab focus cycling between the two popup actions.
    if (event.key === "Tab") {
      const first = completeKycRef.current;
      const last = maybeLaterRef.current;
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-star-900/60 p-4 backdrop-blur-[2px] sm:items-center sm:p-6"
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="corporate-kyc-prompt-heading"
        aria-describedby="corporate-kyc-prompt-description"
        className="w-full max-w-md rounded-2xl border border-star-200 bg-white p-6 shadow-[0_24px_60px_rgba(0,59,42,0.25)] sm:p-8"
      >
        <span className="grid size-12 place-items-center rounded-full bg-star-50 text-star-700">
          <ShieldCheck size={24} aria-hidden="true" />
        </span>
        <p className="mt-4 text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-star-700">Corporate account · {companyName}</p>
        <h2 id="corporate-kyc-prompt-heading" className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em] text-star-900">
          Complete your KYC
        </h2>
        <p id="corporate-kyc-prompt-description" className="mt-2 text-sm leading-6 text-star-muted">
          To unlock full access to your Starfetch corporate account, please complete your company KYC details. It only takes a few minutes.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            ref={maybeLaterRef}
            type="button"
            onClick={dismiss}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-star-300 px-5 text-sm font-bold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
          >
            Maybe Later
          </button>
          <Link
            ref={completeKycRef}
            href="/corporate/profile"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-star-lime px-5 text-sm font-extrabold text-star-900 no-underline transition hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
          >
            Complete KYC
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
