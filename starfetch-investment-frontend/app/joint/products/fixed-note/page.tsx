import type { Metadata } from "next";
import { JointHeader } from "@/components/joint/JointHeader";
import { JointSidebar } from "@/components/joint/JointSidebar";
import { FixedNoteRateForm } from "@/components/portal/FixedNoteRateForm";

export const metadata: Metadata = {
  title: "Fixed Note Rate | Starfetch Joint Account",
  description: "Select an indicative Starfetch Fixed Note rate from a joint investor account.",
};

export default function JointFixedNotePage() {
  return <div className="min-h-screen bg-[#f7f9f8] lg:pl-[270px]"><JointSidebar /><div className="min-w-0"><JointHeader /><main className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8 lg:px-8 xl:px-10"><FixedNoteRateForm backHref="/joint/products" /></main></div></div>;
}
