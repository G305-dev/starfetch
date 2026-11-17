import { OnboardingApplicationStatus } from '@prisma/client';
import { CorporateApplicationAccessService } from './corporate-application-access.service';
import { CorporateApplicantContext } from './corporate-applicant-context.service';

const applicant: CorporateApplicantContext = {
  initiatingUserId: '11111111-1111-4111-8111-111111111111',
  role: 'INVESTOR',
};
const application = {
  id: '33333333-3333-4333-8333-333333333333',
  kind: 'CORPORATE',
  initiatingUserId: applicant.initiatingUserId,
  ownerCorporateAccountId: '44444444-4444-4444-8444-444444444444',
  status: OnboardingApplicationStatus.DRAFT,
};

describe('CorporateApplicationAccessService', () => {
  it('proves ownership using application id, Corporate kind and immutable initiator', async () => {
    const prisma = {
      onboardingApplication: { findFirst: jest.fn().mockResolvedValue(application) },
    } as any;
    const service = new CorporateApplicationAccessService(prisma);
    await expect(service.requireInitiatorOwnedCorporateApplication(applicant, application.id))
      .resolves.toEqual(application);
    expect(prisma.onboardingApplication.findFirst).toHaveBeenCalledWith({
      where: {
        id: application.id,
        kind: 'CORPORATE',
        initiatingUserId: applicant.initiatingUserId,
        ownerCorporateAccountId: { not: null },
      },
    });
  });

  it('maps a corporateAccountId to its distinct initiator-owned application', async () => {
    const prisma = {
      onboardingApplication: { findFirst: jest.fn().mockResolvedValue(application) },
    } as any;
    const service = new CorporateApplicationAccessService(prisma);
    await expect(service.requireInitiatorOwnedCorporateAccount(applicant, application.ownerCorporateAccountId))
      .resolves.toEqual(application);
    expect(prisma.onboardingApplication.findFirst).toHaveBeenCalledWith({
      where: {
        ownerCorporateAccountId: application.ownerCorporateAccountId,
        kind: 'CORPORATE',
        initiatingUserId: applicant.initiatingUserId,
      },
    });
    expect(application.id).not.toBe(application.ownerCorporateAccountId);
  });

  it('returns the same generic 404 for a non-owned or missing application', async () => {
    const prisma = { onboardingApplication: { findFirst: jest.fn().mockResolvedValue(null) } } as any;
    const service = new CorporateApplicationAccessService(prisma);
    await expect(service.requireInitiatorOwnedCorporateApplication(applicant, application.id))
      .rejects.toMatchObject({ status: 404, response: { code: 'NOT_FOUND', message: 'Application not found.' } });
    await expect(service.requireInitiatorOwnedCorporateApplication(applicant, 'not-a-uuid'))
      .rejects.toMatchObject({ status: 404, response: { code: 'NOT_FOUND', message: 'Application not found.' } });
    expect(prisma.onboardingApplication.findFirst).toHaveBeenCalledTimes(1);
  });

  it('returns the same generic 404 for a missing/non-owned corporateAccountId and rejects malformed identifiers', async () => {
    const prisma = { onboardingApplication: { findFirst: jest.fn().mockResolvedValue(null) } } as any;
    const service = new CorporateApplicationAccessService(prisma);
    await expect(service.requireInitiatorOwnedCorporateAccount(applicant, application.ownerCorporateAccountId))
      .rejects.toMatchObject({ status: 404, response: { code: 'NOT_FOUND', message: 'Application not found.' } });
    await expect(service.requireInitiatorOwnedCorporateAccount(applicant, application.id))
      .rejects.toMatchObject({ status: 404, response: { code: 'NOT_FOUND', message: 'Application not found.' } });
    await expect(service.requireInitiatorOwnedCorporateAccount(applicant, 'not-an-id'))
      .rejects.toMatchObject({ status: 404, response: { code: 'NOT_FOUND', message: 'Application not found.' } });
    expect(prisma.onboardingApplication.findFirst).toHaveBeenCalledTimes(2);
  });

  it('allows only explicitly permitted application states', () => {
    const service = new CorporateApplicationAccessService({} as any);
    expect(() => service.requireApplicationState(application as any, [OnboardingApplicationStatus.DRAFT])).not.toThrow();
    expect(() => service.requireApplicationState(application as any, [OnboardingApplicationStatus.INFO_REQUESTED])).toThrow(
      expect.objectContaining({ status: 409 }),
    );
  });
});
