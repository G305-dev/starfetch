"use client";

import { useEffect, useState } from "react";
import { getGreetingEmoji, getTimeGreeting, type TimeGreeting } from "@/lib/greeting";

export function DashboardGreeting({ firstName }: { firstName: string }) {
  // Start with the previous default, then sync to the visitor's local
  // time after mount so server rendering never mismatches the client.
  const [greeting, setGreeting] = useState<TimeGreeting>("Good morning");

  useEffect(() => {
    setGreeting(getTimeGreeting(new Date()));
  }, []);

  return <section><h1 className="font-display text-[clamp(1.9rem,3.2vw,2.65rem)] font-extrabold leading-[1.08] tracking-[-0.045em] text-star-900">{greeting}, {firstName} <span aria-hidden="true">{getGreetingEmoji(greeting)}</span></h1><p className="mt-2 text-sm leading-6 text-star-muted sm:text-[0.96rem]">Here&apos;s an overview of your investments and account activity.</p></section>;
}
