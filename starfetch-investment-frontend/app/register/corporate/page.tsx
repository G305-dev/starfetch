import type { Metadata } from "next";
import { CorporateOnboardingFlow } from "@/components/auth/CorporateOnboardingFlow";
import { OnboardingHeader } from "@/components/auth/OnboardingHeader";

export const metadata: Metadata = {
  title: "Corporate Account Opening | Starfetch Investment Limited",
  description: "Open a corporate investment account with Starfetch.",
};

export default function CorporateRegistrationPage() {
  return (
    <div className="min-h-screen bg-[#fffef9] text-star-900">
      <OnboardingHeader />
      <CorporateOnboardingFlow />
    </div>
  );
}
