"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { getIndividualKycProfile, type IndividualKycProfile } from "@/lib/api/client";
import {
  completedKycSectionCount,
  hasSubmittedIndividualKyc,
  isKycNeedsAttention,
} from "@/lib/individual-kyc-prompt";

type LoadState = "loading" | "ready" | "error";

/**
 * Individual dashboard KYC popup.
 *
 * Shows after login on `/dashboard` when the backend KYC profile has NOT
 * been submitted yet. Offers two actions only:
 * - "Complete KYC" -> `/profile` (where the Individual KYC form lives)
 * - "Maybe Later"  -> dismisses the popup for this dashboard visit
 *
 * When KYC has been submitted (SUBMITTED / UNDER_REVIEW / APPROVED /
 * COMPLETE) the popup never renders. "Maybe Later" is in-memory only:
 * refreshing the page or signing in again will show the popup again until
 * KYC is submitted. No browser storage is used.
 */
export function IndividualKycPrompt() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [profile, setProfile] = useState<IndividualKycProfile | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const completeKycRef = useRef<HTMLAnchorElement>(null);
  const maybeLaterRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadKycProfile() {
      try {
        const kycProfile = await getIndividualKycProfile();
        if (cancelled) return;
        setProfile(kycProfile);
        setLoadState("ready");
      } catch {
        if (cancelled) return;
        // Fail closed: if the status cannot be confirmed, show the prompt
        // rather than silently assuming KYC is submitted.
        setProfile(null);
        setLoadState("error");
      }
    }
    void loadKycProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = !dismissed && loadState !== "loading" && !hasSubmittedIndividualKyc(profile);

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

  const needsAttention = isKycNeedsAttention(profile);
  const completedSections = completedKycSectionCount(profile);
  const bodyCopy =
    loadState === "error"
      ? "We couldn't confirm your KYC status. Please complete and submit your KYC details to unlock full access to your account."
      : needsAttention
        ? "Your KYC needs attention. Please review the requested information on your profile and resubmit so we can continue reviewing your account."
        : "To unlock full access to your Starfetch account, please complete and submit your KYC details. It only takes a few minutes.";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-star-900/60 p-4 backdrop-blur-[2px] sm:items-center sm:p-6"
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="individual-kyc-prompt-heading"
        aria-describedby="individual-kyc-prompt-description"
        className="w-full max-w-md rounded-2xl border border-star-200 bg-white p-6 shadow-[0_24px_60px_rgba(0,59,42,0.25)] sm:p-8"
      >
        <span className="grid size-12 place-items-center rounded-full bg-star-50 text-star-700">
          <ShieldCheck size={24} aria-hidden="true" />
        </span>
        <p className="mt-4 text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-star-700">Individual account</p>
        <h2 id="individual-kyc-prompt-heading" className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em] text-star-900">
          Complete your KYC
        </h2>
        <p id="individual-kyc-prompt-description" className="mt-2 text-sm leading-6 text-star-muted">
          {bodyCopy}
        </p>
        {completedSections > 0 && completedSections < 4 && !needsAttention && loadState === "ready" ? (
          <p className="mt-4 rounded-lg bg-[#f5f9f1] px-3 py-2 text-xs font-bold text-star-700">
            You&apos;ve completed {completedSections} of 4 sections — pick up where you left off on your profile.
          </p>
        ) : null}
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
            href="/profile"
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
