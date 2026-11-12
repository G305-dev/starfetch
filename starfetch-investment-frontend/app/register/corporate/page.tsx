import type { Metadata } from "next";
import { CorporateRegistrationEntry } from "@/components/auth/CorporateRegistrationEntry";
import { OnboardingHeader } from "@/components/auth/OnboardingHeader";

export const metadata: Metadata = {
  title: "Business Account Opening | Starfetch Investment Limited",
  description: "Open a business investment account with Starfetch.",
};

export default function CorporateRegistrationPage() {
  return (
    <div className="min-h-screen bg-[#fffef9] text-star-900">
      <OnboardingHeader />
      <CorporateRegistrationEntry />
    </div>
  );
}
