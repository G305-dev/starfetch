import type { Metadata } from "next";
import { MyInvestmentsContent } from "@/components/portal/MyInvestmentsContent";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar } from "@/components/portal/PortalSidebar";

export const metadata: Metadata = {
  title: "My Investments | Starfetch Investor Portal",
  description: "Starfetch Investor Portal investment holdings frontend mockup.",
};

export default function InvestmentsPage() {
  return (
    <div className="min-h-screen bg-[#fffef9] text-star-900 lg:flex">
      <PortalSidebar />
      <div className="min-w-0 flex-1">
        <PortalHeader />
        <main className="mx-auto max-w-[1600px] px-5 py-7 sm:px-8 sm:py-8 lg:px-8 xl:px-10">
          <MyInvestmentsContent />
        </main>
      </div>
    </div>
  );
}
