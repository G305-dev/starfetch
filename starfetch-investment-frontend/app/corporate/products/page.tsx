import type { Metadata } from "next";
import { CorporatePortalLayout } from "@/components/corporate/CorporatePortalLayout";
import { CorporateProductsContent } from "@/components/corporate/CorporateProductsContent";

export const metadata: Metadata = {
  title: "Products | Starfetch Corporate Portal",
  description: "Explore Starfetch investment products in the Corporate Portal.",
};

export default function CorporateProductsPage() {
  return <CorporatePortalLayout sectionLabel="Products"><CorporateProductsContent /></CorporatePortalLayout>;
}
