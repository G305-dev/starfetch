import { randomUUID } from 'crypto';
import {
  OnboardingApplicationKind,
  OnboardingApplicationStatus,
  UserRole,
  VerificationRulesetLifecycle,
  VerificationSubjectTargetKind,
} from '@prisma/client';
import request from 'supertest';
import { CorporateDraftBootstrapService } from '../src/modules/corporate-onboarding/services/corporate-draft-bootstrap.service';
import { ApplicationRulesetBindingService } from '../src/modules/verification-rulesets/services/application-ruleset-binding.service';
import { VerificationRulesetDraftService } from '../src/modules/verification-rulesets/services/verification-ruleset-draft.service';
import { VERIFICATION_RULESET_BINDING_AUTHORIZER } from '../src/modules/verification-rulesets/security/ruleset-binding-authorizer';
import { VERIFICATION_RULESET_AUTHORING_AUTHORIZER } from '../src/modules/verification-rulesets/security/ruleset-authoring-authorizer';
import { TestApp, cleanDatabase, createTestApp } from './utils/test-app';

const TEST_FINGERPRINT_KEY = 'test-only-non-tin-fingerprint-key-0123456789abcdef';
function syntheticDefinitionsFor(accountKind: OnboardingApplicationKind) {
  const targetKind = accountKind === OnboardingApplicationKind.INDIVIDUAL
    ? VerificationSubjectTargetKind.INDIVIDUAL_APPLICANT
    : accountKind === OnboardingApplicationKind.JOINT
      ? VerificationSubjectTargetKind.JOINT_ACCOUNT_MEMBER
      : VerificationSubjectTargetKind.CORPORATE_LEGAL_ENTITY;
  return {
    requiredSubjects: [{
      subjectKey: 'synthetic-subject-only',
      targetKind,
      requiredChecks: [{
        checkKindKey: 'synthetic-check-only',
        acceptedEvidenceSourceKeys: ['synthetic-evidence-source-only'],
      }],
    }],
    conditionalDocumentRequirements: [{
      requirementKey: 'synthetic-doc-requirement-only',
      documentKindKey: 'synthetic-document-kind-only',
      condition: { testFixture: 'not-a-real-policy' },
      completeness: { minimumFiles: 1, testFixture: 'not-a-real-policy' },
    }],
  };
}

describe('C1.3 dormant verification rulesets and binding foundation (isolated PostgreSQL only)', () => {
  let t: TestApp;
  let draftService: VerificationRulesetDraftService;
  let bindingService: ApplicationRulesetBindingService;
  let bootstrap: CorporateDraftBootstrapService;
  let ownerId: string;
  let governanceActorId: string;
  let databaseIdentityVerified = false;
  let originalFingerprintKey: string | undefined;
  const allowedBindings = new Set<string>();
  const testOnlyAuthoringAuthorizer = {
    authorizeDraftWrite: jest.fn(async ({ principal: requestPrincipal }: { principal: { userId: string } }) =>
      requestPrincipal.userId === governanceActorId
    ),
  };
  const testOnlyAuthorizer = {
    authorizeInitialBinding: jest.fn(async ({ principal, applicationId, rulesetVersionId }) =>
      principal.userId === governanceActorId && allowedBindings.has(`${applicationId}:${rulesetVersionId}`)
    ),
  };

  beforeAll(async () => {
    originalFingerprintKey = process.env.CORPORATE_DRAFT_BOOTSTRAP_FINGERPRINT_HMAC_SECRET;
    process.env.CORPORATE_DRAFT_BOOTSTRAP_FINGERPRINT_HMAC_SECRET = TEST_FINGERPRINT_KEY;
    t = await createTestApp({
      providerOverrides: [
        { provide: VERIFICATION_RULESET_BINDING_AUTHORIZER, useValue: testOnlyAuthorizer },
        { provide: VERIFICATION_RULESET_AUTHORING_AUTHORIZER, useValue: testOnlyAuthoringAuthorizer },
      ],
    });
    draftService = t.app.get(VerificationRulesetDraftService);
    bindingService = t.app.get(ApplicationRulesetBindingService);
    bootstrap = t.app.get(CorporateDraftBootstrapService);

    const identity = await t.prisma.$queryRaw<Array<{ db: string; host: string; db_user: string }>>`
      SELECT current_database() AS db, host(inet_server_addr()) AS host, current_user AS db_user
    `;
    if (
      identity.length !== 1 || identity[0].db !== 'starfetch_test' ||
      !['127.0.0.1', '::1'].includes(identity[0].host) || identity[0].db_user !== 'starfetch_test_role'
    ) {
      throw new Error('Ruleset E2E requires the verified isolated loopback starfetch_test database and starfetch test role.');
    }
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
    testOnlyAuthorizer.authorizeInitialBinding.mockClear();
    ownerId = randomUUID();
    governanceActorId = randomUUID();
    await t.prisma.user.createMany({
      data: [ownerId, governanceActorId].map((id) => ({
        id,
        email: `synthetic-${id}@example.invalid`,
        normalizedEmail: `synthetic-${id}@example.invalid`,
        passwordHash: 'synthetic-e2e-not-used-for-auth',
        role: UserRole.INVESTOR,
        emailVerifiedAt: new Date('2025-01-01T00:00:00.000Z'),
      })),
    });
  });

  function principal(userId: string) {
    return { userId, role: UserRole.INVESTOR, sessionId: randomUUID() };
  }

  async function createCorporateDraft(suffix: string = randomUUID()) {
    return bootstrap.createDraft(principal(ownerId), {
      institutionName: 'Synthetic Ruleset Test Holdings Ltd',
      dateOfIncorporation: '2020-01-02',
      rcNumber: `RC-${suffix.slice(0, 12)}`,
      businessPhoneNumber: '+2348000000000',
      businessEmail: `synthetic-${suffix}@example.invalid`,
    }, `draft-${suffix}`);
  }

  async function createPublishedSyntheticRuleset(
    accountKind: OnboardingApplicationKind,
    keySuffix: string,
    complete = true,
  ) {
    const created = await draftService.createRuleset(principal(governanceActorId), {
      rulesetKey: `synthetic-${keySuffix}`,
      accountKind,
    });
    if (complete) {
      await draftService.replaceDraftDefinitions(principal(governanceActorId), created.rulesetVersionId, syntheticDefinitionsFor(accountKind));
    }
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

  it('starts with no default approved ruleset; draft identity/version creation is consistent and empty by default', async () => {
    expect(await t.prisma.verificationRulesetVersion.count({ where: { lifecycle: VerificationRulesetLifecycle.PUBLISHED } })).toBe(0);
    const first = await draftService.createRuleset(principal(governanceActorId), {
      rulesetKey: 'synthetic-versioned-policy',
      accountKind: OnboardingApplicationKind.CORPORATE,
    });
    const second = await draftService.createNextDraftVersion(principal(governanceActorId), first.rulesetId);
    expect(first).toMatchObject({ version: 1, lifecycle: VerificationRulesetLifecycle.DRAFT });
    expect(second).toMatchObject({ rulesetId: first.rulesetId, version: 2, lifecycle: VerificationRulesetLifecycle.DRAFT });
    expect(await t.prisma.verificationRulesetVersion.count({ where: { rulesetId: first.rulesetId } })).toBe(2);
    expect(await t.prisma.verificationRulesetVersion.count({ where: { id: first.rulesetVersionId, subjectDefinitions: { some: {} } } })).toBe(0);
  });

  it('stores synthetic data-driven subjects/checks/sources/document conditions and blocks empty publication', async () => {
    const empty = await draftService.createRuleset(principal(governanceActorId), {
      rulesetKey: 'synthetic-empty-policy',
      accountKind: OnboardingApplicationKind.CORPORATE,
    });
    await expect(t.prisma.verificationRulesetVersion.update({
      where: { id: empty.rulesetVersionId },
      data: {
        lifecycle: VerificationRulesetLifecycle.PUBLISHED,
        approvedByUserId: governanceActorId,
        approvedAt: new Date(),
        publishedByUserId: governanceActorId,
        publishedAt: new Date(),
      },
    })).rejects.toThrow();
    expect(await t.prisma.verificationRulesetVersion.findUniqueOrThrow({ where: { id: empty.rulesetVersionId } }))
      .toMatchObject({ lifecycle: VerificationRulesetLifecycle.DRAFT, approvedAt: null, publishedAt: null });

    const populated = await draftService.createRuleset(principal(governanceActorId), {
      rulesetKey: 'synthetic-populated-policy',
      accountKind: OnboardingApplicationKind.CORPORATE,
    });
    await expect(draftService.replaceDraftDefinitions(principal(governanceActorId), populated.rulesetVersionId, syntheticDefinitionsFor(OnboardingApplicationKind.CORPORATE)))
      .resolves.toEqual({ rulesetVersionId: populated.rulesetVersionId, subjectCount: 1, checkCount: 1, evidenceSourceCount: 1, documentRequirementCount: 1 });
    const subject = await t.prisma.verificationSubjectDefinition.findFirstOrThrow({
      where: { rulesetVersionId: populated.rulesetVersionId },
      include: { checks: { include: { acceptedEvidenceSources: true } } },
    });
    expect(subject).toMatchObject({ subjectKey: 'synthetic-subject-only', checks: [{
      checkKindKey: 'synthetic-check-only',
      acceptedEvidenceSources: [{ evidenceSourceKey: 'synthetic-evidence-source-only' }],
    }] });
    await expect(t.prisma.conditionalDocumentRequirementDefinition.findFirstOrThrow({
      where: { rulesetVersionId: populated.rulesetVersionId },
    })).resolves.toMatchObject({
      documentKindKey: 'synthetic-document-kind-only',
      condition: { testFixture: 'not-a-real-policy' },
      completeness: { minimumFiles: 1, testFixture: 'not-a-real-policy' },
    });
  });

  it('makes published versions and their definitions immutable', async () => {
    const version = await createPublishedSyntheticRuleset(OnboardingApplicationKind.CORPORATE, 'immutable');
    await expect(t.prisma.verificationRulesetVersion.update({
      where: { id: version.id },
      data: { publishedAt: new Date() },
    })).rejects.toThrow();
    await expect(t.prisma.verificationSubjectDefinition.create({
      data: { rulesetVersionId: version.id, subjectKey: 'late-change' },
    })).rejects.toThrow();
    const nextDraft = await draftService.createNextDraftVersion(principal(governanceActorId), version.rulesetId);
    const publishedSubject = await t.prisma.verificationSubjectDefinition.findFirstOrThrow({
      where: { rulesetVersionId: version.id },
    });
    await expect(t.prisma.verificationSubjectDefinition.update({
      where: { id: publishedSubject.id },
      data: { rulesetVersionId: nextDraft.rulesetVersionId },
    })).rejects.toThrow();
    await expect(t.prisma.verificationSubjectDefinition.delete({ where: { id: publishedSubject.id } })).rejects.toThrow();
    const unchanged = await t.prisma.verificationRulesetVersion.findUniqueOrThrow({ where: { id: version.id } });
    expect(unchanged).toMatchObject({ lifecycle: VerificationRulesetLifecycle.PUBLISHED, publishedAt: new Date('2026-01-02T00:00:00.000Z') });
  });

  it('keeps DRAFT creation without a binding and blocks applicants from selecting a ruleset', async () => {
    const app = await createCorporateDraft();
    const version = await createPublishedSyntheticRuleset(OnboardingApplicationKind.CORPORATE, 'applicant-denial');
    await expect(t.prisma.onboardingApplicationRulesetBinding.findUnique({ where: { applicationId: app.applicationId } }))
      .resolves.toBeNull();
    allowedBindings.add(`${app.applicationId}:${version.id}`);
    await expect(bindingService.bindApprovedVersion(principal(ownerId), app.applicationId, version.id))
      .rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
    expect(await t.prisma.onboardingApplicationRulesetBinding.count()).toBe(0);
  });

  it('binds an exact approved version once, verifies account kind and writes its audit atomically', async () => {
    const app = await createCorporateDraft();
    const version = await createPublishedSyntheticRuleset(OnboardingApplicationKind.CORPORATE, 'bindable');
    allowedBindings.add(`${app.applicationId}:${version.id}`);

    const binding = await bindingService.bindApprovedVersion(principal(governanceActorId), app.applicationId, version.id);
    expect(binding).toMatchObject({ applicationId: app.applicationId, accountKind: OnboardingApplicationKind.CORPORATE, rulesetVersionId: version.id });
    const stored = await t.prisma.onboardingApplicationRulesetBinding.findUniqueOrThrow({
      where: { applicationId: app.applicationId },
      include: { events: true },
    });
    expect(stored).toMatchObject({ rulesetVersionId: version.id, boundByUserId: governanceActorId, events: [{ eventKind: 'BOUND', actorUserId: governanceActorId }] });
    expect(await t.prisma.onboardingApplicationRulesetPin.count()).toBe(0);
    const stillDraft = await t.prisma.onboardingApplication.findUniqueOrThrow({ where: { id: app.applicationId } });
    expect(stillDraft).toMatchObject({ status: OnboardingApplicationStatus.DRAFT, submittedByUserId: null, submittedAt: null });
    await expect(bindingService.bindApprovedVersion(principal(governanceActorId), app.applicationId, version.id))
      .rejects.toMatchObject({ status: 409, response: { code: 'CONFLICT' } });
    expect(await t.prisma.onboardingApplicationRulesetBinding.count({ where: { applicationId: app.applicationId } })).toBe(1);
  });

  it('rejects unapproved, wrong-kind, cross-application and unauthorized bindings', async () => {
    const app = await createCorporateDraft('corp-a');
    const otherApp = await createCorporateDraft('corp-b');
    const draft = await draftService.createRuleset(principal(governanceActorId), {
      rulesetKey: 'synthetic-unapproved', accountKind: OnboardingApplicationKind.CORPORATE,
    });
    const wrongKind = await createPublishedSyntheticRuleset(OnboardingApplicationKind.INDIVIDUAL, 'wrong-kind');
    allowedBindings.add(`${app.applicationId}:${draft.rulesetVersionId}`);
    allowedBindings.add(`${app.applicationId}:${wrongKind.id}`);

    await expect(bindingService.bindApprovedVersion(principal(governanceActorId), app.applicationId, draft.rulesetVersionId))
      .rejects.toMatchObject({ status: 409 });
    await expect(bindingService.bindApprovedVersion(principal(governanceActorId), app.applicationId, wrongKind.id))
      .rejects.toMatchObject({ status: 409 });
    // The composite PostgreSQL FK independently rejects a caller-supplied
    // account-kind mismatch even when bypassing the service.
    await expect(t.prisma.onboardingApplicationRulesetBinding.create({
      data: {
        applicationId: app.applicationId,
        accountKind: OnboardingApplicationKind.INDIVIDUAL,
        rulesetVersionId: wrongKind.id,
        boundByUserId: governanceActorId,
      },
    })).rejects.toThrow();
    await expect(bindingService.bindApprovedVersion(principal(governanceActorId), otherApp.applicationId, wrongKind.id))
      .rejects.toMatchObject({ status: 403 });
    expect(await t.prisma.onboardingApplicationRulesetBinding.count()).toBe(0);
  });

  it('serializes concurrent binding and rolls back when the audit write fails', async () => {
    const app = await createCorporateDraft('concurrent-binding');
    const version = await createPublishedSyntheticRuleset(OnboardingApplicationKind.CORPORATE, 'concurrent');
    allowedBindings.add(`${app.applicationId}:${version.id}`);
    const concurrent = await Promise.allSettled([
      bindingService.bindApprovedVersion(principal(governanceActorId), app.applicationId, version.id),
      bindingService.bindApprovedVersion(principal(governanceActorId), app.applicationId, version.id),
    ]);
    expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((concurrent.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason)
      .toMatchObject({ status: 409 });
    expect(await t.prisma.onboardingApplicationRulesetBinding.count({ where: { applicationId: app.applicationId } })).toBe(1);

    // Test-only database trigger forces the audit insert to fail after the
    // binding insert. Both writes must roll back in this verified local DB.
    const identity = await t.prisma.$queryRaw<Array<{ db: string; host: string; db_user: string }>>`
      SELECT current_database() AS db, host(inet_server_addr()) AS host, current_user AS db_user
    `;
    if (identity[0]?.db !== 'starfetch_test' || !['127.0.0.1', '::1'].includes(identity[0]?.host) || identity[0]?.db_user !== 'starfetch_test_role') {
      throw new Error('Refusing test-only trigger DDL on an unverified database.');
    }
    const rollbackApp = await createCorporateDraft('rollback-binding');
    const rollbackVersion = await createPublishedSyntheticRuleset(OnboardingApplicationKind.CORPORATE, 'rollback');
    allowedBindings.add(`${rollbackApp.applicationId}:${rollbackVersion.id}`);
    await t.prisma.$executeRawUnsafe(`
      CREATE FUNCTION "c13_test_fail_ruleset_audit"() RETURNS TRIGGER AS $$
      BEGIN RAISE EXCEPTION 'synthetic test-only audit failure'; END;
      $$ LANGUAGE plpgsql
    `);
    await t.prisma.$executeRawUnsafe(`
      CREATE TRIGGER "c13_test_fail_ruleset_audit_trigger"
      BEFORE INSERT ON "application_ruleset_binding_events"
      FOR EACH ROW EXECUTE FUNCTION "c13_test_fail_ruleset_audit"()
    `);
    try {
      await expect(bindingService.bindApprovedVersion(principal(governanceActorId), rollbackApp.applicationId, rollbackVersion.id))
        .rejects.toMatchObject({ status: 500 });
      expect(await t.prisma.onboardingApplicationRulesetBinding.count({ where: { applicationId: rollbackApp.applicationId } })).toBe(0);
      expect(await t.prisma.applicationRulesetBindingEvent.count({ where: { applicationId: rollbackApp.applicationId } })).toBe(0);
    } finally {
      await t.prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "c13_test_fail_ruleset_audit_trigger" ON "application_ruleset_binding_events"');
      await t.prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS "c13_test_fail_ruleset_audit"()');
    }
  });

  it('keeps submission and submission pinning unavailable without approved prerequisites', async () => {
    const app = await createCorporateDraft('no-submit');
    await request(t.server)
      .post(`/api/v1/onboarding/applications/${app.applicationId}/submit`)
      .set('Authorization', `Bearer ${principal(ownerId).sessionId}`)
      .send({})
      .expect(404);
    expect(await t.prisma.onboardingApplicationRulesetPin.count()).toBe(0);
    expect(await t.prisma.onboardingApplicationRulesetBinding.count()).toBe(0);
    await expect(t.prisma.onboardingApplication.findUniqueOrThrow({ where: { id: app.applicationId } }))
      .resolves.toMatchObject({ status: OnboardingApplicationStatus.DRAFT, submittedByUserId: null, submittedAt: null });
    expect(await t.prisma.verificationRulesetVersion.count({ where: { lifecycle: VerificationRulesetLifecycle.PUBLISHED } })).toBe(0);
  });
});
