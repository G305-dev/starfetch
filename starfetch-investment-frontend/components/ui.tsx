import Image from "next/image";
import type { AnchorHTMLAttributes, ReactNode } from "react";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <a href="#home" className="group inline-flex shrink-0 items-center gap-2" aria-label="Starfetch Investment Limited home">
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

type ButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  variant?: "lime" | "outline" | "outlineLight" | "light" | "dark";
  className?: string;
};

export function Button({ children, variant = "lime", className = "", ...props }: ButtonProps) {
  const variants = {
    lime: "bg-star-lime text-star-900 hover:bg-[#c7f238] focus-visible:ring-star-lime",
    outline: "border border-star-700 bg-transparent text-star-700 hover:bg-star-700 hover:text-white focus-visible:ring-star-700",
    outlineLight: "border border-white/70 bg-transparent text-white hover:bg-white hover:text-star-900 focus-visible:ring-white",
    light: "bg-white text-star-900 hover:bg-star-100 focus-visible:ring-white",
    dark: "bg-star-900 text-white hover:bg-star-800 focus-visible:ring-star-900",
  };

  return (
    <a {...props} className={`inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-bold no-underline transition duration-200 ease-out hover:-translate-y-px hover:shadow-[0_5px_14px_rgba(0,59,42,0.16)] active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${variants[variant]} ${className}`}>
      {children}
    </a>
  );
}

export function Eyebrow({ children, light = false, centered = false }: { children: ReactNode; light?: boolean; centered?: boolean }) {
  return (
    <p className={`flex items-center gap-2 text-[0.57rem] font-bold uppercase tracking-[0.20em] ${centered ? "justify-center" : ""} ${light ? "text-star-100" : "text-star-700"}`}>
      {children}
    </p>
  );
}

export function SectionHeading({ eyebrow, title, description, centered = false, light = false }: { eyebrow?: string; title: string; description?: string; centered?: boolean; light?: boolean }) {
  return (
    <div className={`${centered ? "mx-auto text-center" : ""} max-w-2xl`}>
      {eyebrow ? <Eyebrow light={light} centered={centered}>{eyebrow}</Eyebrow> : null}
      <h2 className={`mt-2 font-display text-[clamp(1.85rem,3.2vw,2.55rem)] font-bold leading-[1.08] tracking-[-0.035em] ${light ? "text-white" : "text-star-900"}`}>{title}</h2>
      {description ? <p className={`mt-2 text-sm leading-6 ${light ? "text-star-100" : "text-star-muted"}`}>{description}</p> : null}
    </div>
  );
}
