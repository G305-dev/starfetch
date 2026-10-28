import type { Metadata } from "next";
import { IndividualOnboardingFlow } from "@/components/auth/IndividualOnboardingFlow";
import { OnboardingHeader } from "@/components/auth/OnboardingHeader";

export const metadata: Metadata = {
  title: "Individual Onboarding | Starfetch Investor Portal",
  description: "Complete individual investor onboarding with Starfetch.",
};

export default function IndividualOnboardingPage() {
  return <div className="min-h-screen bg-[#fffef9] text-star-900"><OnboardingHeader /><main className="relative isolate min-h-[calc(100vh-76px)] overflow-hidden px-5 py-14 sm:px-8 sm:py-16 lg:px-10 lg:py-20"><div className="pointer-events-none absolute -left-32 top-12 -z-10 size-80 rounded-full bg-star-100/65 blur-3xl" aria-hidden="true" /><div className="pointer-events-none absolute -right-28 bottom-8 -z-10 size-96 rotate-12 border-[42px] border-star-100/80" aria-hidden="true" /><IndividualOnboardingFlow /></main></div>;
}
