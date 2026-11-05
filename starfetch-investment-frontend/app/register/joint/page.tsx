import type { Metadata } from "next";
import { JointApplicantDetailsForm } from "@/components/auth/JointApplicantDetailsForm";
import { OnboardingHeader } from "@/components/auth/OnboardingHeader";
import { RequireIndividualAuth } from "@/components/auth/RequireIndividualAuth";

export const metadata: Metadata = {
  title: "Joint Account Holders | Starfetch Investment Limited",
  description: "Provide the basic details for both Starfetch joint account holders.",
};

export default function JointRegistrationPage() {
  return <RequireIndividualAuth><div className="min-h-screen bg-[#fffef9] text-star-900"><OnboardingHeader /><main className="relative isolate min-h-[calc(100vh-76px)] overflow-hidden px-5 py-14 sm:px-8 sm:py-16 lg:px-10 lg:py-20"><div className="pointer-events-none absolute -left-32 top-12 -z-10 h-80 w-80 rounded-full bg-star-100/65 blur-3xl" aria-hidden="true" /><div className="pointer-events-none absolute -right-28 bottom-8 -z-10 h-96 w-96 rotate-12 border-[42px] border-star-100/80" aria-hidden="true" /><JointApplicantDetailsForm /></main></div></RequireIndividualAuth>;
}
