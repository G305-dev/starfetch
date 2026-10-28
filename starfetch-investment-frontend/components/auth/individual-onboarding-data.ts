export type IndividualMandateId = "fixed-note" | "discretionary-portfolio" | "execution-mandate";

export type IdentityDocumentType = "National ID" | "Driver’s Licence" | "PVC" | "International Passport" | "NIN";

export type IndividualOnboardingData = {
  mandate: IndividualMandateId | "";
  title: string;
  dateOfBirth: string;
  mothersMaidenName: string;
  nationality: string;
  residentialAddress: string;
  stateOfResidence: string;
  mobilePhoneNumber: string;
  idType: IdentityDocumentType | "";
  idDocumentName: string;
  nextOfKinFullName: string;
  nextOfKinRelationship: string;
  nextOfKinDateOfBirth: string;
  nextOfKinAddress: string;
  nextOfKinPhone: string;
  nextOfKinEmail: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  linkedBvn: string;
};

/** Local-only onboarding data. Future account/KYC APIs replace this frontend state. */
export const initialIndividualOnboardingData: IndividualOnboardingData = {
  mandate: "",
  title: "",
  dateOfBirth: "",
  mothersMaidenName: "",
  nationality: "",
  residentialAddress: "",
  stateOfResidence: "",
  mobilePhoneNumber: "",
  idType: "",
  idDocumentName: "",
  nextOfKinFullName: "",
  nextOfKinRelationship: "",
  nextOfKinDateOfBirth: "",
  nextOfKinAddress: "",
  nextOfKinPhone: "",
  nextOfKinEmail: "",
  bankName: "",
  accountNumber: "",
  accountName: "",
  accountType: "",
  linkedBvn: "",
};

export const individualMandates: Array<{ id: IndividualMandateId; title: string; description: string; detail: string }> = [
  {
    id: "fixed-note",
    title: "Starfetch Fixed Note",
    description: "A fixed-term investment solution designed for capital preservation and defined returns.",
    detail: "Fixed income solution",
  },
  {
    id: "discretionary-portfolio",
    title: "Discretionary Portfolio",
    description: "A professionally managed portfolio aligned to your objectives and agreed risk profile.",
    detail: "Managed investment mandate",
  },
  {
    id: "execution-mandate",
    title: "Execution Mandate",
    description: "A client-directed mandate supported by Starfetch research, execution and administration.",
    detail: "Execution-only mandate",
  },
];

export const individualOnboardingSteps = [
  { number: 1, label: "Mandate Selection" },
  { number: 2, label: "Personal Details" },
  { number: 3, label: "Address Details" },
  { number: 4, label: "Identity Verification" },
  { number: 5, label: "Next of Kin" },
  { number: 6, label: "Bank Details" },
] as const;

export const identityDocumentTypes: IdentityDocumentType[] = ["National ID", "Driver’s Licence", "PVC", "International Passport", "NIN"];
