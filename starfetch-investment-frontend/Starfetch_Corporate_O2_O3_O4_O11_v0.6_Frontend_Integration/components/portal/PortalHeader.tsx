"use client";

import { ChevronDown, LoaderCircle, LogOut, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/ui";
import { useAuth } from "@/components/auth/AuthProvider";
import { JointInvitationNotifications } from "@/components/joint/JointInvitationNotifications";

type PortalHeaderUser = {
  fullName: string;
  initials: string;
  accountType: string;
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "SI";
}

export function PortalHeader({ user }: { user?: PortalHeaderUser }) {
  const router = useRouter();
  const { status, user: authenticatedUser, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const isIndividualPortal = !user;
  const displayedUser = user ?? (status === "authenticated" && authenticatedUser ? {
    fullName: `${authenticatedUser.firstName} ${authenticatedUser.lastName}`.trim(),
    initials: getInitials(authenticatedUser.firstName, authenticatedUser.lastName),
    accountType: "Individual Investor",
  } : { fullName: "Account", initials: "AC", accountType: "Individual Investor" });

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // Local auth state is cleared even if the server session cannot be reached.
    } finally {
      router.replace("/login");
    }
  }

  return <header className="sticky top-0 z-40 flex min-h-[76px] items-center justify-between border-b border-star-200 bg-white/95 px-5 backdrop-blur-sm sm:px-8 lg:px-8 xl:px-10"><div className="pl-14 lg:hidden"><Logo href="/" /></div><label className="relative ml-6 hidden min-w-0 flex-1 lg:block lg:max-w-[520px]"><span className="sr-only">Global portal search</span><Search size={19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-star-700" aria-hidden="true" /><input type="search" placeholder="Search investments, transactions, or help..." className="h-11 w-full rounded-md border border-star-100 bg-star-50 px-11 text-sm text-star-900 outline-none transition placeholder:text-star-muted focus:border-star-700 focus:ring-2 focus:ring-star-100" /></label><div className="ml-auto flex items-center gap-3 sm:gap-4">{isIndividualPortal ? <JointInvitationNotifications openJointAccountAfterAccept /> : null}<div className="relative"><button type="button" onClick={() => isIndividualPortal && setMenuOpen((open) => !open)} aria-expanded={isIndividualPortal ? menuOpen : undefined} className="flex items-center gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 sm:gap-3 sm:px-2" aria-label={isIndividualPortal ? `${displayedUser.fullName}, ${displayedUser.accountType}. Open profile menu.` : `${displayedUser.fullName}, ${displayedUser.accountType}. Profile menu unavailable in this dashboard mockup.`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-star-900 text-sm font-extrabold text-white">{displayedUser.initials}</span><span className="hidden min-w-0 sm:block"><span className="block truncate text-sm font-extrabold text-star-900">{displayedUser.fullName}</span><span className="mt-0.5 block text-xs text-star-muted">{displayedUser.accountType}</span></span><ChevronDown size={16} className={`hidden shrink-0 text-star-700 transition sm:block ${menuOpen ? "rotate-180" : ""}`} aria-hidden="true" /></button>{isIndividualPortal && menuOpen ? <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-48 rounded-lg border border-star-200 bg-white p-1.5 shadow-card"><Link href="/profile" onClick={() => setMenuOpen(false)} className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-star-900 no-underline transition hover:bg-star-50"><UserRound size={16} className="text-star-700" aria-hidden="true" />My Profile</Link><button type="button" onClick={() => { void handleLogout(); }} disabled={loggingOut} className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-semibold text-[#b42318] transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-60">{loggingOut ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <LogOut size={16} aria-hidden="true" />}{loggingOut ? "Signing out…" : "Sign out"}</button></div> : null}</div></div></header>;
}
