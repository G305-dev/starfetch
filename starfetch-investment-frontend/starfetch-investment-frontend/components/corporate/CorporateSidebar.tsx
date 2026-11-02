"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/ui";
import { corporateSidebarNavigation } from "./corporate-dashboard-data";

function CorporateNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1.5" aria-label="Corporate account navigation">
      {corporateSidebarNavigation.map(({ label, href, icon: Icon }) => {
        const routePath = href.split("#")[0];
        const active = !href.includes("#") && pathname === routePath;
        return <a key={label} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold no-underline transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-lime focus-visible:ring-offset-2 focus-visible:ring-offset-star-900 ${active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}><span className={`absolute bottom-1 left-0 top-1 w-1 rounded-r-full ${active ? "bg-star-lime" : "bg-transparent"}`} aria-hidden="true" /><Icon size={20} strokeWidth={1.9} aria-hidden="true" /><span>{label}</span></a>;
      })}
    </nav>
  );
}

export function CorporateSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open corporate navigation" className="fixed left-4 top-[18px] z-[60] grid h-10 w-10 place-items-center rounded-md bg-star-900 text-white shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-lime focus-visible:ring-offset-2 lg:hidden"><Menu size={21} aria-hidden="true" /></button>
      <aside className="hidden min-h-screen w-[236px] shrink-0 flex-col bg-[linear-gradient(180deg,#003B2A_0%,#002D20_100%)] text-white lg:sticky lg:top-0 lg:flex" aria-label="Corporate account navigation"><div className="border-b border-white/10 px-6 py-6"><Logo light href="/corporate/dashboard" /></div><div className="px-3 py-5"><CorporateNavigation /></div></aside>
      {open ? <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Corporate navigation menu"><button type="button" className="absolute inset-0 bg-star-900/45" aria-label="Close corporate navigation" onClick={() => setOpen(false)} /><aside className="relative flex h-full w-[min(19rem,84vw)] flex-col bg-star-900 px-4 py-5 shadow-2xl"><div className="flex items-center justify-between border-b border-white/10 px-2 pb-5"><Logo light href="/corporate/dashboard" /><button type="button" onClick={() => setOpen(false)} aria-label="Close corporate navigation" className="grid h-10 w-10 place-items-center rounded-md text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-lime"><X size={21} aria-hidden="true" /></button></div><div className="mt-5"><CorporateNavigation onNavigate={() => setOpen(false)} /></div></aside></div> : null}
    </>
  );
}
