/**
 * Internal application retention policy for private KYC/onboarding documents.
 * Keep this finite and review it with compliance when policy changes; never
 * fall back to indefinite retention when an environment value is absent.
 */
export const INDIVIDUAL_KYC_DOCUMENT_RETENTION_DAYS = 90;
