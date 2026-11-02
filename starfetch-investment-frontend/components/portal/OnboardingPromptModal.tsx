"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

type Props = {
  onDefer: () => void;
  variant?: "individual" | "business";
};

export function OnboardingPromptModal({ onDefer, variant = "individual" }: Props) {
  const business = variant === "business";
  const description = business
    ? "Complete your business profile and account setup to prepare your business investment journey."
    : "Complete your profile and account setup to prepare for your investment journey. You can return to this whenever you are ready.";
  const actionHref = business ? "/corporate/settings" : "/profile";
  const actionLabel = business ? "Account settings" : "Start onboarding";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-star-900/45 px-5 py-6 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="onboarding-prompt-title" aria-describedby="onboarding-prompt-description">
      <section className="relative w-full max-w-md rounded-2xl border border-star-200 bg-white p-6 shadow-[0_20px_55px_rgba(0,59,42,0.28)] sm:p-7">
        <span className="grid size-12 place-items-center rounded-full bg-[#e4f7e8] text-[#168348]"><CheckCircle2 size={25} aria-hidden="true" /></span>
        <p className="mt-5 text-[0.66rem] font-extrabold uppercase tracking-[0.16em] text-star-700">Welcome to Starfetch</p>
        <h2 id="onboarding-prompt-title" className="mt-2 font-display text-2xl font-extrabold tracking-[-0.04em] text-star-900">Start your onboarding</h2>
        <p id="onboarding-prompt-description" className="mt-3 text-sm leading-6 text-star-muted">{description}</p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onDefer} className="min-h-11 rounded-lg border border-star-200 px-5 text-sm font-extrabold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">Do it later</button>
          <Link href={actionHref} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 no-underline transition hover:-translate-y-px hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">{actionLabel}<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  );
}
