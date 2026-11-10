import { OnboardingApplicationStatus } from '@prisma/client';
import { CorporateApplicationReadService } from './corporate-application-read.service';
import { CorporateTinReadService } from './corporate-tin-read.service';

const principal = {
  userId: '11111111-1111-4111-8111-111111111111',
  role: 'INVESTOR',
  sessionId: 'synthetic-session',
} as any;
const applicant = { initiatingUserId: principal.userId, role: 'INVESTOR' } as any;
const ownedApplication = {
  id: '33333333-3333-4333-8333-333333333333',
  kind: 'CORPORATE',
  initiatingUserId: principal.userId,
  ownerCorporateAccountId: '44444444-4444-4444-8444-444444444444',
  status: OnboardingApplicationStatus.DRAFT,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};
const details = {
  institutionName: 'Synthetic Test Holdings Ltd',
  dateOfIncorporation: new Date('2020-01-02T00:00:00.000Z'),
  rcNumber: 'RC-TEST-001',
  businessPhoneNumber: '+2348000000000',
  businessEmail: 'corporate-test@example.invalid',
  taxIdentificationNumberCiphertext: null,
  taxIdentificationNumberIv: null,
  taxIdentificationNumberAuthTag: null,
  taxIdentificationNumberEncryptedDataKey: null,
  taxIdentificationNumberKeyProvider: null,
  taxIdentificationNumberKeyId: null,
  taxIdentificationNumberKeyVersion: null,
  taxIdentificationNumberContextVersion: null,
  version: 1,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function makeService() {
  const contexts = { requireVerifiedInvestor: jest.fn().mockResolvedValue(applicant) };
  const access = {
    requireInitiatorOwnedCorporateApplication: jest.fn().mockResolvedValue(ownedApplication),
    requireInitiatorOwnedCorporateAccount: jest.fn().mockResolvedValue(ownedApplication),
  };
  const prisma = {
    corporateOnboardingDetails: { findUnique: jest.fn().mockResolvedValue(details) },
    onboardingApplicationHistory: { findMany: jest.fn().mockResolvedValue([]) },
    corporateDetailsRevision: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return {
    service: new CorporateApplicationReadService(
      prisma as any,
      contexts as any,
      access as any,
      new CorporateTinReadService({ decrypt: jest.fn() } as any, { isAvailable: () => true } as any),
    ),
    contexts,
    access,
    prisma,
  };
}

describe('CorporateApplicationReadService', () => {
  it('retrieves only the owner-scoped canonical Corporate application/details projection', async () => {
    const { service, contexts, access, prisma } = makeService();
    await expect(service.getApplication(principal, ownedApplication.id)).resolves.toEqual({
      corporateAccountId: ownedApplication.ownerCorporateAccountId,
      applicationId: ownedApplication.id,
      status: OnboardingApplicationStatus.DRAFT,
      createdAt: ownedApplication.createdAt,
      updatedAt: ownedApplication.updatedAt,
      details: {
        institutionName: details.institutionName,
        dateOfIncorporation: '2020-01-02',
        rcNumber: details.rcNumber,
        businessPhoneNumber: details.businessPhoneNumber,
        businessEmail: details.businessEmail,
        taxIdentificationNumberMasked: null,
        version: details.version,
        createdAt: details.createdAt,
        updatedAt: details.updatedAt,
      },
    });
    expect(contexts.requireVerifiedInvestor).toHaveBeenCalledWith(principal);
    expect(access.requireInitiatorOwnedCorporateApplication).toHaveBeenCalledWith(applicant, ownedApplication.id);
    expect(prisma.corporateOnboardingDetails.findUnique).toHaveBeenCalledWith({
      where: { applicationId: ownedApplication.id },
      select: {
        institutionName: true,
        dateOfIncorporation: true,
        rcNumber: true,
        businessPhoneNumber: true,
        businessEmail: true,
        taxIdentificationNumberCiphertext: true,
        taxIdentificationNumberIv: true,
        taxIdentificationNumberAuthTag: true,
        taxIdentificationNumberEncryptedDataKey: true,
        taxIdentificationNumberKeyProvider: true,
        taxIdentificationNumberKeyId: true,
        taxIdentificationNumberKeyVersion: true,
        taxIdentificationNumberContextVersion: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      }, 
    });
  });

  it('maps a corporateAccountId to the distinct application ID before returning details', async () => {
    const { service, access } = makeService();
    const result = await service.getApplicationByCorporateAccountId(principal, ownedApplication.ownerCorporateAccountId);
    expect(result).toMatchObject({
      corporateAccountId: ownedApplication.ownerCorporateAccountId,
      applicationId: ownedApplication.id,
      status: OnboardingApplicationStatus.DRAFT,
    });
    expect(result.applicationId).not.toBe(result.corporateAccountId);
    expect(access.requireInitiatorOwnedCorporateAccount).toHaveBeenCalledWith(applicant, ownedApplication.ownerCorporateAccountId);
    expect(access.requireInitiatorOwnedCorporateApplication).not.toHaveBeenCalled();
  });

  it('returns a generic 404 and does not query details/history for a non-owner', async () => {
    const { service, access, prisma } = makeService();
    access.requireInitiatorOwnedCorporateApplication.mockRejectedValue({
      status: 404,
      response: { code: 'NOT_FOUND', message: 'Application not found.' },
    });
    await expect(service.getApplication(principal, ownedApplication.id))
      .rejects.toMatchObject({ status: 404, response: { code: 'NOT_FOUND', message: 'Application not found.' } });
    await expect(service.getHistory(principal, ownedApplication.id)).rejects.toMatchObject({ status: 404 });
    expect(prisma.corporateOnboardingDetails.findUnique).not.toHaveBeenCalled();
    expect(prisma.onboardingApplicationHistory.findMany).not.toHaveBeenCalled();
  });

  it('returns all six lifecycle states through the public corporateAccountId details mapping', async () => {
    const { service, access } = makeService();
    const states = [
      OnboardingApplicationStatus.DRAFT,
      OnboardingApplicationStatus.SUBMITTED,
      OnboardingApplicationStatus.IN_REVIEW,
      OnboardingApplicationStatus.INFO_REQUESTED,
      OnboardingApplicationStatus.APPROVED,
      OnboardingApplicationStatus.REJECTED,
    ];
    for (const status of states) {
      access.requireInitiatorOwnedCorporateAccount.mockResolvedValueOnce({ ...ownedApplication, status });
      await expect(service.getApplicationByCorporateAccountId(principal, ownedApplication.ownerCorporateAccountId))
        .resolves.toMatchObject({
          corporateAccountId: ownedApplication.ownerCorporateAccountId,
          applicationId: ownedApplication.id,
          status,
        });
    }
    expect(access.requireInitiatorOwnedCorporateAccount).toHaveBeenCalledWith(applicant, ownedApplication.ownerCorporateAccountId);
  });

  it('retrieves history only after ownership authorization and scopes the query to that application', async () => {
    const history = [{
      id: '55555555-5555-4555-8555-555555555555',
      event: 'CREATED',
      fromStatus: null,
      toStatus: OnboardingApplicationStatus.DRAFT,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }];
    const { service, access, prisma } = makeService();
    prisma.onboardingApplicationHistory.findMany.mockResolvedValue(history);
    await expect(service.getHistory(principal, ownedApplication.id)).resolves.toEqual(history);
    expect(access.requireInitiatorOwnedCorporateApplication).toHaveBeenCalledWith(applicant, ownedApplication.id);
    expect(prisma.onboardingApplicationHistory.findMany).toHaveBeenCalledWith({
      where: { applicationId: ownedApplication.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, event: true, fromStatus: true, toStatus: true, createdAt: true },
    });
    await expect(service.getHistoryByCorporateAccountId(principal, ownedApplication.ownerCorporateAccountId))
      .resolves.toEqual({
        corporateAccountId: ownedApplication.ownerCorporateAccountId,
        applicationId: ownedApplication.id,
        history,
        detailsAmendments: [],
      });
    expect(prisma.corporateDetailsRevision.findMany).toHaveBeenCalledWith({
      where: { applicationId: ownedApplication.id },
      orderBy: [{ version: 'asc' }, { id: 'asc' }],
      select: { version: true, changedFieldNames: true, createdAt: true },
    });
  });
});
