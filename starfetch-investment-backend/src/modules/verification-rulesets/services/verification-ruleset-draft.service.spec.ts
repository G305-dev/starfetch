import { OnboardingApplicationKind, Prisma, UserRole, VerificationRulesetLifecycle, VerificationSubjectTargetKind } from '@prisma/client';
import { VerificationRulesetDraftService } from './verification-ruleset-draft.service';
import { DenyAllVerificationRulesetAuthoringAuthorizer } from '../security/ruleset-authoring-authorizer';

const actorId = '11111111-1111-4111-8111-111111111111';
const rulesetId = '22222222-2222-4222-8222-222222222222';
const versionId = '33333333-3333-4333-8333-333333333333';
const principal = { userId: actorId, role: UserRole.INVESTOR, sessionId: 'trusted-test-session' };

function makeService(txOverrides: Record<string, unknown> = {}, authorized = true) {
  const tx = {
    verificationRuleset: {
      create: jest.fn().mockResolvedValue({ id: rulesetId, rulesetKey: 'synthetic-policy', accountKind: OnboardingApplicationKind.CORPORATE }),
      findUnique: jest.fn().mockResolvedValue({ id: rulesetId, rulesetKey: 'synthetic-policy', accountKind: OnboardingApplicationKind.CORPORATE }),
    },
    verificationRulesetVersion: {
      create: jest.fn().mockResolvedValue({ id: versionId, version: 1, lifecycle: VerificationRulesetLifecycle.DRAFT }),
      aggregate: jest.fn().mockResolvedValue({ _max: { version: 1 } }),
      findUnique: jest.fn().mockResolvedValue({ id: versionId, lifecycle: VerificationRulesetLifecycle.DRAFT, accountKind: OnboardingApplicationKind.CORPORATE }),
      update: jest.fn().mockResolvedValue({}),
    },
    verificationSubjectDefinition: { create: jest.fn().mockResolvedValue({ id: '44444444-4444-4444-8444-444444444444' }), deleteMany: jest.fn() },
    verificationCheckDefinition: { create: jest.fn().mockResolvedValue({ id: '55555555-5555-4555-8555-555555555555' }), deleteMany: jest.fn() },
    acceptedEvidenceSourceDefinition: { createMany: jest.fn(), deleteMany: jest.fn() },
    conditionalDocumentRequirementDefinition: { create: jest.fn(), deleteMany: jest.fn() },
    ...txOverrides,
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: any) => unknown) => callback(tx)),
  };
  const authorizer = { authorizeDraftWrite: jest.fn().mockResolvedValue(authorized) };
  return { service: new VerificationRulesetDraftService(prisma as any, authorizer as any), tx, prisma, authorizer };
}

describe('VerificationRulesetDraftService', () => {
  it('uses fail-closed authoring authorization and derives audit actors only from the authenticated principal', async () => {
    const denied = makeService({}, false);
    await expect(denied.service.createRuleset(principal, {
      rulesetKey: 'synthetic-policy', accountKind: OnboardingApplicationKind.CORPORATE,
    })).rejects.toMatchObject({ status: 403 });
    expect(denied.prisma.$transaction).not.toHaveBeenCalled();

    const productionDefault = new DenyAllVerificationRulesetAuthoringAuthorizer();
    await expect(productionDefault.authorizeDraftWrite()).resolves.toBe(false);
    await expect(makeService().service.createRuleset(null, {
      rulesetKey: 'synthetic-policy', accountKind: OnboardingApplicationKind.CORPORATE,
    })).rejects.toMatchObject({ status: 401 });
  });

  it('creates a stable identity with version 1 in DRAFT and no approval/publication attribution', async () => {
    const { service, tx } = makeService();
    await expect(service.createRuleset(principal, {
      rulesetKey: 'synthetic-policy',
      accountKind: OnboardingApplicationKind.CORPORATE,
    })).resolves.toEqual({
      rulesetId,
      rulesetVersionId: versionId,
      rulesetKey: 'synthetic-policy',
      accountKind: OnboardingApplicationKind.CORPORATE,
      version: 1,
      lifecycle: VerificationRulesetLifecycle.DRAFT,
    });
    expect(tx.verificationRuleset.create).toHaveBeenCalledWith({
      data: { rulesetKey: 'synthetic-policy', accountKind: 'CORPORATE', createdByUserId: actorId },
    });
    expect(tx.verificationRulesetVersion.create).toHaveBeenCalledWith({
      data: {
        rulesetId,
        accountKind: 'CORPORATE',
        version: 1,
        lifecycle: 'DRAFT',
        createdByUserId: actorId,
      },
    });
  });

  it('creates a monotonically numbered empty next draft rather than silently cloning policy content', async () => {
    const { service, tx } = makeService();
    tx.verificationRulesetVersion.create.mockResolvedValueOnce({
      id: '66666666-6666-4666-8666-666666666666',
      version: 2,
      lifecycle: VerificationRulesetLifecycle.DRAFT,
    });
    await expect(service.createNextDraftVersion(principal, rulesetId)).resolves.toMatchObject({
      rulesetId,
      version: 2,
      lifecycle: VerificationRulesetLifecycle.DRAFT,
    });
    expect(tx.verificationRulesetVersion.aggregate).toHaveBeenCalledWith({
      where: { rulesetId },
      _max: { version: true },
    });
    expect(tx.verificationRulesetVersion.create).toHaveBeenCalledWith({
      data: {
        rulesetId,
        accountKind: OnboardingApplicationKind.CORPORATE,
        version: 2,
        lifecycle: 'DRAFT',
        createdByUserId: actorId,
      },
    });
  });

  it('stores policy-defined subjects, checks, accepted source keys and conditional documents', async () => {
    const { service, tx } = makeService();
    await expect(service.replaceDraftDefinitions(principal, versionId, {
      requiredSubjects: [{
        subjectKey: 'synthetic-subject',
        targetKind: VerificationSubjectTargetKind.CORPORATE_LEGAL_ENTITY,
        requiredChecks: [{
          checkKindKey: 'synthetic-check',
          acceptedEvidenceSourceKeys: ['synthetic-source'],
        }],
      }],
      conditionalDocumentRequirements: [{
        requirementKey: 'synthetic-document-requirement',
        documentKindKey: 'synthetic-document-kind',
        condition: { testOnly: true },
        completeness: { minimumFiles: 1, testOnly: true },
      }],
    })).resolves.toEqual({
      rulesetVersionId: versionId,
      subjectCount: 1,
      checkCount: 1,
      evidenceSourceCount: 1,
      documentRequirementCount: 1,
    });
    expect(tx.verificationSubjectDefinition.create).toHaveBeenCalledWith({
      data: { rulesetVersionId: versionId, subjectKey: 'synthetic-subject', targetKind: VerificationSubjectTargetKind.CORPORATE_LEGAL_ENTITY },
    });
    expect(tx.verificationCheckDefinition.create).toHaveBeenCalledWith({
      data: {
        rulesetVersionId: versionId,
        subjectDefinitionId: '44444444-4444-4444-8444-444444444444',
        checkKindKey: 'synthetic-check',
      },
    });
    expect(tx.acceptedEvidenceSourceDefinition.createMany).toHaveBeenCalledWith({
      data: [{
        rulesetVersionId: versionId,
        checkDefinitionId: '55555555-5555-4555-8555-555555555555',
        evidenceSourceKey: 'synthetic-source',
      }],
    });
    expect(tx.conditionalDocumentRequirementDefinition.create).toHaveBeenCalledWith({
      data: {
        rulesetVersionId: versionId,
        requirementKey: 'synthetic-document-requirement',
        documentKindKey: 'synthetic-document-kind',
        condition: { testOnly: true },
        completeness: { minimumFiles: 1, testOnly: true },
      },
    });
  });

  it('allows empty DRAFTs but refuses definition mutation on PUBLISHED versions', async () => {
    const empty = makeService();
    await expect(empty.service.replaceDraftDefinitions(principal, versionId, {
      requiredSubjects: [],
      conditionalDocumentRequirements: [],
    })).resolves.toMatchObject({ subjectCount: 0, checkCount: 0, evidenceSourceCount: 0 });

    const published = makeService();
    published.tx.verificationRulesetVersion.findUnique.mockResolvedValueOnce({
      id: versionId,
      lifecycle: VerificationRulesetLifecycle.PUBLISHED,
      accountKind: OnboardingApplicationKind.CORPORATE,
    });
    await expect(published.service.replaceDraftDefinitions(principal, versionId, {
      requiredSubjects: [],
      conditionalDocumentRequirements: [],
    })).rejects.toMatchObject({ status: 409, response: { code: 'CONFLICT' } });
    expect(published.tx.verificationSubjectDefinition.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects a ruleset subject target that does not match its account kind', async () => {
    const { service, tx } = makeService();
    await expect(service.replaceDraftDefinitions(principal, versionId, {
      requiredSubjects: [{
        subjectKey: 'wrong-kind',
        targetKind: VerificationSubjectTargetKind.JOINT_ACCOUNT_MEMBER,
        requiredChecks: [{ checkKindKey: 'check', acceptedEvidenceSourceKeys: ['source'] }],
      }],
      conditionalDocumentRequirements: [],
    })).rejects.toMatchObject({ status: 400 });
    expect(tx.verificationSubjectDefinition.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects duplicate identity creation as a conflict', async () => {
    const { service, tx } = makeService();
    tx.verificationRuleset.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError(
      'Synthetic unique conflict',
      { code: 'P2002', clientVersion: '5.22.0' },
    ));
    await expect(service.createRuleset(principal, {
      rulesetKey: 'synthetic-policy',
      accountKind: OnboardingApplicationKind.CORPORATE,
    })).rejects.toMatchObject({ status: 409 });
  });
});
