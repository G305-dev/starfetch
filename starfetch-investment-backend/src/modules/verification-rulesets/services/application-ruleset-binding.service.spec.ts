import {
  OnboardingApplicationKind,
  OnboardingApplicationStatus,
  Prisma,
  VerificationRulesetLifecycle,
  VerificationSubjectTargetKind,
} from '@prisma/client';
import { ApplicationRulesetBindingService } from './application-ruleset-binding.service';
import { DenyAllVerificationRulesetBindingAuthorizer } from '../security/ruleset-binding-authorizer';

const actorId = '11111111-1111-4111-8111-111111111111';
const applicationId = '22222222-2222-4222-8222-222222222222';
const versionId = '33333333-3333-4333-8333-333333333333';
const principal = { userId: actorId, role: 'INVESTOR', sessionId: 'synthetic-session' } as any;

function completePublishedVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: versionId,
    accountKind: OnboardingApplicationKind.CORPORATE,
    lifecycle: VerificationRulesetLifecycle.PUBLISHED,
    approvedByUserId: actorId,
    approvedAt: new Date('2026-01-01T00:00:00.000Z'),
    publishedByUserId: actorId,
    publishedAt: new Date('2026-01-02T00:00:00.000Z'),
    subjectDefinitions: [{
      id: '44444444-4444-4444-8444-444444444444',
      targetKind: VerificationSubjectTargetKind.CORPORATE_LEGAL_ENTITY,
      checks: [{
        id: '55555555-5555-4555-8555-555555555555',
        acceptedEvidenceSources: [{ id: '66666666-6666-4666-8666-666666666666' }],
      }],
    }],
    ...overrides,
  };
}

function makeService(options: {
  authorized?: boolean;
  application?: Record<string, unknown> | null;
  version?: Record<string, unknown> | null;
  existingBinding?: Record<string, unknown> | null;
  existingPin?: Record<string, unknown> | null;
  failAudit?: boolean;
} = {}) {
  const tx = {
    onboardingApplication: {
      findUnique: jest.fn().mockResolvedValue(options.application === undefined ? {
        id: applicationId,
        kind: OnboardingApplicationKind.CORPORATE,
        status: OnboardingApplicationStatus.DRAFT,
      } : options.application),
    },
    onboardingApplicationRulesetBinding: {
      findUnique: jest.fn().mockResolvedValue(options.existingBinding ?? null),
      create: jest.fn().mockResolvedValue({
        id: '77777777-7777-4777-8777-777777777777',
        operationId: '88888888-8888-4888-8888-888888888888',
        applicationId,
        accountKind: OnboardingApplicationKind.CORPORATE,
        rulesetVersionId: versionId,
        boundAt: new Date('2026-01-03T00:00:00.000Z'),
      }),
    },
    onboardingApplicationRulesetPin: {
      findUnique: jest.fn().mockResolvedValue(options.existingPin ?? null),
    },
    verificationRulesetVersion: {
      findUnique: jest.fn().mockResolvedValue(options.version === undefined ? completePublishedVersion() : options.version),
    },
    applicationRulesetBindingEvent: {
      create: jest.fn().mockImplementation(() => {
        if (options.failAudit) throw new Error('synthetic audit-write failure');
        return Promise.resolve({ id: '99999999-9999-4999-8999-999999999999' });
      }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: any) => unknown) => callback(tx)),
  };
  const authorizer = { authorizeInitialBinding: jest.fn().mockResolvedValue(options.authorized ?? false) };
  return {
    service: new ApplicationRulesetBindingService(prisma as any, authorizer as any),
    tx,
    prisma,
    authorizer,
  };
}

describe('ApplicationRulesetBindingService', () => {
  it('uses a deny-all production authorizer until compliance authority grants are approved', async () => {
    const productionDefault = new DenyAllVerificationRulesetBindingAuthorizer();
    await expect(productionDefault.authorizeInitialBinding()).resolves.toBe(false);
  });

  it('fails closed for an arbitrary applicant without touching application or ruleset data', async () => {
    const { service, prisma, tx } = makeService({ authorized: false });
    await expect(service.bindApprovedVersion(principal, applicationId, versionId))
      .rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.onboardingApplication.findUnique).not.toHaveBeenCalled();
  });

  it('binds an approved, complete immutable version and audits the operation atomically', async () => {
    const { service, tx, authorizer, prisma } = makeService({ authorized: true });
    await expect(service.bindApprovedVersion(principal, applicationId, versionId)).resolves.toMatchObject({
      applicationId,
      accountKind: OnboardingApplicationKind.CORPORATE,
      rulesetVersionId: versionId,
      bindingId: '77777777-7777-4777-8777-777777777777',
    });
    expect(authorizer.authorizeInitialBinding).toHaveBeenCalledWith({ principal, applicationId, rulesetVersionId: versionId });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
    expect(tx.onboardingApplicationRulesetBinding.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId,
        accountKind: OnboardingApplicationKind.CORPORATE,
        rulesetVersionId: versionId,
        boundByUserId: actorId,
        operationId: expect.any(String),
      }),
    });
    const bindingData = tx.onboardingApplicationRulesetBinding.create.mock.calls[0][0].data;
    expect(tx.applicationRulesetBindingEvent.create).toHaveBeenCalledWith({
      data: {
        bindingId: '77777777-7777-4777-8777-777777777777',
        applicationId,
        accountKind: OnboardingApplicationKind.CORPORATE,
        rulesetVersionId: versionId,
        eventKind: 'BOUND',
        operationId: bindingData.operationId,
        actorUserId: actorId,
      },
    });
  });

  it('rejects unapproved and empty ruleset versions rather than treating them as successful verification', async () => {
    for (const version of [
      completePublishedVersion({ lifecycle: VerificationRulesetLifecycle.DRAFT, approvedAt: null, approvedByUserId: null }),
      completePublishedVersion({ subjectDefinitions: [] }),
      completePublishedVersion({ subjectDefinitions: [{ checks: [] }] }),
      completePublishedVersion({ subjectDefinitions: [{ checks: [{ acceptedEvidenceSources: [] }] }] }),
    ]) {
      const { service, tx } = makeService({ authorized: true, version });
      await expect(service.bindApprovedVersion(principal, applicationId, versionId))
        .rejects.toMatchObject({ status: 409, response: { code: 'CONFLICT' } });
      expect(tx.onboardingApplicationRulesetBinding.create).not.toHaveBeenCalled();
    }
  });

  it('rejects an incorrect account kind and a non-DRAFT application', async () => {
    const wrongKind = makeService({
      authorized: true,
      version: completePublishedVersion({ accountKind: OnboardingApplicationKind.INDIVIDUAL }),
    });
    await expect(wrongKind.service.bindApprovedVersion(principal, applicationId, versionId))
      .rejects.toMatchObject({ status: 409 });

    const nonDraft = makeService({
      authorized: true,
      application: { id: applicationId, kind: OnboardingApplicationKind.CORPORATE, status: OnboardingApplicationStatus.SUBMITTED },
    });
    await expect(nonDraft.service.bindApprovedVersion(principal, applicationId, versionId))
      .rejects.toMatchObject({ status: 409 });
    expect(nonDraft.tx.verificationRulesetVersion.findUnique).not.toHaveBeenCalled();
  });

  it('rejects duplicate binding and an existing submission pin without rebinding', async () => {
    for (const options of [
      { existingBinding: { id: 'existing-binding' } },
      { existingPin: { id: 'existing-pin' } },
    ]) {
      const { service, tx } = makeService({ authorized: true, ...options });
      await expect(service.bindApprovedVersion(principal, applicationId, versionId))
        .rejects.toMatchObject({ status: 409 });
      expect(tx.onboardingApplicationRulesetBinding.create).not.toHaveBeenCalled();
    }
  });

  it('does not commit a binding when writing its audit event fails', async () => {
    const { service, tx } = makeService({ authorized: true, failAudit: true });
    await expect(service.bindApprovedVersion(principal, applicationId, versionId))
      .rejects.toMatchObject({ status: 500 });
    expect(tx.onboardingApplicationRulesetBinding.create).toHaveBeenCalledTimes(1);
    expect(tx.applicationRulesetBindingEvent.create).toHaveBeenCalledTimes(1);
    // The binding and audit writes are made only through the one transaction callback.
  });

  it('maps concurrent unique/serialization conflicts to a safe 409', async () => {
    const { service, prisma } = makeService({ authorized: true });
    prisma.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError(
      'Synthetic serialization conflict',
      { code: 'P2034', clientVersion: '5.22.0' },
    ));
    await expect(service.bindApprovedVersion(principal, applicationId, versionId))
      .rejects.toMatchObject({ status: 409, response: { code: 'CONFLICT' } });
  });
});
