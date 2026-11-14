import {
  IndividualKycDocumentScanStatus,
  IndividualKycDocumentStatus,
  IndividualKycIdDocumentType,
  IndividualKycProfileStatus,
  IndividualKycSectionStatus,
} from '@prisma/client';
import type { IndividualKycGenderValue, IndividualKycHorizonValue } from './dto/individual-kyc.dto';
import { IndividualKycInvestmentHorizon } from './individual-kyc.enums';

const GENDER_VALUES = ['MALE', 'FEMALE'] as const;
const HORIZON_VALUES = Object.values(IndividualKycInvestmentHorizon);
// Emmanuel's report names these controlled fields but does not supply their
// approved option catalogues. Draft values are accepted; completion stays shut.
const APPROVED_INVESTMENT_OBJECTIVES: readonly string[] = [];
const APPROVED_RISK_TOLERANCES: readonly string[] = [];
const APPROVED_INVESTMENT_KNOWLEDGE_VALUES: readonly string[] = [];
const APPROVED_SOURCE_OF_FUNDS_VALUES: readonly string[] = [];
const APPROVED_FINANCIAL_CURRENCIES: readonly string[] = [];
const APPROVED_WITHDRAWAL_FREQUENCIES: readonly string[] = [];
const APPROVED_TRANSACTION_FREQUENCIES: readonly string[] = [];
const APPROVED_BANK_ACCOUNT_TYPES: readonly string[] = [];

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
  if (!legacySource) return payload;
  const hasLegacyAmounts = legacySource.annualIncomeMinor !== undefined || legacySource.estimatedNetWorthMinor !== undefined;
  if (!hasLegacyAmounts) return payload;
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
  return payload;
}

export interface KycDocumentState {
  readonly id: string;
  readonly documentType: IndividualKycIdDocumentType;
  readonly status: IndividualKycDocumentStatus;
  readonly scanStatus: IndividualKycDocumentScanStatus;
}

export interface IndividualKycSectionStatuses {
  readonly personal: IndividualKycSectionStatus;
  readonly investment: IndividualKycSectionStatus;
  readonly sourceOfFunds: IndividualKycSectionStatus;
  readonly bank: IndividualKycSectionStatus;
}

export function calculateSectionStatuses(payload: IndividualKycPayload, documents: readonly KycDocumentState[]): IndividualKycSectionStatuses {
  const matchingCleanDocument = documents.some((doc) =>
    doc.status === IndividualKycDocumentStatus.UPLOADED &&
    doc.scanStatus === IndividualKycDocumentScanStatus.CLEAN &&
    doc.documentType === payload.personal?.idDocumentType,
  );
  const personalComplete = completePersonal(payload.personal, matchingCleanDocument);
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
  return selected?.some((value) => value.trim().toUpperCase() === 'OTHER') ?? false;
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
    APPROVED_INVESTMENT_OBJECTIVES.includes(value.primaryInvestmentObjective) &&
    nonEmpty(value.riskTolerance, 80) && APPROVED_RISK_TOLERANCES.includes(value.riskTolerance) &&
    value.investmentHorizon && HORIZON_VALUES.includes(value.investmentHorizon) &&
    nonEmpty(value.financialCurrency, 3) && APPROVED_FINANCIAL_CURRENCIES.includes(value.financialCurrency) &&
    nonEmpty(value.investmentKnowledgeExperience, 120) &&
    APPROVED_INVESTMENT_KNOWLEDGE_VALUES.includes(value.investmentKnowledgeExperience) &&
    validMinorUnits(value.expectedWithdrawalsMinor) && validMinorUnits(value.annualIncomeMinor) &&
    validMinorUnits(value.estimatedNetWorthMinor) && nonEmpty(value.withdrawalFrequency, 80) &&
    APPROVED_WITHDRAWAL_FREQUENCIES.includes(value.withdrawalFrequency));
}

function completeSourceOfFunds(value: SourceOfFundsKycData | undefined): boolean {
  if (!value || !Array.isArray(value.sourceOfFunds) || value.sourceOfFunds.length === 0 ||
    value.sourceOfFunds.length > 10 || value.sourceOfFunds.some((item) =>
      !nonEmpty(item, 80) || !APPROVED_SOURCE_OF_FUNDS_VALUES.includes(item.trim().toUpperCase()))) return false;
  if (isOtherSource(value.sourceOfFunds) && !nonEmpty(value.otherSource, 300)) return false;
  return validMinorUnits(value.expectedAnnualInflowMinor) &&
    nonEmpty(value.expectedTransactionFrequency, 80) &&
    APPROVED_TRANSACTION_FREQUENCIES.includes(value.expectedTransactionFrequency);
}

function completeBank(value: BankDetailsKycData | undefined): boolean {
  return Boolean(value && nonEmpty(value.bankName, 120) && /^\d{10}$/.test(value.accountNumber ?? '') &&
    nonEmpty(value.accountName, 160) && nonEmpty(value.accountType, 40) &&
    APPROVED_BANK_ACCOUNT_TYPES.includes(value.accountType) &&
    typeof value.bvnLinkedToAccount === 'boolean');
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
