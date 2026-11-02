import type { Metadata } from "next";
import { JointHeader } from "@/components/joint/JointHeader";
import { JointSidebar } from "@/components/joint/JointSidebar";
import { JointTransactionsContent } from "@/components/joint/JointTransactionsContent";

export const metadata: Metadata = {
  title: "Transactions | Starfetch Joint Account",
  description: "Frontend-only joint account transaction history for Starfetch Investment Limited.",
};

export default function JointTransactionsPage() {
  return <div className="min-h-screen bg-[#f7f9f8] lg:pl-[270px]"><JointSidebar /><div className="min-w-0"><JointHeader /><div className="px-5 py-8 sm:px-8 lg:px-8 xl:px-10"><JointTransactionsContent /></div></div></div>;
}
