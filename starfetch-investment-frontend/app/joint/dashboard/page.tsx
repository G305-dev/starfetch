import type { Metadata } from "next";
import { JointDashboardContent } from "@/components/joint/JointDashboardContent";
import { JointHeader } from "@/components/joint/JointHeader";
import { JointSidebar } from "@/components/joint/JointSidebar";

export const metadata: Metadata = {
  title: "Joint Account Dashboard | Starfetch Investment Limited",
  description: "Manage authorized Starfetch Joint Account access and membership.",
};

export default function JointDashboardPage() {
  return <div className="min-h-screen bg-[#f7f9f8] lg:pl-[270px]"><JointSidebar /><div className="min-w-0"><JointHeader /><div className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8 lg:px-8 xl:px-10"><JointDashboardContent /></div></div></div>;
}
