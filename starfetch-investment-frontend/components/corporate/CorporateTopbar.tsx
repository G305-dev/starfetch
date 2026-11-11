"use client";

import { BellOff, ChevronDown, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "CI";
}

export function CorporateTopbar({ sectionLabel = "Overview" }: { sectionLabel?: string }) {
  const { status, user } = useAuth();
  const name = status === "authenticated" && user ? `${user.firstName} ${user.lastName}`.trim() : "Corporate applicant";

  return (
    <header className="sticky top-0 z-40 flex min-h-[62px] items-center justify-between border-b border-star-200 bg-white/95 px-5 backdrop-blur-sm sm:px-8 lg:px-9" aria-label="Corporate portal header">
      <p className="ml-12 text-sm font-semibold text-star-700 lg:ml-0">{sectionLabel} <ChevronDown size={15} className="ml-1 inline-block align-[-2px] text-star-muted" aria-hidden="true" /></p>
      <div className="flex items-center gap-3 sm:gap-4">
        <button type="button" disabled aria-label="Corporate notifications are unavailable" title="Corporate notifications are unavailable until an approved API is available" className="grid h-10 w-10 cursor-not-allowed place-items-center rounded-full text-star-muted opacity-70"><BellOff size={20} aria-hidden="true" /></button>
        <span className="hidden h-7 w-px bg-star-200 sm:block" aria-hidden="true" />
        <span className="flex items-center gap-2 rounded-md p-1 text-left sm:gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-star-100 text-star-700"><UserRound size={17} aria-hidden="true" /></span>
          <span className="hidden sm:block"><span className="block max-w-48 truncate text-sm font-bold text-star-900">{name}</span><span className="mt-0.5 block text-xs text-star-muted">Corporate applicant</span></span>
        </span>
      </div>
    </header>
  );
}
