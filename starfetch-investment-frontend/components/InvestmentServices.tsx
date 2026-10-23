import Image from "next/image";
import { ArrowRight, BarChart3, FileText, UsersRound } from "lucide-react";
import { services } from "./site-data";
import { Reveal } from "./Reveal";
import { Eyebrow } from "./ui";

const serviceIcons = [FileText, BarChart3, UsersRound];

export function InvestmentServices() {
  return (
    <section id="services" className="bg-[#EFF7DE] py-14 sm:py-16 lg:py-[70px]">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-7">
        <div className="text-center">
          <Eyebrow centered>Our investment solutions</Eyebrow>
          <h2 className="mt-2 font-display text-[clamp(1.8rem,3.15vw,2.55rem)] font-bold leading-[1.05] tracking-[-0.035em] text-star-900">How would you like to invest?</h2>
          <p className="mt-2 text-[0.8rem] text-star-muted">Simple, professional solutions for different goals and time horizons.</p>
        </div>
        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {services.map((service, index) => {
            const Icon = serviceIcons[index];
            return (
              <Reveal key={service.title} delay={index * 90} className="h-full">
                <article id={service.id} className="group h-full scroll-mt-[72px] overflow-hidden rounded-[4px] border border-star-200 bg-[#fffef9] shadow-[0_4px_14px_rgba(0,59,42,0.04)] transition duration-300 ease-out hover:-translate-y-1 hover:border-star-300 hover:shadow-card focus-within:-translate-y-1 focus-within:border-star-300 focus-within:shadow-card">
                  <div className="relative aspect-[1.8/0.86] overflow-hidden">
                    <Image src={service.image} alt={service.alt} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.035]" />
                  </div>
                  <div className="relative px-4 pb-4 pt-6">
                    <span className="absolute -top-5 left-4 grid h-10 w-10 place-items-center rounded-full bg-star-100 text-star-700 ring-4 ring-[#eff7de]"><Icon size={18} aria-hidden="true" /></span>
                    <h3 className="text-[0.78rem] font-bold text-star-900">{service.title}</h3>
                    <p className="mt-2 min-h-[48px] text-[0.65rem] leading-4 text-star-muted">{service.description}</p>
                    <a href="#contact" className="mt-3 inline-flex items-center gap-1 text-[0.64rem] font-bold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">Learn more <ArrowRight size={13} aria-hidden="true" /></a>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
