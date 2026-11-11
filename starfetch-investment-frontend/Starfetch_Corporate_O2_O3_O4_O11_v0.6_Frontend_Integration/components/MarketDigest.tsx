"use client";

import { ArrowRight } from "lucide-react";
import { FormEvent, useState } from "react";

export function MarketDigest() {
  const [notice, setNotice] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const consent = data.get("consent");
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!name || !isEmail || !consent) {
      setNotice("Enter your first name, a valid email address and consent before continuing.");
      return;
    }

    setNotice("This form is ready for integration. No subscription has been submitted from this frontend.");
  }

  return (
    <section aria-labelledby="digest-heading">
      <p className="text-[0.57rem] font-bold uppercase tracking-[0.20em] text-star-700">Market digest</p>
      <h2 id="digest-heading" className="mt-2 font-display text-[1.45rem] font-bold leading-[1.02] tracking-[-0.03em] text-star-900">Get market insights in your inbox</h2>
      <p className="mt-2 text-[0.65rem] leading-4 text-star-muted">A simple way to stay informed.</p>
      <form noValidate onSubmit={handleSubmit} className="mt-3 grid gap-2">
        <label className="sr-only" htmlFor="digest-name">First name</label>
        <input id="digest-name" name="name" type="text" placeholder="First name" className="h-8 rounded-[3px] border border-star-200 bg-white px-3 text-[0.6rem] text-star-900 placeholder:text-star-muted focus:outline-none focus:ring-1 focus:ring-star-700" />
        <label className="sr-only" htmlFor="digest-email">Email address</label>
        <input id="digest-email" name="email" type="email" placeholder="Email address" className="h-8 rounded-[3px] border border-star-200 bg-white px-3 text-[0.6rem] text-star-900 placeholder:text-star-muted focus:outline-none focus:ring-1 focus:ring-star-700" />
        <label className="flex items-start gap-2 pt-1 text-[0.53rem] leading-3 text-star-muted">
          <input name="consent" type="checkbox" className="mt-0.5 h-3 w-3 shrink-0 accent-[#075038]" />
          <span>I consent to receive market insights and company updates from Starfetch.</span>
        </label>
        <button type="submit" className="mt-1 inline-flex h-8 items-center justify-center gap-1.5 rounded-[3px] bg-star-lime px-3 text-[0.61rem] font-bold text-star-900 transition hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Subscribe <ArrowRight size={12} aria-hidden="true" /></button>
        {notice ? <p role="status" className="text-[0.54rem] leading-3 text-star-700">{notice}</p> : null}
      </form>
    </section>
  );
}
