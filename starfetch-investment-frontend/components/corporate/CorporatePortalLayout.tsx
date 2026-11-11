"use client";

import { type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { CorporateSidebar } from "./CorporateSidebar";
import { CorporateTopbar } from "./CorporateTopbar";

/**
 * The key resets all client-only Corporate page state when the authenticated
 * account changes. Corporate data is never persisted by this shell.
 */
export function CorporatePortalLayout({ sectionLabel, children }: { sectionLabel: string; children: ReactNode }) {
  const { status, user } = useAuth();
  const accountKey = status === "authenticated" && user ? user.id : "no-corporate-account";

  return (
    <div className="min-h-screen bg-[#f7faf7] lg:flex">
      <CorporateSidebar />
      <div className="min-w-0 flex-1">
        <CorporateTopbar sectionLabel={sectionLabel} />
        <div key={accountKey} className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
