export const corporateProfileSectionStatuses = ["NOT_STARTED", "DRAFT", "COMPLETE"] as const;
export type CorporateProfileSectionStatus = (typeof corporateProfileSectionStatuses)[number];

export type CorporateProfileSectionStates = {
  companyDetails: CorporateProfileSectionStatus;
  investmentProfile: CorporateProfileSectionStatus;
  sourceOfFunds: CorporateProfileSectionStatus;
  bankDetails: CorporateProfileSectionStatus;
};

export type CorporateApplicantInfo = {
  companyName: string;
  companyPhoneNumber: string;
  email: string;
};

export type CorporateCompanyDetails = {
  rcNumber: string;
  dateOfIncorporation: string;
  taxIdentificationNumberMasked: string | null;
  registeredAddress: string;
  city: string;
  state: string;
};

export type CorporateInvestmentProfile = {
  primaryObjective: string;
  riskTolerance: string;
  investmentHorizon: string;
  expectedWithdrawals: string;
  withdrawalFrequency: string;
  restrictionsOrExclusions: string;
};

export type CorporateSourceOfFunds = {
  selectedSources: string[];
  otherSource: string;
  expectedAnnualInflow: string;
  expectedTransactionFrequency: string;
};

export type CorporateBankDetails = {
  bankName: string;
  accountNumberMasked: string | null;
  accountName: string;
  accountType: string;
  bvnLinkedToAccount: boolean | null;
};

export type CorporateProfile = {
  applicant: CorporateApplicantInfo;
  sections: CorporateProfileSectionStates;
  companyDetails: CorporateCompanyDetails;
  investmentProfile: CorporateInvestmentProfile;
  sourceOfFunds: CorporateSourceOfFunds;
  bankDetails: CorporateBankDetails;
  version: number;
  updatedAt: string;
};

export type CorporateCompanyDetailsInput = {
  rcNumber: string;
  dateOfIncorporation: string;
  /** Write-only. Omit only when a backend-masked TIN is already present. */
  taxIdentificationNumber?: string;
  registeredAddress: string;
  city: string;
  state: string;
};

export type CorporateInvestmentProfileInput = CorporateInvestmentProfile;
export type CorporateSourceOfFundsInput = CorporateSourceOfFunds;
export type CorporateBankDetailsInput = {
  bankName: string;
  /** Write-only; omit only when a backend-masked account number already exists. */
  accountNumber?: string;
  accountName: string;
  accountType: string;
  bvnLinkedToAccount: boolean | null;
};

export const corporateInvestmentObjectives = ["Capital preservation", "Income", "Balanced", "Growth"] as const;
export const corporateRiskToleranceOptions = ["Conservative", "Moderate", "Balanced", "Aggressive"] as const;
export const corporateInvestmentHorizonOptions = ["< 1 year", "1–3 years", "3–5 years", "5 years +"] as const;
export const corporateSourceOfFundsOptions = ["Business income / operating cash", "Sale of assets", "Loan / financing", "Other (specify)"] as const;

export function emptyCorporateCompanyDetails(): CorporateCompanyDetails {
  return { rcNumber: "", dateOfIncorporation: "", taxIdentificationNumberMasked: null, registeredAddress: "", city: "", state: "" };
}

export function emptyCorporateInvestmentProfile(): CorporateInvestmentProfile {
  return { primaryObjective: "", riskTolerance: "", investmentHorizon: "", expectedWithdrawals: "", withdrawalFrequency: "", restrictionsOrExclusions: "" };
}

export function emptyCorporateSourceOfFunds(): CorporateSourceOfFunds {
  return { selectedSources: [], otherSource: "", expectedAnnualInflow: "", expectedTransactionFrequency: "" };
}

export function emptyCorporateBankDetails(): CorporateBankDetails {
  return { bankName: "", accountNumberMasked: null, accountName: "", accountType: "", bvnLinkedToAccount: null };
}
