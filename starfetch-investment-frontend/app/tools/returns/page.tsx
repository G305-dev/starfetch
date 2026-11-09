import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { ReturnsCalculator } from "@/components/tools/ReturnsCalculator";

export const metadata: Metadata = {
  title: "Returns Calculator | Starfetch Investment Limited",
  description: "Explore illustrative monthly-compounding return scenarios using your own starting amount, contributions, return and fee assumptions.",
};

export default function ReturnsCalculatorPage() {
  return (
    <>
      <Navbar />
      <main className="bg-[#fffef9] py-10 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-7 lg:px-8">
          <Link href="/tools" className="inline-flex items-center gap-2 text-sm font-semibold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">
            <span aria-hidden="true">←</span>
            Back to Free Tools
          </Link>
          <header className="mt-7 max-w-3xl">
            <p className="text-[0.64rem] font-bold uppercase tracking-[0.2em] text-star-700">Free Tool 03</p>
            <h1 className="mt-3 font-display text-[clamp(2.2rem,5vw,4rem)] font-bold leading-[1.02] tracking-[-0.055em] text-star-900">Returns calculator</h1>
            <p className="mt-4 text-[1rem] leading-7 text-star-muted sm:text-[1.08rem]">Project how a starting amount plus monthly contributions could compound — and see the difference fees make.</p>
          </header>
          <div className="mt-10 lg:mt-12">
            <ReturnsCalculator />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
