import { OnboardingApplicationStatus } from '@prisma/client';
import { CorporateApplicationAccessService } from './corporate-application-access.service';
import { CorporateDetailsEditService } from './corporate-details-edit.service';

const principal = {
  userId: '11111111-1111-4111-8111-111111111111',
  role: 'INVESTOR',
  sessionId: 'synthetic-session',
} as any;
const applicant = { initiatingUserId: principal.userId, role: 'INVESTOR' } as any;
const applicationId = '33333333-3333-4333-8333-333333333333';
const application = {
  id: applicationId,
  status: OnboardingApplicationStatus.DRAFT,
  ownerCorporateAccountId: '44444444-4444-4444-8444-444444444444',
};
const beforeDetails = {
  institutionName: 'Original Synthetic Holdings Ltd',
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
const afterDetails = {
  ...beforeDetails,
  institutionName: 'Updated Synthetic Holdings Ltd',
  version: 2,
  updatedAt: new Date('2026-01-03T00:00:00.000Z'),
};

function makeService(options: {
  application?: Record<string, unknown> | null;
  updateCount?: number;
  beforeVersion?: number;
} = {}) {
  const tx = {
    onboardingApplication: {
      findFirst: jest.fn().mockResolvedValue(options.application === undefined ? application : options.application),
    },
    corporateOnboardingDetails: {
      updateMany: jest.fn().mockResolvedValue({ count: options.updateCount ?? 1 }),
      findUnique: jest.fn()
        .mockResolvedValueOnce(options.beforeVersion === undefined
          ? beforeDetails
          : { ...beforeDetails, version: options.beforeVersion })
        .mockResolvedValueOnce(afterDetails),
    },
    corporateDetailsRevision: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: any) => unknown) => callback(tx)),
  };
  const applicants = {
    requireVerifiedInvestor: jest.fn().mockResolvedValue(applicant),
  };
  const access = new CorporateApplicationAccessService({} as any);
  const encryption = { encrypt: jest.fn().mockResolvedValue({
    ciphertext: 'ciphertext-only', iv: 'iv', authTag: 'tag', encryptedDataKey: 'wrapped',
    keyProvider: 'TEST_AES_GCM', keyId: 'synthetic-test-key', keyVersion: 'test-v1', contextVersion: 1,
  }) };
  const availability = { requireAvailable: jest.fn(), isAvailable: jest.fn().mockReturnValue(false) };
  const tinRead = { maskedProjection: jest.fn().mockResolvedValue(null) };
  const service = new CorporateDetailsEditService(
    prisma as any, applicants as any, access, encryption as any, availability as any, tinRead as any,
  );
  return { service, tx, prisma, applicants, encryption, availability, tinRead };
}

describe('CorporateDetailsEditService', () => {
  it('atomically applies a version-checked patch and appends the next encrypted-history version', async () => {
    const { service, tx, prisma, applicants } = makeService();
    await expect(service.updateDetails(principal, applicationId, 1, {
      institutionName: ' Updated Synthetic Holdings Ltd ',
    })).resolves.toMatchObject({
      applicationId,
      corporateAccountId: application.ownerCorporateAccountId,
      status: OnboardingApplicationStatus.DRAFT,
      details: { version: 2, institutionName: afterDetails.institutionName },
    });
    expect(applicants.requireVerifiedInvestor).toHaveBeenCalledWith(principal);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      isolationLevel: 'Serializable',
    }));
    expect(tx.onboardingApplication.findFirst).toHaveBeenCalledWith({
      where: {
        id: applicationId,
        kind: 'CORPORATE',
        initiatingUserId: applicant.initiatingUserId,
        ownerCorporateAccountId: { not: null },
      },
      select: { id: true, status: true, ownerCorporateAccountId: true },
    });
    expect(tx.corporateOnboardingDetails.updateMany).toHaveBeenCalledWith({
      where: { applicationId, version: 1 },
      data: { institutionName: 'Updated Synthetic Holdings Ltd', version: { increment: 1 } },
    });
    expect(tx.corporateDetailsRevision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        applicationId,
        version: 2,
        changedByUserId: principal.userId,
        changedFieldNames: ['institutionName'],
      }),
    }));
  });

  it('allows edits in INFO_REQUESTED as well as DRAFT', async () => {
    const { service, tx } = makeService({ application: { ...application, status: OnboardingApplicationStatus.INFO_REQUESTED } });
    await service.updateDetails(principal, applicationId, 1, { rcNumber: 'RC-UPDATED' });
    expect(tx.corporateOnboardingDetails.updateMany).toHaveBeenCalled();
  });

  it('encrypts a permitted TIN update before writing any TIN columns and requires the privacy/KMS gate', async () => {
    const { service, tx, encryption, availability } = makeService();
    await service.updateDetails(principal, applicationId, 1, { taxIdentificationNumber: 'SYNTHETIC-TIN' });
    expect(availability.requireAvailable).toHaveBeenCalledTimes(1);
    expect(encryption.encrypt).toHaveBeenCalledWith('SYNTHETIC-TIN', applicationId);
    expect(tx.corporateOnboardingDetails.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        taxIdentificationNumberCiphertext: 'ciphertext-only',
        taxIdentificationNumberEncryptedDataKey: 'wrapped',
        version: { increment: 1 },
      }),
    }));
    const write = tx.corporateOnboardingDetails.updateMany.mock.calls[0][0];
    expect(JSON.stringify(write)).not.toContain('SYNTHETIC-TIN');
  });

  it('rejects a stale version with 409 before writing details or amendment history', async () => {
    const { service, tx } = makeService({ beforeVersion: 2 });
    await expect(service.updateDetails(principal, applicationId, 1, { rcNumber: 'RC-STALE' }))
      .rejects.toMatchObject({ status: 409, response: { code: 'CONFLICT' } });
    expect(tx.corporateOnboardingDetails.updateMany).not.toHaveBeenCalled();
    expect(tx.corporateDetailsRevision.create).not.toHaveBeenCalled();
  });

  it('returns generic 404 and never reads or updates details for a non-owner', async () => {
    const { service, tx } = makeService({ application: null });
    await expect(service.updateDetails(principal, applicationId, 1, { rcNumber: 'RC-NOPE' }))
      .rejects.toMatchObject({ status: 404, response: { code: 'NOT_FOUND', message: 'Application not found.' } });
    expect(tx.corporateOnboardingDetails.findUnique).not.toHaveBeenCalled();
    expect(tx.corporateOnboardingDetails.updateMany).not.toHaveBeenCalled();
  });

  it('rejects updates outside DRAFT and INFO_REQUESTED before touching details', async () => {
    const { service, tx } = makeService({ application: { ...application, status: OnboardingApplicationStatus.SUBMITTED } });
    await expect(service.updateDetails(principal, applicationId, 1, { rcNumber: 'RC-DISALLOWED' }))
      .rejects.toMatchObject({ status: 409, response: { code: 'CONFLICT' } });
    expect(tx.corporateOnboardingDetails.findUnique).not.toHaveBeenCalled();
  });

  it('rejects invalid IDs/versions and unknown fields before opening a transaction', async () => {
    const { service, prisma } = makeService();
    await expect(service.updateDetails(principal, 'not-a-uuid', 1, { rcNumber: 'RC-TEST' }))
      .rejects.toMatchObject({ status: 404, response: { code: 'NOT_FOUND' } });
    await expect(service.updateDetails(principal, applicationId, 0, { rcNumber: 'RC-TEST' }))
      .rejects.toMatchObject({ status: 400 });
    await expect(service.updateDetails(principal, applicationId, 1, {
      rcNumber: 'RC-TEST', initiatingUserId: '22222222-2222-4222-8222-222222222222',
    } as any)).rejects.toMatchObject({ status: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
