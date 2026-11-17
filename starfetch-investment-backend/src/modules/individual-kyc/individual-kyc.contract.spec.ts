import { IndividualKycDocumentStatus, IndividualKycIdDocumentType, IndividualKycSectionStatus, ManualDocumentReviewStatus } from '@prisma/client';
import { IndividualKycInvestmentHorizon } from './individual-kyc.enums';
import { allSectionsComplete, calculateSectionStatuses, INDIVIDUAL_KYC_PROPOSED_OPTIONS, isOtherSource, maskNuban, missingOtherSourceDetail, normalizeLegacyKycPayload } from './individual-kyc.contract';

describe('Individual KYC contract calculations', () => {
  it('maps the current frontend option labels to canonical values and completes the four sections without implying approval', () => {
    const labels = INDIVIDUAL_KYC_PROPOSED_OPTIONS;
    const payload = normalizeLegacyKycPayload({
      personal: {
        dateOfBirth: '1990-01-01', gender: 'FEMALE', nationality: 'NG',
        stateOfResidence: 'Lagos', residentialAddress: 'Synthetic address, Lagos',
        idDocumentType: IndividualKycIdDocumentType.PASSPORT, occupation: 'Analyst', pepStatus: 'NO',
      },
      investmentProfile: {
        primaryInvestmentObjective: labels.investmentObjectives.CAPITAL_PRESERVATION,
        riskTolerance: labels.riskTolerances.MODERATE,
        investmentHorizon: IndividualKycInvestmentHorizon.DAYS_180,
        financialCurrency: 'ngn',
        investmentKnowledgeExperience: labels.investmentKnowledgeExperience.GOOD,
        expectedWithdrawalsMinor: '500000', annualIncomeMinor: '10000000', estimatedNetWorthMinor: '30000000',
        withdrawalFrequency: 'Every six months',
      },
      sourceOfFunds: {
        sourceOfFunds: [labels.sourceOfFunds.SALARY_EMPLOYMENT, labels.sourceOfFunds.OTHER],
        otherSource: 'Synthetic declared source', expectedAnnualInflowMinor: '5000000',
        expectedTransactionFrequency: 'About monthly',
      },
      bankDetails: {
        bankName: 'Synthetic Bank', accountNumber: '0123456789', accountName: 'Synthetic Applicant',
        accountType: 'Current account', bvnLinkedToAccount: true,
      },
    });
    const document = [{
      id: 'doc-1', documentType: IndividualKycIdDocumentType.PASSPORT,
      status: IndividualKycDocumentStatus.UNDER_REVIEW,
      manualReviewStatus: ManualDocumentReviewStatus.UNDER_REVIEW,
    }];

    expect(payload.investmentProfile?.primaryInvestmentObjective).toBe('CAPITAL_PRESERVATION');
    expect(payload.investmentProfile?.riskTolerance).toBe('MODERATE');
    expect(payload.investmentProfile?.investmentKnowledgeExperience).toBe('GOOD');
    expect(payload.investmentProfile?.financialCurrency).toBe('NGN');
    expect(payload.sourceOfFunds?.sourceOfFunds).toEqual(['SALARY_EMPLOYMENT', 'OTHER']);
    const completeStatuses = {
      personal: IndividualKycSectionStatus.COMPLETE,
      investment: IndividualKycSectionStatus.COMPLETE,
      sourceOfFunds: IndividualKycSectionStatus.COMPLETE,
      bank: IndividualKycSectionStatus.COMPLETE,
    };
    expect(calculateSectionStatuses(payload, document)).toEqual(completeStatuses);
    const canonicalWirePayload = {
      ...payload,
      investmentProfile: {
        ...payload.investmentProfile,
        primaryInvestmentObjective: 'CAPITAL_PRESERVATION',
        riskTolerance: 'MODERATE',
        investmentKnowledgeExperience: 'GOOD',
      },
      sourceOfFunds: { ...payload.sourceOfFunds, sourceOfFunds: ['SALARY_EMPLOYMENT', 'OTHER'] },
    };
    expect(calculateSectionStatuses(canonicalWirePayload, document)).toEqual(completeStatuses);
  });

  it('does not complete controlled fields outside the proposed catalogues', () => {
    const valid = {
      personal: {
        dateOfBirth: '1990-01-01', gender: 'FEMALE' as const, nationality: 'NG',
        stateOfResidence: 'Lagos', residentialAddress: 'Synthetic address',
        idDocumentType: IndividualKycIdDocumentType.PASSPORT, occupation: 'Analyst', pepStatus: 'NO' as const,
      },
      investmentProfile: {
        primaryInvestmentObjective: 'Invented investment objective', riskTolerance: 'MODERATE',
        investmentHorizon: IndividualKycInvestmentHorizon.DAYS_180, financialCurrency: 'NGN',
        investmentKnowledgeExperience: 'GOOD', expectedWithdrawalsMinor: '0', annualIncomeMinor: '0',
        estimatedNetWorthMinor: '0', withdrawalFrequency: 'Monthly',
      },
    };
    const document = [{ id: 'doc-1', documentType: IndividualKycIdDocumentType.PASSPORT,
      status: IndividualKycDocumentStatus.UNDER_REVIEW, manualReviewStatus: ManualDocumentReviewStatus.UNDER_REVIEW }];
    expect(calculateSectionStatuses(valid, document).personal).toBe(IndividualKycSectionStatus.COMPLETE);
    expect(calculateSectionStatuses(valid, document).investment).toBe(IndividualKycSectionStatus.DRAFT);
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

  it('keeps OTHER source detail conditional and refuses a missing conditional explanation', () => {
    expect(isOtherSource(['OTHER'])).toBe(true);
    expect(isOtherSource(['Other (specify)'])).toBe(true);
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
    const listedSource = calculateSectionStatuses({ sourceOfFunds: { sourceOfFunds: ['Savings'], expectedAnnualInflowMinor: '300', expectedTransactionFrequency: 'Monthly' } }, []);
    expect(listedSource.sourceOfFunds).toBe(IndividualKycSectionStatus.DRAFT); // prerequisite sections are not complete
  });

  it('requires a matching document upload and full conditional PEP details when the applicant declares YES', () => {
    const base = {
      dateOfBirth: '1990-01-01', gender: 'FEMALE' as const, nationality: 'NG',
      stateOfResidence: 'Lagos', residentialAddress: 'Synthetic address, Lagos',
      idDocumentType: IndividualKycIdDocumentType.PASSPORT, occupation: 'Analyst', pepStatus: 'YES' as const,
    };
    const reviewedDocument = [{ id: 'pep-document', documentType: IndividualKycIdDocumentType.PASSPORT, status: IndividualKycDocumentStatus.UNDER_REVIEW, manualReviewStatus: ManualDocumentReviewStatus.UNDER_REVIEW }];
    expect(calculateSectionStatuses({ personal: base }, reviewedDocument).personal).toBe(IndividualKycSectionStatus.DRAFT);
    expect(calculateSectionStatuses({ personal: { ...base, pepDetails: { fullName: 'Synthetic PEP', position: 'Synthetic public role', country: 'NG', periodHeld: '2020–2022' } } }, reviewedDocument).personal).toBe(IndividualKycSectionStatus.COMPLETE);
  });

  it('requires a matching upload before personal completion and gates later sections sequentially', () => {
    const payload = {
      personal: {
        dateOfBirth: '1990-01-01', gender: 'FEMALE' as const, nationality: 'NG',
        stateOfResidence: 'Lagos', residentialAddress: 'Synthetic address, Lagos',
        idDocumentType: IndividualKycIdDocumentType.PASSPORT, occupation: 'Analyst', pepStatus: 'NO' as const,
      },
      investmentProfile: { investmentHorizon: IndividualKycInvestmentHorizon.DAYS_180 },
    };
    const pending = [{ id: 'document-1', documentType: IndividualKycIdDocumentType.PASSPORT, status: IndividualKycDocumentStatus.PENDING_UPLOAD, manualReviewStatus: ManualDocumentReviewStatus.NOT_REVIEWED }];
    expect(calculateSectionStatuses(payload, pending)).toMatchObject({
      personal: IndividualKycSectionStatus.DRAFT,
      investment: IndividualKycSectionStatus.DRAFT,
    });
    const uploaded = [{ ...pending[0], status: IndividualKycDocumentStatus.UNDER_REVIEW, manualReviewStatus: ManualDocumentReviewStatus.UNDER_REVIEW }];
    expect(calculateSectionStatuses(payload, uploaded).personal).toBe(IndividualKycSectionStatus.COMPLETE);
    const rejected = [{ ...uploaded[0], manualReviewStatus: ManualDocumentReviewStatus.REJECTED }];
    expect(calculateSectionStatuses(payload, rejected).personal).toBe(IndividualKycSectionStatus.DRAFT);
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
