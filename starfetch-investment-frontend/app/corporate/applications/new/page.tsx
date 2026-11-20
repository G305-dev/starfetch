import type { Metadata } from "next";
import { CorporateApplicationStart } from "@/components/corporate/CorporateApplicationStart";
import { CorporatePortalLayout } from "@/components/corporate/CorporatePortalLayout";

export const metadata: Metadata = {
  title: "Start Corporate Application | Starfetch Investor Portal",
  description: "Create a Corporate application DRAFT and continue to the Company Profile.",
};

/** Protected by app/corporate/layout.tsx (RequireInvestorAuth); the backend enforces Corporate authorisation. */
export default function CorporateApplicationCreatePage() {
  return <CorporatePortalLayout sectionLabel="Start application"><CorporateApplicationStart /></CorporatePortalLayout>;
}
