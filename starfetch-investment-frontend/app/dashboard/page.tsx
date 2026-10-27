import type { Metadata } from "next";
import { IndividualDashboardContent } from "@/components/portal/IndividualDashboardContent";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar } from "@/components/portal/PortalSidebar";

export const metadata: Metadata = {
  title: "Individual Investor Dashboard | Starfetch Investor Portal",
  description: "Starfetch Individual Investor Dashboard frontend mockup.",
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#fffef9] text-star-900 lg:flex">
      <PortalSidebar />
      <div className="min-w-0 flex-1">
        <PortalHeader />
        <main className="mx-auto max-w-[1600px] px-5 py-7 sm:px-8 sm:py-8 lg:px-8 xl:px-10">
          <IndividualDashboardContent />
        </main>
      </div>
    </div>
  );
}
