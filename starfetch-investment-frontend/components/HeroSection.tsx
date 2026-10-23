"use client";

import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";
import { Button, Eyebrow } from "./ui";

const heroSlides = [
  {
    src: "/images/hero-bridge.webp",
    alt: "The Lekki–Ikoyi Link Bridge, Lagos — minutes from our Lekki office",
    position: "object-[59%_center]",
  },
  {
    src: "/images/advisory.webp",
    alt: "A Starfetch portfolio manager presenting analysis to a client",
    position: "object-center",
  },
  {
    src: "/images/couple.webp",
    alt: "Clients reviewing their portfolio together at home",
    position: "object-center",
  },
];

export function HeroSection() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [timerVersion, setTimerVersion] = useState(0);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => setReduceMotion(query.matches);
    syncMotionPreference();
    query.addEventListener("change", syncMotionPreference);
    return () => query.removeEventListener("change", syncMotionPreference);
  }, []);

  useEffect(() => {
    if (isPaused || reduceMotion) return;
    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [isPaused, reduceMotion, timerVersion]);

  function goToSlide(index: number) {
    setActiveSlide((index + heroSlides.length) % heroSlides.length);
    setTimerVersion((current) => current + 1);
  }

  function showPreviousSlide() {
    goToSlide(activeSlide - 1);
  }

  function showNextSlide() {
    goToSlide(activeSlide + 1);
  }

  function resumeWhenFocusLeaves(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsPaused(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPreviousSlide();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      showNextSlide();
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    setSwipeStartX(event.clientX);
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (swipeStartX === null) return;
    const distance = event.clientX - swipeStartX;
    setSwipeStartX(null);
    if (Math.abs(distance) > 40) {
      goToSlide(activeSlide + (distance < 0 ? 1 : -1));
    }
  }

  return (
    <section
      id="home"
      aria-roledescription="carousel"
      aria-label="Starfetch Investment Limited highlights"
      className="relative isolate h-[385px] overflow-hidden sm:h-[430px] lg:h-[450px]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={resumeWhenFocusLeaves}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {heroSlides.map((slide, index) => {
        const isActive = activeSlide === index;
        return (
          <div
            key={slide.src}
            aria-hidden={!isActive}
            className={`absolute inset-0 transition-opacity duration-700 ease-[ease] motion-reduce:transition-none ${isActive ? "z-[1] opacity-100" : "z-0 pointer-events-none opacity-0"}`}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={index === 0}
              sizes="100vw"
              className={`hero-slide-image ${isActive ? "hero-slide-image-active" : ""} object-cover ${slide.position}`}
            />
          </div>
        );
      })}
      <div className="absolute inset-0 z-[2] bg-black/30" />

      <div className="relative z-[3] mx-auto flex h-full max-w-[1170px] items-center justify-center px-5 pb-9 pt-2 text-center lg:px-7">
        <div className="mx-auto max-w-[620px]">
          <Eyebrow light centered>Invest with purpose</Eyebrow>
          <h1 className="mt-3 font-display text-[clamp(2.05rem,4.6vw,3.55rem)] font-bold leading-[1.03] tracking-[-0.045em] text-white">Disciplined investing, transparent by design.</h1>
          <p className="mx-auto mt-3 max-w-[34rem] text-[0.93rem] leading-5 text-white/90 sm:text-[1rem] sm:leading-6">Thoughtful investment management for individuals, families and organisations.</p>
          <div className="mt-5 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button href="#contact" variant="lime" className="rounded-[4px] px-4 py-2.5 text-[0.68rem]">Start Investing <ArrowRight size={14} aria-hidden="true" /></Button>
            <a href="#services" className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold text-white no-underline transition hover:text-star-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-lime">Explore our services <ArrowRight size={14} aria-hidden="true" /></a>
          </div>
        </div>
      </div>

      <button type="button" onClick={showPreviousSlide} className="absolute left-4 top-1/2 z-[4] grid h-[38px] w-[38px] -translate-y-1/2 place-items-center rounded-full bg-white/90 text-star-900 transition hover:bg-star-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-lime sm:left-5 sm:h-[46px] sm:w-[46px]" aria-label="Show previous hero image">
        <ChevronLeft size={22} aria-hidden="true" />
      </button>
      <button type="button" onClick={showNextSlide} className="absolute right-4 top-1/2 z-[4] grid h-[38px] w-[38px] -translate-y-1/2 place-items-center rounded-full bg-white/90 text-star-900 transition hover:bg-star-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-lime sm:right-5 sm:h-[46px] sm:w-[46px]" aria-label="Show next hero image">
        <ChevronRight size={22} aria-hidden="true" />
      </button>
      <div className="absolute bottom-4 left-1/2 z-[4] flex -translate-x-1/2 items-center gap-2" aria-label="Hero slide indicators">
        {heroSlides.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            onClick={() => goToSlide(index)}
            aria-label={`Go to slide ${index + 1}: ${slide.alt}`}
            aria-current={activeSlide === index ? "true" : undefined}
            className={`h-2.5 rounded-full border-0 p-0 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-lime ${activeSlide === index ? "w-[26px] bg-star-lime" : "w-2.5 bg-white/55 hover:bg-white"}`}
          />
        ))}
      </div>
    </section>
  );
}
