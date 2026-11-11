import { ChartPie, ShieldCheck, UsersRound, type LucideIcon } from "lucide-react";
import Image from "next/image";

type VisionPrinciple = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const visionPrinciples: VisionPrinciple[] = [
  {
    title: "Trusted Investment Partner",
    description: "We aim to build enduring relationships by operating with integrity, transparency and accountability. Clients should have confidence not only in how their investments are managed, but also in the information, communication and support they receive from us.",
    icon: ShieldCheck,
  },
  {
    title: "Investment Excellence",
    description: "We aspire to maintain a disciplined, research-driven investment culture where decisions are supported by sound analysis, professional judgement and effective risk management. Our objective is to continuously improve the quality of our investment process as markets and client needs evolve.",
    icon: ChartPie,
  },
  {
    title: "Long-Term Client Value",
    description: "Our vision extends beyond individual transactions or short-term market movements. We want to help clients build and preserve wealth through investment solutions designed around their objectives, risk tolerance and time horizon.",
    icon: UsersRound,
  },
];

export function AboutVision() {
  return (
    <section id="vision" className="border-y border-star-200 bg-white py-16 sm:py-20 lg:py-[88px]" aria-labelledby="vision-heading">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-7">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2.5 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-star-700">
            <span className="h-px w-7 bg-star-lime" aria-hidden="true" />
            Our vision
          </p>
          <h2 id="vision-heading" className="mt-4 font-display text-[clamp(2rem,3.5vw,2.85rem)] font-bold leading-[1.08] tracking-[-0.04em] text-star-900">
            Building a trusted future for investment management
          </h2>
          <p className="mt-4 max-w-[44rem] text-sm leading-7 text-star-muted sm:text-[0.95rem]">
            Our vision is to be a trusted and leading investment management company, recognised for disciplined investment practice, strong client relationships and consistent professional excellence.
          </p>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14">
          <div className="divide-y divide-star-200">
            {visionPrinciples.map(({ title, description, icon: Icon }) => (
              <article key={title} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 py-7 first:pt-0 last:pb-0">
                <span className="mt-0.5 grid h-10 w-10 place-items-center rounded-lg bg-star-50 text-star-limeDark ring-1 ring-star-200" aria-hidden="true">
                  <Icon size={20} strokeWidth={2.05} />
                </span>
                <div>
                  <h3 className="text-[1.08rem] font-bold tracking-[-0.02em] text-star-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-star-muted">{description}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative aspect-[3/2] overflow-hidden rounded-xl border border-star-200 bg-star-100 shadow-[0_6px_18px_rgba(0,59,42,0.06)]">
              <Image
                src="/images/about-vision.png"
                alt="A light bulb above the word Vision, representing clear direction and long-term thinking"
                fill
                sizes="(max-width: 1023px) calc(100vw - 2.5rem), 410px"
                className="object-cover object-center"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
