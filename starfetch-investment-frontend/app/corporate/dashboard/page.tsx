import type { Metadata } from "next";
import { CorporateDashboardContent } from "@/components/corporate/CorporateDashboardContent";
import { CorporateSidebar } from "@/components/corporate/CorporateSidebar";
import { CorporateTopbar } from "@/components/corporate/CorporateTopbar";

export const metadata: Metadata = {
  title: "Corporate Overview | Starfetch Investor Portal",
  description: "Starfetch Corporate Investor Dashboard frontend mockup.",
};

export default function CorporateDashboardPage() {
  return (
    <div className="min-h-screen bg-[#fffef9] text-star-900 lg:flex">
      <CorporateSidebar />
      <div className="min-w-0 flex-1"><CorporateTopbar /><CorporateDashboardContent /></div>
    </div>
  );
}
