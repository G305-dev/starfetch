import type { Metadata } from "next";
import { JointInvestmentsContent } from "@/components/joint/JointInvestmentsContent";
import { JointPortalShell } from "@/components/joint/JointPortalShell";

export const metadata: Metadata = {
  title: "My Investments | Starfetch Joint Account",
  description: "Frontend-only joint account investments page for Starfetch Investment Limited.",
};

export default function JointInvestmentsPage() {
  return <JointPortalShell><JointInvestmentsContent /></JointPortalShell>;
}
