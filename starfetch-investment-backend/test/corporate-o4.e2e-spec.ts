import { randomUUID } from 'crypto';
import { OnboardingApplicationKind, OnboardingApplicationStatus, UserRole, VerificationRulesetLifecycle, VerificationSubjectTargetKind } from '@prisma/client';
import request from 'supertest';
import { AccessTokenService } from '../src/modules/auth/services/access-token.service';
import { CsrfService } from '../src/modules/auth/services/csrf.service';
import {
  CORPORATE_O2_HMAC_KEYRING,
} from '../src/modules/corporate-onboarding/crypto/corporate-o2-hmac-keyring';
import {
  CORPORATE_TIN_ENCRYPTION_PROVIDER,
  TestCorporateTinEncryptionProvider,
} from '../src/modules/corporate-onboarding/crypto/corporate-tin-encryption';
import { CorporateO2AvailabilityService } from '../src/modules/corporate-onboarding/services/corporate-o2-availability.service';
import { ApplicationRulesetBindingService } from '../src/modules/verification-rulesets/services/application-ruleset-binding.service';
import { VerificationRulesetDraftService } from '../src/modules/verification-rulesets/services/verification-ruleset-draft.service';
import { VERIFICATION_RULESET_AUTHORING_AUTHORIZER } from '../src/modules/verification-rulesets/security/ruleset-authoring-authorizer';
import { VERIFICATION_RULESET_BINDING_AUTHORIZER } from '../src/modules/verification-rulesets/security/ruleset-binding-authorizer';
import { TestApp, cleanDatabase, createTestApp } from './utils/test-app';

const ORIGIN = 'http://localhost:3000';
const O2_PATH = '/api/v1/corporate-accounts/applications';
const TEST_TIN = 'SYNTHETIC-O4-TIN-DO-NOT-USE';
const O2_INPUT = {
  institutionName: 'Synthetic O4 Test Holdings Ltd',
  dateOfIncorporation: '2020-01-02',
  rcNumber: 'RC-SYNTHETIC-O4-001',
  taxIdentificationNumber: 'SYNTHETIC-O4-INITIAL-TIN',
  businessPhoneNumber: '+2348000000000',
  businessEmail: 'synthetic-o4@example.invalid',
};
const keyring = {
  activeVersion: 'synthetic-hmac-v1',
  keys: [{ version: 'synthetic-hmac-v1', key: Buffer.alloc(32, 0x41) }],
};
const encryption = new TestCorporateTinEncryptionProvider(Buffer.alloc(32, 0x52));
const activeGate = { isAvailable: () => true, requireAvailable: jest.fn() };
const testAuthoringAuthorizer = { authorizeDraftWrite: jest.fn().mockResolvedValue(true) };
const testBindingAuthorizer = { authorizeInitialBinding: jest.fn().mockResolvedValue(true) };

describe('Corporate O4 draft amendments (synthetic data, isolated PostgreSQL)', () => {
  let t: TestApp;
  let accessTokens: AccessTokenService;
  let csrf: CsrfService;
  let databaseIdentityVerified = false;

  beforeAll(async () => {
    t = await createTestApp({
      providerOverrides: [
        { provide: CorporateO2AvailabilityService, useValue: activeGate },
        { provide: CORPORATE_O2_HMAC_KEYRING, useValue: keyring },
        { provide: CORPORATE_TIN_ENCRYPTION_PROVIDER, useValue: encryption },
        { provide: VERIFICATION_RULESET_AUTHORING_AUTHORIZER, useValue: testAuthoringAuthorizer },
        { provide: VERIFICATION_RULESET_BINDING_AUTHORIZER, useValue: testBindingAuthorizer },
      ],
    });
    accessTokens = t.app.get(AccessTokenService);
    csrf = t.app.get(CsrfService);
    const databaseIdentity = await t.prisma.$queryRaw<Array<{ db: string; host: string; db_user: string }>>`
      SELECT current_database() AS db, host(inet_server_addr()) AS host, current_user AS db_user
    `;
    if (databaseIdentity.length !== 1 || databaseIdentity[0].db !== 'starfetch_test' ||
      !['127.0.0.1', '::1'].includes(databaseIdentity[0].host) || databaseIdentity[0].db_user !== 'starfetch_test_role') {
      throw new Error('Corporate O4 E2E requires positively verified starfetch_test|loopback|starfetch_test_role.');
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
    testAuthoringAuthorizer.authorizeDraftWrite.mockClear();
    testBindingAuthorizer.authorizeInitialBinding.mockClear();
  });

  async function identity() {
    const userId = randomUUID();
    const sessionId = randomUUID();
    const future = new Date(Date.now() + 60 * 60 * 1000);
    await t.prisma.user.create({
      data: {
        id: userId,
        email: `o4-${userId}@example.invalid`,
        normalizedEmail: `o4-${userId}@example.invalid`,
        passwordHash: 'synthetic-o4-test-only-not-a-real-password-hash',
        role: UserRole.INVESTOR,
        emailVerifiedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });
    await t.prisma.authSession.create({ data: { id: sessionId, userId, expiresAt: future, idleExpiresAt: future } });
    const token = await accessTokens.sign({ userId, role: UserRole.INVESTOR, sessionId });
    return { userId, sessionId, token, csrf: csrf.issue(sessionId) };
  }

  function authenticatedCall(method: 'post' | 'patch' | 'get', path: string, auth: Awaited<ReturnType<typeof identity>>) {
    const call = request(t.server)[method](path)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${auth.token}`)
      .set('Cookie', `sf_csrf=${auth.csrf}`)
      .set('X-CSRF-Token', auth.csrf);
    return call;
  }

  async function createDraft(auth: Awaited<ReturnType<typeof identity>>) {
    const response = await authenticatedCall('post', O2_PATH, auth)
      .set('Idempotency-Key', `synthetic-o4-key-${randomUUID()}`)
      .send(O2_INPUT)
      .expect(201);
    return response.body.data as { corporateAccountId: string; applicationId: string };
  }

  it('completes a synthetic O2 → O4 → stale-check → immutable snapshot regeneration journey without claiming verification', async () => {
    const auth = await identity();
    const ids = await createDraft(auth);
    const principal = { userId: auth.userId, role: UserRole.INVESTOR, sessionId: auth.sessionId };
    const draftService = t.app.get(VerificationRulesetDraftService);
    const bindingService = t.app.get(ApplicationRulesetBindingService);
    const ruleset = await draftService.createRuleset(principal, {
      rulesetKey: `synthetic-corporate-o4-${randomUUID()}`,
      accountKind: OnboardingApplicationKind.CORPORATE,
    });
    await draftService.replaceDraftDefinitions(principal, ruleset.rulesetVersionId, {
      requiredSubjects: [{
        subjectKey: 'synthetic-entity',
        targetKind: VerificationSubjectTargetKind.CORPORATE_LEGAL_ENTITY,
        requiredChecks: [{ checkKindKey: 'synthetic-cac-check', acceptedEvidenceSourceKeys: ['synthetic-source-only'] }],
      }],
      conditionalDocumentRequirements: [],
    });
    await t.prisma.verificationRulesetVersion.update({
      where: { id: ruleset.rulesetVersionId },
      data: {
        lifecycle: VerificationRulesetLifecycle.PUBLISHED,
        approvedByUserId: auth.userId,
        approvedAt: new Date('2026-01-01T00:00:00.000Z'),
        publishedByUserId: auth.userId,
        publishedAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedByUserId: auth.userId,
      },
    });
    await bindingService.bindApprovedVersion(principal, ids.applicationId, ruleset.rulesetVersionId);

    const base = `/api/v1/corporate-accounts/${ids.corporateAccountId}/onboarding`;
    const firstSnapshot = await authenticatedCall('post', `${base}/verification-snapshot`, auth)
      .expect(200);
    expect(firstSnapshot.body.data).toMatchObject({ generation: 1, submissionEligible: false, idempotentReplay: false });

    const amendment = await authenticatedCall('patch', `${base}/draft`, auth)
      .set('If-Match', '"1"')
      .send({ institutionName: 'Synthetic Journey Revised Holdings Ltd' });
    expect(amendment.status).toBe(200);
    const stale = await authenticatedCall('get', `${base}/verification-snapshot/freshness`, auth).expect(200);
    expect(stale.body.data).toMatchObject({
      generation: 1,
      isFresh: false,
      issues: ['CORPORATE_DETAILS_VERSION_CHANGED'],
    });

    const refreshed = await authenticatedCall('post', `${base}/verification-snapshot`, auth).expect(200);
    expect(refreshed.body.data).toMatchObject({ generation: 2, submissionEligible: false, idempotentReplay: false });
    expect(await t.prisma.applicationVerificationSnapshot.count({ where: { applicationId: ids.applicationId } })).toBe(2);
    const history = await authenticatedCall('get', `${base}/history`, auth).expect(200);
    expect(history.body.data.detailsAmendments).toEqual([
      expect.objectContaining({ version: 2, changedFieldNames: ['institutionName'] }),
    ]);
    expect(JSON.stringify(history.body)).not.toContain(TEST_TIN);
  });

  it('updates only the owner DRAFT with optimistic versioning and encrypted append-only history', async () => {
    const auth = await identity();
    const ids = await createDraft(auth);
    const path = `/api/v1/corporate-accounts/${ids.corporateAccountId}/onboarding/draft`;
    const update = await authenticatedCall('patch', path, auth)
      .set('If-Match', '"1"')
      .send({ institutionName: 'Synthetic O4 Revised Holdings Ltd', taxIdentificationNumber: TEST_TIN })
      .expect(200);

    expect(update.body.data).toMatchObject({
      applicationId: ids.applicationId,
      corporateAccountId: ids.corporateAccountId,
      status: OnboardingApplicationStatus.DRAFT,
      details: {
        institutionName: 'Synthetic O4 Revised Holdings Ltd',
        version: 2,
        taxIdentificationNumberMasked: expect.any(String),
      },
    });
    expect(JSON.stringify(update.body)).not.toContain(TEST_TIN);
    const canonical = await t.prisma.corporateOnboardingDetails.findUniqueOrThrow({
      where: { applicationId: ids.applicationId },
    });
    expect(canonical).toMatchObject({ version: 2, taxIdentificationNumberKeyProvider: 'TEST_AES_GCM' });
    expect(JSON.stringify(canonical)).not.toContain(TEST_TIN);

    const revision = await t.prisma.corporateDetailsRevision.findUniqueOrThrow({
      where: { applicationId_version: { applicationId: ids.applicationId, version: 2 } },
    });
    expect(revision.changedFieldNames).toEqual(['institutionName', 'taxIdentificationNumber']);
    expect(JSON.stringify(revision)).not.toContain(TEST_TIN);
    expect(JSON.stringify(revision.afterSnapshot)).toContain('taxIdentificationNumberEnvelope');

    const history = await authenticatedCall('get', `/api/v1/corporate-accounts/${ids.corporateAccountId}/onboarding/history`, auth)
      .expect(200);
    expect(history.body.data.detailsAmendments).toEqual([
      expect.objectContaining({ version: 2, changedFieldNames: ['institutionName', 'taxIdentificationNumber'] }),
    ]);
    expect(JSON.stringify(history.body)).not.toContain(TEST_TIN);

    await authenticatedCall('patch', path, auth)
      .set('If-Match', '"1"')
      .send({ rcNumber: 'RC-STALE-UPDATE' })
      .expect(409);
    expect(await t.prisma.corporateDetailsRevision.count({ where: { applicationId: ids.applicationId } })).toBe(1);
    expect(await t.prisma.corporateOnboardingDetails.findUniqueOrThrow({ where: { applicationId: ids.applicationId } }))
      .toMatchObject({ version: 2, rcNumber: O2_INPUT.rcNumber });
  });

  it('does not disclose applications across initiating users and lists only the caller-owned application', async () => {
    const owner = await identity();
    const outsider = await identity();
    const ids = await createDraft(owner);
    const list = await authenticatedCall('get', '/api/v1/me/corporate-accounts', owner).expect(200);
    expect(list.body.data).toEqual([
      expect.objectContaining({
        corporateAccountId: ids.corporateAccountId,
        applicationId: ids.applicationId,
        status: 'DRAFT',
        accessVia: 'INITIATING_APPLICANT',
      }),
    ]);
    const otherList = await authenticatedCall('get', '/api/v1/me/corporate-accounts', outsider).expect(200);
    expect(otherList.body.data).toEqual([]);

    await authenticatedCall('patch', `/api/v1/corporate-accounts/${ids.corporateAccountId}/onboarding/draft`, outsider)
      .set('If-Match', '"1"')
      .send({ rcNumber: 'RC-CROSS-ACCOUNT-ATTEMPT' })
      .expect(404);
    expect(await t.prisma.corporateOnboardingDetails.findUniqueOrThrow({ where: { applicationId: ids.applicationId } }))
      .toMatchObject({ version: 1, rcNumber: O2_INPUT.rcNumber });
  });

  it('serializes concurrent edits and never commits a partial amendment', async () => {
    const auth = await identity();
    const ids = await createDraft(auth);
    const path = `/api/v1/corporate-accounts/${ids.corporateAccountId}/onboarding/draft`;
    const results = await Promise.all([
      authenticatedCall('patch', path, auth).set('If-Match', '"1"').send({ institutionName: 'Concurrent A Synthetic Ltd' }),
      authenticatedCall('patch', path, auth).set('If-Match', '"1"').send({ institutionName: 'Concurrent B Synthetic Ltd' }),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await t.prisma.corporateOnboardingDetails.findUniqueOrThrow({ where: { applicationId: ids.applicationId } }))
      .toMatchObject({ version: 2 });
    expect(await t.prisma.corporateDetailsRevision.count({ where: { applicationId: ids.applicationId } })).toBe(1);
  });

  it('rolls back canonical details when immutable amendment history cannot be appended', async () => {
    const auth = await identity();
    const ids = await createDraft(auth);
    const databaseIdentity = await t.prisma.$queryRaw<Array<{ db: string; host: string; db_user: string }>>`
      SELECT current_database() AS db, host(inet_server_addr()) AS host, current_user AS db_user
    `;
    if (databaseIdentity[0]?.db !== 'starfetch_test' || !['127.0.0.1', '::1'].includes(databaseIdentity[0]?.host) ||
      databaseIdentity[0]?.db_user !== 'starfetch_test_role') {
      throw new Error('Refusing test-only trigger DDL on an unverified database.');
    }
    await t.prisma.$executeRawUnsafe(`
      CREATE FUNCTION "corporate_o4_test_fail_revision"() RETURNS TRIGGER AS $$
      BEGIN RAISE EXCEPTION 'synthetic test-only amendment failure'; END;
      $$ LANGUAGE plpgsql
    `);
    await t.prisma.$executeRawUnsafe(`
      CREATE TRIGGER "corporate_o4_test_fail_revision_trigger"
      BEFORE INSERT ON "corporate_details_revisions"
      FOR EACH ROW EXECUTE FUNCTION "corporate_o4_test_fail_revision"()
    `);
    try {
      const response = await authenticatedCall(
        'patch',
        `/api/v1/corporate-accounts/${ids.corporateAccountId}/onboarding/draft`,
        auth,
      ).set('If-Match', '"1"').send({ institutionName: 'Must Roll Back Synthetic Ltd' });
      expect(response.status).toBe(500);
      expect(await t.prisma.corporateOnboardingDetails.findUniqueOrThrow({ where: { applicationId: ids.applicationId } }))
        .toMatchObject({ version: 1, institutionName: O2_INPUT.institutionName });
      expect(await t.prisma.corporateDetailsRevision.count({ where: { applicationId: ids.applicationId } })).toBe(0);
    } finally {
      await t.prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "corporate_o4_test_fail_revision_trigger" ON "corporate_details_revisions"');
      await t.prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS "corporate_o4_test_fail_revision"()');
    }
  });
});
