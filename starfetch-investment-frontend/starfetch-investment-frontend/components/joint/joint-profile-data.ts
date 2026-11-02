export type JointProfileSectionStatus = "Completed" | "Pending" | "Action Required";

export type JointProfileApplicant = {
  id: "applicant-1" | "applicant-2";
  label: "Applicant 1" | "Applicant 2";
  fullName: string;
  initials: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  profileStatus: "Profile Updated";
};

export type JointProfileSection = {
  id: "personal-details" | "identity-verification" | "next-of-kin" | "investment-profile" | "source-of-funds" | "bank-details" | "pep-declaration" | "documents";
  title: string;
  description: string;
  status: JointProfileSectionStatus;
};

/** Frontend-only mock data for the joint account profile experience. */
export const jointProfile = {
  applicant1: {
    id: "applicant-1",
    label: "Applicant 1",
    fullName: "Amara Okeke",
    initials: "AO",
    email: "amara.okeke@example.com",
    phone: "+234 803 123 4567",
    dateOfBirth: "Jan 15, 1985",
    profileStatus: "Profile Updated",
  },
  applicant2: {
    id: "applicant-2",
    label: "Applicant 2",
    fullName: "Daniel Musa",
    initials: "DM",
    email: "daniel.musa@example.com",
    phone: "+234 806 987 6543",
    dateOfBirth: "Mar 22, 1988",
    profileStatus: "Profile Updated",
  },
  profileCompletion: {
    percentage: 60,
    completedSections: 3,
    totalSections: 5,
    completedLabel: "3 of 5 sections completed",
    title: "Complete Your Joint Profile",
    description: "Finish setting up your account to access all Starfetch investment services.",
  },
  personalDetailsStatus: "Completed",
  identityStatus: "Pending",
  nextOfKinStatus: "Completed",
  investmentProfileStatus: "Pending",
  sourceOfFundsStatus: "Pending",
  bankDetailsStatus: "Completed",
  pepStatus: "Completed",
  documentsStatus: "Pending",
  signingMandate: {
    selected: "Both Holders to Sign",
    description: "Both holders must approve account instructions before they are processed.",
    supportedRules: ["Either Holder to Sign", "Both Holders to Sign"],
  },
} as const satisfies {
  applicant1: JointProfileApplicant;
  applicant2: JointProfileApplicant;
  profileCompletion: { percentage: number; completedSections: number; totalSections: number; completedLabel: string; title: string; description: string };
  personalDetailsStatus: JointProfileSectionStatus;
  identityStatus: JointProfileSectionStatus;
  nextOfKinStatus: JointProfileSectionStatus;
  investmentProfileStatus: JointProfileSectionStatus;
  sourceOfFundsStatus: JointProfileSectionStatus;
  bankDetailsStatus: JointProfileSectionStatus;
  pepStatus: JointProfileSectionStatus;
  documentsStatus: JointProfileSectionStatus;
  signingMandate: { selected: "Either Holder to Sign" | "Both Holders to Sign"; description: string; supportedRules: readonly string[] };
};

export const jointProfileSections: ReadonlyArray<JointProfileSection> = [
  { id: "personal-details", title: "Personal Details", description: "Additional information for both account holders.", status: jointProfile.personalDetailsStatus },
  { id: "identity-verification", title: "Identity Verification", description: "ID, BVN, NIN and proof of address for both holders.", status: jointProfile.identityStatus },
  { id: "next-of-kin", title: "Next of Kin", description: "Next of kin information for both account holders.", status: jointProfile.nextOfKinStatus },
  { id: "investment-profile", title: "Investment Profile", description: "Investment objective, risk tolerance and experience.", status: jointProfile.investmentProfileStatus },
  { id: "source-of-funds", title: "Source of Funds", description: "Source of funds and expected transaction activity.", status: jointProfile.sourceOfFundsStatus },
  { id: "bank-details", title: "Bank Details", description: "Joint account bank details for withdrawals and returns.", status: jointProfile.bankDetailsStatus },
  { id: "pep-declaration", title: "PEP Declaration", description: "Politically exposed person declaration for both holders.", status: jointProfile.pepStatus },
  { id: "documents", title: "Documents", description: "Upload required identity and supporting documents.", status: jointProfile.documentsStatus },
];
