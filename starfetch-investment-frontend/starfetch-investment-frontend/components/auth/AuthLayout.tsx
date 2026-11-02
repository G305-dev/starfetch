import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui";

type AuthLayoutProps = {
  children: ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fffef9] text-star-900">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 sm:px-8 lg:px-10 lg:py-7">
        <Logo href="/" />
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-xs font-bold text-star-700 no-underline transition hover:bg-star-100 hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          <span className="hidden sm:inline">Back to website</span>
          <span className="sm:hidden">Website</span>
        </Link>
      </header>

      <div className="grid min-h-screen lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]">
        <section className="relative flex min-h-[39rem] items-center overflow-hidden bg-white px-5 pb-10 pt-28 sm:px-10 sm:pt-32 lg:min-h-screen lg:px-[clamp(2.5rem,6vw,7.5rem)] lg:py-28">
          <div className="relative z-10 max-w-[33rem]">
            <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.19em] text-star-700">
              Starfetch Investor Portal
            </p>
            <h1 className="mt-4 font-display text-[clamp(2.35rem,4.2vw,4.5rem)] font-bold leading-[1.02] tracking-[-0.055em] text-star-900">
              Welcome back
            </h1>
            <h2 className="mt-4 text-[clamp(1rem,1.7vw,1.35rem)] font-bold leading-tight text-star-700">
              Log in to continue
            </h2>
            <p className="mt-5 max-w-[30rem] text-sm leading-7 text-star-muted sm:text-[0.96rem]">
              Access your investments, portfolio updates, transactions and account information securely from your Starfetch Investor Portal.
            </p>
            <p className="mt-8 text-sm text-star-muted">
              New to Starfetch?{" "}
              <Link
                href="/open-account"
                className="font-bold text-star-700 underline decoration-star-lime decoration-2 underline-offset-4 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
              >
                Create an account
              </Link>
            </p>
          </div>

          <div className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full border-[34px] border-star-100/80" aria-hidden="true" />
          <div className="pointer-events-none absolute bottom-16 left-[18%] h-3 w-3 rounded-full bg-star-lime/90" aria-hidden="true" />
          <div className="pointer-events-none absolute bottom-28 left-[30%] h-2 w-2 rounded-full bg-star-200" aria-hidden="true" />
        </section>

        <section className="flex items-center bg-star-50 px-5 py-10 sm:px-10 lg:min-h-screen lg:px-[clamp(2.5rem,7vw,9rem)] lg:py-28">
          <div className="mx-auto w-full max-w-[35rem]">{children}</div>
        </section>
      </div>
    </main>
  );
}
