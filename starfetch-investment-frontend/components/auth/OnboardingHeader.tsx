import Link from "next/link";
import { Logo } from "@/components/ui";

export function OnboardingHeader() {
  return (
    <header className="border-b border-star-200 bg-white">
      <div className="mx-auto flex min-h-[76px] max-w-[1280px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
        <Logo href="/" />
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="hidden text-sm text-star-muted sm:inline">Already have an account?</span>
          <Link
            href="/login"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-star-700 px-4 text-sm font-bold text-white no-underline transition hover:-translate-y-px hover:bg-star-900 hover:shadow-[0_5px_14px_rgba(0,59,42,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 active:translate-y-0"
          >
            Log In
          </Link>
        </div>
      </div>
    </header>
  );
}
