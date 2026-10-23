import { Eye, Flower2, Umbrella } from "lucide-react";
import { FAQSection } from "./FAQSection";
import { MarketDigest } from "./MarketDigest";
import { Reveal } from "./Reveal";

const principles = [
  { icon: Umbrella, title: "Capital preservation", text: "We put risk management at the centre." },
  { icon: Eye, title: "Transparency", text: "We communicate clearly and honestly." },
  { icon: Flower2, title: "Disciplined investment process", text: "We follow a consistent, research-driven approach." },
];

export function InsightsSection() {
  return (
    <section className="bg-[#fffef9] py-14 sm:py-16 lg:py-[70px]">
      <div className="mx-auto grid max-w-[1100px] gap-8 px-5 md:grid-cols-3 lg:px-7">
        <section aria-labelledby="principles-heading">
          <p className="text-[0.57rem] font-bold uppercase tracking-[0.20em] text-star-700">Our principles</p>
          <h2 id="principles-heading" className="mt-2 font-display text-[1.65rem] font-bold leading-[1.04] tracking-[-0.035em] text-star-900">Long-term thinking.<br />Lasting value.</h2>
          <div className="mt-5 grid gap-4">
            {principles.map(({ icon: Icon, title, text }, index) => (
              <Reveal key={title} delay={index * 75}>
                <div className="flex items-center gap-3 transition-transform duration-300 ease-out hover:translate-x-1">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-star-100 text-star-700 transition-transform duration-300 hover:scale-105"><Icon size={16} aria-hidden="true" /></span>
                  <div><h3 className="text-[0.67rem] font-bold text-star-900">{title}</h3><p className="mt-0.5 text-[0.58rem] leading-3.5 text-star-muted">{text}</p></div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
        <section aria-labelledby="faq-heading">
          <p className="text-[0.57rem] font-bold uppercase tracking-[0.20em] text-star-700">Frequently asked questions</p>
          <h2 id="faq-heading" className="sr-only">Frequently asked questions</h2>
          <div className="mt-4"><FAQSection /></div>
        </section>
        <MarketDigest />
      </div>
    </section>
  );
}
