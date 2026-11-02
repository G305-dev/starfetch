import type { Metadata } from "next";
import { JointPortalShell } from "@/components/joint/JointPortalShell";
import { JointProfileContent } from "@/components/joint/JointProfileContent";

export const metadata: Metadata = {
  title: "Joint Profile | Starfetch Joint Account",
  description: "Frontend-only joint account profile for Starfetch Investment Limited.",
};

export default function JointProfilePage() {
  return <JointPortalShell><JointProfileContent /></JointPortalShell>;
}
