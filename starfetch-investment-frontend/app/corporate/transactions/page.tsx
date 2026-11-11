import type { Metadata } from "next";
import { CorporatePortalLayout } from "@/components/corporate/CorporatePortalLayout";
import { CorporateTransactionsContent } from "@/components/corporate/CorporateTransactionsContent";

export const metadata: Metadata = {
  title: "Transactions | Starfetch Corporate Portal",
  description: "Review authorised Corporate transaction availability.",
};

export default function CorporateTransactionsPage() {
  return <CorporatePortalLayout sectionLabel="Transactions"><CorporateTransactionsContent /></CorporatePortalLayout>;
}
