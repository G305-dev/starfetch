import type { Metadata } from "next";
import { JointDashboardContent } from "@/components/joint/JointDashboardContent";
import { JointPortalShell } from "@/components/joint/JointPortalShell";

export const metadata: Metadata = {
  title: "Joint Account Dashboard | Starfetch Investment Limited",
  description: "Frontend-only joint investment account dashboard for Starfetch Investment Limited.",
};

export default function JointDashboardPage() {
  return <JointPortalShell><JointDashboardContent /></JointPortalShell>;
}
