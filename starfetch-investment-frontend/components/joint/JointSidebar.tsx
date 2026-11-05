"use client";

import { BriefcaseBusiness, LayoutDashboard, Mail, Menu, PackageOpen, UsersRound, Waypoints, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/ui";

const jointNavigation = [
  { label: "Dashboard", href: "/joint/dashboard", icon: LayoutDashboard },
  { label: "Invitations", href: "/joint/invitations", icon: Mail },
  { label: "My Investments", href: "/joint/investments", icon: BriefcaseBusiness },
  { label: "Products", href: "/joint/products", icon: PackageOpen },
  { label: "Transactions", href: "/joint/transactions", icon: Waypoints },
  { label: "Joint Profile", href: "/joint/profile", icon: UsersRound },
] as const;

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <nav className="grid gap-1.5" aria-label="Joint account navigation">{jointNavigation.map(({ label, href, icon: Icon }) => { const active = pathname === href; return <Link key={label} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`relative flex min-h-12 items-center gap-3 rounded-lg px-3.5 text-sm font-bold no-underline transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-lime focus-visible:ring-offset-2 focus-visible:ring-offset-star-900 ${active ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10 hover:text-white"}`}><span className={`absolute -left-3 h-8 w-1 rounded-r-full ${active ? "bg-star-lime" : "bg-transparent"}`} aria-hidden="true" /><Icon size={20} className={active ? "text-star-lime" : "text-white/75"} aria-hidden="true" />{label}</Link>; })}</nav>;
}

export function JointSidebar() {
  const [open, setOpen] = useState(false);
  return <><aside className="fixed inset-y-0 left-0 z-50 hidden h-screen w-[270px] flex-col overflow-y-auto bg-[linear-gradient(180deg,#003B2A_0%,#002D20_100%)] px-4 py-5 text-white lg:flex"><Logo light href="/joint/dashboard" /><span className="mt-7 inline-flex w-fit rounded-full border border-star-lime/40 bg-star-lime/10 px-3 py-1.5 text-[0.62rem] font-extrabold tracking-[0.14em] text-star-lime">JOINT ACCOUNT</span><div className="mt-7"><NavigationLinks /></div><section className="mt-auto rounded-xl border border-white/10 bg-white/[0.06] p-5"><UsersRound size={21} className="text-star-lime" aria-hidden="true" /><h2 className="mt-4 text-base font-extrabold">Membership-based access</h2><p className="mt-2 text-xs leading-5 text-white/80">Only active members can view a Joint Account. Invitations require independent consent.</p></section></aside><button type="button" onClick={() => setOpen(true)} aria-label="Open joint account navigation" className="fixed left-5 top-[18px] z-[60] grid size-10 place-items-center rounded-md bg-star-900 text-white shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-lime lg:hidden"><Menu size={20} aria-hidden="true" /></button>{open ? <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Joint account navigation"><button type="button" onClick={() => setOpen(false)} aria-label="Close joint account navigation" className="absolute inset-0 bg-star-900/50" /><aside className="relative flex h-full w-[min(19rem,84vw)] flex-col bg-star-900 px-5 py-6 text-white shadow-2xl"><div className="flex items-center justify-between border-b border-white/10 pb-5"><Logo light href="/joint/dashboard" /><button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="grid size-10 place-items-center rounded-md hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-lime"><X size={20} aria-hidden="true" /></button></div><span className="mt-6 inline-flex w-fit rounded-full border border-star-lime/40 bg-star-lime/10 px-3 py-1.5 text-[0.62rem] font-extrabold tracking-[0.14em] text-star-lime">JOINT ACCOUNT</span><div className="mt-7"><NavigationLinks onNavigate={() => setOpen(false)} /></div></aside></div> : null}</>;
}
