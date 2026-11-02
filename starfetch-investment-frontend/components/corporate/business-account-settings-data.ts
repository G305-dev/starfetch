export type BusinessVerificationSection = {
  id: "kyc" | "kyb";
  title: string;
  acronym: string;
  description: string;
  requirements: string[];
};

/** Local-only KYC/KYB requirements shown in Business Account Settings. */
export const businessVerificationSections: BusinessVerificationSection[] = [
  {
    id: "kyc",
    title: "Know Your Customer",
    acronym: "KYC",
    description: "Verify the authorised representative managing this business investment account.",
    requirements: ["Valid government-issued identification", "Proof of residential address", "Authorised representative details"],
  },
  {
    id: "kyb",
    title: "Know Your Business",
    acronym: "KYB",
    description: "Verify the business information and documents required for this investment account.",
    requirements: ["Certificate of incorporation or registration", "RC and business registration details", "Tax identification number and business records"],
  },
];
