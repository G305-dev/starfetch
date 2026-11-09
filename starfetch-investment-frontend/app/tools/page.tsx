import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Free Tools | Starfetch Investment Limited",
  description: "Explore Starfetch's practical financial planning tools for budgeting, portfolio allocation and return scenarios.",
};

const tools = [
  {
    number: "TOOL 01",
    title: "Budget Planner",
    description: "Map your monthly income and spending, see your savings capacity, and compare against the 50/30/20 guideline.",
    action: "Open the planner →",
    href: "/tools/budget",
  },
  {
    number: "TOOL 02",
    title: "Portfolio Allocation Tool",
    description: "Six questions about your goals and risk comfort produce a suggested split across money-market, fixed-income and growth assets.",
    action: "Find your mix →",
  },
  {
    number: "TOOL 03",
    title: "Returns Calculator",
    description: "Project lump-sum and monthly contributions with compounding — including the effect of fees on your net outcome.",
    action: "Run the numbers →",
    href: "/tools/returns",
  },
] as const;

export default function FreeToolsPage() {
  return (
    <>
      <Navbar />
      <main className="bg-[#fffef9]">
        <section aria-labelledby="tools-heading" className="mx-auto max-w-[1280px] px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20 lg:px-10 lg:pb-24 lg:pt-24">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-star-700">Free tools</p>
            <h1 id="tools-heading" className="mt-4 font-display text-[clamp(2.55rem,6.4vw,5.4rem)] font-bold leading-[0.98] tracking-[-0.06em] text-star-900">
              Practical tools, <span className="inline-block bg-star-lime px-2 text-star-900">real clarity.</span>
            </h1>
            <p className="mt-7 max-w-3xl text-[1.05rem] leading-8 text-star-muted sm:text-[1.15rem] sm:leading-9">
              No account needed. Use them, share them, come back to them. If you would like your results emailed to you, we will ask for your consent first — and nothing else.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-6" aria-label="Free tools">
            {tools.map((tool) => (
              <article key={tool.number} className="group flex min-h-[286px] flex-col rounded-xl border border-star-200 bg-white p-7 transition duration-200 ease-out hover:border-star-300 hover:shadow-card sm:p-8 lg:min-h-[310px]">
                <p className="text-sm font-bold tracking-[0.08em] text-star-limeDark">{tool.number}</p>
                <h2 className="mt-6 font-display text-[1.5rem] font-bold leading-tight tracking-[-0.03em] text-star-900">{tool.title}</h2>
                <p className="mt-4 text-[0.98rem] leading-7 text-star-muted">{tool.description}</p>
                <div className="mt-auto pt-7">
                  {"href" in tool ? (
                    <Link href={tool.href} className="inline-flex items-center text-[0.96rem] font-bold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">
                      {tool.action}
                    </Link>
                  ) : (
                    <span aria-disabled="true" className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.96rem] font-bold text-star-700">
                      <span>{tool.action}</span>
                      <span className="text-[0.72rem] font-medium text-star-muted">(Coming soon)</span>
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
