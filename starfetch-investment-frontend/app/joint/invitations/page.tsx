import type { Metadata } from "next";
import { JointHeader } from "@/components/joint/JointHeader";
import { JointInvitationsContent } from "@/components/joint/JointInvitationsContent";
import { JointSidebar } from "@/components/joint/JointSidebar";

export const metadata: Metadata = {
  title: "Joint Invitations | Starfetch Investment Limited",
  description: "Review Joint Account invitations addressed to your verified Starfetch investor account.",
};

export default function JointInvitationsPage() {
  return <div className="min-h-screen bg-[#f7f9f8] lg:pl-[270px]"><JointSidebar /><div className="min-w-0"><JointHeader /><div className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8 lg:px-8 xl:px-10"><JointInvitationsContent /></div></div></div>;
}
