import type { Metadata } from "next";
import { BusinessAccountSettingsContent } from "@/components/corporate/BusinessAccountSettingsContent";
import { CorporatePortalLayout } from "@/components/corporate/CorporatePortalLayout";

export const metadata: Metadata = {
  title: "Account Settings | Starfetch Corporate Portal",
  description: "Review Corporate account settings and verification availability.",
};

export default function CorporateSettingsPage() {
  return <CorporatePortalLayout sectionLabel="Settings"><BusinessAccountSettingsContent /></CorporatePortalLayout>;
}
