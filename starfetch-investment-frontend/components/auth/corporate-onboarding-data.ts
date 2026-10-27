export const corporateOnboardingSteps = [
  { number: 1, label: "Applicant Details" },
  { number: 2, label: "Mandate Selection" },
  { number: 3, label: "Bank Details" },
] as const;

export const corporateMandates = [
  {
    id: "fixed-note",
    title: "Starfetch Fixed Note",
    description: "Structured fixed-income investment focused on capital preservation and steady returns.",
  },
  {
    id: "discretionary-portfolio-management",
    title: "Discretionary Portfolio Management",
    description: "Starfetch manages day-to-day investment decisions on behalf of the institution based on an agreed mandate.",
  },
  {
    id: "non-discretionary-portfolio-management",
    title: "Non-Discretionary Portfolio Management",
    description: "The institution retains investment decision-making authority while Starfetch provides execution and support.",
  },
] as const;

export const accountTypeOptions = ["Current", "Savings", "Corporate Current", "Other"] as const;

export type CorporateMandateId = (typeof corporateMandates)[number]["id"];
export type CorporateAccountType = (typeof accountTypeOptions)[number];

export type CorporateApplicationData = {
  institutionName: string;
  dateOfIncorporation: string;
  rcNumber: string;
  taxIdentificationNumber: string;
  businessPhoneNumber: string;
  businessEmail: string;
  selectedMandate: CorporateMandateId | "";
  bankName: string;
  accountNumber: string;
  accountName: string;
  accountType: CorporateAccountType | "";
  linkedBvn: string;
};

export type CorporateFieldErrors = Partial<Record<keyof CorporateApplicationData, string>>;

export const initialCorporateApplicationData: CorporateApplicationData = {
  institutionName: "",
  dateOfIncorporation: "",
  rcNumber: "",
  taxIdentificationNumber: "",
  businessPhoneNumber: "",
  businessEmail: "",
  selectedMandate: "",
  bankName: "",
  accountNumber: "",
  accountName: "",
  accountType: "",
  linkedBvn: "",
};
