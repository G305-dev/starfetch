import type { Metadata } from "next";
import { OnboardingHeader } from "@/components/auth/OnboardingHeader";
import { RegistrationPlaceholder } from "@/components/auth/RegistrationPlaceholder";

export const metadata: Metadata = {
  title: "Joint Account Registration | Starfetch Investment Limited",
};

export default function JointRegistrationPage() {
  return (
    <div className="min-h-screen bg-star-50 text-star-900">
      <OnboardingHeader />
      <RegistrationPlaceholder
        accountType="Joint"
        description="You selected a Joint Account for two individuals who want to open and manage an investment account together."
      />
    </div>
  );
}
