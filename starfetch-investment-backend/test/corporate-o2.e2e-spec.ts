import { randomUUID } from 'crypto';
import { OnboardingApplicationStatus, UserRole } from '@prisma/client';
import { ServiceUnavailableException } from '@nestjs/common';
import request from 'supertest';
import { AccessTokenService } from '../src/modules/auth/services/access-token.service';
import { CsrfService } from '../src/modules/auth/services/csrf.service';
import { CorporateO2AvailabilityService } from '../src/modules/corporate-onboarding/services/corporate-o2-availability.service';
import {
  CORPORATE_O2_HMAC_KEYRING,
} from '../src/modules/corporate-onboarding/crypto/corporate-o2-hmac-keyring';
import {
  CORPORATE_TIN_ENCRYPTION_PROVIDER,
  TestCorporateTinEncryptionProvider,
} from '../src/modules/corporate-onboarding/crypto/corporate-tin-encryption';
import { CorporateApplicationReadService } from '../src/modules/corporate-onboarding/services/corporate-application-read.service';
import { TestApp, cleanDatabase, createTestApp } from './utils/test-app';

const PATH = '/api/v1/corporate-accounts/applications';
const ORIGIN = 'http://localhost:3000';
const SYNTHETIC_TIN = 'SYNTHETIC-TIN-NOT-A-REAL-CUSTOMER';
const INPUT = {
  institutionName: 'Synthetic O2 Test Holdings Ltd',
  dateOfIncorporation: '2020-01-02',
  rcNumber: 'RC-SYNTHETIC-O2-001',
  taxIdentificationNumber: SYNTHETIC_TIN,
  businessPhoneNumber: '+2348000000000',
  businessEmail: 'synthetic-o2@example.invalid',
};

const testKeyring: { activeVersion: string; keys: Array<{ version: string; key: Buffer }> } = {
  activeVersion: 'synthetic-hmac-v1',
  keys: [{ version: 'synthetic-hmac-v1', key: Buffer.alloc(32, 0x41) }],
};
const testEncryption = new TestCorporateTinEncryptionProvider(Buffer.alloc(32, 0x52));
const activeGate = {
  isAvailable: () => true,
  requireAvailable: jest.fn(),
};

describe('Corporate O2 DRAFT API (synthetic data, verified local PostgreSQL only)', () => {
  let t: TestApp;
  let accessTokens: AccessTokenService;
  let csrf: CsrfService;
  let reads: CorporateApplicationReadService;
  let databaseIdentityVerified = false;

  beforeAll(async () => {
    t = await createTestApp({
      providerOverrides: [
        { provide: CorporateO2AvailabilityService, useValue: activeGate },
        { provide: CORPORATE_O2_HMAC_KEYRING, useValue: testKeyring },
        { provide: CORPORATE_TIN_ENCRYPTION_PROVIDER, useValue: testEncryption },
      ],
    });
    accessTokens = t.app.get(AccessTokenService);
    csrf = t.app.get(CsrfService);
    reads = t.app.get(CorporateApplicationReadService);
    const identity = await t.prisma.$queryRaw<Array<{ db: string; host: string; db_user: string }>>`
      SELECT current_database() AS db, host(inet_server_addr()) AS host, current_user AS db_user
    `;
    if (identity.length !== 1 || identity[0].db !== 'starfetch_test' ||
      !['127.0.0.1', '::1'].includes(identity[0].host) || identity[0].db_user !== 'starfetch_test_role') {
      throw new Error('Corporate O2 E2E requires positively verified starfetch_test|127.0.0.1|starfetch_test_role.');
    }
    databaseIdentityVerified = true;
    await cleanDatabase(t.prisma);
  }, 60_000);

  afterAll(async () => {
    if (t) {
      if (databaseIdentityVerified) await cleanDatabase(t.prisma);
      await t.app.close();
    }
  }, 60_000);

  beforeEach(async () => {
    await cleanDatabase(t.prisma);
    activeGate.requireAvailable.mockClear();
    testKeyring.activeVersion = 'synthetic-hmac-v1';
    testKeyring.keys = [{ version: 'synthetic-hmac-v1', key: Buffer.alloc(32, 0x41) }];
  });

  async function identity(verified = true, role: UserRole = UserRole.INVESTOR) {
    const userId = randomUUID();
    const sessionId = randomUUID();
    const future = new Date(Date.now() + 60 * 60 * 1000);
    await t.prisma.user.create({
      data: {
        id: userId,
        email: `o2-${userId}@example.invalid`,
        normalizedEmail: `o2-${userId}@example.invalid`,
        passwordHash: 'synthetic-e2e-test-only-not-a-real-password-hash',
        role,
        emailVerifiedAt: verified ? new Date('2025-01-01T00:00:00.000Z') : null,
      },
    });
    await t.prisma.authSession.create({ data: { id: sessionId, userId, expiresAt: future, idleExpiresAt: future } });
    const token = await accessTokens.sign({ userId, role, sessionId });
    return { userId, sessionId, token, csrf: csrf.issue(sessionId) };
  }

  function post(auth?: Awaited<ReturnType<typeof identity>>, key = 'synthetic-idempotency-key-001', body: unknown = INPUT) {
    let call = request(t.server).post(PATH).set('Origin', ORIGIN).set('Idempotency-Key', key).send(body as object);
    if (auth) {
      call = call
        .set('Authorization', `Bearer ${auth.token}`)
        .set('Cookie', `sf_csrf=${auth.csrf}`)
        .set('X-CSRF-Token', auth.csrf);
    }
    return call;
  }

  it('creates one authenticated verified-owner DRAFT and persists only the encrypted TIN envelope', async () => {
    const auth = await identity();
    const response = await post(auth).expect(201);
    expect(response.body).toMatchObject({
      data: {
        applicationId: expect.any(String),
        corporateAccountId: expect.any(String),
        applicationStatus: 'DRAFT',
        detailsVersion: 1,
      },
      meta: { requestId: expect.any(String) },
    });
    expect(JSON.stringify(response.body)).not.toContain(SYNTHETIC_TIN);

    const app = await t.prisma.onboardingApplication.findUniqueOrThrow({
      where: { id: response.body.data.applicationId },
      include: { corporateDetails: true },
    });
    expect(app).toMatchObject({
      initiatingUserId: auth.userId,
      ownerCorporateAccountId: response.body.data.corporateAccountId,
      status: OnboardingApplicationStatus.DRAFT,
      submittedByUserId: null,
      submittedAt: null,
    });
    expect(app.corporateDetails).toMatchObject({
      institutionName: INPUT.institutionName,
      rcNumber: INPUT.rcNumber,
      taxIdentificationNumberKeyProvider: 'TEST_AES_GCM',
      taxIdentificationNumberKeyVersion: 'test-v1',
      taxIdentificationNumberContextVersion: 1,
      version: 1,
    });
    expect(app.corporateDetails?.taxIdentificationNumberCiphertext).not.toContain(SYNTHETIC_TIN);
    expect(JSON.stringify(app.corporateDetails)).not.toContain(SYNTHETIC_TIN);
    expect(app.corporateDetails).not.toHaveProperty('taxIdentificationNumber');

    const storedFingerprint = await t.prisma.corporateDraftCreation.findFirstOrThrow({
      where: { applicationId: app.id },
    });
    expect(storedFingerprint.payloadFingerprintHmac).toMatch(/^[0-9a-f]{64}$/);
    expect(storedFingerprint.payloadFingerprintHmac).not.toContain(SYNTHETIC_TIN);
    expect(JSON.stringify(storedFingerprint.receipt)).not.toContain(SYNTHETIC_TIN);

    const projection = await reads.getApplication({ userId: auth.userId, role: UserRole.INVESTOR, sessionId: auth.sessionId }, app.id);
    expect(projection.details.taxIdentificationNumberMasked).toMatch(/^[•]+OMER$/);
    expect(JSON.stringify(projection)).not.toContain(SYNTHETIC_TIN);
  });

  it('replays same-key requests, aliases same-user duplicate content, and conflicts on key/payload mismatch', async () => {
    const auth = await identity();
    const first = await post(auth, 'same-synthetic-key-001').expect(201);
    const replay = await post(auth, 'same-synthetic-key-001').expect(201);
    const alias = await post(auth, 'different-synthetic-key-002').expect(201);
    expect(replay.body.data).toEqual(first.body.data);
    expect(alias.body.data).toEqual(first.body.data);
    expect(await t.prisma.corporateAccount.count()).toBe(1);
    expect(await t.prisma.onboardingApplication.count()).toBe(1);
    expect(await t.prisma.corporateDraftIdempotencyKey.count({ where: { operation: 'CORPORATE_DRAFT_BOOTSTRAP_O2_V1' } })).toBe(2);

    await post(auth, 'same-synthetic-key-001', { ...INPUT, rcNumber: 'RC-DIFFERENT-SYNTHETIC' })
      .expect(409)
      .expect((res) => expect(res.body.error.code).toBe('CONFLICT'));
  });

  it('supports HMAC key rotation by checking retained versions and recording the active version on new keys', async () => {
    const auth = await identity();
    const first = await post(auth, 'rotation-key-before-001').expect(201);
    testKeyring.keys = [
      { version: 'synthetic-hmac-v1', key: Buffer.alloc(32, 0x41) },
      { version: 'synthetic-hmac-v2', key: Buffer.alloc(32, 0x42) },
    ];
    testKeyring.activeVersion = 'synthetic-hmac-v2';
    const replay = await post(auth, 'rotation-key-after-002').expect(201);
    expect(replay.body.data).toEqual(first.body.data);
    expect(await t.prisma.onboardingApplication.count()).toBe(1);
    const keys = await t.prisma.corporateDraftIdempotencyKey.findMany({
      where: { operation: 'CORPORATE_DRAFT_BOOTSTRAP_O2_V1' }, orderBy: { createdAt: 'asc' },
    });
    expect(keys.map((entry) => entry.idempotencyHmacVersion).sort()).toEqual(['synthetic-hmac-v1', 'synthetic-hmac-v2']);
  });

  it('does not merge or disclose equal content across authenticated users', async () => {
    const firstUser = await identity();
    const secondUser = await identity();
    const first = await post(firstUser, 'user-one-key-001').expect(201);
    const second = await post(secondUser, 'user-two-key-001').expect(201);
    expect(second.body.data.applicationId).not.toBe(first.body.data.applicationId);
    expect(second.body.data.corporateAccountId).not.toBe(first.body.data.corporateAccountId);
    expect(await t.prisma.corporateAccount.count()).toBe(2);
    expect(await t.prisma.onboardingApplication.count()).toBe(2);
    await expect(reads.getApplication(
      { userId: secondUser.userId, role: UserRole.INVESTOR, sessionId: secondUser.sessionId },
      first.body.data.applicationId,
    )).rejects.toMatchObject({ status: 404 });
  });

  it('is concurrency-safe for same-key retries and same-user duplicate payloads', async () => {
    const auth = await identity();
    const [a, b] = await Promise.all([
      post(auth, 'concurrent-o2-key-001').expect(201),
      post(auth, 'concurrent-o2-key-001').expect(201),
    ]);
    expect(a.body.data).toEqual(b.body.data);
    const [c, d] = await Promise.all([
      post(auth, 'concurrent-o2-key-002', { ...INPUT, rcNumber: 'RC-SYNTHETIC-O2-CONCURRENT-2' }).expect(201),
      post(auth, 'concurrent-o2-key-003', { ...INPUT, rcNumber: 'RC-SYNTHETIC-O2-CONCURRENT-2' }).expect(201),
    ]);
    expect(c.body.data).toEqual(d.body.data);
    expect(await t.prisma.onboardingApplication.count()).toBe(2);
    expect(await t.prisma.corporateAccount.count()).toBe(2);
  });

  it('rolls back every account/application row when encryption fails inside the transaction', async () => {
    const auth = await identity();
    const spy = jest.spyOn(testEncryption, 'encrypt').mockRejectedValueOnce(
      new ServiceUnavailableException({ code: 'SERVICE_UNAVAILABLE', message: 'Corporate registration is temporarily unavailable.' }),
    );
    await post(auth, 'encryption-failure-key-001').expect(503);
    expect(await t.prisma.corporateAccount.count()).toBe(0);
    expect(await t.prisma.onboardingApplication.count()).toBe(0);
    expect(await t.prisma.corporateOnboardingDetails.count()).toBe(0);
    expect(await t.prisma.corporateDraftCreation.count()).toBe(0);
    expect(await t.prisma.corporateDraftIdempotencyKey.count()).toBe(0);
    spy.mockRestore();
  });

  it('fails before writes when the dedicated O2 HMAC keyring is absent', async () => {
    const auth = await identity();
    testKeyring.keys = [];
    await post(auth, 'missing-hmac-key-001').expect(503);
    expect(await t.prisma.corporateAccount.count()).toBe(0);
    expect(await t.prisma.onboardingApplication.count()).toBe(0);
  });

  it('requires session authentication, verified email, allowed origin, and valid session-bound CSRF', async () => {
    await post(undefined).expect(401);
    const unverified = await identity(false);
    await post(unverified).expect(403).expect((res) => expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED'));
    const verified = await identity();
    await request(t.server).post(PATH).set('Origin', ORIGIN).set('Authorization', `Bearer ${verified.token}`)
      .set('Idempotency-Key', 'missing-csrf-key-001').send(INPUT)
      .expect(403).expect((res) => expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED'));
    await request(t.server).post(PATH).set('Origin', 'https://untrusted.example')
      .set('Authorization', `Bearer ${verified.token}`).set('Cookie', `sf_csrf=${verified.csrf}`)
      .set('X-CSRF-Token', verified.csrf).set('Idempotency-Key', 'bad-origin-key-001').send(INPUT)
      .expect(403).expect((res) => expect(res.body.error.code).toBe('FORBIDDEN'));
  });

  it('rejects extra identity/authorization fields and a missing idempotency header without persistence', async () => {
    const auth = await identity();
    await post(auth, 'bad-body-key-001', { ...INPUT, initiatingUserId: randomUUID(), submittedByUserId: auth.userId })
      .expect(400);
    const missingKey = await request(t.server).post(PATH).set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${auth.token}`).set('Cookie', `sf_csrf=${auth.csrf}`)
      .set('X-CSRF-Token', auth.csrf).send(INPUT).expect(400);
    expect(missingKey.body.error.code).toBe('VALIDATION_FAILED');
    expect(await t.prisma.onboardingApplication.count()).toBe(0);
  });
});
