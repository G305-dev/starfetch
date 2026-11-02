import type { Metadata } from "next";
import { JointHeader } from "@/components/joint/JointHeader";
import { JointSidebar } from "@/components/joint/JointSidebar";
import { ProductsContent } from "@/components/portal/ProductsContent";

export const metadata: Metadata = {
  title: "Products | Starfetch Joint Account",
  description: "Explore Starfetch investment products from a joint investor account.",
};

export default function JointProductsPage() {
  return <div className="min-h-screen bg-[#f7f9f8] lg:pl-[270px]"><JointSidebar /><div className="min-w-0"><JointHeader /><main className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8 lg:px-8 xl:px-10"><ProductsContent fixedNoteHref="/joint/products/fixed-note" /></main></div></div>;
}
