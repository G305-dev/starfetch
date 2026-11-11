import type { Metadata } from "next";
import { CorporateDashboardContent } from "@/components/corporate/CorporateDashboardContent";
import { CorporatePortalLayout } from "@/components/corporate/CorporatePortalLayout";

export const metadata: Metadata = {
  title: "Corporate Overview | Starfetch Investor Portal",
  description: "Review corporate verification progress and authorised account availability.",
};

export default function CorporateDashboardPage() {
  return <CorporatePortalLayout sectionLabel="Overview"><CorporateDashboardContent /></CorporatePortalLayout>;
}
