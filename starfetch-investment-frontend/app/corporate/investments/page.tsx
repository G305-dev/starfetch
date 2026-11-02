import type { Metadata } from "next";
import { CorporateInvestmentsContent } from "@/components/corporate/CorporateInvestmentsContent";
import { corporateCompany } from "@/components/corporate/corporate-dashboard-data";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar } from "@/components/portal/PortalSidebar";

export const metadata: Metadata = {
  title: "Investments | Starfetch Business Portal",
  description: "View and manage business investment holdings in the Starfetch Investor Portal.",
};

export default function CorporateInvestmentsPage() {
  return <div className="min-h-screen bg-[#fffef9] text-star-900 lg:flex"><PortalSidebar businessDashboard /><div className="min-w-0 flex-1"><PortalHeader user={{ fullName: corporateCompany.name, initials: corporateCompany.initials, accountType: "Business Investor" }} /><main className="mx-auto max-w-[1600px] px-5 py-7 sm:px-8 sm:py-8 lg:px-8 xl:px-10"><CorporateInvestmentsContent /></main></div></div>;
}
