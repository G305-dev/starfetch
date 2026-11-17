"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function FixedNoteRatesPopup() {
  const [isOpen, setIsOpen] = useState(true);
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-star-900/75 p-3 backdrop-blur-sm sm:p-5"
      onClick={(event) => {
        if (event.target === event.currentTarget) setIsOpen(false);
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fixed-note-rates-popup-title"
        aria-describedby="fixed-note-rates-popup-description"
        tabIndex={-1}
        className="max-h-[calc(100dvh-1.5rem)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl bg-[#f7f6ed] shadow-[0_24px_80px_rgba(0,26,18,0.45)] sm:max-h-[calc(100dvh-2.5rem)] sm:max-w-[calc(100vw-2.5rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="fixed-note-rates-popup-title" className="sr-only">Starfetch Fixed Note Rates</h2>
        <p id="fixed-note-rates-popup-description" className="sr-only">
          Fixed Note rates for 180 and 365 days, across investment bands from ten million naira to five hundred million naira and above. The poster also shows the minimum investment, tax and early-exit terms, rollover information, and contact details.
        </p>
        <div className="flex h-10 items-center justify-end px-2">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close Fixed Note rates popup"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white/90 px-3 text-xs font-bold text-star-900 shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
          >
            Close <X size={15} aria-hidden="true" />
          </button>
        </div>
        <Image
          src="/images/fixed-note-rates-popup.png"
          alt="Starfetch Fixed Note rates poster showing 180-day and 365-day rates for different investment bands."
          width={1080}
          height={1080}
          priority
          sizes="(max-width: 720px) 92vw, 760px"
          className="block h-auto max-h-[calc(100dvh-4.5rem)] w-auto max-w-[calc(100vw-1.5rem)] object-contain sm:max-h-[calc(100dvh-5.5rem)] sm:max-w-[calc(100vw-2.5rem)]"
        />
      </section>
    </div>
  );
}
