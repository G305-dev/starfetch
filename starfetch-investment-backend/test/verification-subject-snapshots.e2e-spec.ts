import { randomUUID } from 'crypto';
import {
  ApplicationRulesetBindingEventKind,
  ApplicationVerificationRequirementKind,
  ApplicationVerificationRequirementStage,
  ApplicationVerificationRequirementState,
  OnboardingApplicationKind,
  OnboardingApplicationStatus,
  UserRole,
  VerificationRulesetLifecycle,
  VerificationSubjectResolutionState,
  VerificationSubjectTargetKind,
} from '@prisma/client';
import request from 'supertest';
import { CorporateDraftBootstrapService } from '../src/modules/corporate-onboarding/services/corporate-draft-bootstrap.service';
import { CorporateDetailsEditService } from '../src/modules/corporate-onboarding/services/corporate-details-edit.service';
import { ApplicationRulesetBindingService } from '../src/modules/verification-rulesets/services/application-ruleset-binding.service';
import { ApplicationVerificationSnapshotService } from '../src/modules/verification-rulesets/services/application-verification-snapshot.service';
import { ApplicationVerificationSnapshotFreshnessService } from '../src/modules/verification-rulesets/services/application-verification-snapshot-freshness.service';
import { VerificationRulesetDraftService } from '../src/modules/verification-rulesets/services/verification-ruleset-draft.service';
import { VERIFICATION_RULESET_BINDING_AUTHORIZER } from '../src/modules/verification-rulesets/security/ruleset-binding-authorizer';
import { VERIFICATION_RULESET_AUTHORING_AUTHORIZER } from '../src/modules/verification-rulesets/security/ruleset-authoring-authorizer';
import { TestApp, cleanDatabase, createTestApp } from './utils/test-app';

const TEST_FINGERPRINT_KEY = 'test-only-non-tin-fingerprint-key-0123456789abcdef';

type SubjectSpec = { key: string; targetKind: VerificationSubjectTargetKind };

function principal(userId: string) {
  return { userId, role: UserRole.INVESTOR, sessionId: randomUUID() };
}

describe('C1.4 subject resolution, staged snapshots, and C1.3 append-only security (isolated PostgreSQL only)', () => {
  let t: TestApp;
  let draftService: VerificationRulesetDraftService;
  let bindingService: ApplicationRulesetBindingService;
  let snapshotService: ApplicationVerificationSnapshotService;
  let corporateBootstrap: CorporateDraftBootstrapService;
  let corporateDetailsEdit: CorporateDetailsEditService;
  let freshness: ApplicationVerificationSnapshotFreshnessService;
  let ownerId: string;
  let secondMemberId: string;
  let outsiderId: string;
  let governanceActorId: string;
  let databaseIdentityVerified = false;
  let originalFingerprintKey: string | undefined;
  const allowedBindings = new Set<string>();

  const testOnlyAuthoringAuthorizer = {
    authorizeDraftWrite: jest.fn(async ({ principal: actor }: { principal: { userId: string } }) =>
      actor.userId === governanceActorId),
  };
  const testOnlyBindingAuthorizer = {
    authorizeInitialBinding: jest.fn(async ({
      principal: actor,
      applicationId,
      rulesetVersionId,
    }: { principal: { userId: string }; applicationId: string; rulesetVersionId: string }) =>
      actor.userId === governanceActorId && allowedBindings.has(`${applicationId}:${rulesetVersionId}`)),
  };

  beforeAll(async () => {
    originalFingerprintKey = process.env.CORPORATE_DRAFT_BOOTSTRAP_FINGERPRINT_HMAC_SECRET;
    process.env.CORPORATE_DRAFT_BOOTSTRAP_FINGERPRINT_HMAC_SECRET = TEST_FINGERPRINT_KEY;
    t = await createTestApp({
      providerOverrides: [
        { provide: VERIFICATION_RULESET_AUTHORING_AUTHORIZER, useValue: testOnlyAuthoringAuthorizer },
        { provide: VERIFICATION_RULESET_BINDING_AUTHORIZER, useValue: testOnlyBindingAuthorizer },
      ],
    });
    draftService = t.app.get(VerificationRulesetDraftService);
    bindingService = t.app.get(ApplicationRulesetBindingService);
    snapshotService = t.app.get(ApplicationVerificationSnapshotService);
    corporateBootstrap = t.app.get(CorporateDraftBootstrapService);
    corporateDetailsEdit = t.app.get(CorporateDetailsEditService);
    freshness = t.app.get(ApplicationVerificationSnapshotFreshnessService);

    const identity = await t.prisma.$queryRaw<Array<{ db: string; host: string; db_user: string }>>`
      SELECT current_database() AS db, host(inet_server_addr()) AS host, current_user AS db_user
    `;
    if (
      identity.length !== 1 || identity[0].db !== 'starfetch_test' ||
      !['127.0.0.1', '::1'].includes(identity[0].host) || identity[0].db_user !== 'starfetch_test_role'
    ) throw new Error('C1.4 E2E requires the positively verified local starfetch_test database.');
    databaseIdentityVerified = true;
    await cleanDatabase(t.prisma);
  }, 60_000);

  afterAll(async () => {
    if (t) {
      if (databaseIdentityVerified) await cleanDatabase(t.prisma);
      await t.app.close();
    }
    if (originalFingerprintKey === undefined) delete process.env.CORPORATE_DRAFT_BOOTSTRAP_FINGERPRINT_HMAC_SECRET;
    else process.env.CORPORATE_DRAFT_BOOTSTRAP_FINGERPRINT_HMAC_SECRET = originalFingerprintKey;
  }, 60_000);

  beforeEach(async () => {
    await cleanDatabase(t.prisma);
    allowedBindings.clear();
    testOnlyAuthoringAuthorizer.authorizeDraftWrite.mockClear();
    testOnlyBindingAuthorizer.authorizeInitialBinding.mockClear();
    ownerId = randomUUID();
    secondMemberId = randomUUID();
    outsiderId = randomUUID();
    governanceActorId = randomUUID();
    await t.prisma.user.createMany({
      data: [ownerId, secondMemberId, outsiderId, governanceActorId].map((id) => ({
        id,
        email: `synthetic-${id}@example.invalid`,
        normalizedEmail: `synthetic-${id}@example.invalid`,
        passwordHash: 'synthetic-e2e-not-used-for-auth',
        role: UserRole.INVESTOR,
        emailVerifiedAt: new Date('2025-01-01T00:00:00.000Z'),
      })),
    });
  });

  async function createApplication(
    kind: OnboardingApplicationKind,
    individualOwnerId: string = ownerId,
  ): Promise<string> {
    if (kind === OnboardingApplicationKind.CORPORATE) {
      const suffix = randomUUID();
      const draft = await corporateBootstrap.createDraft(principal(ownerId), {
        institutionName: 'Synthetic Snapshot Holdings Ltd',
        dateOfIncorporation: '2020-01-02',
        rcNumber: `RC-${suffix.slice(0, 12)}`,
        businessPhoneNumber: '+2348000000000',
        businessEmail: `synthetic-${suffix}@example.invalid`,
      }, `snapshot-${suffix}`);
      return draft.applicationId;
    }

    if (kind === OnboardingApplicationKind.INDIVIDUAL) {
      const application = await t.prisma.onboardingApplication.create({
        data: {
          kind,
          ownerUserId: individualOwnerId,
          initiatingUserId: individualOwnerId,
        },
      });
      return application.id;
    }

    const account = await t.prisma.jointAccount.create({
      data: { displayName: 'Synthetic Joint Snapshot', createdByUserId: ownerId },
    });
    await t.prisma.jointAccountMember.createMany({
      data: [ownerId, secondMemberId].map((userId) => ({ jointAccountId: account.id, userId })),
    });
    const application = await t.prisma.onboardingApplication.create({
      data: {
        kind,
        ownerJointAccountId: account.id,
        initiatingUserId: ownerId,
      },
    });
    return application.id;
  }

  async function createPublishedPolicy(
    kind: OnboardingApplicationKind,
    subjects: SubjectSpec[] = [
      {
        key: 'synthetic-required-subject',
        targetKind: kind === OnboardingApplicationKind.INDIVIDUAL
          ? VerificationSubjectTargetKind.INDIVIDUAL_APPLICANT
          : kind === OnboardingApplicationKind.JOINT
            ? VerificationSubjectTargetKind.JOINT_ACCOUNT_MEMBER
            : VerificationSubjectTargetKind.CORPORATE_LEGAL_ENTITY,
      },
    ],
  ) {
    const suffix = randomUUID();
    const created = await draftService.createRuleset(principal(governanceActorId), {
      rulesetKey: `synthetic-snapshot-${suffix}`,
      accountKind: kind,
    });
    await draftService.replaceDraftDefinitions(principal(governanceActorId), created.rulesetVersionId, {
      requiredSubjects: subjects.map((subject) => ({
        subjectKey: subject.key,
        targetKind: subject.targetKind,
        requiredChecks: [{
          checkKindKey: `synthetic-check-${subject.key}`,
          acceptedEvidenceSourceKeys: ['synthetic-evidence-source-only'],
        }],
      })),
      conditionalDocumentRequirements: [{
        requirementKey: 'synthetic-conditional-document',
        documentKindKey: 'synthetic-document-kind-only',
        condition: { testFixture: 'uninterpreted-condition' },
        completeness: { minimumFiles: 1, testFixture: 'uninterpreted-completeness' },
      }],
    });
    return t.prisma.verificationRulesetVersion.update({
      where: { id: created.rulesetVersionId },
      data: {
        lifecycle: VerificationRulesetLifecycle.PUBLISHED,
        approvedByUserId: governanceActorId,
        approvedAt: new Date('2026-01-01T00:00:00.000Z'),
        publishedByUserId: governanceActorId,
        publishedAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedByUserId: governanceActorId,
      },
    });
  }

  async function bind(applicationId: string, versionId: string) {
    allowedBindings.add(`${applicationId}:${versionId}`);
    return bindingService.bindApprovedVersion(principal(governanceActorId), applicationId, versionId);
  }

  it('fails closed on draft authoring for an arbitrary caller-supplied identity', async () => {
    await expect(draftService.createRuleset(principal(ownerId), {
      rulesetKey: `synthetic-denied-${randomUUID()}`,
      accountKind: OnboardingApplicationKind.CORPORATE,
    })).rejects.toMatchObject({ status: 403 });
    expect(await t.prisma.verificationRuleset.count()).toBe(0);
  });

  it('resolves an Individual applicant only from their own application and records pending, non-verification Tier 1–3 requirements', async () => {
    const applicationId = await createApplication(OnboardingApplicationKind.INDIVIDUAL);
    const version = await createPublishedPolicy(OnboardingApplicationKind.INDIVIDUAL);
    await bind(applicationId, version.id);

    const result = await snapshotService.createOrGetSnapshot(principal(ownerId), applicationId);
    expect(result).toMatchObject({
      accountKind: OnboardingApplicationKind.INDIVIDUAL,
      rulesetVersionId: version.id,
      subjectCount: 1,
      resolvedSubjectCount: 1,
      unresolvedSubjectCount: 0,
      submissionEligible: false,
      idempotentReplay: false,
      tiers: {
        TIER_1_BASIC_MONO: { requirementCount: 1, pendingCount: 1, unresolvedCount: 0, state: 'INCOMPLETE' },
        TIER_2_DOCUMENTS: { requirementCount: 1, pendingCount: 0, unresolvedCount: 1, state: 'BLOCKED' },
        TIER_3_STAFF_COMPLIANCE: { requirementCount: 2, pendingCount: 2, unresolvedCount: 0, state: 'INCOMPLETE' },
      },
    });
    const stored = await t.prisma.applicationVerificationSnapshot.findFirstOrThrow({
      where: { applicationId }, orderBy: { generation: 'desc' },
      include: { subjects: true, requirements: true },
    });
    expect(stored.subjects).toHaveLength(1);
    expect(stored.subjects[0]).toMatchObject({
      targetKind: VerificationSubjectTargetKind.INDIVIDUAL_APPLICANT,
      resolutionState: VerificationSubjectResolutionState.RESOLVED,
      resolvedUserId: ownerId,
    });
    expect(stored.requirements.find((r) => r.requirementKind === ApplicationVerificationRequirementKind.VERIFICATION_CHECK))
      .toMatchObject({ state: ApplicationVerificationRequirementState.PENDING, sourceCheckDefinitionId: expect.any(String) });
    expect(stored.requirements.find((r) => r.requirementKind === ApplicationVerificationRequirementKind.CONDITIONAL_DOCUMENT))
      .toMatchObject({
        state: ApplicationVerificationRequirementState.UNRESOLVED,
        stage: ApplicationVerificationRequirementStage.TIER_2_DOCUMENTS,
        conditionSnapshot: { testFixture: 'uninterpreted-condition' },
        documentKindKeySnapshot: 'synthetic-document-kind-only',
        documentCompletenessSnapshot: { minimumFiles: 1, testFixture: 'uninterpreted-completeness' },
      });

    const replay = await snapshotService.createOrGetSnapshot(principal(ownerId), applicationId);
    expect(replay.snapshotId).toBe(result.snapshotId);
    expect(replay.idempotentReplay).toBe(true);
    expect(await t.prisma.applicationVerificationSnapshot.count({ where: { applicationId } })).toBe(1);
    expect(await t.prisma.applicationVerificationRequirement.count({ where: { snapshotId: result.snapshotId } })).toBe(4);
    await expect(snapshotService.createOrGetSnapshot(principal(outsiderId), applicationId))
      .rejects.toMatchObject({ status: 404 });
    await expect(t.prisma.onboardingApplication.findUniqueOrThrow({ where: { id: applicationId } }))
      .resolves.toMatchObject({ status: OnboardingApplicationStatus.DRAFT, submittedAt: null, submittedByUserId: null });
    expect(await t.prisma.onboardingApplicationRulesetPin.count({ where: { applicationId } })).toBe(0);
  });

  it('resolves every current JointAccountMember independently, not the initiator alone or another account', async () => {
    const applicationId = await createApplication(OnboardingApplicationKind.JOINT);
    const version = await createPublishedPolicy(OnboardingApplicationKind.JOINT);
    await bind(applicationId, version.id);

    const snapshot = await snapshotService.createOrGetSnapshot(principal(ownerId), applicationId);
    expect(snapshot).toMatchObject({ subjectCount: 2, resolvedSubjectCount: 2, unresolvedSubjectCount: 0, submissionEligible: false });
    const stored = await t.prisma.applicationVerificationSnapshot.findFirstOrThrow({
      where: { applicationId }, orderBy: { generation: 'desc' },
      include: { subjects: true, requirements: true },
    });
    expect(stored.subjects.map((subject) => subject.resolvedUserId).sort()).toEqual([ownerId, secondMemberId].sort());
    expect(stored.subjects.every((subject) => subject.sourceJointMembershipId !== null)).toBe(true);
    expect(stored.requirements.filter((r) => r.requirementKind === ApplicationVerificationRequirementKind.VERIFICATION_CHECK)).toHaveLength(2);
    await expect(snapshotService.createOrGetSnapshot(principal(outsiderId), applicationId))
      .rejects.toMatchObject({ status: 404 });
  });

  it('resolves a Corporate legal entity but records representatives and beneficial owners as unresolved without inventing people', async () => {
    const applicationId = await createApplication(OnboardingApplicationKind.CORPORATE);
    const version = await createPublishedPolicy(OnboardingApplicationKind.CORPORATE, [
      { key: 'synthetic-legal-entity', targetKind: VerificationSubjectTargetKind.CORPORATE_LEGAL_ENTITY },
      { key: 'synthetic-authorized-representative', targetKind: VerificationSubjectTargetKind.CORPORATE_AUTHORIZED_REPRESENTATIVE },
      { key: 'synthetic-beneficial-owner', targetKind: VerificationSubjectTargetKind.CORPORATE_BENEFICIAL_OWNER },
    ]);
    await bind(applicationId, version.id);

    const result = await snapshotService.createOrGetSnapshot(principal(ownerId), applicationId);
    expect(result).toMatchObject({
      accountKind: OnboardingApplicationKind.CORPORATE,
      subjectCount: 3,
      resolvedSubjectCount: 1,
      unresolvedSubjectCount: 2,
      submissionEligible: false,
      unresolvedRequirementCount: 3,
    });
    const stored = await t.prisma.applicationVerificationSnapshot.findFirstOrThrow({
      where: { applicationId }, orderBy: { generation: 'desc' },
      include: { subjects: true, requirements: true },
    });
    expect(stored.corporateDetailsVersion).toBe(1);
    const unresolvedPeople = stored.subjects.filter((subject) =>
      subject.targetKind === VerificationSubjectTargetKind.CORPORATE_AUTHORIZED_REPRESENTATIVE ||
      subject.targetKind === VerificationSubjectTargetKind.CORPORATE_BENEFICIAL_OWNER,
    );
    expect(unresolvedPeople).toHaveLength(2);
    expect(unresolvedPeople.every((subject) =>
      subject.resolutionState === VerificationSubjectResolutionState.UNRESOLVED &&
      subject.resolvedUserId === null && subject.resolvedCorporateAccountId === null && subject.sourceJointMembershipId === null,
    )).toBe(true);
    expect(stored.requirements.filter((r) => r.requirementKind === ApplicationVerificationRequirementKind.VERIFICATION_CHECK))
      .toHaveLength(3);
    expect(stored.requirements.filter((r) => r.requirementKind === ApplicationVerificationRequirementKind.STAFF_REVIEW)).toHaveLength(1);
    expect(stored.requirements.filter((r) => r.requirementKind === ApplicationVerificationRequirementKind.INDEPENDENT_COMPLIANCE_APPROVAL)).toHaveLength(1);
    expect(stored.requirements.filter((r) => r.stage === ApplicationVerificationRequirementStage.TIER_3_STAFF_COMPLIANCE)
      .every((r) => r.state === ApplicationVerificationRequirementState.PENDING)).toBe(true);
  });

  it('blocks Joint member TRUNCATE independently of snapshot foreign keys', async () => {
    await createApplication(OnboardingApplicationKind.JOINT);
    await expect(t.prisma.$executeRawUnsafe('TRUNCATE TABLE "joint_account_members" CASCADE')).rejects.toThrow();
  });

  it('keeps immutable snapshots stale on Corporate detail or Joint membership revision changes', async () => {
    const corporateApplicationId = await createApplication(OnboardingApplicationKind.CORPORATE);
    const corporateVersion = await createPublishedPolicy(OnboardingApplicationKind.CORPORATE);
    await bind(corporateApplicationId, corporateVersion.id);
    const corporateReceipt = await snapshotService.createOrGetSnapshot(principal(ownerId), corporateApplicationId);
    await corporateDetailsEdit.updateDetails(principal(ownerId), corporateApplicationId, 1, {
      institutionName: 'Synthetic Updated Snapshot Holdings Ltd',
    });
    await expect(freshness.assess(principal(ownerId), corporateApplicationId)).resolves.toMatchObject({
      snapshotId: corporateReceipt.snapshotId,
      isFresh: false,
      issues: ['CORPORATE_DETAILS_VERSION_CHANGED'],
    });
    const regeneratedCorporate = await snapshotService.createOrGetSnapshot(principal(ownerId), corporateApplicationId);
    expect(regeneratedCorporate).toMatchObject({ generation: 2, idempotentReplay: false });
    await expect(freshness.assess(principal(ownerId), corporateApplicationId)).resolves.toMatchObject({
      snapshotId: regeneratedCorporate.snapshotId,
      generation: 2,
      isFresh: true,
      issues: [],
    });
    expect(await t.prisma.applicationVerificationSnapshot.count({ where: { applicationId: corporateApplicationId } })).toBe(2);

    const jointApplicationId = await createApplication(OnboardingApplicationKind.JOINT);
    const jointVersion = await createPublishedPolicy(OnboardingApplicationKind.JOINT);
    await bind(jointApplicationId, jointVersion.id);
    const jointReceipt = await snapshotService.createOrGetSnapshot(principal(ownerId), jointApplicationId);
    const jointApplication = await t.prisma.onboardingApplication.findUniqueOrThrow({
      where: { id: jointApplicationId }, select: { ownerJointAccountId: true },
    });
    const membershipVersionBefore = await t.prisma.jointAccount.findUniqueOrThrow({
      where: { id: jointApplication.ownerJointAccountId! }, select: { membershipVersion: true },
    });
    await t.prisma.jointAccountMember.create({
      data: { jointAccountId: jointApplication.ownerJointAccountId!, userId: outsiderId },
    });
    const membershipVersionAfter = await t.prisma.jointAccount.findUniqueOrThrow({
      where: { id: jointApplication.ownerJointAccountId! }, select: { membershipVersion: true },
    });
    expect(membershipVersionAfter.membershipVersion).toBe(membershipVersionBefore.membershipVersion + 1);
    await expect(t.prisma.jointAccount.update({
      where: { id: jointApplication.ownerJointAccountId! }, data: { membershipVersion: 999 },
    })).rejects.toThrow();
    await expect(freshness.assess(principal(ownerId), jointApplicationId)).resolves.toMatchObject({
      snapshotId: jointReceipt.snapshotId,
      isFresh: false,
      issues: ['JOINT_MEMBERSHIP_VERSION_CHANGED'],
    });
    const regeneratedJoint = await snapshotService.createOrGetSnapshot(principal(ownerId), jointApplicationId);
    expect(regeneratedJoint).toMatchObject({ generation: 2, idempotentReplay: false });
    await expect(freshness.assess(principal(ownerId), jointApplicationId)).resolves.toMatchObject({
      snapshotId: regeneratedJoint.snapshotId,
      generation: 2,
      isFresh: true,
      issues: [],
    });
    expect(await t.prisma.applicationVerificationSnapshot.count({ where: { applicationId: jointApplicationId } })).toBe(2);
  });

  it('rejects wrong-kind bindings and keeps submission, pinning, verification and approval unavailable', async () => {
    const applicationId = await createApplication(OnboardingApplicationKind.INDIVIDUAL);
    const jointVersion = await createPublishedPolicy(OnboardingApplicationKind.JOINT);
    allowedBindings.add(`${applicationId}:${jointVersion.id}`);
    await expect(bindingService.bindApprovedVersion(principal(governanceActorId), applicationId, jointVersion.id))
      .rejects.toMatchObject({ status: 409 });
    expect(await t.prisma.onboardingApplicationRulesetBinding.count({ where: { applicationId } })).toBe(0);
    await request(t.server).post(`/api/v1/onboarding/applications/${applicationId}/submit`).send({}).expect(404);
    await expect(snapshotService.createOrGetSnapshot(principal(ownerId), applicationId))
      .rejects.toMatchObject({ status: 409 });
    await expect(t.prisma.onboardingApplication.findUniqueOrThrow({ where: { id: applicationId } }))
      .resolves.toMatchObject({ status: OnboardingApplicationStatus.DRAFT, submittedByUserId: null, submittedAt: null });
    expect(await t.prisma.onboardingApplicationRulesetPin.count()).toBe(0);
  });

  it('returns one immutable snapshot on concurrent retries and rolls back every row after an injected requirement write failure', async () => {
    const applicationId = await createApplication(OnboardingApplicationKind.INDIVIDUAL);
    const version = await createPublishedPolicy(OnboardingApplicationKind.INDIVIDUAL);
    await bind(applicationId, version.id);

    const concurrent = await Promise.all([
      snapshotService.createOrGetSnapshot(principal(ownerId), applicationId),
      snapshotService.createOrGetSnapshot(principal(ownerId), applicationId),
    ]);
    expect(concurrent[0].snapshotId).toBe(concurrent[1].snapshotId);
    expect(concurrent.some((result) => result.idempotentReplay)).toBe(true);
    expect(await t.prisma.applicationVerificationSnapshot.count({ where: { applicationId } })).toBe(1);

    const rollbackApplicationId = await createApplication(OnboardingApplicationKind.INDIVIDUAL, secondMemberId);
    const rollbackVersion = await createPublishedPolicy(OnboardingApplicationKind.INDIVIDUAL);
    await bind(rollbackApplicationId, rollbackVersion.id);
    const identity = await t.prisma.$queryRaw<Array<{ db: string; host: string; db_user: string }>>`
      SELECT current_database() AS db, host(inet_server_addr()) AS host, current_user AS db_user
    `;
    if (identity[0]?.db !== 'starfetch_test' || !['127.0.0.1', '::1'].includes(identity[0]?.host) || identity[0]?.db_user !== 'starfetch_test_role') {
      throw new Error('Refusing test-only trigger DDL on an unverified database.');
    }
    await t.prisma.$executeRawUnsafe(`
      CREATE FUNCTION "c14_test_fail_snapshot_requirement"() RETURNS TRIGGER AS $$
      BEGIN RAISE EXCEPTION 'synthetic test-only snapshot failure'; END;
      $$ LANGUAGE plpgsql
    `);
    await t.prisma.$executeRawUnsafe(`
      CREATE TRIGGER "c14_test_fail_snapshot_requirement_trigger"
      BEFORE INSERT ON "application_verification_requirements"
      FOR EACH ROW EXECUTE FUNCTION "c14_test_fail_snapshot_requirement"()
    `);
    try {
      await expect(snapshotService.createOrGetSnapshot(principal(secondMemberId), rollbackApplicationId)).rejects.toThrow();
      expect(await t.prisma.applicationVerificationSnapshot.count({ where: { applicationId: rollbackApplicationId } })).toBe(0);
      expect(await t.prisma.applicationVerificationSubjectSnapshot.count({
        where: { snapshot: { applicationId: rollbackApplicationId } },
      })).toBe(0);
      expect(await t.prisma.applicationVerificationRequirement.count({
        where: { snapshot: { applicationId: rollbackApplicationId } },
      })).toBe(0);
    } finally {
      await t.prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "c14_test_fail_snapshot_requirement_trigger" ON "application_verification_requirements"');
      await t.prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS "c14_test_fail_snapshot_requirement"()');
    }
  });

  it('blocks unauthorized update and deletion of binding, audit, pin, subject, and requirement records', async () => {
    const applicationId = await createApplication(OnboardingApplicationKind.INDIVIDUAL);
    const version = await createPublishedPolicy(OnboardingApplicationKind.INDIVIDUAL);
    const bindingReceipt = await bind(applicationId, version.id);
    await snapshotService.createOrGetSnapshot(principal(ownerId), applicationId);
    const binding = await t.prisma.onboardingApplicationRulesetBinding.findUniqueOrThrow({ where: { applicationId } });
    const audit = await t.prisma.applicationRulesetBindingEvent.findFirstOrThrow({ where: { bindingId: binding.id } });
    const snapshot = await t.prisma.applicationVerificationSnapshot.findFirstOrThrow({
      where: { applicationId }, orderBy: { generation: 'desc' }, include: { subjects: true, requirements: true },
    });
    const subject = snapshot.subjects[0];
    const requirement = snapshot.requirements[0];

    await expect(t.prisma.onboardingApplicationRulesetBinding.update({
      where: { id: binding.id }, data: { rulesetVersionId: randomUUID() },
    })).rejects.toThrow();
    await expect(t.prisma.onboardingApplicationRulesetBinding.delete({ where: { id: binding.id } })).rejects.toThrow();
    await expect(t.prisma.applicationRulesetBindingEvent.update({
      where: { id: audit.id }, data: { occurredAt: new Date() },
    })).rejects.toThrow();
    await expect(t.prisma.applicationRulesetBindingEvent.delete({ where: { id: audit.id } })).rejects.toThrow();
    await expect(t.prisma.$executeRawUnsafe('TRUNCATE TABLE "application_ruleset_binding_events"')).rejects.toThrow();
    await expect(t.prisma.applicationVerificationSnapshot.update({
      where: { id: snapshot.id }, data: { corporateDetailsVersion: 99 },
    })).rejects.toThrow();
    await expect(t.prisma.applicationVerificationSubjectSnapshot.delete({ where: { id: subject.id } })).rejects.toThrow();
    await expect(t.prisma.applicationVerificationRequirement.update({
      where: { id: requirement.id }, data: { state: ApplicationVerificationRequirementState.PENDING },
    })).rejects.toThrow();

    // Synthetic future pin fixture only: no production pin/submission method exists.
    const pinOperationId = randomUUID();
    await t.prisma.$transaction(async (tx) => {
      await tx.onboardingApplication.update({
        where: { id: applicationId },
        data: { status: OnboardingApplicationStatus.SUBMITTED, submittedAt: new Date(), submittedByUserId: ownerId },
      });
      await tx.onboardingApplicationRulesetPin.create({
        data: {
          bindingId: bindingReceipt.bindingId,
          applicationId,
          accountKind: OnboardingApplicationKind.INDIVIDUAL,
          rulesetVersionId: version.id,
          pinnedByUserId: ownerId,
        },
      });
      await tx.applicationRulesetBindingEvent.create({
        data: {
          bindingId: bindingReceipt.bindingId,
          applicationId,
          accountKind: OnboardingApplicationKind.INDIVIDUAL,
          rulesetVersionId: version.id,
          eventKind: ApplicationRulesetBindingEventKind.SUBMISSION_PINNED,
          operationId: pinOperationId,
          actorUserId: ownerId,
        },
      });
    });
    const pin = await t.prisma.onboardingApplicationRulesetPin.findUniqueOrThrow({ where: { applicationId } });
    await expect(t.prisma.onboardingApplicationRulesetPin.update({
      where: { id: pin.id }, data: { pinnedAt: new Date() },
    })).rejects.toThrow();
    await expect(t.prisma.onboardingApplicationRulesetPin.delete({ where: { id: pin.id } })).rejects.toThrow();
  });
});
