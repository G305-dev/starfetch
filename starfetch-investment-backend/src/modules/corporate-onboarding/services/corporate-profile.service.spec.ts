import { CorporateProfileSectionStatus } from '@prisma/client';
import { CorporateProfileService } from './corporate-profile.service';

describe('CorporateProfileService read projection', () => {
  it('returns real O2/account identity, 0% saved-form progress and no fabricated profile', async () => {
    const details = {
      applicationId: 'app-1', institutionName: 'Canonical Holdings', dateOfIncorporation: new Date('2020-01-02T00:00:00.000Z'),
      rcNumber: 'RC-1', businessPhoneNumber: '+2348000000000', businessEmail: 'business@example.invalid', version: 4,
      taxIdentificationNumberCiphertext: null, taxIdentificationNumberIv: null, taxIdentificationNumberAuthTag: null,
      taxIdentificationNumberEncryptedDataKey: null, taxIdentificationNumberKeyProvider: null, taxIdentificationNumberKeyId: null,
      taxIdentificationNumberKeyVersion: null, taxIdentificationNumberContextVersion: null,
    };
    const prisma = {
      corporateOnboardingDetails: { findUnique: jest.fn().mockResolvedValue(details) },
      corporateProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findUnique: jest.fn().mockResolvedValue({ email: 'owner@example.invalid', corporateApplicantProfile: { companyName: 'Applicant Display Co', companyPhoneNumber: '+2348000000000' } }) },
    } as any;
    const applicants = { requireVerifiedInvestor: jest.fn().mockResolvedValue({ initiatingUserId: 'owner-1' }) } as any;
    const access = { requireInitiatorOwnedCorporateAccount: jest.fn().mockResolvedValue({ id: 'app-1', initiatingUserId: 'owner-1', ownerCorporateAccountId: 'real-account-1', status: 'DRAFT' }) } as any;
    const tinRead = { maskedProjection: jest.fn().mockResolvedValue(null) } as any;
    const bank = { mask: jest.fn().mockResolvedValue(null) } as any;
    const service = new CorporateProfileService(prisma, applicants, access, {} as any, {} as any, tinRead, bank);

    const result = await service.getByCorporateAccountId({ userId: 'owner-1', role: 'INVESTOR', sessionId: 's' } as any, 'real-account-1');

    expect(result.corporateAccountId).toBe('real-account-1');
    expect(result.canonicalDetails.rcNumber).toBe('RC-1');
    expect(result.applicant.companyName).toBe('Applicant Display Co');
    expect(result.profileVersion).toBe(0);
    expect(result.detailsVersion).toBe(4);
    expect(result.sectionStatuses).toEqual({
      companyDetails: CorporateProfileSectionStatus.NOT_STARTED,
      investmentProfile: CorporateProfileSectionStatus.NOT_STARTED,
      sourceOfFunds: CorporateProfileSectionStatus.NOT_STARTED,
      bankDetails: CorporateProfileSectionStatus.NOT_STARTED,
    });
    expect(result.progress).toEqual({ percentage: 0, nextSection: 'companyDetails', canSubmit: false, meaning: 'SAVED_FORM_COMPLETION_ONLY' });
    expect(result.bankDetails.accountNumberMasked).toBeNull();
    expect(prisma.corporateProfile.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.corporateProfile).not.toHaveProperty('create');
  });
});

describe('CorporateProfileService write transaction authorization', () => {
  const principal = { userId: 'owner-1', role: 'INVESTOR', sessionId: 'session-1' } as any;
  const app = { id: 'app-1', initiatingUserId: 'owner-1', ownerCorporateAccountId: 'account-1', status: 'DRAFT' };

  function makeHarness(lockedStatus: string) {
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: app.id, status: lockedStatus }]),
      corporateOnboardingDetails: {
        findUnique: jest.fn().mockResolvedValue({
          applicationId: app.id, version: 1, rcNumber: 'RC-1', dateOfIncorporation: new Date('2020-01-02T00:00:00.000Z'),
          taxIdentificationNumberCiphertext: null, taxIdentificationNumberIv: null, taxIdentificationNumberAuthTag: null,
          taxIdentificationNumberEncryptedDataKey: null, taxIdentificationNumberKeyProvider: null,
          taxIdentificationNumberKeyId: null, taxIdentificationNumberKeyVersion: null, taxIdentificationNumberContextVersion: null,
        }),
        updateMany: jest.fn(),
      },
      corporateProfile: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
      corporateDetailsRevision: { create: jest.fn() },
      corporateProfileRevision: { create: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((work: (client: any) => Promise<void>) => work(tx)) };
    const applicants = { requireVerifiedInvestor: jest.fn().mockResolvedValue({ initiatingUserId: principal.userId }) };
    const access = { requireInitiatorOwnedCorporateAccount: jest.fn().mockResolvedValue(app) };
    const availability = { requireAvailable: jest.fn(), isAvailable: jest.fn().mockReturnValue(true) };
    const tinEncryption = { encrypt: jest.fn() };
    const tinRead = { maskedProjection: jest.fn().mockResolvedValue(null) };
    const bank = { encrypt: jest.fn().mockResolvedValue({
      ciphertext: 'cipher', iv: 'iv', authTag: 'tag', encryptedDataKey: 'dek', keyProvider: 'AWS_KMS',
      keyId: 'key', keyVersion: 'v1', contextVersion: 1,
    }) };
    const service = new CorporateProfileService(prisma, applicants as any, access as any, tinEncryption as any, availability as any, tinRead as any, bank as any);
    return { service, tx, prisma, access };
  }

  const attempts: Array<[string, (service: CorporateProfileService) => Promise<unknown>]> = [
    ['Company Details', (s) => s.saveCompanyDetails(principal, 'account-1', 0, 1, {
      rcNumber: 'RC-1', dateOfIncorporation: '2020-01-02', registeredAddress: '10 Example Road', city: 'Lagos', state: 'Lagos',
    } as any)],
    ['Investment Profile', (s) => s.saveInvestmentProfile(principal, 'account-1', 0, {
      primaryObjective: 'Income', riskTolerance: 'Moderate', investmentHorizon: '1–3 years',
      expectedWithdrawals: 'No withdrawals planned', withdrawalFrequency: 'Quarterly',
    } as any)],
    ['Source of Funds', (s) => s.saveSourceOfFunds(principal, 'account-1', 0, {
      selectedSources: ['Business income / operating cash'], expectedAnnualInflow: '100000', expectedTransactionFrequency: 'Quarterly',
    } as any)],
    ['Bank Details', (s) => s.saveBankDetails(principal, 'account-1', 0, {
      bankName: 'Example Bank', accountNumber: '0123456789', accountName: 'Example Holdings', accountType: 'Current', bvnLinkedToAccount: true,
    } as any)],
  ];

  async function expectConflict(work: Promise<unknown>) {
    try {
      await work;
      throw new Error('Expected the amendment to be rejected');
    } catch (error) {
      expect(error).toHaveProperty('status', 409);
    }
  }

  it.each(attempts)('rechecks and rejects a stale non-editable status for %s before writes', async (_name, attempt) => {
    // Preflight access returned DRAFT; the row lock sees a concurrently updated SUBMITTED status.
    const { service, tx } = makeHarness('SUBMITTED');
    await expectConflict(attempt(service));
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.corporateProfile.updateMany).not.toHaveBeenCalled();
    expect(tx.corporateOnboardingDetails.updateMany).not.toHaveBeenCalled();
  });

  it('rechecks owner/account binding inside the transaction and returns the same not-found outcome', async () => {
    const { service, tx } = makeHarness('DRAFT');
    tx.$queryRaw.mockResolvedValue([]); // owner/account binding changed or no longer matches the route.
    try {
      await service.saveSourceOfFunds(principal, 'account-1', 0, {
        selectedSources: ['Business income / operating cash'], expectedAnnualInflow: '100000', expectedTransactionFrequency: 'Quarterly',
      } as any);
      throw new Error('Expected ownership recheck to reject the amendment');
    } catch (error) {
      expect(error).toHaveProperty('status', 404);
    }
    expect(tx.corporateProfile.updateMany).not.toHaveBeenCalled();
  });

  it('rejects amendments after an application has been rejected', async () => {
    const { service, tx } = makeHarness('REJECTED');
    await expectConflict(service.saveSourceOfFunds(principal, 'account-1', 0, {
      selectedSources: ['Business income / operating cash'], expectedAnnualInflow: '100000', expectedTransactionFrequency: 'Quarterly',
    } as any));
    expect(tx.corporateProfile.updateMany).not.toHaveBeenCalled();
  });

  it('does not save when a concurrent submission commits before the locked status recheck', async () => {
    const { service, tx } = makeHarness('DRAFT');
    let signalLockReached!: () => void;
    let finishSubmission!: () => void;
    const lockReached = new Promise<void>((resolve) => { signalLockReached = resolve; });
    const submissionCommitted = new Promise<void>((resolve) => { finishSubmission = resolve; });
    tx.$queryRaw.mockImplementation(async () => {
      signalLockReached();
      await submissionCommitted;
      return [{ id: app.id, status: 'SUBMITTED' }];
    });

    const amendment = service.saveSourceOfFunds(principal, 'account-1', 0, {
      selectedSources: ['Business income / operating cash'], expectedAnnualInflow: '100000', expectedTransactionFrequency: 'Quarterly',
    } as any);
    await lockReached;
    // Models the submission transaction acquiring/updating the same application row first.
    finishSubmission();
    await expectConflict(amendment);
    expect(tx.corporateProfile.updateMany).not.toHaveBeenCalled();
  });
});
