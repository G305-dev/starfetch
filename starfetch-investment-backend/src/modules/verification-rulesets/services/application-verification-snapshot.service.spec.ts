import { OnboardingApplicationKind, OnboardingApplicationStatus, UserRole } from '@prisma/client';
import { ApplicationVerificationSnapshotService } from './application-verification-snapshot.service';

const userId = '11111111-1111-4111-8111-111111111111';
const applicationId = '22222222-2222-4222-8222-222222222222';
const actor = { userId, role: UserRole.INVESTOR, sessionId: 'trusted-session' };

function makeService(application: unknown) {
  const tx = {
    onboardingApplication: { findFirst: jest.fn().mockResolvedValue(application) },
    $queryRaw: jest.fn().mockResolvedValue([{ id: applicationId }]),
    applicationVerificationSnapshot: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };
  const prisma = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
  return { service: new ApplicationVerificationSnapshotService(prisma as any), prisma, tx };
}

describe('ApplicationVerificationSnapshotService', () => {
  it('requires an authenticated principal and exposes no application lookup to unauthenticated callers', async () => {
    const { service, prisma } = makeService(null);
    await expect(service.createOrGetSnapshot(undefined, applicationId)).rejects.toMatchObject({ status: 401 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses an owner-scoped application lookup and returns a generic 404 for non-owners', async () => {
    const { service, prisma, tx } = makeService(null);
    await expect(service.createOrGetSnapshot({ ...actor, userId: '33333333-3333-4333-8333-333333333333' }, applicationId))
      .rejects.toMatchObject({ status: 404 });
    expect(tx.onboardingApplication.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: applicationId,
        OR: expect.arrayContaining([
          expect.objectContaining({ kind: OnboardingApplicationKind.INDIVIDUAL, ownerUserId: '33333333-3333-4333-8333-333333333333' }),
          expect.objectContaining({ kind: OnboardingApplicationKind.CORPORATE, initiatingUserId: '33333333-3333-4333-8333-333333333333' }),
        ]),
      }),
    }));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('blocks editable owner applications that do not have an exact bound published ruleset', async () => {
    const application = {
      id: applicationId,
      kind: OnboardingApplicationKind.INDIVIDUAL,
      ownerUserId: userId,
      ownerCorporateAccountId: null,
      ownerJointAccountId: null,
      initiatingUserId: userId,
      status: OnboardingApplicationStatus.DRAFT,
      corporateDetails: null,
      jointOwner: null,
      rulesetBinding: null,
    };
    const { service, tx } = makeService(application);
    await expect(service.createOrGetSnapshot(actor, applicationId)).rejects.toMatchObject({ status: 409 });
    expect(tx.applicationVerificationSnapshot.create).not.toHaveBeenCalled();
  });
});
