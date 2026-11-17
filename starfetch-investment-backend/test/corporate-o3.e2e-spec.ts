import { randomUUID } from 'crypto';
import { OnboardingApplicationStatus, UserRole } from '@prisma/client';
import request from 'supertest';
import { AccessTokenService } from '../src/modules/auth/services/access-token.service';
import { CsrfService } from '../src/modules/auth/services/csrf.service';
import { CORPORATE_O2_HMAC_KEYRING } from '../src/modules/corporate-onboarding/crypto/corporate-o2-hmac-keyring';
import {
  CORPORATE_TIN_ENCRYPTION_PROVIDER,
  TestCorporateTinEncryptionProvider,
} from '../src/modules/corporate-onboarding/crypto/corporate-tin-encryption';
import { CorporateO2AvailabilityService } from '../src/modules/corporate-onboarding/services/corporate-o2-availability.service';
import { CORPORATE_O2_RATE_LIMITER } from '../src/modules/corporate-onboarding/rate-limit/corporate-o2-rate-limiter';
import { TestApp, cleanDatabase, createTestApp } from './utils/test-app';

const O2_PATH = '/api/v1/corporate-accounts/applications';
const ORIGIN = 'http://localhost:3000';
const TIN = 'SYNTHETIC-TIN-NOT-A-REAL-CUSTOMER';
const INPUT = {
  institutionName: 'Synthetic O3 Read Holdings Ltd',
  dateOfIncorporation: '2020-01-02',
  rcNumber: 'RC-SYNTHETIC-O3-001',
  taxIdentificationNumber: TIN,
  businessPhoneNumber: '+2348000000000',
  businessEmail: 'synthetic-o3@example.invalid',
};
const testKeyring = {
  activeVersion: 'synthetic-hmac-v1',
  keys: [{ version: 'synthetic-hmac-v1', key: Buffer.alloc(32, 0x61) }],
};
const testEncryption = new TestCorporateTinEncryptionProvider(Buffer.alloc(32, 0x62));
const activeGate = { isAvailable: () => true, requireAvailable: jest.fn() };

describe('Corporate O3/O11 owner-scoped reads (synthetic data, isolated PostgreSQL only)', () => {
  let t: TestApp;
  let accessTokens: AccessTokenService;
  let csrf: CsrfService;
  let databaseIdentityVerified = false;

  beforeAll(async () => {
    t = await createTestApp({
      providerOverrides: [
        { provide: CorporateO2AvailabilityService, useValue: activeGate },
        { provide: CORPORATE_O2_RATE_LIMITER, useValue: { consumeUser: jest.fn().mockResolvedValue({ allowed: true }) } },
        { provide: CORPORATE_O2_HMAC_KEYRING, useValue: testKeyring },
        { provide: CORPORATE_TIN_ENCRYPTION_PROVIDER, useValue: testEncryption },
      ],
    });
    accessTokens = t.app.get(AccessTokenService);
    csrf = t.app.get(CsrfService);
    const identity = await t.prisma.$queryRaw<Array<{ db: string; host: string; db_user: string }>>`
      SELECT current_database() AS db, host(inet_server_addr()) AS host, current_user AS db_user
    `;
    if (identity.length !== 1 || identity[0].db !== 'starfetch_test' ||
      !['127.0.0.1', '::1'].includes(identity[0].host) || identity[0].db_user !== 'starfetch_test_role') {
      throw new Error('Corporate O3 E2E requires positively verified starfetch_test|127.0.0.1|starfetch_test_role.');
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
    testKeyring.activeVersion = 'synthetic-hmac-v1';
    testKeyring.keys = [{ version: 'synthetic-hmac-v1', key: Buffer.alloc(32, 0x61) }];
  });

  async function identity() {
    const userId = randomUUID();
    const sessionId = randomUUID();
    const future = new Date(Date.now() + 60 * 60 * 1000);
    await t.prisma.user.create({
      data: {
        id: userId,
        email: `o3-${userId}@example.invalid`,
        normalizedEmail: `o3-${userId}@example.invalid`,
        passwordHash: 'synthetic-e2e-test-only-not-a-real-password-hash',
        role: UserRole.INVESTOR,
        emailVerifiedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });
    await t.prisma.authSession.create({ data: { id: sessionId, userId, expiresAt: future, idleExpiresAt: future } });
    const token = await accessTokens.sign({ userId, role: UserRole.INVESTOR, sessionId });
    return { userId, sessionId, token, csrf: csrf.issue(sessionId) };
  }

  function postO2(auth: Awaited<ReturnType<typeof identity>>) {
    return request(t.server).post(O2_PATH)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${auth.token}`)
      .set('Cookie', `sf_csrf=${auth.csrf}`)
      .set('X-CSRF-Token', auth.csrf)
      .set('Idempotency-Key', 'synthetic-o3-bootstrap-key-001')
      .send(INPUT);
  }

  function getRead(auth: Awaited<ReturnType<typeof identity>>, corporateAccountId: string, suffix = '') {
    return request(t.server)
      .get(`/api/v1/corporate-accounts/${corporateAccountId}/onboarding${suffix}`)
      .set('Authorization', `Bearer ${auth.token}`);
  }

  async function createDraft(auth: Awaited<ReturnType<typeof identity>>) {
    const response = await postO2(auth).expect(201);
    return response.body.data as { corporateAccountId: string; applicationId: string; applicationStatus: 'DRAFT' };
  }

  it('returns only the owner’s approved masked details and lifecycle status using corporateAccountId mapping', async () => {
    const owner = await identity();
    const receipt = await createDraft(owner);
    expect(receipt.corporateAccountId).not.toBe(receipt.applicationId);

    const response = await getRead(owner, receipt.corporateAccountId).expect(200);
    expect(response.body.data).toMatchObject({
      corporateAccountId: receipt.corporateAccountId,
      applicationId: receipt.applicationId,
      status: 'DRAFT',
      details: {
        institutionName: INPUT.institutionName,
        dateOfIncorporation: '2020-01-02',
        rcNumber: INPUT.rcNumber,
        businessPhoneNumber: INPUT.businessPhoneNumber,
        businessEmail: INPUT.businessEmail,
        taxIdentificationNumberMasked: expect.stringMatching(/^[•]+OMER$/),
        version: 1,
      },
    });
    const json = JSON.stringify(response.body);
    expect(json).not.toContain(TIN);
    expect(json).not.toMatch(/ciphertext|authTag|encryptedDataKey|keyVersion|keyId|HMAC|fingerprint|initiatingUserId|submittedByUserId/i);
  });

  it('returns permitted history only after owner authorization and excludes actor/internal authorization fields', async () => {
    const owner = await identity();
    const receipt = await createDraft(owner);
    const response = await getRead(owner, receipt.corporateAccountId, '/history').expect(200);
    expect(response.body.data).toEqual({
      corporateAccountId: receipt.corporateAccountId,
      applicationId: receipt.applicationId,
      detailsAmendments: [],
      history: [expect.objectContaining({
        event: 'CREATED',
        fromStatus: null,
        toStatus: OnboardingApplicationStatus.DRAFT,
      })],
    });
    const json = JSON.stringify(response.body);
    expect(json).not.toMatch(/actorUserId|submittedByUserId|initiatingUserId|staff|compliance|permission|authorization/i);
  });

  it('returns the same generic 404 for non-owner, missing account, malformed ID, or an applicationId used as accountId', async () => {
    const owner = await identity();
    const other = await identity();
    const receipt = await createDraft(owner);
    const nonOwner = await getRead(other, receipt.corporateAccountId).expect(404);
    const missing = await getRead(owner, randomUUID()).expect(404);
    const malformed = await getRead(owner, 'not-a-uuid').expect(404);
    const wrongIdentifierType = await getRead(owner, receipt.applicationId).expect(404);
    const errors = [nonOwner, missing, malformed, wrongIdentifierType].map(({ body }) => ({
      code: body.error.code,
      message: body.error.message,
    }));
    expect(errors).toEqual(Array.from({ length: 4 }, () => ({
      code: 'NOT_FOUND',
      message: 'Application not found.',
    })));

    const nonOwnerHistory = await getRead(other, receipt.corporateAccountId, '/history').expect(404);
    expect({ code: nonOwnerHistory.body.error.code, message: nonOwnerHistory.body.error.message }).toEqual(errors[0]);
  });

  it('requires a current authenticated investor session and verified applicant context', async () => {
    await request(t.server).get(`/api/v1/corporate-accounts/${randomUUID()}/onboarding`).expect(401);
    const owner = await identity();
    const receipt = await createDraft(owner);
    const revokedSessionUser = await identity();
    await t.prisma.authSession.update({ where: { id: revokedSessionUser.sessionId }, data: { revokedAt: new Date() } });
    await getRead(revokedSessionUser, receipt.corporateAccountId).expect(401);
    const staff = await identity();
    await t.prisma.user.update({ where: { id: staff.userId }, data: { role: UserRole.STAFF } });
    await getRead(staff, receipt.corporateAccountId).expect(403);
  });

  it('requires If-Match for O4 and exposes no submission, approval, or investment mutation route', async () => {
    const owner = await identity();
    const receipt = await createDraft(owner);
    const base = `/api/v1/corporate-accounts/${receipt.corporateAccountId}/onboarding`;
    const headers = {
      Origin: ORIGIN,
      Authorization: `Bearer ${owner.token}`,
      Cookie: `sf_csrf=${owner.csrf}`,
      'X-CSRF-Token': owner.csrf,
    };
    await request(t.server).patch(`${base}/draft`).set(headers).send({ institutionName: 'Synthetic missing-version update' }).expect(400);
    await request(t.server).post(`${base}/submit`).set(headers).send({}).expect(404);
    await request(t.server).post(`${base}/approval`).set(headers).send({}).expect(404);
    await request(t.server).post(`${base}/investment-activation`).set(headers).send({}).expect(404);
    const application = await t.prisma.onboardingApplication.findUniqueOrThrow({ where: { id: receipt.applicationId } });
    expect(application.status).toBe(OnboardingApplicationStatus.DRAFT);
    expect(await t.prisma.onboardingApplicationHistory.count({ where: { applicationId: receipt.applicationId } })).toBe(1);
  });
});
