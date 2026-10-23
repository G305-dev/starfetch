import { ArrowRight } from "lucide-react";
import { Button } from "../ui";

export function ServicesCTA() {
  return (
    <section className="bg-star-900 py-16 sm:py-20 lg:py-[84px]" aria-labelledby="services-cta-heading">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-7">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2.5 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-star-lime">
            <span className="h-px w-7 bg-star-lime" aria-hidden="true" />
            Talk to Starfetch
          </p>
          <h2 id="services-cta-heading" className="mt-4 font-display text-[clamp(2rem,3.5vw,2.85rem)] font-bold leading-[1.08] tracking-[-0.04em] text-white">
            Find the investment approach that fits your goals
          </h2>
          <p className="mt-4 max-w-[40rem] text-sm leading-7 text-star-100 sm:text-[0.95rem]">
            Speak with our team to understand which Starfetch solution may be appropriate for your objectives and risk profile.
          </p>
          <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row">
            <Button href="#contact" variant="lime" className="rounded-[5px] px-5 py-3 text-[0.8rem]">
              Start Investing <ArrowRight size={15} aria-hidden="true" />
            </Button>
            <Button href="#contact" variant="outlineLight" className="rounded-[5px] px-5 py-3 text-[0.8rem]">
              Speak with an Adviser
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
