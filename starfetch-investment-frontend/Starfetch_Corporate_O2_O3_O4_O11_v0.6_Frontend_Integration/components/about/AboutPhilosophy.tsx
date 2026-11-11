import { ShieldCheck, Target, TrendingUp, type LucideIcon } from "lucide-react";

type PhilosophyPrinciple = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const philosophyPrinciples: PhilosophyPrinciple[] = [
  {
    title: "Disciplined Decision-Making",
    description: "Every investment decision should be supported by clear objectives, structured analysis and sound judgement. We focus on understanding the opportunity, the risks involved and how each decision fits within the client's broader investment mandate.",
    icon: Target,
  },
  {
    title: "Risk Before Reward",
    description: "We believe return should always be considered alongside risk. Before pursuing an opportunity, we evaluate downside exposure, diversification, liquidity, concentration and suitability to ensure that risk remains aligned with the client's objectives.",
    icon: ShieldCheck,
  },
  {
    title: "Long-Term Perspective",
    description: "We look beyond short-term market movements and focus on building portfolios that can remain relevant across changing economic and market conditions. Patience, diversification and consistent monitoring are central to our approach.",
    icon: TrendingUp,
  },
];

export function AboutPhilosophy() {
  return (
    <section id="philosophy" className="bg-[#fffef9] py-16 sm:py-20 lg:py-[88px]" aria-labelledby="philosophy-heading">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-7">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2.5 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-star-700">
            <span className="h-px w-7 bg-star-lime" aria-hidden="true" />
            Our philosophy
          </p>
          <h2 id="philosophy-heading" className="mt-4 font-display text-[clamp(2rem,3.5vw,2.85rem)] font-bold leading-[1.08] tracking-[-0.04em] text-star-900">
            Disciplined thinking. Clear decisions. Long-term value.
          </h2>
          <p className="mt-4 max-w-[44rem] text-sm leading-7 text-star-muted sm:text-[0.95rem]">
            Our investment philosophy is built around disciplined analysis, thoughtful risk management and a clear understanding of each client&apos;s objectives. We focus on making informed decisions that support sustainable long-term outcomes rather than reacting to short-term market noise.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {philosophyPrinciples.map(({ title, description, icon: Icon }) => (
            <article key={title} className="flex h-full flex-col rounded-lg border border-star-200 bg-white p-6 sm:p-7">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-star-100 text-star-900" aria-hidden="true">
                <Icon size={21} strokeWidth={2.05} />
              </span>
              <h3 className="mt-5 text-[1.05rem] font-bold leading-6 tracking-[-0.02em] text-star-900">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-star-muted">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
