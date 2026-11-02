export type IndividualProfileStepId = "personal-information" | "identity-verification" | "employment-income" | "bank-details" | "pep-declaration" | "investment-risk-profile";
export type ProfileSectionStatus = "Completed" | "Pending" | "Action Required";
export type ProfileVerificationStatus = "Profile Incomplete" | "Verification Pending" | "Action Required" | "Verified";
export type MockDocumentStatus = "Not Uploaded" | "Uploaded" | "Pending Review" | "Verified";

export type IndividualProfile = {
  personalInformation: {
    title: string;
    firstName: string;
    middleName: string;
    surname: string;
    dateOfBirth: string;
    gender: string;
    nationality: string;
    countryOfBirth: string;
    residentialAddress: string;
    stateOfResidence: string;
    countryOfTaxResidence: string;
    emailAddress: string;
    mobilePhone: string;
  };
  identityVerification: {
    idType: string;
    idNumber: string;
    issueDate: string;
    expiryDate: string;
    bvn: string;
    nin: string;
    tin: string;
    documents: Array<{ id: "photo-id" | "passport-photo" | "proof-of-address"; label: string; status: MockDocumentStatus }>;
  };
  employmentIncomeSourceOfFunds: {
    occupation: string;
    employerName: string;
    employmentStatus: string;
    annualIncome: string;
    estimatedNetWorth: string;
    sourceOfFunds: string;
    specifySource: string;
    expectedAnnualInflow: string;
    expectedTransactionFrequency: string;
  };
  bankDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    accountType: string;
    branchSortCode: string;
    bvnLinkedToAccount: string;
  };
  pepDeclaration: {
    hasPepRelationship: "Yes" | "No" | "";
    name: string;
    position: string;
    country: string;
    periodHeld: string;
    declarationAccepted: boolean;
  };
  investmentRiskProfile: {
    primaryObjective: string;
    riskTolerance: string;
    investmentHorizon: string;
    investmentKnowledge: string;
    expectedWithdrawals: string;
    withdrawalFrequency: string;
    investmentRestrictions: string;
    preferredProducts: string[];
  };
  verificationStatus: ProfileVerificationStatus;
};

export type IndividualProfileStep = {
  id: IndividualProfileStepId;
  number: number;
  title: string;
  shortTitle: string;
  description: string;
};

/** Frontend-only initial state. Future APIs can hydrate this structure directly. */
export const individualProfile: IndividualProfile = {
  personalInformation: {
    title: "Mr.",
    firstName: "Adekunle",
    middleName: "Tunde",
    surname: "Adebayo",
    dateOfBirth: "1988-03-22",
    gender: "Male",
    nationality: "Nigerian",
    countryOfBirth: "Nigeria",
    residentialAddress: "14 Adeola Crescent, Victoria Island",
    stateOfResidence: "Lagos",
    countryOfTaxResidence: "Nigeria",
    emailAddress: "adekunle.adebayo@example.com",
    mobilePhone: "+234 803 555 0198",
  },
  identityVerification: {
    idType: "National ID Card",
    idNumber: "NIN-1234-5678",
    issueDate: "2024-03-10",
    expiryDate: "2034-03-09",
    bvn: "22123456789",
    nin: "12345678901",
    tin: "",
    documents: [
      { id: "photo-id", label: "Valid Photo ID", status: "Verified" },
      { id: "passport-photo", label: "Passport Photograph", status: "Verified" },
      { id: "proof-of-address", label: "Proof of Address", status: "Verified" },
    ],
  },
  employmentIncomeSourceOfFunds: {
    occupation: "Finance Professional",
    employerName: "Local Enterprise Ltd.",
    employmentStatus: "Employed",
    annualIncome: "18000000",
    estimatedNetWorth: "75000000",
    sourceOfFunds: "Salary / Employment",
    specifySource: "",
    expectedAnnualInflow: "25000000",
    expectedTransactionFrequency: "Quarterly",
  },
  bankDetails: {
    bankName: "Starfetch Partner Bank",
    accountNumber: "0123454321",
    accountName: "Adekunle Tunde Adebayo",
    accountType: "Savings",
    branchSortCode: "044150149",
    bvnLinkedToAccount: "22123456789",
  },
  pepDeclaration: {
    hasPepRelationship: "No",
    name: "",
    position: "",
    country: "",
    periodHeld: "",
    declarationAccepted: true,
  },
  investmentRiskProfile: {
    primaryObjective: "Growth",
    riskTolerance: "Moderate",
    investmentHorizon: "3–5 years",
    investmentKnowledge: "Good",
    expectedWithdrawals: "5000000",
    withdrawalFrequency: "As Needed",
    investmentRestrictions: "",
    preferredProducts: ["Starfetch Fixed Note", "Discretionary Portfolio"],
  },
  verificationStatus: "Verified",
};

export const individualProfileSteps: ReadonlyArray<IndividualProfileStep> = [
  { id: "personal-information", number: 1, title: "Personal Information", shortTitle: "Personal Information", description: "Provide your basic personal and contact information." },
  { id: "identity-verification", number: 2, title: "Identity Verification", shortTitle: "Identity Verification", description: "Provide the information required to verify your identity." },
  { id: "employment-income", number: 3, title: "Employment, Income & Source of Funds", shortTitle: "Employment, Income & Source of Funds", description: "Tell us about your employment, income and the source of funds you intend to invest." },
  { id: "bank-details", number: 4, title: "Bank Details", shortTitle: "Bank Details", description: "Provide the bank account to be used for withdrawals and distributions." },
  { id: "pep-declaration", number: 5, title: "PEP / Regulatory Declaration", shortTitle: "PEP / Regulatory Declaration", description: "Tell us whether you or a close relative or associate has held a prominent public position." },
  { id: "investment-risk-profile", number: 6, title: "Investment Objective & Risk Profile", shortTitle: "Investment Objective & Risk Profile", description: "Tell us about your investment goals, risk appetite, horizon and experience. This helps us understand your investment profile." },
];

export const profileSelectOptions = {
  titles: ["Mr.", "Mrs.", "Ms.", "Dr.", "Other"],
  genders: ["Female", "Male", "Non-binary", "Prefer not to say"],
  identityTypes: ["National ID Card", "International Passport", "Driver's Licence", "Voter's Card"],
  employmentStatuses: ["Employed", "Self-Employed", "Business Owner", "Retired", "Student", "Other"],
  sourceOfFunds: ["Salary / Employment", "Business Income", "Sale of Assets", "Inheritance / Gift", "Savings", "Pension / Retirement", "Investment Proceeds", "Other"],
  transactionFrequencies: ["Monthly", "Quarterly", "Semi-Annually", "Annually", "Occasionally"],
  bankAccountTypes: ["Savings", "Current", "Domiciliary"],
  withdrawalFrequencies: ["As Needed", "Monthly", "Quarterly", "Semi-Annually", "Annually"],
} as const;

export const investmentRiskOptions = {
  primaryObjective: ["Capital Preservation", "Income", "Balanced", "Growth"],
  riskTolerance: ["Conservative", "Moderate", "Balanced", "Aggressive"],
  investmentHorizon: ["Less than 1 year", "1–3 years", "3–5 years", "5 years+"],
  investmentKnowledge: ["None", "Limited", "Good", "Extensive"],
  preferredProducts: ["Starfetch Fixed Note", "Discretionary Portfolio", "Execution Mandate"],
} as const;

export function isIndividualProfileStepComplete(stepId: IndividualProfileStepId, profile: IndividualProfile) {
  const personal = profile.personalInformation;
  const identity = profile.identityVerification;
  const employment = profile.employmentIncomeSourceOfFunds;
  const bank = profile.bankDetails;
  const pep = profile.pepDeclaration;
  const risk = profile.investmentRiskProfile;

  if (stepId === "personal-information") return [personal.title, personal.firstName, personal.surname, personal.dateOfBirth, personal.gender, personal.nationality, personal.countryOfBirth, personal.residentialAddress, personal.stateOfResidence, personal.countryOfTaxResidence, personal.emailAddress, personal.mobilePhone].every(Boolean);
  if (stepId === "identity-verification") return [identity.idType, identity.idNumber, identity.issueDate, identity.expiryDate, identity.bvn, identity.nin].every(Boolean) && identity.documents.every((document) => document.status === "Verified" || document.status === "Pending Review" || document.status === "Uploaded");
  if (stepId === "employment-income") return [employment.occupation, employment.employerName, employment.employmentStatus, employment.annualIncome, employment.estimatedNetWorth, employment.sourceOfFunds, employment.expectedAnnualInflow, employment.expectedTransactionFrequency].every(Boolean) && (employment.sourceOfFunds !== "Other" || Boolean(employment.specifySource));
  if (stepId === "bank-details") return [bank.bankName, bank.accountNumber, bank.accountName, bank.accountType, bank.branchSortCode, bank.bvnLinkedToAccount].every(Boolean);
  if (stepId === "pep-declaration") return Boolean(pep.hasPepRelationship && pep.declarationAccepted && (pep.hasPepRelationship !== "Yes" || [pep.name, pep.position, pep.country, pep.periodHeld].every(Boolean)));
  return [risk.primaryObjective, risk.riskTolerance, risk.investmentHorizon, risk.investmentKnowledge, risk.expectedWithdrawals, risk.withdrawalFrequency].every(Boolean) && risk.preferredProducts.length > 0;
}

export function getIndividualProfileCompletion(profile: IndividualProfile) {
  const completedSections = individualProfileSteps.filter((step) => isIndividualProfileStepComplete(step.id, profile)).length;
  return { completedSections, totalSections: individualProfileSteps.length, percentage: Math.round((completedSections / individualProfileSteps.length) * 100) };
}

export function getIndividualProfileSectionStatus(stepId: IndividualProfileStepId, profile: IndividualProfile): ProfileSectionStatus {
  return isIndividualProfileStepComplete(stepId, profile) ? "Completed" : "Action Required";
}

export function maskAccountNumber(accountNumber: string) {
  return accountNumber.length > 4 ? `${"•".repeat(Math.max(0, accountNumber.length - 4))}${accountNumber.slice(-4)}` : accountNumber;
}
