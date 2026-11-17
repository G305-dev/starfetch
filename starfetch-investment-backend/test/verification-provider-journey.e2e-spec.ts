import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { OnboardingApplicationKind, UserRole, VerificationRulesetLifecycle, VerificationSubjectTargetKind } from '@prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { MonoProveAdapter } from '../src/modules/verification-providers/mono/mono-prove.adapter';
import { MonoProveWebhookProcessor } from '../src/modules/verification-providers/mono/mono-prove-webhook.processor';
import { PrismaMonoEvidenceJournal } from '../src/modules/verification-providers/mono/prisma-mono-evidence-journal';
import { MonoHttpTransport } from '../src/modules/verification-providers/mono/mono-verification-ports';
import { VerificationConsentService } from '../src/modules/verification-providers/verification-consent.service';
import { VerificationOperationKeyring } from '../src/modules/verification-providers/verification-operation-keyring';
import { ApplicationRulesetBindingService } from '../src/modules/verification-rulesets/services/application-ruleset-binding.service';
import { ApplicationVerificationSnapshotService } from '../src/modules/verification-rulesets/services/application-verification-snapshot.service';
import { VerificationRulesetDraftService } from '../src/modules/verification-rulesets/services/verification-ruleset-draft.service';
import { VERIFICATION_RULESET_BINDING_AUTHORIZER } from '../src/modules/verification-rulesets/security/ruleset-binding-authorizer';
import { VERIFICATION_RULESET_AUTHORING_AUTHORIZER } from '../src/modules/verification-rulesets/security/ruleset-authoring-authorizer';
import { TestApp, cleanDatabase, createTestApp } from './utils/test-app';

const keyring: VerificationOperationKeyring = {
  activeVersion: 'synthetic-verification-hmac-v1',
  keys: [{ version: 'synthetic-verification-hmac-v1', key: Buffer.alloc(32, 41) }],
};
const consentPolicy = {
  enabled: true,
  environment: 'sandbox',
  secretKey: 'synthetic-mono-prove-key-not-a-credential',
  webhookSecret: 'synthetic-mono-webhook-not-a-credential',
  redirectUrl: 'https://app.starfetch.example/verify',
  consentTextVersion: 'synthetic-consent-v1',
  consentTextSha256: 'a'.repeat(64),
  privacyNoticeVersion: 'synthetic-privacy-v1',
  lawfulBasisVersion: 'synthetic-lawful-basis-v1',
  lawfulBasisApproved: true,
  privacyNoticeApproved: true,
  consentTextApproved: true,
};

function config(): ConfigService {
  return { get: (key: string) => key === 'corporate.mono' ? consentPolicy : undefined } as unknown as ConfigService;
}

describe('Synthetic Mono Prove journey with PostgreSQL consent, evidence and atomic webhook replay (isolated test DB only)', () => {
  let t: TestApp;
  let databaseIdentityVerified = false;
  let ownerId: string;
  let governanceId: string;
  let applicationId: string;
  let requirementId: string;
  let consentService: VerificationConsentService;
  let evidenceJournal: PrismaMonoEvidenceJournal;
  let draftService: VerificationRulesetDraftService;
  let bindingService: ApplicationRulesetBindingService;
  let snapshotService: ApplicationVerificationSnapshotService;

  const authorizer = {
    authorizeDraftWrite: jest.fn(async ({ principal }: { principal: { userId: string } }) => principal.userId === governanceId),
  };
  const binder = {
    authorizeInitialBinding: jest.fn(async ({ principal }: { principal: { userId: string } }) => principal.userId === governanceId),
  };

  const principal = (userId: string, role: UserRole = UserRole.INVESTOR) => ({ userId, role, sessionId: randomUUID() });

  beforeAll(async () => {
    t = await createTestApp({
      providerOverrides: [
        { provide: VERIFICATION_RULESET_AUTHORING_AUTHORIZER, useValue: authorizer },
        { provide: VERIFICATION_RULESET_BINDING_AUTHORIZER, useValue: binder },
      ],
    });
    draftService = t.app.get(VerificationRulesetDraftService);
    bindingService = t.app.get(ApplicationRulesetBindingService);
    snapshotService = t.app.get(ApplicationVerificationSnapshotService);
    const identity = await t.prisma.$queryRaw<Array<{ db: string; host: string; db_user: string }>>`
      SELECT current_database() AS db, host(inet_server_addr()) AS host, current_user AS db_user
    `;
    if (identity.length !== 1 || identity[0].db !== 'starfetch_test' ||
      !['127.0.0.1', '::1'].includes(identity[0].host) || identity[0].db_user !== 'starfetch_test_role') {
      throw new Error('Synthetic provider journey requires the verified isolated starfetch_test database.');
    }
    databaseIdentityVerified = true;
  }, 60_000);

  afterAll(async () => {
    if (t) {
      if (databaseIdentityVerified) await cleanDatabase(t.prisma);
      await t.app.close();
    }
  }, 60_000);

  beforeEach(async () => {
    await cleanDatabase(t.prisma);
    ownerId = randomUUID();
    governanceId = randomUUID();
    authorizer.authorizeDraftWrite.mockClear();
    binder.authorizeInitialBinding.mockClear();
    await t.prisma.user.createMany({
      data: [
        { id: ownerId, email: `synthetic-${ownerId}@example.invalid`, normalizedEmail: `synthetic-${ownerId}@example.invalid`, passwordHash: 'synthetic-test-only', role: UserRole.INVESTOR, emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z') },
        { id: governanceId, email: `synthetic-${governanceId}@example.invalid`, normalizedEmail: `synthetic-${governanceId}@example.invalid`, passwordHash: 'synthetic-test-only', role: UserRole.ADMIN, emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z') },
      ],
    });
    const app = await t.prisma.onboardingApplication.create({
      data: { kind: OnboardingApplicationKind.INDIVIDUAL, ownerUserId: ownerId, initiatingUserId: ownerId },
    });
    applicationId = app.id;

    const created = await draftService.createRuleset(principal(governanceId, UserRole.ADMIN), {
      rulesetKey: `synthetic-mono-prove-${randomUUID()}`,
      accountKind: OnboardingApplicationKind.INDIVIDUAL,
    });
    await draftService.replaceDraftDefinitions(principal(governanceId, UserRole.ADMIN), created.rulesetVersionId, {
      requiredSubjects: [{
        subjectKey: 'synthetic-individual-applicant',
        targetKind: VerificationSubjectTargetKind.INDIVIDUAL_APPLICANT,
        requiredChecks: [{ checkKindKey: 'synthetic-mono-prove-check', acceptedEvidenceSourceKeys: ['mono_prove'] }],
      }],
      conditionalDocumentRequirements: [],
    });
    await t.prisma.verificationRulesetVersion.update({
      where: { id: created.rulesetVersionId },
      data: {
        lifecycle: VerificationRulesetLifecycle.PUBLISHED,
        approvedByUserId: governanceId,
        approvedAt: new Date('2026-01-01T00:00:00.000Z'),
        publishedByUserId: governanceId,
        publishedAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedByUserId: governanceId,
      },
    });
    await bindingService.bindApprovedVersion(principal(governanceId, UserRole.ADMIN), applicationId, created.rulesetVersionId);
    await snapshotService.createOrGetSnapshot(principal(ownerId), applicationId);
    const requirement = await t.prisma.applicationVerificationRequirement.findFirstOrThrow({
      where: { snapshot: { applicationId }, requirementKind: 'VERIFICATION_CHECK' },
    });
    requirementId = requirement.id;
    consentService = new VerificationConsentService(t.prisma as PrismaService, config(), keyring);
    evidenceJournal = new PrismaMonoEvidenceJournal(t.prisma as PrismaService, keyring);
  }, 60_000);

  it('persists versioned consent, performs only a synthetic request, atomically deduplicates webhook replay, and never stores customer identifiers', async () => {
    const consent = await consentService.recordGrant(principal(ownerId), {
      applicationId,
      providerKey: 'mono_prove',
      operationKey: 'synthetic-consent-operation-001',
      allowedIdentityKinds: ['bvn'],
    });
    const replay = await consentService.recordGrant(principal(ownerId), {
      applicationId,
      providerKey: 'mono_prove',
      operationKey: 'synthetic-consent-operation-001',
      allowedIdentityKinds: ['bvn'],
    });
    expect(replay.consentRecordId).toBe(consent.consentRecordId);
    expect(replay.idempotentReplay).toBe(true);

    const transport: jest.Mocked<MonoHttpTransport> = {
      post: jest.fn(async (_url, _headers, _body, _timeout) => {
        void _url; void _headers; void _body; void _timeout;
        return { status: 200, body: { data: { id: 'PRV-SYNTHETIC-POSTGRES-01', url: 'https://verify.withmono.com/session/synthetic' } } };
      }),
    };
    const adapter = new MonoProveAdapter(config(), transport, consentService, evidenceJournal);
    const initiation = await adapter.initiate({
      applicationId,
      requirementId,
      actorUserId: ownerId,
      subjectUserId: ownerId,
      consentRecordId: consent.consentRecordId,
      operationKey: 'synthetic-provider-operation-001',
      identities: ['bvn'],
      customer: {
        name: 'Synthetic Applicant Only',
        phone: '+2348000000000',
        email: 'synthetic-applicant@example.invalid',
        identity: { number: '12345678901', type: 'bvn' },
      },
    });
    expect(initiation).toMatchObject({ status: 'PENDING', idempotentReplay: false });
    expect(transport.post).toHaveBeenCalledTimes(1);
    expect(transport.post.mock.calls[0][0]).toBe('https://api.withmono.com/v1/prove/initiate');

    const webhookProcessor = new MonoProveWebhookProcessor(config(), evidenceJournal);
    const syntheticWebhook = {
      event: 'mono.prove.data_verification_successful',
      data: {
        id: 'PRV-SYNTHETIC-POSTGRES-01',
        reference: initiation.status === 'PENDING' ? initiation.reference : '',
        status: 'successful',
        created_at: '2026-01-01T00:00:00.000Z',
        customer: { name: 'Should Not Persist', email: 'secret@example.invalid', identity: { number: '12345678901' } },
      },
    };
    const first = await webhookProcessor.process(consentPolicy.webhookSecret, syntheticWebhook);
    const duplicate = await webhookProcessor.process(consentPolicy.webhookSecret, syntheticWebhook);
    expect(first).toEqual({ duplicate: false, status: 'PROVIDER_VERIFIED' });
    expect(duplicate).toEqual({ duplicate: true, status: 'PROVIDER_VERIFIED' });

    const stored = await t.prisma.providerVerificationEvidenceEvent.findMany({
      include: { attempt: true },
      orderBy: { sequence: 'asc' },
    });
    expect(stored.map((event) => event.status)).toEqual(['PENDING', 'PROVIDER_VERIFIED']);
    const serialized = JSON.stringify(stored);
    for (const secret of ['Synthetic Applicant Only', 'synthetic-applicant@example.invalid', '12345678901', 'Should Not Persist', 'secret@example.invalid']) {
      expect(serialized).not.toContain(secret);
    }
    expect(stored[0].attempt.identityKinds).toEqual(['bvn']);
    expect(stored[0].attempt.operationKeyDigest).not.toContain('synthetic-provider-operation-001');

    await expect(t.prisma.providerVerificationEvidenceEvent.update({
      where: { id: stored[0].id }, data: { status: 'PROVIDER_FAILED' },
    })).rejects.toThrow();
    await expect(t.prisma.verificationConsentEvent.delete({ where: { id: consent.consentRecordId } })).rejects.toThrow();
    await expect(t.prisma.$executeRawUnsafe('TRUNCATE TABLE "provider_verification_evidence_events"')).rejects.toThrow(/cannot be truncated/);

    await consentService.withdraw(principal(ownerId), {
      applicationId,
      providerKey: 'mono_prove',
      operationKey: 'synthetic-consent-withdraw-001',
    });
    await expect(consentService.requireApprovedConsent({
      applicationId,
      requirementId,
      actorUserId: ownerId,
      subjectUserId: ownerId,
      consentRecordId: consent.consentRecordId,
      identities: ['bvn'],
    })).rejects.toThrow();
  }, 60_000);
});
