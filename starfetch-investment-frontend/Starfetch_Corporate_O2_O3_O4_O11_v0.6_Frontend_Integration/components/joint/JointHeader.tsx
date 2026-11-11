"use client";

import { ChevronDown, LoaderCircle, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/ui";
import { useAuth } from "@/components/auth/AuthProvider";
import { JointInvitationNotifications } from "./JointInvitationNotifications";
import { useJointAccounts } from "./JointAccountProvider";

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "SI";
}

export function JointHeader() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { accounts, accountsStatus, selectedAccountId, selectAccount, refresh } = useJointAccounts();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : "Account";

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      router.replace("/login");
    }
  }

  async function handleAcceptedInvitation(jointAccountId: string) {
    const nextAccounts = await refresh();
    if (nextAccounts.some((account) => account.jointAccountId === jointAccountId)) selectAccount(jointAccountId);
  }

  return <header className="sticky top-0 z-40 border-b border-star-200 bg-white/95 backdrop-blur-sm"><div className="mx-auto flex min-h-[76px] w-full max-w-[1600px] items-center gap-3 px-5 sm:px-8 lg:px-8 xl:px-10"><div className="pl-14 lg:hidden"><Logo href="/joint/dashboard" /></div><div className="hidden min-w-0 flex-1 lg:block"><label className="block max-w-[420px]"><span className="text-[0.66rem] font-extrabold uppercase tracking-[0.12em] text-star-700">Selected Joint Account</span>{accountsStatus === "ready" && accounts.length ? <select value={selectedAccountId ?? ""} onChange={(event) => selectAccount(event.target.value)} className="mt-1 h-10 w-full max-w-md rounded-md border border-star-200 bg-white px-3 text-sm font-extrabold text-star-900 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100">{accounts.map((account) => <option key={account.jointAccountId} value={account.jointAccountId}>{account.displayName}{account.awaitingSecondHolder ? " — awaiting second holder" : ""}</option>)}</select> : <p className="mt-1 text-sm font-semibold text-star-muted">{accountsStatus === "loading" ? "Loading your Joint Accounts…" : "No active Joint Account selected"}</p>}</label></div><div className="ml-auto flex items-center gap-3 sm:gap-4"><JointInvitationNotifications onAccepted={handleAcceptedInvitation} /><span className="hidden h-7 w-px bg-star-200 sm:block" aria-hidden="true" /><div className="relative"><button type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} className="flex items-center gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 sm:gap-3 sm:px-2"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-star-900 text-sm font-extrabold text-white">{user ? initials(user.firstName, user.lastName) : "AC"}</span><span className="hidden min-w-0 sm:block"><span className="block max-w-40 truncate text-sm font-extrabold text-star-900">{fullName}</span><span className="mt-0.5 block text-xs text-star-muted">Joint Investor</span></span><ChevronDown size={16} className={`hidden shrink-0 text-star-700 transition sm:block ${menuOpen ? "rotate-180" : ""}`} aria-hidden="true" /></button>{menuOpen ? <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-52 rounded-lg border border-star-200 bg-white p-1.5 shadow-card"><Link href="/joint/profile" onClick={() => setMenuOpen(false)} className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-star-900 no-underline transition hover:bg-star-50"><UserRound size={16} className="text-star-700" aria-hidden="true" />Joint profile</Link><button type="button" onClick={() => { void handleLogout(); }} disabled={loggingOut} className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-semibold text-[#b42318] transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-60">{loggingOut ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <LogOut size={16} aria-hidden="true" />}{loggingOut ? "Signing out…" : "Sign out"}</button></div> : null}</div></div></div></header>;
}
