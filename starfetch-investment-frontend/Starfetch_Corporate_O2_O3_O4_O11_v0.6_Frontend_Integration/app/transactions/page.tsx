import type { Metadata } from "next";
import { RequireIndividualAuth } from "@/components/auth/RequireIndividualAuth";
import { MyTransactionsContent } from "@/components/portal/MyTransactionsContent";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar } from "@/components/portal/PortalSidebar";

export const metadata: Metadata = {
  title: "Transactions | Starfetch Investor Portal",
  description: "Starfetch Investor Portal transaction history.",
};

export default function TransactionsPage() {
  return <RequireIndividualAuth><div className="min-h-screen bg-[#fffef9] text-star-900 lg:flex"><PortalSidebar /><div className="min-w-0 flex-1"><PortalHeader /><main className="mx-auto max-w-[1600px] px-5 py-7 sm:px-8 sm:py-8 lg:px-8 xl:px-10"><MyTransactionsContent /></main></div></div></RequireIndividualAuth>;
}
