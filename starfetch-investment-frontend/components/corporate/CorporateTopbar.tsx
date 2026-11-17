"use client";

import { BellOff, ChevronDown, LoaderCircle, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type KeyboardEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getCompanyInitials } from "@/lib/corporate/dashboard";

export function CorporateTopbar({ sectionLabel = "Overview" }: { sectionLabel?: string }) {
  const router = useRouter();
  const { status, user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const companyName = status === "authenticated" && user?.companyName ? user.companyName : "Corporate applicant";
  const initials = getCompanyInitials(companyName);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setMenuOpen(false);
    try {
      await logout();
    } catch {
      // Local auth state is cleared even if the server session cannot be reached.
    } finally {
      router.replace("/login");
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setMenuOpen(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 flex min-h-[62px] items-center justify-between border-b border-star-200 bg-white/95 px-5 backdrop-blur-sm sm:px-8 lg:px-9" aria-label="Corporate portal header">
      <p className="ml-12 text-sm font-semibold text-star-700 lg:ml-0">{sectionLabel} <ChevronDown size={15} className="ml-1 inline-block align-[-2px] text-star-muted" aria-hidden="true" /></p>
      <div className="flex items-center gap-3 sm:gap-4">
        <button type="button" disabled aria-label="Corporate notifications are unavailable" title="Corporate notifications are unavailable until an approved API is available" className="grid h-10 w-10 cursor-not-allowed place-items-center rounded-full text-star-muted opacity-70"><BellOff size={20} aria-hidden="true" /></button>
        <span className="hidden h-7 w-px bg-star-200 sm:block" aria-hidden="true" />
        <div className="relative" onKeyDown={handleMenuKeyDown}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`${companyName}, Corporate Account. Open account menu.`}
            className="flex items-center gap-2 rounded-md p-1 text-left transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 sm:gap-3"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-star-900 text-xs font-extrabold text-white">{initials}</span>
            <span className="hidden sm:block">
              <span className="block max-w-48 truncate text-sm font-bold text-star-900">{companyName}</span>
              <span className="mt-0.5 block text-xs text-star-muted">Corporate Account</span>
            </span>
            <ChevronDown size={16} className={`shrink-0 text-star-700 transition ${menuOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {menuOpen ? (
            <>
              <button type="button" aria-label="Close account menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 cursor-default bg-transparent" tabIndex={-1} />
              <div role="menu" aria-label="Corporate account menu" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-52 rounded-xl border border-star-200 bg-white p-1.5 shadow-card">
                <Link
                  href="/corporate/profile"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-star-900 no-underline transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"
                >
                  <UserRound size={16} className="text-star-700" aria-hidden="true" />
                  Profile
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleSignOut()}
                  disabled={signingOut}
                  className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-[#b42318] transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {signingOut ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <LogOut size={16} aria-hidden="true" />}
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
