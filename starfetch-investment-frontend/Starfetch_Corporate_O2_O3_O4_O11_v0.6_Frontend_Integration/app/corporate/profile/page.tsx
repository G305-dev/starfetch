import type { Metadata } from "next";
import { CorporatePortalLayout } from "@/components/corporate/CorporatePortalLayout";
import { CorporateProfileContent } from "@/components/corporate/CorporateProfileContent";

export const metadata: Metadata = {
  title: "Company Profile | Starfetch Investor Portal",
  description: "Review canonical company information and corporate verification progress.",
};

export default function CorporateProfilePage() {
  return <CorporatePortalLayout sectionLabel="Company Profile"><CorporateProfileContent /></CorporatePortalLayout>;
}
