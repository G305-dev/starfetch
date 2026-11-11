import type { Metadata } from "next";
import { CorporatePortalLayout } from "@/components/corporate/CorporatePortalLayout";
import { CorporateProductsContent } from "@/components/corporate/CorporateProductsContent";

export const metadata: Metadata = {
  title: "Product Access | Starfetch Corporate Portal",
  description: "Review Corporate product action availability.",
};

export default function CorporateFixedNotePage() {
  return <CorporatePortalLayout sectionLabel="Products"><CorporateProductsContent requestedProduct /></CorporatePortalLayout>;
}
