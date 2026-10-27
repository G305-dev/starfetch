import { CorporateSettingsContent } from "@/components/corporate/CorporateSettingsContent";
import { CorporateSidebar } from "@/components/corporate/CorporateSidebar";
import { CorporateTopbar } from "@/components/corporate/CorporateTopbar";

export const metadata = {
  title: "Settings | Starfetch Investor Portal",
  description: "Manage corporate account settings in the Starfetch Investor Portal.",
};

export default function CorporateSettingsPage() {
  return (
    <div className="min-h-screen bg-[#f7faf7] lg:flex">
      <CorporateSidebar />
      <div className="min-w-0 flex-1">
        <CorporateTopbar sectionLabel="Settings" />
        <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          <CorporateSettingsContent />
        </div>
      </div>
    </div>
  );
}
