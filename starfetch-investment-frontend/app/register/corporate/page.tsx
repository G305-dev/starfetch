import type { Metadata } from "next";
import { OnboardingHeader } from "@/components/auth/OnboardingHeader";
import { RegistrationPlaceholder } from "@/components/auth/RegistrationPlaceholder";

export const metadata: Metadata = {
  title: "Corporate Account Registration | Starfetch Investment Limited",
};

export default function CorporateRegistrationPage() {
  return (
    <div className="min-h-screen bg-star-50 text-star-900">
      <OnboardingHeader />
      <RegistrationPlaceholder
        accountType="Corporate"
        description="You selected a Corporate Account for companies, institutions and other eligible organisations opening an investment account."
      />
    </div>
  );
}
