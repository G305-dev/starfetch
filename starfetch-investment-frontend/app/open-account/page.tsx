import type { Metadata } from "next";
import { AccountTypeSelection } from "@/components/auth/AccountTypeSelection";
import { OnboardingHeader } from "@/components/auth/OnboardingHeader";

export const metadata: Metadata = {
  title: "Choose Account Type | Starfetch Investment Limited",
  description: "Choose the type of Starfetch investment account you would like to open.",
};

export default function OpenAccountPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fffef9] text-star-900">
      <OnboardingHeader />
      <main className="relative isolate flex min-h-[calc(100vh-76px)] items-center px-5 py-14 sm:px-8 sm:py-16 lg:px-10 lg:py-20">
        <div className="pointer-events-none absolute -left-32 top-24 -z-10 h-80 w-80 rounded-full bg-star-100/65 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-28 bottom-12 -z-10 h-96 w-96 rotate-12 border-[42px] border-star-100/80" aria-hidden="true" />
        <AccountTypeSelection />
      </main>
      <footer className="relative z-10 border-t border-star-200 bg-white/85 px-5 py-5 text-[0.7rem] text-star-muted backdrop-blur-sm sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1280px] items-center gap-3 text-center sm:grid-cols-3 sm:text-left">
          <a
            href="https://starfetchinvestltd.com.ng/privacy"
            className="w-fit justify-self-center font-semibold text-star-700 no-underline transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 sm:justify-self-start"
          >
            Privacy Policy
          </a>
          <p className="justify-self-center">© 2026 Starfetch Investment Limited</p>
          <a
            href="/terms-of-service"
            className="w-fit justify-self-center font-semibold text-star-700 no-underline transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 sm:justify-self-end"
          >
            Terms of Service
          </a>
        </div>
      </footer>
    </div>
  );
}
