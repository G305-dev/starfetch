import type { Metadata } from "next";
import { BusinessAccountSettingsContent } from "@/components/corporate/BusinessAccountSettingsContent";
import { corporateCompany } from "@/components/corporate/corporate-dashboard-data";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar } from "@/components/portal/PortalSidebar";

export const metadata: Metadata = {
  title: "Account Settings | Starfetch Investor Portal",
  description: "Complete KYC and KYB requirements for a Starfetch business account.",
};

export default function CorporateSettingsPage() {
  return <div className="min-h-screen bg-[#fffef9] text-star-900 lg:flex"><PortalSidebar businessDashboard /><div className="min-w-0 flex-1"><PortalHeader user={{ fullName: corporateCompany.name, initials: corporateCompany.initials, accountType: "Business Investor" }} /><div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-8 lg:px-8 xl:px-10"><BusinessAccountSettingsContent /></div></div></div>;
}
