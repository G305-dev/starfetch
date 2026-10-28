import { ArrowRight, BadgeCheck, Check, Mail } from "lucide-react";
import Link from "next/link";

const mockVerifiedEmail = "you@example.com";
const emailVerified = true;

export function EmailVerificationSuccess() {
  return (
    <section className="mx-auto w-full max-w-xl text-center">
      <div className="rounded-2xl border border-star-200 bg-white p-7 shadow-card sm:p-10">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-star-100 text-star-700 motion-safe:animate-[success-pop_500ms_ease-out_both]"><BadgeCheck size={34} strokeWidth={1.8} aria-hidden="true" /></div>
        <p className="mt-7 text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-star-700">Starfetch Investor Portal</p>
        <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.08] tracking-[-0.045em] text-star-900">Email Verified Successfully</h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-star-muted sm:text-[0.96rem]">Your email address has been successfully verified. Continue onboarding to select your mandate and complete your remaining personal details.</p>
        {emailVerified ? <div className="mt-7 rounded-xl border border-star-200 bg-star-50 px-4 py-4 text-left"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-star-700 shadow-[0_2px_7px_rgba(0,59,42,0.06)]" aria-hidden="true"><Mail size={19} /></span><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.11em] text-star-muted">Verified Email</p><p className="mt-1 truncate text-sm font-bold text-star-900">{mockVerifiedEmail}</p></div><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-star-100 px-2.5 py-1 text-[0.68rem] font-extrabold text-star-700"><Check size={13} strokeWidth={3} aria-hidden="true" />Verified</span></div></div> : null}
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-star-50 px-3 py-2 text-xs font-bold text-star-700"><Check size={14} strokeWidth={3} aria-hidden="true" />Verification code accepted</div>
        <Link href="/register/individual/onboarding" className="group mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 no-underline transition duration-200 hover:-translate-y-px hover:bg-[#c7f238] hover:shadow-[0_6px_16px_rgba(0,59,42,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 active:translate-y-0">Continue Onboarding<ArrowRight size={17} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5" /></Link>
        <p className="mt-6 text-sm text-star-muted">Need help? <Link href="/#contact" className="font-bold text-star-700 underline decoration-star-lime decoration-2 underline-offset-4 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Contact Support</Link></p>
      </div>
    </section>
  );
}
