import type { Metadata } from "next";
import { CorporateInvestmentsContent } from "@/components/corporate/CorporateInvestmentsContent";
import { CorporatePortalLayout } from "@/components/corporate/CorporatePortalLayout";

export const metadata: Metadata = {
  title: "Investments | Starfetch Corporate Portal",
  description: "Review authorised Corporate investment availability.",
};

export default function CorporateInvestmentsPage() {
  return <CorporatePortalLayout sectionLabel="Investments"><CorporateInvestmentsContent /></CorporatePortalLayout>;
}
