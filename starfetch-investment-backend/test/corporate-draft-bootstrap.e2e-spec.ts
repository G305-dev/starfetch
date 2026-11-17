import { randomUUID } from 'crypto';
import { OnboardingApplicationKind, OnboardingApplicationStatus, UserRole } from '@prisma/client';
import request from 'supertest';
import { CorporateApplicationReadService } from '../src/modules/corporate-onboarding/services/corporate-application-read.service';
import { CorporateDetailsEditService } from '../src/modules/corporate-onboarding/services/corporate-details-edit.service';
import { CorporateDraftBootstrapService } from '../src/modules/corporate-onboarding/services/corporate-draft-bootstrap.service';
import { TestApp, cleanDatabase, createTestApp } from './utils/test-app';

const TEST_FINGERPRINT_KEY = 'test-only-non-tin-fingerprint-key-0123456789abcdef';
const INPUT = {
  institutionName: 'Synthetic Test Holdings Ltd',
  dateOfIncorporation: '2020-01-02',
  rcNumber: 'RC-TEST-001',
  businessPhoneNumber: '+2348000000000',
  businessEmail: 'corporate-test@example.invalid',
};

describe('C1.1A Corporate DRAFT foundation (e2e, designated local test DB only)', () => {
  let t: TestApp;
  let service: CorporateDraftBootstrapService;
  let reads: CorporateApplicationReadService;
  let edits: CorporateDetailsEditService;
  let userId: string;
  let databaseIdentityVerified = false;
  let originalFingerprintKey: string | undefined;

  beforeAll(async () => {
    // This key and all business values below are synthetic test data. No TIN is
    // accepted by the internal bootstrap service or written to PostgreSQL.
    originalFingerprintKey = process.env.CORPORATE_DRAFT_BOOTSTRAP_FINGERPRINT_HMAC_SECRET;
    process.env.CORPORATE_DRAFT_BOOTSTRAP_FINGERPRINT_HMAC_SECRET = TEST_FINGERPRINT_KEY;
    t = await createTestApp();
    service = t.app.get(CorporateDraftBootstrapService);
    reads = t.app.get(CorporateApplicationReadService);
    edits = t.app.get(CorporateDetailsEditService);

    // Verify actual server identity before the first destructive cleanup; the
    // cleanup helper independently repeats this identity check each time.
    const identity = await t.prisma.$queryRaw<Array<{ db: string; host: string; db_user: string }>>`
      SELECT current_database() AS db, host(inet_server_addr()) AS host, current_user AS db_user
    `;
    if (
      identity.length !== 1 ||
      identity[0].db !== 'starfetch_test' ||
      !['127.0.0.1', '::1'].includes(identity[0].host) ||
      identity[0].db_user !== 'starfetch_test_role'
    ) {
      throw new Error('E2E database is not the verified designated loopback starfetch_test target.');
    }
    databaseIdentityVerified = true;
    await cleanDatabase(t.prisma);
  }, 60_000);

  afterAll(async () => {
    if (t) {
      // Never perform cleanup unless beforeAll positively verified server
      // database/host/user identity; a failed connection is not a safe target.
      if (databaseIdentityVerified) await cleanDatabase(t.prisma);
      await t.app.close();
    }
    if (originalFingerprintKey === undefined) delete process.env.CORPORATE_DRAFT_BOOTSTRAP_FINGERPRINT_HMAC_SECRET;
    else process.env.CORPORATE_DRAFT_BOOTSTRAP_FINGERPRINT_HMAC_SECRET = originalFingerprintKey;
  }, 60_000);

  beforeEach(async () => {
    await cleanDatabase(t.prisma);
    userId = randomUUID();
    await t.prisma.user.create({
      data: {
        id: userId,
        email: `investor-${userId}@example.invalid`,
        normalizedEmail: `investor-${userId}@example.invalid`,
        passwordHash: 'synthetic-test-hash-not-used-for-auth',
        role: UserRole.INVESTOR,
        emailVerifiedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });
  });

  function principal(id = userId) {
    return { userId: id, role: UserRole.INVESTOR, sessionId: randomUUID() };
  }

  it('persists one account shell, DRAFT app, version-1 non-TIN details and creation history atomically', async () => {
    const receipt = await service.createDraft(principal(), INPUT, 'safe-create-1');
    const app = await t.prisma.onboardingApplication.findUniqueOrThrow({
      where: { id: receipt.applicationId },
      include: { corporateDetails: true, history: true },
    });
    expect(app).toMatchObject({
      kind: OnboardingApplicationKind.CORPORATE,
      ownerUserId: null,
      ownerJointAccountId: null,
      ownerCorporateAccountId: receipt.corporateAccountId,
      initiatingUserId: userId,
      status: OnboardingApplicationStatus.DRAFT,
      submittedByUserId: null,
      submittedAt: null,
    });
    expect(app.corporateDetails).toMatchObject({
      applicationId: receipt.applicationId,
      institutionName: INPUT.institutionName,
      rcNumber: INPUT.rcNumber,
      businessPhoneNumber: INPUT.businessPhoneNumber,
      businessEmail: INPUT.businessEmail,
      version: 1,
    });
    expect(Object.keys(app.corporateDetails ?? {})).not.toContain('taxIdentificationNumber');
    expect(app.history).toHaveLength(1);
    expect(app.history[0]).toMatchObject({
      event: 'CREATED',
      fromStatus: null,
      toStatus: 'DRAFT',
      actorUserId: userId,
    });
    expect(await t.prisma.corporateAccount.count()).toBe(1);
  });

  it('replays same key/payload, aliases same-initiator same payload across keys, and conflicts on changed payload', async () => {
    const first = await service.createDraft(principal(), INPUT, 'same-key');
    const replay = await service.createDraft(principal(), INPUT, 'same-key');
    const alias = await service.createDraft(principal(), INPUT, 'different-key');
    expect(replay).toEqual(first);
    expect(alias).toEqual(first);
    expect(await t.prisma.corporateAccount.count()).toBe(1);
    expect(await t.prisma.onboardingApplication.count()).toBe(1);
    expect(await t.prisma.corporateDraftIdempotencyKey.count()).toBe(2);

    await expect(service.createDraft(principal(), { ...INPUT, rcNumber: 'RC-CHANGED' }, 'same-key'))
      .rejects.toMatchObject({ status: 409 });
    expect(await t.prisma.corporateAccount.count()).toBe(1);
  });

  it('serializes concurrent identical creates without duplicate CorporateAccount shells', async () => {
    const [left, right] = await Promise.all([
      service.createDraft(principal(), INPUT, 'concurrent-left'),
      service.createDraft(principal(), INPUT, 'concurrent-right'),
    ]);
    expect(left).toEqual(right);
    expect(await t.prisma.corporateAccount.count()).toBe(1);
    expect(await t.prisma.onboardingApplication.count()).toBe(1);
  });

  it('rolls back the Corporate shell, application, details, history and receipts on a PostgreSQL write failure', async () => {
    // PostgreSQL text columns reject NUL. This synthetic failure occurs after
    // the CorporateAccount and application inserts inside the serializable
    // transaction, proving that no partial aggregate or idempotency receipt is committed.
    await expect(service.createDraft(principal(), {
      ...INPUT,
      institutionName: 'Synthetic\u0000Failure Holdings',
    }, 'rollback-key')).rejects.toMatchObject({ status: 500 });
    expect(await t.prisma.corporateAccount.count()).toBe(0);
    expect(await t.prisma.onboardingApplication.count()).toBe(0);
    expect(await t.prisma.corporateOnboardingDetails.count()).toBe(0);
    expect(await t.prisma.onboardingApplicationHistory.count()).toBe(0);
    expect(await t.prisma.corporateDraftCreation.count()).toBe(0);
    expect(await t.prisma.corporateDraftIdempotencyKey.count()).toBe(0);
  });

  it('does not deduplicate or reveal a cross-user matching business payload', async () => {
    const first = await service.createDraft(principal(), INPUT, 'user-one-key');
    const otherUserId = randomUUID();
    await t.prisma.user.create({
      data: {
        id: otherUserId,
        email: `other-${otherUserId}@example.invalid`,
        normalizedEmail: `other-${otherUserId}@example.invalid`,
        passwordHash: 'synthetic-test-hash-not-used-for-auth',
        role: UserRole.INVESTOR,
        emailVerifiedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });
    const second = await service.createDraft(principal(otherUserId), INPUT, 'user-two-key');
    expect(second.corporateAccountId).not.toBe(first.corporateAccountId);
    expect(second.applicationId).not.toBe(first.applicationId);
    expect(await t.prisma.corporateAccount.count()).toBe(2);
  });

  it('enforces D-09 active uniqueness and account-context XOR in PostgreSQL', async () => {
    const receipt = await service.createDraft(principal(), INPUT, 'owner-check');
    await expect(
      t.prisma.onboardingApplication.create({
        data: {
          kind: OnboardingApplicationKind.CORPORATE,
          ownerCorporateAccountId: receipt.corporateAccountId,
          initiatingUserId: userId,
          status: OnboardingApplicationStatus.DRAFT,
        },
      }),
    ).rejects.toThrow();

    await expect(
      t.prisma.onboardingApplication.create({
        data: {
          kind: OnboardingApplicationKind.CORPORATE,
          initiatingUserId: userId,
          status: OnboardingApplicationStatus.DRAFT,
        },
      }),
    ).rejects.toThrow();
  });

  it('keeps initiator and owner immutable and rejects DRAFT submission attribution changes', async () => {
    const receipt = await service.createDraft(principal(), INPUT, 'immutable-check');
    await expect(
      t.prisma.onboardingApplication.update({
        where: { id: receipt.applicationId },
        data: { initiatingUserId: randomUUID() },
      }),
    ).rejects.toThrow();
    await expect(
      t.prisma.onboardingApplication.update({
        where: { id: receipt.applicationId },
        data: { status: OnboardingApplicationStatus.SUBMITTED },
      }),
    ).rejects.toThrow();
    const stillDraft = await t.prisma.onboardingApplication.findUniqueOrThrow({ where: { id: receipt.applicationId } });
    expect(stillDraft.status).toBe(OnboardingApplicationStatus.DRAFT);
    expect(stillDraft.initiatingUserId).toBe(userId);
    expect(stillDraft.submittedByUserId).toBeNull();
    expect(stillDraft.submittedAt).toBeNull();
  });

  it('provides owner-scoped application/status/history reads with generic non-owner 404s', async () => {
    const receipt = await service.createDraft(principal(), INPUT, 'owner-read');
    const application = await reads.getApplication(principal(), receipt.applicationId);
    expect(application).toMatchObject({
      applicationId: receipt.applicationId,
      status: OnboardingApplicationStatus.DRAFT,
      details: { institutionName: INPUT.institutionName, version: 1 },
    });
    await expect(reads.getStatus(principal(), receipt.applicationId)).resolves.toEqual({
      corporateAccountId: receipt.corporateAccountId,
      applicationId: receipt.applicationId,
      status: OnboardingApplicationStatus.DRAFT,
    });
    const history = await reads.getHistory(principal(), receipt.applicationId);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ event: 'CREATED', fromStatus: null, toStatus: 'DRAFT' });

    const otherUserId = randomUUID();
    await t.prisma.user.create({
      data: {
        id: otherUserId,
        email: `reader-${otherUserId}@example.invalid`,
        normalizedEmail: `reader-${otherUserId}@example.invalid`,
        passwordHash: 'synthetic-test-hash-not-used-for-auth',
        role: UserRole.INVESTOR,
        emailVerifiedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });
    await expect(reads.getApplication(principal(otherUserId), receipt.applicationId))
      .rejects.toMatchObject({ status: 404, response: { code: 'NOT_FOUND', message: 'Application not found.' } });
    await expect(reads.getStatus(principal(otherUserId), receipt.applicationId)).rejects.toMatchObject({ status: 404 });
    await expect(reads.getHistory(principal(otherUserId), receipt.applicationId)).rejects.toMatchObject({ status: 404 });
  });

  it('updates one canonical details row optimistically only in DRAFT/INFO_REQUESTED and preserves application identity', async () => {
    const receipt = await service.createDraft(principal(), INPUT, 'owner-edit');
    const identityBefore = await t.prisma.onboardingApplication.findUniqueOrThrow({
      where: { id: receipt.applicationId },
      select: { id: true, kind: true, ownerCorporateAccountId: true, initiatingUserId: true },
    });

    const firstUpdate = await edits.updateDetails(principal(), receipt.applicationId, 1, {
      institutionName: 'Updated Synthetic Test Holdings Ltd',
    });
    expect(firstUpdate).toMatchObject({
      status: OnboardingApplicationStatus.DRAFT,
      details: { version: 2, institutionName: 'Updated Synthetic Test Holdings Ltd' },
    });
    const concurrent = await Promise.allSettled([
      edits.updateDetails(principal(), receipt.applicationId, 2, { businessPhoneNumber: '+2348111111111' }),
      edits.updateDetails(principal(), receipt.applicationId, 2, { businessEmail: 'race@example.invalid' }),
    ]);
    expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const rejectedRace = concurrent.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejectedRace.reason).toMatchObject({ status: 409, response: { code: 'CONFLICT' } });
    await expect(edits.updateDetails(principal(), receipt.applicationId, 1, { rcNumber: 'RC-STALE' }))
      .rejects.toMatchObject({ status: 409, response: { code: 'CONFLICT' } });

    const otherUserId = randomUUID();
    await t.prisma.user.create({
      data: {
        id: otherUserId,
        email: `editor-${otherUserId}@example.invalid`,
        normalizedEmail: `editor-${otherUserId}@example.invalid`,
        passwordHash: 'synthetic-test-hash-not-used-for-auth',
        role: UserRole.INVESTOR,
        emailVerifiedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });
    await expect(edits.updateDetails(principal(otherUserId), receipt.applicationId, 3, { rcNumber: 'RC-UNAUTHORIZED' }))
      .rejects.toMatchObject({ status: 404, response: { code: 'NOT_FOUND', message: 'Application not found.' } });

    await t.prisma.onboardingApplication.update({
      where: { id: receipt.applicationId },
      data: { status: OnboardingApplicationStatus.INFO_REQUESTED, submittedByUserId: userId, submittedAt: new Date() },
    });
    const secondUpdate = await edits.updateDetails(principal(), receipt.applicationId, 3, {
      rcNumber: 'RC-UPDATED-002',
    });
    expect(secondUpdate).toMatchObject({
      status: OnboardingApplicationStatus.INFO_REQUESTED,
      details: { version: 4, rcNumber: 'RC-UPDATED-002' },
    });

    await t.prisma.onboardingApplication.update({
      where: { id: receipt.applicationId },
      data: { status: OnboardingApplicationStatus.SUBMITTED },
    });
    await expect(edits.updateDetails(principal(), receipt.applicationId, 4, { rcNumber: 'RC-DISALLOWED' }))
      .rejects.toMatchObject({ status: 409, response: { code: 'CONFLICT' } });

    const identityAfter = await t.prisma.onboardingApplication.findUniqueOrThrow({
      where: { id: receipt.applicationId },
      select: { id: true, kind: true, ownerCorporateAccountId: true, initiatingUserId: true },
    });
    expect(identityAfter).toEqual(identityBefore);
    expect(await t.prisma.corporateOnboardingDetails.count({ where: { applicationId: receipt.applicationId } })).toBe(1);
    await expect(t.prisma.corporateOnboardingDetails.findUniqueOrThrow({ where: { applicationId: receipt.applicationId } }))
      .resolves.toMatchObject({ version: 4, rcNumber: 'RC-UPDATED-002', institutionName: 'Updated Synthetic Test Holdings Ltd' });
    // No unapproved revision/audit retention behavior is introduced by edits.
    expect(await t.prisma.onboardingApplicationHistory.count({ where: { applicationId: receipt.applicationId } })).toBe(1);
  });

  it('keeps the public O2 route behind its disabled-by-default feature gate', async () => {
    const response = await request(t.server)
      .post('/api/v1/corporate-accounts/applications')
      .send({ ...INPUT, taxIdentificationNumber: 'SYNTHETIC-NOT-A-REAL-TIN' })
      .expect(503);
    expect(response.body.error.code).toBe('FEATURE_UNAVAILABLE');
    expect(JSON.stringify(response.body)).not.toContain('SYNTHETIC-NOT-A-REAL-TIN');
    expect(await t.prisma.corporateAccount.count()).toBe(0);
    expect(await t.prisma.onboardingApplication.count()).toBe(0);
  });
});
