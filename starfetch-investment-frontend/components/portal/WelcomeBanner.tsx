import Image from "next/image";

export function WelcomeBanner() {
  return (
    <section className="relative min-h-[205px] overflow-hidden rounded-xl bg-star-900 p-6 text-white sm:p-8" aria-labelledby="welcome-banner-heading">
      <Image src="/images/hero-bridge.webp" alt="Lagos bridge skyline" fill priority sizes="(max-width: 1279px) 100vw, 850px" className="object-cover object-[60%_58%] opacity-65" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,59,42,0.96)_0%,rgba(0,59,42,0.86)_48%,rgba(0,59,42,0.28)_100%)]" />
      <div className="relative z-10 grid min-h-[157px] gap-6 md:grid-cols-[minmax(0,1fr)_minmax(190px,0.6fr)] md:items-center">
        <div><h1 id="welcome-banner-heading" className="font-display text-[clamp(1.8rem,3.3vw,2.7rem)] font-extrabold leading-[1.06] tracking-[-0.045em]">Welcome to Starfetch <span aria-hidden="true">👋</span></h1><p className="mt-3 text-sm leading-6 text-white/90 sm:text-[0.96rem]">Complete your account setup to begin your investment journey.</p></div>
        <blockquote className="border-l border-white/40 pl-5 text-[clamp(1.1rem,2vw,1.4rem)] font-medium leading-6 text-white/95">“Invest today for a better tomorrow.”</blockquote>
      </div>
    </section>
  );
}
