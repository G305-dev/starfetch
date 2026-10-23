import Image from "next/image";

export function WhoWeAreAbout() {
  return (
    <section id="who-we-are" className="bg-[#fffef9] py-16 sm:py-20 lg:py-[88px]" aria-labelledby="about-who-we-are-heading">
      <div className="mx-auto grid max-w-[1100px] items-center gap-10 px-5 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] md:gap-10 lg:gap-14 lg:px-7">
        <div className="max-w-[31rem]">
          <p className="flex items-center gap-2.5 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-star-700">
            <span className="h-px w-7 bg-star-lime" aria-hidden="true" />
            About us
          </p>
          <h1 id="about-who-we-are-heading" className="mt-4 font-display text-[clamp(2.15rem,4vw,3.25rem)] font-bold leading-[1.06] tracking-[-0.045em] text-star-900">
            Who We Are
          </h1>
          <div className="mt-6 space-y-4 text-sm leading-7 text-star-muted sm:text-[0.95rem]">
            <p className="font-medium text-star-ink">
              Starfetch Investment Limited is a Lagos-based investment management company focused on helping individuals, families, institutions and eligible international investors build and preserve wealth through disciplined investment management.
            </p>
            <p>
              Our approach combines professional investment expertise, disciplined risk management and clear communication. We believe investment management should be structured and rigorous without being distant or difficult to understand.
            </p>
            <p>
              We work to understand each client&apos;s objectives, risk tolerance and time horizon before recommending or managing investment solutions. Our goal is to build long-term relationships based on integrity, transparency and measurable client outcomes.
            </p>
          </div>
        </div>

        <div className="relative aspect-video overflow-hidden rounded-xl border border-star-200 bg-star-100 shadow-[0_6px_18px_rgba(0,59,42,0.06)]">
          <Image
            src="/images/about-who-we-are.png"
            alt="A team of African professionals collaborating around a laptop in an office"
            fill
            sizes="(max-width: 767px) calc(100vw - 2.5rem), (max-width: 1100px) calc(50vw - 2rem), 570px"
            className="object-cover object-center"
          />
        </div>
      </div>
    </section>
  );
}
