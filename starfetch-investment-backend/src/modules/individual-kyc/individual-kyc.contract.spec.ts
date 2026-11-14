import { IndividualKycDocumentScanStatus, IndividualKycDocumentStatus, IndividualKycIdDocumentType, IndividualKycSectionStatus } from '@prisma/client';
import { IndividualKycInvestmentHorizon } from './individual-kyc.enums';
import { allSectionsComplete, calculateSectionStatuses, isOtherSource, maskNuban, missingOtherSourceDetail, normalizeLegacyKycPayload } from './individual-kyc.contract';

describe('Individual KYC contract calculations', () => {
  it('accepts all five stable horizon enum mappings specified by Emmanuel', () => {
    const base = {
      primaryInvestmentObjective: 'Some bounded draft value', riskTolerance: 'Some bounded draft value',
      investmentKnowledgeExperience: 'Some bounded draft value', expectedWithdrawalsMinor: '500000',
      withdrawalFrequency: 'monthly',
    };
    for (const investmentHorizon of Object.values(IndividualKycInvestmentHorizon)) {
      const statuses = calculateSectionStatuses({ investmentProfile: { ...base, investmentHorizon } }, []);
      // Values persist, but missing approved objective/risk/knowledge catalogues
      // prevent this section from being represented as policy-complete.
      expect(statuses.investment).toBe(IndividualKycSectionStatus.DRAFT);
    }
  });

  it('moves legacy annual-income/net-worth draft fields into Investment Profile without overwriting newer values', () => {
    const legacy = {
      investmentProfile: { annualIncomeMinor: '999' },
      sourceOfFunds: { sourceOfFunds: ['OTHER'], annualIncomeMinor: '100', estimatedNetWorthMinor: '200' },
    } as any;
    expect(normalizeLegacyKycPayload(legacy)).toEqual({
      investmentProfile: { annualIncomeMinor: '999', estimatedNetWorthMinor: '200' },
      sourceOfFunds: { sourceOfFunds: ['OTHER'] },
    });
  });

  it('keeps OTHER source detail conditional and refuses completion while source values have no approved allowlist', () => {
    expect(isOtherSource(['OTHER'])).toBe(true);
    expect(missingOtherSourceDetail({ sourceOfFunds: ['OTHER'] })).toBe(true);
    expect(missingOtherSourceDetail({ sourceOfFunds: ['OTHER'], otherSource: 'Synthetic detail' })).toBe(false);
    const missingDetail = calculateSectionStatuses({ sourceOfFunds: {
      sourceOfFunds: ['OTHER'], expectedAnnualInflowMinor: '300', expectedTransactionFrequency: 'monthly',
    } }, []);
    expect(missingDetail.sourceOfFunds).toBe(IndividualKycSectionStatus.DRAFT);
    const withDetail = calculateSectionStatuses({ sourceOfFunds: {
      sourceOfFunds: ['OTHER'], otherSource: 'synthetic detail',
      expectedAnnualInflowMinor: '300', expectedTransactionFrequency: 'monthly',
    } }, []);
    expect(withDetail.sourceOfFunds).toBe(IndividualKycSectionStatus.DRAFT);
  });

  it('requires full conditional PEP details when the applicant declares YES', () => {
    const base = {
      dateOfBirth: '1990-01-01', gender: 'FEMALE' as const, nationality: 'NG',
      stateOfResidence: 'Lagos', residentialAddress: 'Synthetic address, Lagos',
      idDocumentType: IndividualKycIdDocumentType.PASSPORT, occupation: 'Analyst', pepStatus: 'YES' as const,
    };
    const cleanDocument = [{ id: 'pep-document', documentType: IndividualKycIdDocumentType.PASSPORT, status: IndividualKycDocumentStatus.UPLOADED, scanStatus: IndividualKycDocumentScanStatus.CLEAN }];
    expect(calculateSectionStatuses({ personal: base }, cleanDocument).personal).toBe(IndividualKycSectionStatus.DRAFT);
    expect(calculateSectionStatuses({ personal: { ...base, pepDetails: { fullName: 'Synthetic PEP', position: 'Synthetic public role', country: 'NG', periodHeld: '2020–2022' } } }, cleanDocument).personal).toBe(IndividualKycSectionStatus.COMPLETE);
  });

  it('requires a clean matching document before personal completion and gates later sections sequentially', () => {
    const payload = {
      personal: {
        dateOfBirth: '1990-01-01', gender: 'FEMALE' as const, nationality: 'NG',
        stateOfResidence: 'Lagos', residentialAddress: 'Synthetic address, Lagos',
        idDocumentType: IndividualKycIdDocumentType.PASSPORT, occupation: 'Analyst', pepStatus: 'NO' as const,
      },
      investmentProfile: { investmentHorizon: IndividualKycInvestmentHorizon.DAYS_180 },
    };
    const pending = [{ id: 'document-1', documentType: IndividualKycIdDocumentType.PASSPORT, status: IndividualKycDocumentStatus.PENDING_UPLOAD, scanStatus: IndividualKycDocumentScanStatus.PENDING }];
    expect(calculateSectionStatuses(payload, pending)).toMatchObject({
      personal: IndividualKycSectionStatus.DRAFT,
      investment: IndividualKycSectionStatus.DRAFT,
    });
    const clean = [{ ...pending[0], status: IndividualKycDocumentStatus.UPLOADED, scanStatus: IndividualKycDocumentScanStatus.CLEAN }];
    expect(calculateSectionStatuses(payload, clean).personal).toBe(IndividualKycSectionStatus.COMPLETE);
    expect(allSectionsComplete({
      personal: IndividualKycSectionStatus.COMPLETE,
      investment: IndividualKycSectionStatus.COMPLETE,
      sourceOfFunds: IndividualKycSectionStatus.COMPLETE,
      bank: IndividualKycSectionStatus.COMPLETE,
    })).toBe(true);
  });

  it('never exposes a full NUBAN in the masked display value', () => {
    expect(maskNuban('0123456789')).toBe('******6789');
    expect(maskNuban(undefined)).toBeNull();
  });
});
