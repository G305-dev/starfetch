/**
 * Form shapes for the four-section Corporate Profile. Form values are held only
 * in component memory; persisted values are loaded from and saved through the
 * owner-scoped Corporate Profile API. The TIN and bank account number inputs are
 * write-only and are never hydrated from a backend response.
 */
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

/* -------------------------------------------------------------------------- */
/* Backend contract: GET/PATCH /api/v1/corporate-accounts/:id/profile[/...]    */
/* (starfetch-investment-backend CorporateProfileView). The TIN and the bank   */
/* account number are never returned; only backend-masked projections exist.  */
/* -------------------------------------------------------------------------- */

export const corporateProfileSectionKeys = ["companyDetails", "investmentProfile", "sourceOfFunds", "bankDetails"] as const;
export type CorporateProfileSectionKey = (typeof corporateProfileSectionKeys)[number];
export type CorporateProfileSectionStatus = "NOT_STARTED" | "DRAFT" | "COMPLETE";

export type CorporateProfileView = {
  corporateAccountId: string;
  applicationId: string;
  applicant: { companyName: string | null; companyPhoneNumber: string | null; email: string };
  canonicalDetails: {
    institutionName: string;
    dateOfIncorporation: string;
    rcNumber: string;
    businessPhoneNumber: string;
    businessEmail: string;
    /** Backend-masked or null (null also when the TIN privacy/KMS gate is closed). */
    taxIdentificationNumberMasked: string | null;
  };
  companyDetails: { registeredAddress: string | null; city: string | null; state: string | null };
  investmentProfile: {
    primaryObjective: string | null;
    riskTolerance: string | null;
    investmentHorizon: string | null;
    expectedWithdrawals: string | null;
    withdrawalFrequency: string | null;
    restrictionsOrExclusions: string | null;
  };
  sourceOfFunds: { selectedSources: string[]; otherSource: string | null; expectedAnnualInflow: string | null; expectedTransactionFrequency: string | null };
  bankDetails: { bankName: string | null; accountNumberMasked: string | null; accountName: string | null; accountType: string | null; bvnLinkedToAccount: boolean | null };
  profileVersion: number;
  detailsVersion: number;
  sectionStatuses: Record<CorporateProfileSectionKey, CorporateProfileSectionStatus>;
  /** Saved-form completion only. It is not KYC/KYB verification, review, approval or eligibility. */
  progress: { percentage: number; nextSection: CorporateProfileSectionKey | null; canSubmit: false; meaning: "SAVED_FORM_COMPLETION_ONLY" };
  updatedAt: string | null;
};

/** Exact Company Details PATCH body. Omit the TIN to retain the encrypted TIN on file. */
export type CorporateProfileCompanyDetailsInput = {
  rcNumber: string;
  dateOfIncorporation: string;
  taxIdentificationNumber?: string;
  registeredAddress: string;
  city: string;
  state: string;
};

export type CorporateProfileInvestmentInput = {
  primaryObjective: string;
  riskTolerance: string;
  investmentHorizon: string;
  expectedWithdrawals: string;
  withdrawalFrequency: string;
  restrictionsOrExclusions?: string;
};

export type CorporateProfileSourceOfFundsInput = {
  selectedSources: string[];
  otherSource?: string;
  /** Non-negative NGN amount, at most two decimal places, no separators. */
  expectedAnnualInflow: string;
  expectedTransactionFrequency: string;
};

/** The account number is transmitted only in this request and never stored by the browser. */
export type CorporateProfileBankDetailsInput = {
  bankName: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  bvnLinkedToAccount: boolean;
};

export type CorporateApplicantIdentityInput = { companyName: string; companyPhoneNumber: string };

/** Backend DTO patterns mirrored for early, non-authoritative client feedback. */
export const corporateAnnualInflowPattern = /^\d{1,15}(?:\.\d{1,2})?$/;
export const corporateApplicantPhonePattern = /^\+?[0-9][0-9()\-\s]{5,18}[0-9]$/;

/** Mirrors the backend's unambiguous-amount rule for expected withdrawals. */
export function isAmbiguousCorporateWithdrawalAmount(value: string) {
  const trimmed = value.trim();
  if (/^no withdrawals planned$/i.test(trimmed)) return false;
  if (/^₦?\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?$/.test(trimmed)) return false;
  return /[₦\d]/.test(trimmed);
}

/** Builds the exact quoted If-Match values required by the backend. */
export function corporateProfileIfMatch(profileVersion: number, detailsVersion?: number) {
  if (!Number.isSafeInteger(profileVersion) || profileVersion < 0) throw new Error("Invalid Corporate Profile version");
  if (detailsVersion === undefined) return `"profile-${profileVersion}"`;
  if (!Number.isSafeInteger(detailsVersion) || detailsVersion < 1) throw new Error("Invalid Corporate details version");
  return `"profile-${profileVersion};details-${detailsVersion}"`;
}
