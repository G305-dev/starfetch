"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui";
import { portalNavigation } from "./dashboard-data";

function NavigationLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1.5" aria-label={mobile ? "Mobile investor portal navigation" : "Investor portal navigation"}>
      {portalNavigation.map(({ label, href, icon: Icon }) => {
        const active = href === pathname;

        return (
          <a
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex min-h-12 items-center gap-3 rounded-lg px-3.5 text-sm font-bold no-underline transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 ${
              active
                ? "bg-star-100 text-star-900"
                : "text-star-700 hover:bg-star-50 hover:text-star-900"
            }`}
          >
            {active ? <span className="absolute -left-3 h-8 w-1 rounded-r-full bg-star-lime" aria-hidden="true" /> : null}
            <Icon size={20} strokeWidth={2} className="shrink-0 text-star-700" aria-hidden="true" />
            {label}
          </a>
        );
      })}
    </nav>
  );
}

export function PortalSidebar() {
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[270px] shrink-0 flex-col border-r border-star-200 bg-white px-4 py-5 lg:flex">
        <Logo href="/" />
        <div className="mt-10">
          <NavigationLinks />
        </div>
        <PromoCard />
      </aside>

      <details className="group relative z-50 lg:hidden">
        <summary className="absolute left-5 top-4 z-50 grid h-10 w-10 cursor-pointer list-none place-items-center rounded-md border border-star-200 bg-white text-star-700 shadow-sm transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 sm:left-8 [&::-webkit-details-marker]:hidden">
          <Menu size={20} aria-hidden="true" className="group-open:hidden" />
          <X size={20} aria-hidden="true" className="hidden group-open:block" />
          <span className="sr-only">Toggle investor portal navigation</span>
        </summary>
        <div className="fixed inset-x-0 bottom-0 top-[76px] overflow-y-auto border-t border-star-200 bg-white px-5 py-7 shadow-[0_16px_40px_rgba(0,59,42,0.13)] sm:px-8">
          <NavigationLinks mobile />
          <PromoCard mobile />
        </div>
      </details>
    </>
  );
}

function PromoCard({ mobile = false }: { mobile?: boolean }) {
  return (
    <section className={`${mobile ? "mt-8 max-w-sm" : "mt-auto"} relative min-h-[250px] overflow-hidden rounded-xl border border-star-200 bg-star-900 p-5 text-white`} aria-labelledby={mobile ? "mobile-sidebar-promo" : "sidebar-promo"}>
      <Image src="/images/hero-bridge.webp" alt="Lagos bridge at sunset" fill sizes={mobile ? "384px" : "238px"} className="object-cover object-[55%_65%] opacity-65" />
      <div className="absolute inset-0 bg-[linear-gradient(155deg,rgba(0,59,42,0.94)_5%,rgba(0,59,42,0.78)_60%,rgba(0,59,42,0.55)_100%)]" />
      <div className="relative z-10 flex min-h-[210px] max-w-[12rem] flex-col">
        <h2 id={mobile ? "mobile-sidebar-promo" : "sidebar-promo"} className="text-xl font-extrabold leading-6">Build your financial future with confidence</h2>
        <p className="mt-4 text-xs leading-5 text-white/90">Professional investment solutions for a brighter tomorrow.</p>
        <a
          href="/services"
          className="mt-auto inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-white/80 bg-white/10 px-3 text-xs font-bold text-white no-underline transition hover:bg-white hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-lime focus-visible:ring-offset-2 focus-visible:ring-offset-star-900"
        >
          Explore Products <ArrowRight size={14} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
