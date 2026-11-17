import type { Metadata } from "next";
import { CorporateFixedNoteInfo } from "@/components/corporate/CorporateFixedNoteInfo";
import { CorporatePortalLayout } from "@/components/corporate/CorporatePortalLayout";

export const metadata: Metadata = {
  title: "Fixed Note | Starfetch Corporate Portal",
  description: "Starfetch Fixed Note product information for corporate investors.",
};

export default function CorporateFixedNotePage() {
  return <CorporatePortalLayout sectionLabel="Products"><CorporateFixedNoteInfo /></CorporatePortalLayout>;
}
