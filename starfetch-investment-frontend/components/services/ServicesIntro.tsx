export function ServicesIntro() {
  return (
    <section className="bg-[#fffef9] py-16 sm:py-20 lg:py-[76px]" aria-labelledby="services-page-heading">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-7">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2.5 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-star-700">
            <span className="h-px w-7 bg-star-lime" aria-hidden="true" />
            Our services
          </p>
          <h1 id="services-page-heading" className="mt-4 font-display text-[clamp(2.2rem,4vw,3.35rem)] font-bold leading-[1.06] tracking-[-0.045em] text-star-900">
            Investment solutions designed around your goals
          </h1>
          <p className="mt-5 max-w-[44rem] text-sm leading-7 text-star-muted sm:text-[0.98rem]">
            Starfetch provides structured investment solutions for individuals, families and organisations, with a focus on disciplined management, clear communication and appropriate risk oversight.
          </p>
        </div>
      </div>
    </section>
  );
}
