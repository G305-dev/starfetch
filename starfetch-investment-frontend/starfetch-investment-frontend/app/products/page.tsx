import type { Metadata } from "next";
import { ProductsContent } from "@/components/portal/ProductsContent";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar } from "@/components/portal/PortalSidebar";

export const metadata: Metadata = {
  title: "Products | Starfetch Investor Portal",
  description: "Explore Starfetch investment products in the individual investor portal.",
};

export default function ProductsPage() {
  return <div className="min-h-screen bg-[#fffef9] text-star-900 lg:flex"><PortalSidebar /><div className="min-w-0 flex-1"><PortalHeader /><main className="mx-auto max-w-[1600px] px-5 py-7 sm:px-8 sm:py-8 lg:px-8 xl:px-10"><ProductsContent /></main></div></div>;
}
