import type { Metadata } from "next";
import { RequireIndividualAuth } from "@/components/auth/RequireIndividualAuth";
import { IndividualFixedNoteInfo } from "@/components/portal/IndividualFixedNoteInfo";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar } from "@/components/portal/PortalSidebar";

export const metadata: Metadata = {
  title: "Fixed Note Rate | Starfetch Investor Portal",
  description: "Starfetch Fixed Note product information.",
};

export default function FixedNoteRatePage() {
  return <RequireIndividualAuth><div className="min-h-screen bg-[#fffef9] text-star-900 lg:flex"><PortalSidebar /><div className="min-w-0 flex-1"><PortalHeader /><main className="mx-auto max-w-[1600px] px-5 py-7 sm:px-8 sm:py-8 lg:px-8 xl:px-10"><IndividualFixedNoteInfo /></main></div></div></RequireIndividualAuth>;
}
