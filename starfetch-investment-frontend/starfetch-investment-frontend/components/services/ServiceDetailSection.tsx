import Image from "next/image";
import type { ServiceDetail } from "./services-data";

export function ServiceDetailSection({ service }: { service: ServiceDetail }) {
  const isCream = service.tone === "cream";

  return (
    <section id={service.id} className={`${isCream ? "bg-[#fffef9]" : "bg-white"} scroll-mt-[60px] border-t border-star-200 py-16 sm:py-20 lg:py-[92px]`} aria-labelledby={`${service.id}-heading`}>
      <div className="mx-auto max-w-[1100px] px-5 lg:px-7">
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
          <div className={service.reverseLayout ? "lg:order-2" : ""}>
            <p className="flex items-center gap-2.5 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-star-700">
              <span className="h-px w-7 bg-star-lime" aria-hidden="true" />
              {service.eyebrow}
            </p>
            <h2 id={`${service.id}-heading`} className="mt-4 max-w-xl font-display text-[clamp(2rem,3.5vw,2.85rem)] font-bold leading-[1.08] tracking-[-0.04em] text-star-900">
              {service.title}
            </h2>
            <p className="mt-5 max-w-[35rem] text-[0.98rem] font-medium leading-7 text-star-ink">
              {service.description}
            </p>
            <p className="mt-4 max-w-[35rem] text-sm leading-7 text-star-muted sm:text-[0.95rem]">
              {service.supportingDescription}
            </p>

            <div className="mt-8 max-w-[35rem] border-t border-star-200 pt-6">
              <h3 className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-star-700">How it works</h3>
              <div className="mt-3 space-y-3 text-sm leading-7 text-star-muted sm:text-[0.95rem]">
                {service.howItWorks.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </div>
          </div>

          <aside className={`${service.reverseLayout ? "lg:order-1" : ""} overflow-hidden rounded-xl bg-star-900 text-white`} aria-label={`${service.title} details`}>
            <div className="relative aspect-[16/9] border-b border-white/15">
              <Image
                src={service.image}
                alt={service.imageAlt}
                fill
                sizes="(max-width: 1023px) calc(100vw - 2.5rem), 520px"
                className="object-cover object-center"
              />
            </div>
            <div className="divide-y divide-white/15 px-6 py-2 sm:px-8">
              <div className="py-6">
                <h3 className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-star-lime">Typical use</h3>
                <p className="mt-3 text-sm leading-7 text-star-100">{service.typicalUse}</p>
              </div>
              <div className="py-6">
                <h3 className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-star-lime">Risk character</h3>
                <p className="mt-3 text-sm leading-7 text-star-100">{service.riskCharacter}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
