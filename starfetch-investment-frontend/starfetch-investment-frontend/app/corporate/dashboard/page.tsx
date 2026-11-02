import type { Metadata } from "next";
import { IndividualDashboardContent } from "@/components/portal/IndividualDashboardContent";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { corporateCompany } from "@/components/corporate/corporate-dashboard-data";

export const metadata: Metadata = {
  title: "Dashboard | Starfetch Investor Portal",
  description: "Starfetch Investor Dashboard frontend mockup.",
};

/** The business-account dashboard intentionally shares the individual portal dashboard and navigation. */
export default function CorporateDashboardPage() {
  return <div className="min-h-screen bg-[#fffef9] text-star-900 lg:flex"><PortalSidebar businessDashboard /><div className="min-w-0 flex-1"><PortalHeader user={{ fullName: corporateCompany.name, initials: corporateCompany.initials, accountType: "Business Investor" }} /><main className="mx-auto max-w-[1600px] px-5 py-7 sm:px-8 sm:py-8 lg:px-8 xl:px-10"><IndividualDashboardContent dashboardVariant="business" /></main></div></div>;
}
