import Image from "next/image";

export function Logo({ light = false, href = "#home" }: { light?: boolean; href?: string }) {
  return (
    <a href={href} className="group inline-flex shrink-0 items-center gap-2" aria-label="Starfetch Investment Limited home">
      <Image
        src="/images/logo-icon.svg"
        alt=""
        width={35}
        height={35}
        priority
        className={light ? "h-9 w-9 [filter:brightness(0)_saturate(100%)_invert(87%)_sepia(27%)_saturate(1535%)_hue-rotate(26deg)_brightness(102%)_contrast(86%)]" : "h-9 w-9"}
      />
      <span className={`text-[0.82rem] font-bold leading-[1.02] tracking-[0.02em] ${light ? "text-white" : "text-star-700"}`}>
        STARFETCH
        <span className={`mt-0.5 block text-[0.42rem] font-bold tracking-[0.13em] ${light ? "text-star-100" : "text-star-700"}`}>INVESTMENT LIMITED</span>
      </span>
    </a>
  );
}

