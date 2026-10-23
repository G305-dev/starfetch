import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button, Eyebrow } from "./ui";

export function CTASection() {
  return (
    <section className="relative isolate overflow-hidden py-11 sm:py-12">
      <Image src="/images/hero-bridge.webp" alt="The Lekki–Ikoyi Link Bridge in Lagos" fill sizes="100vw" className="-z-20 object-cover object-[60%_65%]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(0,59,42,0.93)_0%,rgba(0,59,42,0.82)_53%,rgba(0,59,42,0.37)_100%)]" />
      <div className="mx-auto flex max-w-[1100px] flex-col justify-between gap-6 px-5 sm:flex-row sm:items-center lg:px-7">
        <div>
          <Eyebrow light>Let&apos;s plan together</Eyebrow>
          <h2 className="mt-2 font-display text-[clamp(1.6rem,3vw,2.4rem)] font-bold leading-[1.06] tracking-[-0.035em] text-white">Let&apos;s plan your investment goals</h2>
          <p className="mt-2 text-[0.72rem] text-white/90">Speak with our team about the right solution for you, your family or your organisation.</p>
        </div>
        <Button href="#contact" variant="lime" className="shrink-0 self-start rounded-[4px] px-4 py-3 text-[0.68rem] sm:self-auto">Open an Account <ArrowRight size={14} aria-hidden="true" /></Button>
      </div>
    </section>
  );
}
