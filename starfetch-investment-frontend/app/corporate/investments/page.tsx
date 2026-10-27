import { CorporateInvestmentsContent } from "@/components/corporate/CorporateInvestmentsContent";
import { CorporateSidebar } from "@/components/corporate/CorporateSidebar";
import { CorporateTopbar } from "@/components/corporate/CorporateTopbar";

export const metadata = { title: "Investments | Starfetch Investor Portal", description: "View corporate investments in the Starfetch Investor Portal." };

export default function CorporateInvestmentsPage() {
  return <div className="min-h-screen bg-[#f7faf7] lg:flex"><CorporateSidebar /><div className="min-w-0 flex-1"><CorporateTopbar sectionLabel="Investments" /><div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7"><CorporateInvestmentsContent /></div></div></div>;
}
