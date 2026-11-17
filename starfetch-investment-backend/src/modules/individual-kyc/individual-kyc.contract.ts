import {
  IndividualKycDocumentStatus,
  ManualDocumentReviewStatus,
  IndividualKycIdDocumentType,
  IndividualKycProfileStatus,
  IndividualKycSectionStatus,
} from '@prisma/client';
import type { IndividualKycGenderValue, IndividualKycHorizonValue } from './dto/individual-kyc.dto';
import { IndividualKycInvestmentHorizon } from './individual-kyc.enums';

const GENDER_VALUES = ['MALE', 'FEMALE'] as const;
const HORIZON_VALUES = Object.values(IndividualKycInvestmentHorizon);

/**
 * Proposed API catalogues mapped directly from the existing Individual KYC UI
 * option labels. These are completion/format rules only; they are not management,
 * suitability, AML/CFT, or compliance approval. See the API field-mapping guide.
 */
export const INDIVIDUAL_KYC_PROPOSED_OPTIONS = Object.freeze({
  investmentObjectives: Object.freeze({
    CAPITAL_PRESERVATION: 'Capital preservation',
    INCOME: 'Income',
    BALANCED: 'Balanced',
    GROWTH: 'Growth',
  }),
  riskTolerances: Object.freeze({
    CONSERVATIVE: 'Conservative',
    MODERATE: 'Moderate',
    BALANCED: 'Balanced',
    AGGRESSIVE: 'Aggressive',
  }),
  investmentKnowledgeExperience: Object.freeze({
    NONE: 'None',
    LIMITED: 'Limited',
    GOOD: 'Good',
    EXTENSIVE: 'Extensive',
  }),
  sourceOfFunds: Object.freeze({
    SALARY_EMPLOYMENT: 'Salary / employment',
    BUSINESS_INCOME: 'Business income',
    SALE_OF_ASSETS: 'Sale of assets',
    INHERITANCE_GIFT: 'Inheritance / gift',
    SAVINGS: 'Savings',
    PENSION_RETIREMENT: 'Pension / retirement',
    INVESTMENT_PROCEEDS: 'Investment proceeds',
    OTHER: 'Other (specify)',
  }),
  financialCurrencies: Object.freeze({ NGN: '₦' }),
});

const investmentObjectiveValues = Object.keys(INDIVIDUAL_KYC_PROPOSED_OPTIONS.investmentObjectives);
const riskToleranceValues = Object.keys(INDIVIDUAL_KYC_PROPOSED_OPTIONS.riskTolerances);
const investmentKnowledgeValues = Object.keys(INDIVIDUAL_KYC_PROPOSED_OPTIONS.investmentKnowledgeExperience);
const sourceOfFundsValues = Object.keys(INDIVIDUAL_KYC_PROPOSED_OPTIONS.sourceOfFunds);
const financialCurrencyValues = Object.keys(INDIVIDUAL_KYC_PROPOSED_OPTIONS.financialCurrencies);

export interface PersonalKycData {
  dateOfBirth?: string | null;
  gender?: IndividualKycGenderValue | null;
  nationality?: string | null;
  stateOfResidence?: string | null;
  residentialAddress?: string | null;
  idDocumentType?: IndividualKycIdDocumentType | null;
  occupation?: string | null;
  pepStatus?: 'YES' | 'NO' | null;
  pepDetails?: { fullName?: string | null; position?: string | null; country?: string | null; periodHeld?: string | null } | null;
}

export interface InvestmentProfileKycData {
  primaryInvestmentObjective?: string | null;
  riskTolerance?: string | null;
  investmentHorizon?: IndividualKycHorizonValue | null;
  financialCurrency?: string | null;
  investmentKnowledgeExperience?: string | null;
  expectedWithdrawalsMinor?: string | null;
  annualIncomeMinor?: string | null;
  estimatedNetWorthMinor?: string | null;
  withdrawalFrequency?: string | null;
  investmentRestrictions?: string | null;
}

export interface SourceOfFundsKycData {
  sourceOfFunds?: string[] | null;
  otherSource?: string | null;
  expectedAnnualInflowMinor?: string | null;
  expectedTransactionFrequency?: string | null;
}

export interface BankDetailsKycData {
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  accountType?: string | null;
  bvnLinkedToAccount?: boolean | null;
}

export interface IndividualKycPayload {
  personal?: PersonalKycData;
  investmentProfile?: InvestmentProfileKycData;
  sourceOfFunds?: SourceOfFundsKycData;
  bankDetails?: BankDetailsKycData;
}

/** Compatibility shape from the first Individual KYC persistence release. */
interface LegacySourceOfFundsKycData extends SourceOfFundsKycData {
  annualIncomeMinor?: string | null;
  estimatedNetWorthMinor?: string | null;
}

/** Moves legacy amounts to the report-defined Investment section without data loss. */
export function normalizeLegacyKycPayload(payload: IndividualKycPayload): IndividualKycPayload {
  const legacySource = payload.sourceOfFunds as LegacySourceOfFundsKycData | undefined;
  if (legacySource) {
    const hasLegacyAmounts = legacySource.annualIncomeMinor !== undefined || legacySource.estimatedNetWorthMinor !== undefined;
    if (hasLegacyAmounts) {
      const investment: InvestmentProfileKycData = { ...(payload.investmentProfile ?? {}) };
      if (investment.annualIncomeMinor === undefined && legacySource.annualIncomeMinor !== undefined) {
        investment.annualIncomeMinor = legacySource.annualIncomeMinor;
      }
      if (investment.estimatedNetWorthMinor === undefined && legacySource.estimatedNetWorthMinor !== undefined) {
        investment.estimatedNetWorthMinor = legacySource.estimatedNetWorthMinor;
      }
      delete legacySource.annualIncomeMinor;
      delete legacySource.estimatedNetWorthMinor;
      payload.investmentProfile = investment;
    }
    if (Array.isArray(legacySource.sourceOfFunds)) {
      legacySource.sourceOfFunds = [...new Set(legacySource.sourceOfFunds.map((value) =>
        canonicalOption(value, INDIVIDUAL_KYC_PROPOSED_OPTIONS.sourceOfFunds)))];
    }
  }
  if (payload.investmentProfile) {
    const investment = payload.investmentProfile;
    if (investment.primaryInvestmentObjective) investment.primaryInvestmentObjective = canonicalOption(
      investment.primaryInvestmentObjective, INDIVIDUAL_KYC_PROPOSED_OPTIONS.investmentObjectives,
    );
    if (investment.riskTolerance) investment.riskTolerance = canonicalOption(
      investment.riskTolerance, INDIVIDUAL_KYC_PROPOSED_OPTIONS.riskTolerances,
    );
    if (investment.investmentKnowledgeExperience) investment.investmentKnowledgeExperience = canonicalOption(
      investment.investmentKnowledgeExperience, INDIVIDUAL_KYC_PROPOSED_OPTIONS.investmentKnowledgeExperience,
    );
    if (investment.financialCurrency) {
      const currency = investment.financialCurrency.trim().toUpperCase();
      if (financialCurrencyValues.includes(currency)) investment.financialCurrency = currency;
    }
  }
  return payload;
}

export interface KycDocumentState {
  readonly id: string;
  readonly documentType: IndividualKycIdDocumentType;
  readonly status: IndividualKycDocumentStatus;
  readonly manualReviewStatus: import('@prisma/client').ManualDocumentReviewStatus;
}

export interface IndividualKycSectionStatuses {
  readonly personal: IndividualKycSectionStatus;
  readonly investment: IndividualKycSectionStatus;
  readonly sourceOfFunds: IndividualKycSectionStatus;
  readonly bank: IndividualKycSectionStatus;
}

export function calculateSectionStatuses(payload: IndividualKycPayload, documents: readonly KycDocumentState[]): IndividualKycSectionStatuses {
  const matchingUploadedDocument = documents.some((doc) =>
    (doc.status === IndividualKycDocumentStatus.UPLOADED || doc.status === IndividualKycDocumentStatus.UNDER_REVIEW || doc.status === IndividualKycDocumentStatus.PENDING_SCAN) &&
    doc.manualReviewStatus !== ManualDocumentReviewStatus.REJECTED &&
    doc.documentType === payload.personal?.idDocumentType,
  );
  const personalComplete = completePersonal(payload.personal, matchingUploadedDocument);
  const investmentComplete = completeInvestment(payload.investmentProfile);
  const sourceComplete = completeSourceOfFunds(payload.sourceOfFunds);
  const bankComplete = completeBank(payload.bankDetails);

  const personal = sectionStatus(hasValues(payload.personal), personalComplete);
  const investment = sectionStatus(
    hasValues(payload.investmentProfile),
    personal === IndividualKycSectionStatus.COMPLETE && investmentComplete,
  );
  const sourceOfFunds = sectionStatus(
    hasValues(payload.sourceOfFunds),
    investment === IndividualKycSectionStatus.COMPLETE && sourceComplete,
  );
  const bank = sectionStatus(
    hasValues(payload.bankDetails),
    sourceOfFunds === IndividualKycSectionStatus.COMPLETE && bankComplete,
  );
  return { personal, investment, sourceOfFunds, bank };
}

export function allSectionsComplete(statuses: IndividualKycSectionStatuses): boolean {
  return Object.values(statuses).every((status) => status === IndividualKycSectionStatus.COMPLETE);
}

export function isOtherSource(selected: readonly string[] | null | undefined): boolean {
  return selected?.some((value) => canonicalOption(value, INDIVIDUAL_KYC_PROPOSED_OPTIONS.sourceOfFunds) === 'OTHER') ?? false;
}

export function missingOtherSourceDetail(value: SourceOfFundsKycData | undefined): boolean {
  return Boolean(value && isOtherSource(value.sourceOfFunds) && !nonEmpty(value.otherSource, 300));
}

export function maskNuban(value: string | null | undefined): string | null {
  if (!value) return null;
  return `******${value.slice(-4)}`;
}

function completePersonal(value: PersonalKycData | undefined, hasMatchingDocument: boolean): boolean {
  if (!value || !value.dateOfBirth || !isValidPastDate(value.dateOfBirth) ||
    !value.gender || !GENDER_VALUES.includes(value.gender) ||
    !value.nationality || !/^[A-Z]{2}$/.test(value.nationality) ||
    !nonEmpty(value.stateOfResidence, 80) || !nonEmpty(value.residentialAddress, 500) ||
    !value.idDocumentType || !Object.values(IndividualKycIdDocumentType).includes(value.idDocumentType) ||
    !nonEmpty(value.occupation, 120) || !value.pepStatus) return false;
  if (value.pepStatus === 'NO') return !value.pepDetails && hasMatchingDocument;
  if (value.pepStatus !== 'YES' || !value.pepDetails) return false;
  const pep = value.pepDetails;
  return nonEmpty(pep.fullName, 120) && nonEmpty(pep.position, 120) &&
    nonEmpty(pep.country, 80) && nonEmpty(pep.periodHeld, 120) && hasMatchingDocument;
}

function completeInvestment(value: InvestmentProfileKycData | undefined): boolean {
  return Boolean(value && nonEmpty(value.primaryInvestmentObjective, 120) &&
    investmentObjectiveValues.includes(canonicalOption(value.primaryInvestmentObjective, INDIVIDUAL_KYC_PROPOSED_OPTIONS.investmentObjectives)) &&
    nonEmpty(value.riskTolerance, 80) &&
    riskToleranceValues.includes(canonicalOption(value.riskTolerance, INDIVIDUAL_KYC_PROPOSED_OPTIONS.riskTolerances)) &&
    value.investmentHorizon && HORIZON_VALUES.includes(value.investmentHorizon) &&
    nonEmpty(value.financialCurrency, 3) && financialCurrencyValues.includes(value.financialCurrency.trim().toUpperCase()) &&
    nonEmpty(value.investmentKnowledgeExperience, 120) &&
    investmentKnowledgeValues.includes(canonicalOption(value.investmentKnowledgeExperience, INDIVIDUAL_KYC_PROPOSED_OPTIONS.investmentKnowledgeExperience)) &&
    validMinorUnits(value.expectedWithdrawalsMinor) && validMinorUnits(value.annualIncomeMinor) &&
    validMinorUnits(value.estimatedNetWorthMinor) && nonEmpty(value.withdrawalFrequency, 80));
}

function completeSourceOfFunds(value: SourceOfFundsKycData | undefined): boolean {
  if (!value || !Array.isArray(value.sourceOfFunds) || value.sourceOfFunds.length === 0 ||
    value.sourceOfFunds.length > 10 || value.sourceOfFunds.some((item) =>
      !nonEmpty(item, 80) || !sourceOfFundsValues.includes(canonicalOption(item, INDIVIDUAL_KYC_PROPOSED_OPTIONS.sourceOfFunds)))) return false;
  if (isOtherSource(value.sourceOfFunds) && !nonEmpty(value.otherSource, 300)) return false;
  return validMinorUnits(value.expectedAnnualInflowMinor) && nonEmpty(value.expectedTransactionFrequency, 80);
}

function completeBank(value: BankDetailsKycData | undefined): boolean {
  return Boolean(value && nonEmpty(value.bankName, 120) && /^\d{10}$/.test(value.accountNumber ?? '') &&
    nonEmpty(value.accountName, 160) && nonEmpty(value.accountType, 40) &&
    typeof value.bvnLinkedToAccount === 'boolean');
}

function canonicalOption(value: string, catalogue: Readonly<Record<string, string>>): string {
  const normalizedValue = normalizeOptionText(value);
  for (const [canonical, label] of Object.entries(catalogue)) {
    if (normalizedValue === normalizeOptionText(canonical) ||
        normalizedValue === normalizeOptionText(canonical.replaceAll('_', ' ')) ||
        normalizedValue === normalizeOptionText(label)) return canonical;
  }
  return value;
}

function normalizeOptionText(value: string): string {
  return value.normalize('NFKC').replace(/[–—]/g, '-').trim().replace(/\s+/g, ' ').toUpperCase();
}

function sectionStatus(hasData: boolean, complete: boolean): IndividualKycSectionStatus {
  if (complete) return IndividualKycSectionStatus.COMPLETE;
  return hasData ? IndividualKycSectionStatus.DRAFT : IndividualKycSectionStatus.NOT_STARTED;
}

function hasValues(value: object | undefined): boolean {
  if (!value) return false;
  return Object.values(value).some((item) => {
    if (item === null || item === undefined || item === '') return false;
    if (Array.isArray(item)) return item.length > 0;
    if (typeof item === 'object') return hasValues(item as object);
    return true;
  });
}

function nonEmpty(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function validMinorUnits(value: unknown): value is string {
  return typeof value === 'string' && /^\d{1,18}$/.test(value);
}

function isValidPastDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && parsed.getTime() <= Date.now();
}

export function emptySectionStatuses(): IndividualKycSectionStatuses {
  return {
    personal: IndividualKycSectionStatus.NOT_STARTED,
    investment: IndividualKycSectionStatus.NOT_STARTED,
    sourceOfFunds: IndividualKycSectionStatus.NOT_STARTED,
    bank: IndividualKycSectionStatus.NOT_STARTED,
  };
}

export function draftStatus(): IndividualKycProfileStatus {
  return IndividualKycProfileStatus.DRAFT;
}
