import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";
import { Eyebrow } from "./ui";

const audiences = [
  {
    title: "Individual investors",
    text: "Grow your wealth with solutions that fit your life goals.",
    image: "/images/client-individual-investors.png",
    alt: "A financial professional standing beside a rising market chart outside a modern office building",
    position: "object-[center_32%]",
  },
  {
    title: "Joint investors",
    text: "Plan together for shared goals and greater possibilities.",
    image: "/images/client-joint-investors.png",
    alt: "Two business figures shaking hands on a stack of coins, representing a shared investment partnership",
    position: "object-[center_15%]",
  },
  {
    title: "Corporate investors",
    text: "Tailored solutions for businesses, institutions and trusts.",
    image: "/images/client-corporate-investors.png",
    alt: "A business presenter leading a financial strategy meeting in a boardroom",
    position: "object-center",
  },
];

export function PersonalApproach() {
  return (
    <section className="bg-[#fffef9] py-14 sm:py-16 lg:py-[70px]">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-7">
        <Eyebrow>Our clients</Eyebrow>
        <h2 className="mt-2 font-display text-[clamp(1.75rem,3vw,2.42rem)] font-bold leading-[1.08] tracking-[-0.035em] text-star-900">A thoughtful approach for every investor</h2>
        <p className="mt-2 text-[0.8rem] text-star-muted">Different needs. A common purpose — building a more secure financial future.</p>
        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {audiences.map((audience, index) => (
            <Reveal key={audience.title} delay={index * 90} className="h-full">
              <article className="group h-full overflow-hidden rounded-[4px] border border-star-200 bg-white transition duration-300 ease-out hover:-translate-y-1 hover:border-star-300 hover:shadow-card focus-within:-translate-y-1 focus-within:border-star-300 focus-within:shadow-card">
                <div className="relative aspect-[1.8/0.82] overflow-hidden">
                  <Image src={audience.image} alt={audience.alt} fill sizes="(max-width: 768px) 100vw, 33vw" className={`object-cover transition duration-500 group-hover:scale-[1.035] ${audience.position}`} />
                </div>
                <div className="p-4">
                  <h3 className="text-[0.8rem] font-bold text-star-900">{audience.title}</h3>
                  <p className="mt-1 text-[0.64rem] leading-4 text-star-muted">{audience.text}</p>
                  <a href="#contact" className="mt-3 inline-flex items-center gap-1 text-[0.64rem] font-bold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">Learn more <ArrowRight size={13} aria-hidden="true" /></a>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
