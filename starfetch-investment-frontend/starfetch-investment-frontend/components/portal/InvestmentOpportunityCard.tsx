import { ArrowRight } from "lucide-react";
import Image from "next/image";

export function InvestmentOpportunityCard() {
  return (
    <section className="relative min-h-[190px] overflow-hidden rounded-xl border border-star-200 bg-star-100 p-5" aria-labelledby="investment-opportunities-heading">
      <Image
        src="/images/meeting.webp"
        alt="Professionals discussing investment opportunities"
        fill
        sizes="(max-width: 1279px) 100vw, 360px"
        className="object-cover object-center opacity-30"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(237,246,222,0.98)_0%,rgba(237,246,222,0.9)_58%,rgba(237,246,222,0.28)_100%)]" />
      <div className="relative z-10 max-w-[17rem]">
        <h2 id="investment-opportunities-heading" className="text-lg font-extrabold leading-6 text-star-900">Explore More Investment Opportunities</h2>
        <p className="mt-3 text-sm leading-5 text-star-700">Diversify your portfolio with our range of investment solutions.</p>
        <a
          href="/services"
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-star-900 px-4 text-sm font-bold text-white no-underline transition hover:-translate-y-px hover:bg-star-700 hover:shadow-[0_5px_14px_rgba(0,59,42,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
        >
          View Products <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
