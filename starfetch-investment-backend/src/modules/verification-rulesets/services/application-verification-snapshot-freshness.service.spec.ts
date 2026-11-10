import { OnboardingApplicationKind, UserRole } from '@prisma/client';
import { ApplicationVerificationSnapshotFreshnessService } from './application-verification-snapshot-freshness.service';

const applicationId = '22222222-2222-4222-8222-222222222222';
const userId = '11111111-1111-4111-8111-111111111111';
const actor = { userId, role: UserRole.INVESTOR, sessionId: 'synthetic-session' };

function serviceFor(application: unknown) {
  const prisma = { onboardingApplication: { findFirst: jest.fn().mockResolvedValue(application) } };
  return { service: new ApplicationVerificationSnapshotFreshnessService(prisma as any), prisma };
}

describe('ApplicationVerificationSnapshotFreshnessService', () => {
  it('marks a Corporate snapshot stale when canonical details version advances', async () => {
    const { service } = serviceFor({
      id: applicationId,
      kind: OnboardingApplicationKind.CORPORATE,
      corporateDetails: { version: 2 },
      jointOwner: null,
      verificationSnapshots: [{ id: 'snapshot-id', generation: 1, accountKind: OnboardingApplicationKind.CORPORATE, corporateDetailsVersion: 1, jointMembershipVersion: null }],
    });
    await expect(service.assess(actor, applicationId)).resolves.toMatchObject({
      isFresh: false,
      issues: ['CORPORATE_DETAILS_VERSION_CHANGED'],
    });
  });

  it('marks a Joint snapshot stale when the database-maintained member-set version changes', async () => {
    const { service } = serviceFor({
      id: applicationId,
      kind: OnboardingApplicationKind.JOINT,
      corporateDetails: null,
      jointOwner: { membershipVersion: 3 },
      verificationSnapshots: [{ id: 'snapshot-id', generation: 1, accountKind: OnboardingApplicationKind.JOINT, corporateDetailsVersion: null, jointMembershipVersion: 2 }],
    });
    await expect(service.assess(actor, applicationId)).resolves.toMatchObject({
      isFresh: false,
      issues: ['JOINT_MEMBERSHIP_VERSION_CHANGED'],
    });
  });

  it('returns a safe stale result when no immutable snapshot exists', async () => {
    const { service } = serviceFor({
      id: applicationId,
      kind: OnboardingApplicationKind.INDIVIDUAL,
      corporateDetails: null,
      jointOwner: null,
      verificationSnapshots: [],
    });
    await expect(service.assess(actor, applicationId)).resolves.toMatchObject({
      snapshotId: null,
      isFresh: false,
      issues: ['SNAPSHOT_MISSING'],
    });
  });

  it('uses the authenticated account context and returns generic 404 for a non-owner', async () => {
    const { service, prisma } = serviceFor(null);
    await expect(service.assess(actor, applicationId)).rejects.toMatchObject({ status: 404 });
    expect(prisma.onboardingApplication.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: applicationId, OR: expect.any(Array) }),
    }));
  });
});
