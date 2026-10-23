import { BadgeCheck, ChartPie, ShieldCheck, UsersRound, type LucideIcon } from "lucide-react";
import Image from "next/image";

type CoreValue = {
  title: string;
  shortDescription: string;
  description: string[];
  icon: LucideIcon;
};

const coreValues: CoreValue[] = [
  {
    title: "Integrity",
    shortDescription: "We do what is right, even when it is not the easiest option.",
    description: [
      "Integrity is the foundation of every client relationship and investment decision we make. We operate with a strong commitment to honesty, transparency, accountability and ethical conduct.",
      "Our clients should clearly understand how their investments are managed, the risks involved and the fees they are paying.",
      "We believe trust is earned through consistent actions, responsible decision-making and open communication.",
    ],
    icon: ShieldCheck,
  },
  {
    title: "Client Focus",
    shortDescription: "Your goals come first.",
    description: [
      "Every client has different financial objectives, circumstances, risk tolerance and investment horizons.",
      "We begin by understanding those differences before recommending or managing an investment strategy.",
      "Our approach is built around listening carefully, communicating clearly and providing investment solutions that align with each client's specific needs.",
    ],
    icon: UsersRound,
  },
  {
    title: "Risk Resilience",
    shortDescription: "A disciplined approach to managing risk across changing market conditions.",
    description: [
      "Investment opportunities always involve risk.",
      "Our responsibility is not to eliminate risk completely, but to understand it, manage it carefully and ensure it remains consistent with each client's investment objectives.",
      "We apply disciplined risk frameworks, diversification, investment limits and ongoing portfolio monitoring to reduce unnecessary exposure.",
    ],
    icon: BadgeCheck,
  },
  {
    title: "Expertise",
    shortDescription: "Deep market knowledge supported by disciplined analysis.",
    description: [
      "Professional investment management requires continuous research, sound judgement and an understanding of changing economic and market conditions.",
      "We combine market knowledge, structured analysis and investment experience to support our decisions.",
      "We also believe expertise includes the ability to explain complex investment decisions clearly and practically to our clients.",
    ],
    icon: ChartPie,
  },
];

export function AboutCoreValues() {
  return (
    <section id="core-values" className="border-t border-star-200 bg-white py-16 sm:py-20 lg:py-[88px]" aria-labelledby="core-values-heading">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-7">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2.5 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-star-700">
            <span className="h-px w-7 bg-star-lime" aria-hidden="true" />
            Our core values
          </p>
          <h2 id="core-values-heading" className="mt-4 font-display text-[clamp(2rem,3.5vw,2.85rem)] font-bold leading-[1.08] tracking-[-0.04em] text-star-900">
            The principles that guide how we work
          </h2>
          <p className="mt-4 max-w-[43rem] text-sm leading-7 text-star-muted sm:text-[0.95rem]">
            Our values shape the way we make investment decisions, manage risk, communicate with clients and build long-term relationships.
          </p>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-14">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-star-200 bg-star-100 shadow-[0_6px_18px_rgba(0,59,42,0.06)]">
              <Image
                src="/images/advisory.webp"
                alt="Two African investment professionals reviewing portfolio analysis together in an office"
                fill
                sizes="(max-width: 1023px) calc(100vw - 2.5rem), 400px"
                className="object-cover object-center"
              />
            </div>
          </div>

          <div className="divide-y divide-star-200">
            {coreValues.map(({ title, shortDescription, description, icon: Icon }) => (
              <article key={title} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 py-7 first:pt-0 last:pb-0">
                <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-full bg-star-50 text-star-limeDark ring-1 ring-star-200" aria-hidden="true">
                  <Icon size={18} strokeWidth={2.1} />
                </span>
                <div>
                  <h3 className="text-[1.08rem] font-bold tracking-[-0.02em] text-star-900">{title}</h3>
                  <p className="mt-2 text-sm font-bold leading-6 text-star-ink">{shortDescription}</p>
                  <div className="mt-3 space-y-2.5 text-sm leading-6 text-star-muted">
                    {description.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
