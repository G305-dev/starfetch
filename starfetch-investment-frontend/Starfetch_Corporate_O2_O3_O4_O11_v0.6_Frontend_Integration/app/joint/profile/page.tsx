import type { Metadata } from "next";
import { JointHeader } from "@/components/joint/JointHeader";
import { JointProfileContent } from "@/components/joint/JointProfileContent";
import { JointSidebar } from "@/components/joint/JointSidebar";

export const metadata: Metadata = {
  title: "Joint Profile | Starfetch Joint Account",
  description: "View Joint Account holder and account details for Starfetch Investment Limited.",
};

export default function JointProfilePage() {
  return <div className="min-h-screen bg-[#f7f9f8] lg:pl-[270px]"><JointSidebar /><div className="min-w-0"><JointHeader /><div className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8 lg:px-8 xl:px-10"><JointProfileContent /></div></div></div>;
}
