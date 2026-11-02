import type { Metadata } from "next";
import { JointPortalShell } from "@/components/joint/JointPortalShell";
import { JointTransactionsContent } from "@/components/joint/JointTransactionsContent";

export const metadata: Metadata = {
  title: "Transactions | Starfetch Joint Account",
  description: "Frontend-only joint account transaction history for Starfetch Investment Limited.",
};

export default function JointTransactionsPage() {
  return <JointPortalShell><JointTransactionsContent /></JointPortalShell>;
}
