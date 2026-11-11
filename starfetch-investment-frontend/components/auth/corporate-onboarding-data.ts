import type { CorporateDraftInput } from "@/lib/corporate/application";

export const corporateOnboardingSteps = [
  { number: 1, label: "Business Information" },
  { number: 2, label: "Review & Verification" },
] as const;

/**
 * This is the approved six-field Corporate O2 draft shape. It remains local
 * only until David publishes an authenticated public Corporate O2 endpoint.
 */
export type CorporateApplicationData = CorporateDraftInput & {
  authorizationConfirmed: boolean;
};

export type CorporateFieldErrors = Partial<Record<keyof CorporateApplicationData, string>>;

export const initialCorporateApplicationData: CorporateApplicationData = {
  institutionName: "",
  dateOfIncorporation: "",
  rcNumber: "",
  taxIdentificationNumber: "",
  businessPhoneNumber: "",
  businessEmail: "",
  authorizationConfirmed: false,
};

export function toCorporateDraftInput(data: CorporateApplicationData): CorporateDraftInput {
  return {
    institutionName: data.institutionName.trim(),
    dateOfIncorporation: data.dateOfIncorporation,
    rcNumber: data.rcNumber.trim(),
    taxIdentificationNumber: data.taxIdentificationNumber.trim(),
    businessPhoneNumber: data.businessPhoneNumber.trim(),
    businessEmail: data.businessEmail.trim(),
  };
}
