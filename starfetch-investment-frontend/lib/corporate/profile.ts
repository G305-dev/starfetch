/** Form shapes for the Corporate Profile's current-session-only preview. */
export type CorporateApplicantInfo = {
  companyName: string;
  companyPhoneNumber: string;
  email: string;
};

export type CorporateCompanyDetails = {
  rcNumber: string;
  dateOfIncorporation: string;
  taxIdentificationNumber: string;
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
  accountNumber: string;
  accountName: string;
  accountType: string;
  bvnLinkedToAccount: boolean | null;
};

export const corporateInvestmentObjectives = ["Capital preservation", "Income", "Balanced", "Growth"] as const;
export const corporateRiskToleranceOptions = ["Conservative", "Moderate", "Balanced", "Aggressive"] as const;
export const corporateInvestmentHorizonOptions = ["< 1 year", "1–3 years", "3–5 years", "5 years +"] as const;
export const corporateSourceOfFundsOptions = ["Business income / operating cash", "Sale of assets", "Loan / financing", "Other (specify)"] as const;

export function emptyCorporateCompanyDetails(): CorporateCompanyDetails {
  return { rcNumber: "", dateOfIncorporation: "", taxIdentificationNumber: "", registeredAddress: "", city: "", state: "" };
}

export function emptyCorporateInvestmentProfile(): CorporateInvestmentProfile {
  return { primaryObjective: "", riskTolerance: "", investmentHorizon: "", expectedWithdrawals: "", withdrawalFrequency: "", restrictionsOrExclusions: "" };
}

export function emptyCorporateSourceOfFunds(): CorporateSourceOfFunds {
  return { selectedSources: [], otherSource: "", expectedAnnualInflow: "", expectedTransactionFrequency: "" };
}

export function emptyCorporateBankDetails(): CorporateBankDetails {
  return { bankName: "", accountNumber: "", accountName: "", accountType: "", bvnLinkedToAccount: null };
}
