import type { Metadata } from "next";
import { corporateCompany } from "@/components/corporate/corporate-dashboard-data";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { ProductsContent } from "@/components/portal/ProductsContent";

export const metadata: Metadata = {
  title: "Products | Starfetch Business Portal",
  description: "Explore Starfetch investment products from your business account.",
};

export default function CorporateProductsPage() {
  return <div className="min-h-screen bg-[#fffef9] text-star-900 lg:flex"><PortalSidebar businessDashboard /><div className="min-w-0 flex-1"><PortalHeader user={{ fullName: corporateCompany.name, initials: corporateCompany.initials, accountType: "Business Investor" }} /><main className="mx-auto max-w-[1600px] px-5 py-7 sm:px-8 sm:py-8 lg:px-8 xl:px-10"><ProductsContent fixedNoteHref="/corporate/products/fixed-note" /></main></div></div>;
}
