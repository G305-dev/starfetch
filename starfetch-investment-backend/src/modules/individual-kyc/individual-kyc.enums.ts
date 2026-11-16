/** Stable wire enum values for the Investment Horizon dropdown. */
export enum IndividualKycInvestmentHorizon {
  DAYS_180 = 'DAYS_180',
  DAYS_365 = 'DAYS_365',
  YEARS_1_TO_3 = 'YEARS_1_TO_3',
  YEARS_3_TO_5 = 'YEARS_3_TO_5',
  YEARS_5_PLUS = 'YEARS_5_PLUS',
}

/** Stable enum-to-display mapping; clients may localize the labels. */
export const INDIVIDUAL_KYC_HORIZON_LABELS: Readonly<Record<IndividualKycInvestmentHorizon, string>> = Object.freeze({
  [IndividualKycInvestmentHorizon.DAYS_180]: '180 days',
  [IndividualKycInvestmentHorizon.DAYS_365]: '365 days',
  [IndividualKycInvestmentHorizon.YEARS_1_TO_3]: '1–3 years',
  [IndividualKycInvestmentHorizon.YEARS_3_TO_5]: '3–5 years',
  [IndividualKycInvestmentHorizon.YEARS_5_PLUS]: '5+ years',
});
