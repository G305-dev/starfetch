"use client";

import { ArrowRight, Menu, Settings, X } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui";
import { portalNavigation } from "./dashboard-data";

type PortalSidebarProps = {
  dashboardAlias?: string;
  businessDashboard?: boolean;
  /** Enables the forest-green portal shell used by the individual SEC/KYC profile. */
  dark?: boolean;
};

type NavigationLinksProps = PortalSidebarProps & { mobile?: boolean };

function NavigationLinks({ mobile = false, dashboardAlias, businessDashboard = false, dark = false }: NavigationLinksProps) {
  const pathname = usePathname();
  const navigation = businessDashboard
    ? portalNavigation.map((item) => {
      if (item.label === "Dashboard") return { ...item, href: "/corporate/dashboard" };
      if (item.label === "Profile") return { ...item, label: "Account Settings", href: "/corporate/settings", icon: Settings };
      if (item.label === "Investments") return { ...item, href: "/corporate/investments" };
      if (item.label === "Transactions") return { ...item, href: "/corporate/transactions" };
      if (item.label === "Products") return { ...item, href: "/corporate/products" };
      return item;
    })
    : portalNavigation;

  return <nav className="grid gap-1.5" aria-label={mobile ? "Mobile investor portal navigation" : "Investor portal navigation"}>{navigation.map(({ label, href, icon: Icon }) => {
    const active = href === pathname || (href === "/dashboard" && pathname === dashboardAlias);
    return <a key={label} href={href} aria-current={active ? "page" : undefined} className={`group relative flex min-h-12 items-center gap-3 rounded-lg px-3.5 text-sm font-bold no-underline transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-lime focus-visible:ring-offset-2 ${dark ? "focus-visible:ring-offset-star-900" : "focus-visible:ring-star-700 focus-visible:ring-offset-white"} ${active ? (dark ? "bg-star-lime text-star-900" : "bg-star-100 text-star-900") : (dark ? "text-white/85 hover:bg-white/10 hover:text-white" : "text-star-700 hover:bg-star-50 hover:text-star-900")}`}><span className={`absolute -left-3 h-8 w-1 rounded-r-full ${active ? "bg-star-lime" : "bg-transparent"}`} aria-hidden="true" /><Icon size={20} strokeWidth={2} className={`shrink-0 ${dark && !active ? "text-white/75" : "text-star-700"}`} aria-hidden="true" />{label}</a>;
  })}</nav>;
}

export function PortalSidebar({ dashboardAlias, businessDashboard = false, dark = false }: PortalSidebarProps) {
  const shell = dark ? "border-white/10 bg-[linear-gradient(180deg,#003B2A_0%,#002D20_100%)] text-white" : "border-star-200 bg-white text-star-900";
  return <><aside className={`sticky top-0 hidden h-screen w-[270px] shrink-0 flex-col border-r px-4 py-5 lg:flex ${shell}`}><Logo light={dark} href="/" /><div className="mt-10"><NavigationLinks dashboardAlias={dashboardAlias} businessDashboard={businessDashboard} dark={dark} /></div>{businessDashboard ? <PromoCard dark={dark} /> : null}</aside><details className="group relative z-50 lg:hidden"><summary className="absolute left-5 top-4 z-50 grid h-10 w-10 cursor-pointer list-none place-items-center rounded-md border border-star-200 bg-white text-star-700 shadow-sm transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 sm:left-8 [&::-webkit-details-marker]:hidden"><Menu size={20} aria-hidden="true" className="group-open:hidden" /><X size={20} aria-hidden="true" className="hidden group-open:block" /><span className="sr-only">Toggle investor portal navigation</span></summary><div className={`fixed inset-x-0 bottom-0 top-[76px] overflow-y-auto border-t px-5 py-7 shadow-[0_16px_40px_rgba(0,59,42,0.13)] sm:px-8 ${dark ? "border-white/10 bg-star-900 text-white" : "border-star-200 bg-white text-star-900"}`}><NavigationLinks mobile dashboardAlias={dashboardAlias} businessDashboard={businessDashboard} dark={dark} />{businessDashboard ? <PromoCard mobile dark={dark} /> : null}</div></details></>;
}

function PromoCard({ mobile = false, dark = false }: { mobile?: boolean; dark?: boolean }) {
  return <section className={`${mobile ? "mt-8 max-w-sm" : "mt-auto"} relative min-h-[250px] overflow-hidden rounded-xl border p-5 text-white ${dark ? "border-white/10 bg-white/[0.06]" : "border-star-200 bg-star-900"}`} aria-labelledby={mobile ? "mobile-sidebar-promo" : "sidebar-promo"}><Image src="/images/hero-bridge.webp" alt="Lagos bridge at sunset" fill sizes={mobile ? "384px" : "238px"} className="object-cover object-[55%_65%] opacity-65" /><div className="absolute inset-0 bg-[linear-gradient(155deg,rgba(0,59,42,0.94)_5%,rgba(0,59,42,0.78)_60%,rgba(0,59,42,0.55)_100%)]" /><div className="relative z-10 flex min-h-[210px] max-w-[12rem] flex-col"><h2 id={mobile ? "mobile-sidebar-promo" : "sidebar-promo"} className="text-xl font-extrabold leading-6">Build your financial future with confidence</h2><p className="mt-4 text-xs leading-5 text-white/90">Professional investment solutions for a brighter tomorrow.</p><a href="/services" className="mt-auto inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-white/80 bg-white/10 px-3 text-xs font-bold text-white no-underline transition hover:bg-white hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-lime focus-visible:ring-offset-2 focus-visible:ring-offset-star-900">Explore Products <ArrowRight size={14} aria-hidden="true" /></a></div></section>;
}
