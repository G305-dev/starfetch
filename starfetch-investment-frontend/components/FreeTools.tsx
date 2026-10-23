import { ArrowRight, Calculator, PieChart, WalletMinimal } from "lucide-react";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./ui";

const tools = [
  { icon: WalletMinimal, title: "Budget Planner", text: "Plan your finances with ease.", link: "Open planner" },
  { icon: PieChart, title: "Portfolio Allocation Tool", text: "Explore different risk profiles.", link: "Explore your mix" },
  { icon: Calculator, title: "Returns Calculator", text: "Model different scenarios.", link: "Run calculations" },
];

export function FreeTools() {
  return (
    <section id="tools" className="bg-star-50 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-7">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            eyebrow="Free tools"
            title="Free tools for smarter decisions"
            description="Practical tools to help you plan, explore and make more informed investment decisions."
          />
          <a href="#contact" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">
            View all tools <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {tools.map(({ icon: Icon, title, text, link }, index) => (
            <Reveal key={title} delay={index * 75} className="h-full">
              <article className="group h-full rounded-lg border border-star-200 bg-white p-6 transition duration-300 ease-out hover:-translate-y-1 hover:border-star-300 hover:shadow-card focus-within:-translate-y-1 focus-within:border-star-300 focus-within:shadow-card">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-star-lime text-star-900"><Icon size={23} aria-hidden="true" /></span>
                <h3 className="mt-6 text-lg font-bold text-star-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-star-muted">{text}</p>
                <a href="#contact" className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-star-700 no-underline transition group-hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">
                  {link} <ArrowRight size={16} aria-hidden="true" />
                </a>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
