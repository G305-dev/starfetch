import type { Metadata } from "next";
import Link from "next/link";
import { OnboardingHeader } from "@/components/auth/OnboardingHeader";

export const metadata: Metadata = {
  title: "Terms of Service | Starfetch Investment Limited",
  description: "Starfetch terms of service placeholder.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-star-50 text-star-900">
      <OnboardingHeader />
      <main className="mx-auto flex min-h-[calc(100vh-76px)] max-w-3xl items-center px-5 py-16 sm:px-8">
        <section className="w-full rounded-2xl border border-star-200 bg-white p-7 text-center shadow-card sm:p-10">
          <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-star-700">Starfetch legal</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.04em] text-star-900">Terms of Service</h1>
          <p className="mt-4 text-sm leading-6 text-star-muted">
            Terms of Service content has not been supplied for this frontend mockup. No legal terms are presented or implied on this page.
          </p>
          <Link
            href="/open-account"
            className="mt-7 inline-flex rounded-md border border-star-700 px-4 py-2.5 text-sm font-bold text-star-700 no-underline transition hover:bg-star-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
          >
            Return to account selection
          </Link>
        </section>
      </main>
    </div>
  );
}
