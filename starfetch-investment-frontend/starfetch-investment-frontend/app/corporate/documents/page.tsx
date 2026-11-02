import { CorporateDocumentsContent } from "@/components/corporate/CorporateDocumentsContent";
import { CorporateSidebar } from "@/components/corporate/CorporateSidebar";
import { CorporateTopbar } from "@/components/corporate/CorporateTopbar";

export const metadata = {
  title: "Documents | Starfetch Investor Portal",
  description: "Manage corporate documents in the Starfetch Investor Portal.",
};

export default function CorporateDocumentsPage() {
  return (
    <div className="min-h-screen bg-[#f7faf7] lg:flex">
      <CorporateSidebar />
      <div className="min-w-0 flex-1">
        <CorporateTopbar sectionLabel="Documents" />
        <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          <CorporateDocumentsContent />
        </div>
      </div>
    </div>
  );
}
