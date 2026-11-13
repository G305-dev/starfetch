"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

type KycCompletionPromptProps = {
  accountType: "individual" | "corporate";
};

/**
 * Dashboard-entry reminder only. It has no completion state, makes no
 * authorisation decision, and deliberately stores no dismissal preference.
 */
export function KycCompletionPrompt({ accountType }: KycCompletionPromptProps) {
  const isCorporate = accountType === "corporate";
  const profileHref = isCorporate ? "/corporate/profile" : "/profile";
  const portalLabel = isCorporate ? "Corporate applicant" : "Investor";

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-star-900/55 p-5 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="complete-kyc-heading" aria-describedby="complete-kyc-description">
      <section className="w-full max-w-md rounded-2xl border border-star-200 bg-white p-6 text-center shadow-[0_24px_65px_rgba(0,45,32,0.28)] sm:p-8">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-star-100 text-star-700"><ShieldCheck size={24} aria-hidden="true" /></span>
        <p className="mt-5 text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-star-700">{portalLabel} portal</p>
        <h2 id="complete-kyc-heading" className="mt-2 font-display text-2xl font-extrabold tracking-[-0.04em] text-star-900">Complete your KYC</h2>
        <p id="complete-kyc-description" className="mt-3 text-sm leading-6 text-star-muted">Review the information and KYC steps available in your profile. Completion status is determined only by Starfetch&apos;s approved backend process.</p>
        <Link href={profileHref} className="group mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 no-underline transition hover:-translate-y-px hover:bg-[#c7f238] hover:shadow-[0_6px_16px_rgba(0,59,42,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Complete KYC<ArrowRight size={17} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" /></Link>
      </section>
    </div>
  );
}
