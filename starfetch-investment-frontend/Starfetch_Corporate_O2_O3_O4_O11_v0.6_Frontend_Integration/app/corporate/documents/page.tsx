import type { Metadata } from "next";
import { CorporateDocumentsContent } from "@/components/corporate/CorporateDocumentsContent";
import { CorporatePortalLayout } from "@/components/corporate/CorporatePortalLayout";

export const metadata: Metadata = {
  title: "Documents | Starfetch Investor Portal",
  description: "Review corporate document requirements and secure-upload availability.",
};

export default function CorporateDocumentsPage() {
  return <CorporatePortalLayout sectionLabel="Documents"><CorporateDocumentsContent /></CorporatePortalLayout>;
}
