import { CorporateProfile, CorporateProfileSectionStatus, CorporateOnboardingDetails } from '@prisma/client';

export const CORPORATE_PROFILE_SECTIONS = ['companyDetails', 'investmentProfile', 'sourceOfFunds', 'bankDetails'] as const;
export type CorporateProfileSectionKey = typeof CORPORATE_PROFILE_SECTIONS[number];

type ProfileFields = Pick<CorporateProfile,
  'profileVersion' | 'companyDetailsDetailsVersion' | 'companyDetailsStatus' | 'investmentProfileStatus' | 'sourceOfFundsStatus' | 'bankDetailsStatus' |
  'registeredAddress' | 'city' | 'state' | 'primaryObjective' | 'riskTolerance' | 'investmentHorizon' | 'expectedWithdrawals' | 'withdrawalFrequency' |
  'selectedSources' | 'otherSource' | 'expectedAnnualInflowMinor' | 'expectedTransactionFrequency' |
  'bankName' | 'accountName' | 'accountType' | 'bvnLinkedToAccount' |
  'bankAccountNumberCiphertext' | 'bankAccountNumberIv' | 'bankAccountNumberAuthTag' | 'bankAccountNumberEncryptedDataKey' |
  'bankAccountNumberKeyProvider' | 'bankAccountNumberKeyId' | 'bankAccountNumberKeyVersion' | 'bankAccountNumberContextVersion'>;

type DetailsFields = Pick<CorporateOnboardingDetails,
  'version' | 'rcNumber' | 'dateOfIncorporation' |
  'taxIdentificationNumberCiphertext' | 'taxIdentificationNumberIv' | 'taxIdentificationNumberAuthTag' | 'taxIdentificationNumberEncryptedDataKey' |
  'taxIdentificationNumberKeyProvider' | 'taxIdentificationNumberKeyId' | 'taxIdentificationNumberKeyVersion' | 'taxIdentificationNumberContextVersion'>;

export interface CorporateProfileReadiness {
  readonly effectiveStatuses: Record<CorporateProfileSectionKey, CorporateProfileSectionStatus>;
  /** Sections not saved COMPLETE against the current canonical details, or whose stored data is no longer complete. */
  readonly incompleteSections: CorporateProfileSectionKey[];
  readonly profileVersion: number;
  readonly detailsVersion: number;
}

const present = (value: string | null | undefined) => typeof value === 'string' && value.trim().length > 0;

function hasTin(d: DetailsFields): boolean {
  return Boolean(d.taxIdentificationNumberCiphertext && d.taxIdentificationNumberIv && d.taxIdentificationNumberAuthTag &&
    d.taxIdentificationNumberEncryptedDataKey && d.taxIdentificationNumberKeyProvider && d.taxIdentificationNumberKeyId &&
    d.taxIdentificationNumberKeyVersion && d.taxIdentificationNumberContextVersion === 1);
}

function hasBankEnvelope(p: ProfileFields): boolean {
  return Boolean(p.bankAccountNumberCiphertext && p.bankAccountNumberIv && p.bankAccountNumberAuthTag && p.bankAccountNumberEncryptedDataKey &&
    p.bankAccountNumberKeyProvider && p.bankAccountNumberKeyId && p.bankAccountNumberKeyVersion && p.bankAccountNumberContextVersion !== null);
}

/**
 * Applies the same staleness rule as CorporateProfileService (a COMPLETE
 * Company Details section saved against older canonical details is DRAFT and
 * demotes the later sections), then re-checks that the stored values a
 * COMPLETE section depends on are still present. Nothing is decrypted.
 */
export function evaluateCorporateProfileReadiness(profile: ProfileFields | null, details: DetailsFields): CorporateProfileReadiness {
  const N = CorporateProfileSectionStatus.NOT_STARTED;
  const C = CorporateProfileSectionStatus.COMPLETE;
  const D = CorporateProfileSectionStatus.DRAFT;
  const stale = Boolean(profile && profile.companyDetailsStatus === C && profile.companyDetailsDetailsVersion !== details.version);
  const demote = (s: CorporateProfileSectionStatus) => (stale && s === C ? D : s);
  const effectiveStatuses: Record<CorporateProfileSectionKey, CorporateProfileSectionStatus> = {
    companyDetails: profile ? demote(profile.companyDetailsStatus) : N,
    investmentProfile: profile ? demote(profile.investmentProfileStatus) : N,
    sourceOfFunds: profile ? demote(profile.sourceOfFundsStatus) : N,
    bankDetails: profile ? demote(profile.bankDetailsStatus) : N,
  };
  const dataValid: Record<CorporateProfileSectionKey, boolean> = profile ? {
    companyDetails: present(profile.registeredAddress) && present(profile.city) && present(profile.state) &&
      present(details.rcNumber) && details.dateOfIncorporation instanceof Date && hasTin(details),
    investmentProfile: present(profile.primaryObjective) && present(profile.riskTolerance) && present(profile.investmentHorizon) &&
      present(profile.expectedWithdrawals) && present(profile.withdrawalFrequency),
    sourceOfFunds: Array.isArray(profile.selectedSources) && profile.selectedSources.length > 0 &&
      (!profile.selectedSources.includes('Other (specify)') || present(profile.otherSource)) &&
      profile.expectedAnnualInflowMinor !== null && present(profile.expectedTransactionFrequency),
    bankDetails: present(profile.bankName) && present(profile.accountName) && present(profile.accountType) &&
      profile.bvnLinkedToAccount !== null && hasBankEnvelope(profile),
  } : { companyDetails: false, investmentProfile: false, sourceOfFunds: false, bankDetails: false };
  const incompleteSections = CORPORATE_PROFILE_SECTIONS.filter((key) => effectiveStatuses[key] !== C || !dataValid[key]);
  return { effectiveStatuses, incompleteSections, profileVersion: profile?.profileVersion ?? 0, detailsVersion: details.version };
}
