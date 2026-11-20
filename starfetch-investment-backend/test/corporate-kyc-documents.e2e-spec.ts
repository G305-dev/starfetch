import { ServiceUnavailableException } from '@nestjs/common';
import {
  CorporateProfileSectionStatus,
  OnboardingApplicationHistoryEvent,
  OnboardingApplicationKind,
  OnboardingApplicationStatus,
  PrimaryAccountType,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AccessTokenService } from '../src/modules/auth/services/access-token.service';
import { CsrfService } from '../src/modules/auth/services/csrf.service';
import {
  INDIVIDUAL_KYC_DOCUMENT_STORAGE,
  IsolatedMemoryIndividualKycDocumentStorage,
} from '../src/modules/individual-kyc/individual-kyc-document-ports';
import { TestApp, cleanDatabase, createTestApp } from './utils/test-app';

/**
 * Corporate KYC documents + submission. Synthetic data only, against the
 * positively identified isolated local starfetch_test database. Storage is the
 * repository's isolated in-memory test adapter; no AWS call is made.
 */
const ORIGIN = 'http://localhost:3000';
const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.alloc(32, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2), Buffer.from([0xff, 0xd9])]);
const CATEGORIES = ['CERTIFICATE_OF_INCORPORATION', 'MEMART', 'TIN_CERTIFICATE'] as const;
const PII_FILENAME = 'Ada Lovelace passport 12345678.pdf';

describe('Corporate KYC documents and submission (synthetic data, verified local PostgreSQL only)', () => {
  let t: TestApp;
  let accessTokens: AccessTokenService;
  let csrf: CsrfService;
  let storage: IsolatedMemoryIndividualKycDocumentStorage;
  let databaseIdentityVerified = false;

  beforeAll(async () => {
    storage = new IsolatedMemoryIndividualKycDocumentStorage('test');
    t = await createTestApp({ providerOverrides: [{ provide: INDIVIDUAL_KYC_DOCUMENT_STORAGE, useValue: storage }] });
    accessTokens = t.app.get(AccessTokenService);
    csrf = t.app.get(CsrfService);
    const identity = await t.prisma.$queryRaw<Array<{ db: string; host: string; db_user: string }>>`
      SELECT current_database() AS db, host(inet_server_addr()) AS host, current_user AS db_user
    `;
    if (identity.length !== 1 || identity[0].db !== 'starfetch_test' ||
      !['127.0.0.1', '::1'].includes(identity[0].host) || identity[0].db_user !== 'starfetch_test_role') {
      throw new Error('Corporate KYC document E2E requires positively verified starfetch_test|127.0.0.1|starfetch_test_role.');
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
    jest.restoreAllMocks();
  }, 60_000);

  async function identity(opts: { verified?: boolean; role?: UserRole } = {}) {
    const verified = opts.verified ?? true;
    const role = opts.role ?? UserRole.INVESTOR;
    const userId = randomUUID();
    const sessionId = randomUUID();
    const future = new Date(Date.now() + 60 * 60 * 1000);
    await t.prisma.user.create({
      data: {
        id: userId,
        email: `kyc-docs-${userId}@example.invalid`,
        normalizedEmail: `kyc-docs-${userId}@example.invalid`,
        passwordHash: 'synthetic-e2e-test-only-not-a-real-password-hash',
        role,
        ...(role === UserRole.INVESTOR ? { primaryAccountType: PrimaryAccountType.CORPORATE } : {}),
        emailVerifiedAt: verified ? new Date('2025-01-01T00:00:00.000Z') : null,
      },
    });
    await t.prisma.authSession.create({ data: { id: sessionId, userId, expiresAt: future, idleExpiresAt: future } });
    const token = await accessTokens.sign({ userId, role, sessionId });
    return { userId, sessionId, token, csrf: csrf.issue(sessionId) };
  }
  type Auth = Awaited<ReturnType<typeof identity>>;

  async function corporateApplication(owner: Auth, opts: { completeProfile?: boolean } = {}) {
    const account = await t.prisma.corporateAccount.create({ data: {} });
    const application = await t.prisma.$transaction(async (tx) => {
      const created = await tx.onboardingApplication.create({
        data: {
          kind: OnboardingApplicationKind.CORPORATE, ownerCorporateAccountId: account.id, initiatingUserId: owner.userId,
          status: OnboardingApplicationStatus.DRAFT,
        },
      });
      await tx.corporateOnboardingDetails.create({
        data: {
          applicationId: created.id, institutionName: 'Synthetic Holdings Ltd', dateOfIncorporation: new Date('2020-01-02T00:00:00.000Z'),
          rcNumber: 'RC-SYNTHETIC-1', businessPhoneNumber: '+2348000000000', businessEmail: `biz-${created.id}@example.invalid`, version: 1,
          // Synthetic, non-decryptable envelope placeholders (no plaintext TIN anywhere).
          taxIdentificationNumberCiphertext: 'c3ludGhldGlj', taxIdentificationNumberIv: 'aXY=', taxIdentificationNumberAuthTag: 'dGFn',
          taxIdentificationNumberEncryptedDataKey: 'ZGs=', taxIdentificationNumberKeyProvider: 'TEST_AES_GCM', taxIdentificationNumberKeyId: 'synthetic-key',
          taxIdentificationNumberKeyVersion: 'v1', taxIdentificationNumberContextVersion: 1,
        },
      });
      await tx.onboardingApplicationHistory.create({
        data: { applicationId: created.id, event: OnboardingApplicationHistoryEvent.CREATED, fromStatus: null, toStatus: OnboardingApplicationStatus.DRAFT, actorUserId: owner.userId },
      });
      return created;
    });
    if (opts.completeProfile) await completeProfile(application.id);
    return { corporateAccountId: account.id, applicationId: application.id };
  }

  async function completeProfile(applicationId: string, overrides: Record<string, unknown> = {}) {
    const C = CorporateProfileSectionStatus.COMPLETE;
    await t.prisma.corporateProfile.create({
      data: {
        applicationId, profileVersion: 4, companyDetailsDetailsVersion: 1,
        companyDetailsStatus: C, investmentProfileStatus: C, sourceOfFundsStatus: C, bankDetailsStatus: C,
        registeredAddress: '1 Synthetic Close', city: 'Lagos', state: 'Lagos',
        primaryObjective: 'Capital preservation', riskTolerance: 'Low', investmentHorizon: '1-3 years',
        expectedWithdrawals: 'None planned', withdrawalFrequency: 'Annually',
        selectedSources: ['Business income / operating cash'], expectedAnnualInflowMinor: BigInt(100_000_00), expectedTransactionFrequency: 'Monthly',
        bankName: 'Synthetic Bank', accountName: 'Synthetic Holdings Ltd', accountType: 'Current', bvnLinkedToAccount: true,
        bankAccountNumberCiphertext: 'c3ludGhldGlj', bankAccountNumberIv: 'aXY=', bankAccountNumberAuthTag: 'dGFn', bankAccountNumberEncryptedDataKey: 'ZGs=',
        bankAccountNumberKeyProvider: 'AWS_KMS', bankAccountNumberKeyId: 'synthetic-key', bankAccountNumberKeyVersion: 'v1', bankAccountNumberContextVersion: 1,
        ...overrides,
      },
    });
  }

  const base = (id: string) => `/api/v1/corporate-accounts/${id}`;
  function get(auth: Auth | null, id: string) {
    const call = request(t.server).get(`${base(id)}/kyc-documents`);
    return auth ? call.set('Authorization', `Bearer ${auth.token}`) : call;
  }
  function mutate(auth: Auth | null, path: string, opts: { csrf?: boolean; origin?: string } = {}) {
    let call = request(t.server).post(path).set('Origin', opts.origin ?? ORIGIN);
    if (auth) {
      call = call.set('Authorization', `Bearer ${auth.token}`);
      if (opts.csrf !== false) call = call.set('Cookie', `sf_csrf=${auth.csrf}`).set('X-CSRF-Token', auth.csrf);
    }
    return call;
  }
  function upload(auth: Auth | null, id: string, category: string, file: { bytes: Buffer; filename: string; contentType: string } = { bytes: PDF, filename: 'scan.pdf', contentType: 'application/pdf' }, replacesDocumentId?: string, opts: { csrf?: boolean; origin?: string } = {}) {
    let call = mutate(auth, `${base(id)}/kyc-documents/${category}`, opts);
    if (replacesDocumentId) call = call.field('replacesDocumentId', replacesDocumentId);
    return call.attach('file', file.bytes, { filename: file.filename, contentType: file.contentType });
  }
  function submit(auth: Auth | null, id: string, key: string | null = 'synthetic-submit-key-0001', opts: { csrf?: boolean } = {}) {
    const call = mutate(auth, `${base(id)}/submission`, opts);
    return key === null ? call.send() : call.set('Idempotency-Key', key).send();
  }
  async function uploadAll(auth: Auth, id: string) {
    for (const category of CATEGORIES) await upload(auth, id, category).expect(201);
  }

  it('returns exactly the three mandatory requirements with types, limits, status and blockers', async () => {
    const owner = await identity();
    const app = await corporateApplication(owner);
    const res = await get(owner, app.corporateAccountId).expect(200);
    const data = res.body.data;
    expect(data.requirements.map((r: { category: string }) => r.category)).toEqual([...CATEGORIES]);
    for (const r of data.requirements) {
      expect(r).toMatchObject({
        mandatory: true, acceptedContentTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        acceptedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'], maxSizeBytes: 4 * 1024 * 1024,
        uploadStatus: 'NOT_UPLOADED', canUpload: true, canReplace: false, blockedReason: null, currentDocument: null,
      });
      expect(typeof r.title).toBe('string');
      expect(typeof r.description).toBe('string');
    }
    expect(data.section).toEqual({ key: 'kycDocuments', order: 5, status: 'NOT_STARTED', uploadedCount: 0, requiredCount: 3 });
    expect(data.submission.canSubmit).toBe(false);
    expect(data.submission.blockers).toEqual([
      { kind: 'PROFILE_SECTION', key: 'companyDetails' }, { kind: 'PROFILE_SECTION', key: 'investmentProfile' },
      { kind: 'PROFILE_SECTION', key: 'sourceOfFunds' }, { kind: 'PROFILE_SECTION', key: 'bankDetails' },
      { kind: 'DOCUMENT', key: 'CERTIFICATE_OF_INCORPORATION' }, { kind: 'DOCUMENT', key: 'MEMART' }, { kind: 'DOCUMENT', key: 'TIN_CERTIFICATE' },
    ]);
  });

  it('enforces authentication, verified email, INVESTOR role and uniform 404 for non-owners on every route', async () => {
    const owner = await identity();
    const app = await corporateApplication(owner);
    await uploadAll(owner, app.corporateAccountId);
    const doc = await t.prisma.corporateKycDocument.findFirstOrThrow({ where: { applicationId: app.applicationId } });
    const other = await identity();
    await corporateApplication(other);
    const unverified = await identity({ verified: false });
    const staff = await identity({ role: UserRole.STAFF });

    await get(null, app.corporateAccountId).expect(401);
    await upload(null, app.corporateAccountId, 'MEMART').expect(401);
    await submit(null, app.corporateAccountId).expect(401);
    await get(unverified, app.corporateAccountId).expect(403);
    await get(staff, app.corporateAccountId).expect(403);
    await upload(staff, app.corporateAccountId, 'MEMART').expect(403);

    await get(other, app.corporateAccountId).expect(404);
    await upload(other, app.corporateAccountId, 'MEMART').expect(404);
    await mutate(other, `${base(app.corporateAccountId)}/kyc-documents/${doc.id}/view-authorization`).expect(404);
    await submit(other, app.corporateAccountId).expect(404);
    await get(owner, randomUUID()).expect(404);
    await get(owner, 'not-a-uuid').expect(404);

    // A different applicant cannot reach the owner's document even through their own account.
    const otherApp = await t.prisma.onboardingApplication.findFirstOrThrow({ where: { initiatingUserId: other.userId } });
    await mutate(other, `${base(otherApp.ownerCorporateAccountId!)}/kyc-documents/${doc.id}/view-authorization`).expect(404);
    expect(await t.prisma.corporateKycDocument.count({ where: { applicationId: otherApp.id } })).toBe(0);
    expect(await t.prisma.corporateKycDocumentEvent.count({ where: { eventKind: 'VIEW_AUTHORIZED' } })).toBe(0);
  });

  it('requires Origin and signed double-submit CSRF for uploads, view grants and submission', async () => {
    const owner = await identity();
    const app = await corporateApplication(owner, { completeProfile: true });
    await upload(owner, app.corporateAccountId, 'MEMART', undefined, undefined, { csrf: false }).expect(403);
    await upload(owner, app.corporateAccountId, 'MEMART', undefined, undefined, { origin: 'https://untrusted.example' }).expect(403);
    await submit(owner, app.corporateAccountId, 'synthetic-submit-key-0001', { csrf: false }).expect(403);
    expect(await t.prisma.corporateKycDocument.count()).toBe(0);
  });

  it('stores a verified upload privately with opaque references, safe metadata and an UPLOADED audit event', async () => {
    const owner = await identity();
    const app = await corporateApplication(owner);
    const res = await upload(owner, app.corporateAccountId, 'CERTIFICATE_OF_INCORPORATION', { bytes: PDF, filename: PII_FILENAME, contentType: 'application/pdf' }).expect(201);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('onboarding-documents/');
    expect(body).not.toContain('Lovelace');
    expect(body).not.toContain('storageObject');
    const requirement = res.body.data.requirements[0];
    expect(requirement).toMatchObject({
      category: 'CERTIFICATE_OF_INCORPORATION', uploadStatus: 'UPLOADED', canUpload: false, canReplace: true,
      currentDocument: { version: 1, contentType: 'application/pdf', sizeBytes: PDF.length, displayFilename: 'certificate-of-incorporation-v1.pdf', scanStatus: 'NOT_SCANNED', reviewStatus: 'NOT_SUBMITTED' },
    });
    expect(res.body.data.section).toMatchObject({ status: 'DRAFT', uploadedCount: 1 });

    const row = await t.prisma.corporateKycDocument.findUniqueOrThrow({ where: { id: requirement.currentDocument.documentId } });
    expect(row.storageObjectKey).toBe(`onboarding-documents/${row.id}`);
    expect(row.applicationId).toBe(app.applicationId);
    expect(row.uploadedByUserId).toBe(owner.userId);
    expect(row.checksumSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain('Lovelace');
    expect(storage.readTestVersion(row.storageObjectKey, row.storageObjectVersionId)?.equals(PDF)).toBe(true);
    const events = await t.prisma.corporateKycDocumentEvent.findMany({ where: { documentId: row.id } });
    expect(events).toEqual([expect.objectContaining({ eventKind: 'UPLOADED', actorUserId: owner.userId, documentVersion: 1, previousDocumentId: null })]);

    await upload(owner, app.corporateAccountId, 'MEMART', { bytes: PNG, filename: 'memart.png', contentType: 'image/png' }).expect(201);
    await upload(owner, app.corporateAccountId, 'TIN_CERTIFICATE', { bytes: JPEG, filename: 'tin.jpeg', contentType: 'image/jpeg' }).expect(201);
    const after = await get(owner, app.corporateAccountId).expect(200);
    expect(after.body.data.section).toMatchObject({ status: 'COMPLETE', uploadedCount: 3 });
  });

  it('rejects any category outside the approved three without storing anything', async () => {
    const owner = await identity();
    const app = await corporateApplication(owner);
    for (const category of ['CAC_STATUS_REPORT', 'BOARD_RESOLUTION', 'DIRECTOR_ID', 'BVN', 'PASSPORT_PHOTOGRAPH', 'SPECIMEN_SIGNATURE', 'SOURCE_OF_FUNDS', 'SCUML_CERTIFICATE', 'INVESTMENT_POLICY_STATEMENT', 'memart']) {
      const res = await upload(owner, app.corporateAccountId, category).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    }
    expect(await t.prisma.corporateKycDocument.count()).toBe(0);
    await expect(t.prisma.$executeRawUnsafe(`SELECT 'CAC_STATUS_REPORT'::"CorporateKycDocumentCategory"`)).rejects.toThrow();
  });

  it('validates signature, declared type, extension, PDF structure and size server-side', async () => {
    const owner = await identity();
    const app = await corporateApplication(owner);
    const cases: Array<[{ bytes: Buffer; filename: string; contentType: string }, number, string]> = [
      [{ bytes: Buffer.from('<html><script>alert(1)</script></html>'), filename: 'x.pdf', contentType: 'application/pdf' }, 415, 'UNSUPPORTED_FILE_TYPE'],
      [{ bytes: PNG, filename: 'x.pdf', contentType: 'application/pdf' }, 415, 'UNSUPPORTED_FILE_TYPE'],
      [{ bytes: PDF, filename: 'x.png', contentType: 'application/pdf' }, 415, 'UNSUPPORTED_FILE_TYPE'],
      [{ bytes: PDF, filename: 'x.pdf', contentType: 'application/octet-stream' }, 415, 'UNSUPPORTED_FILE_TYPE'],
      [{ bytes: Buffer.from('%PDF-1.7\n<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>\n%%EOF\n'), filename: 'x.pdf', contentType: 'application/pdf' }, 415, 'UNSUPPORTED_FILE_TYPE'],
      [{ bytes: Buffer.from('%PDF-1.7\n<< /Encrypt 5 0 R >>\n%%EOF\n'), filename: 'x.pdf', contentType: 'application/pdf' }, 415, 'UNSUPPORTED_FILE_TYPE'],
      [{ bytes: Buffer.from('%PDF-1.7\ntruncated'), filename: 'x.pdf', contentType: 'application/pdf' }, 415, 'UNSUPPORTED_FILE_TYPE'],
      [{ bytes: Buffer.concat([PDF, Buffer.alloc(4 * 1024 * 1024)]), filename: 'big.pdf', contentType: 'application/pdf' }, 413, 'FILE_TOO_LARGE'],
    ];
    for (const [file, status, code] of cases) {
      const res = await upload(owner, app.corporateAccountId, 'MEMART', file).expect(status);
      expect(res.body.error.code).toBe(code);
    }
    const missing = await mutate(owner, `${base(app.corporateAccountId)}/kyc-documents/MEMART`).field('replacesDocumentId', '').expect(400);
    expect(missing.body.error.code).toBe('VALIDATION_FAILED');
    expect(await t.prisma.corporateKycDocument.count()).toBe(0);
  });

  it('supports explicit versioned replacement with append-only audit and rejects stale or implicit overwrites', async () => {
    const owner = await identity();
    const app = await corporateApplication(owner);
    const first = await upload(owner, app.corporateAccountId, 'MEMART').expect(201);
    const v1 = first.body.data.requirements[1].currentDocument.documentId;
    const implicit = await upload(owner, app.corporateAccountId, 'MEMART').expect(409);
    expect(implicit.body.error.code).toBe('CONFLICT');
    await upload(owner, app.corporateAccountId, 'TIN_CERTIFICATE', undefined, v1).expect(409);

    const second = await upload(owner, app.corporateAccountId, 'MEMART', { bytes: PNG, filename: 'm.png', contentType: 'image/png' }, v1).expect(201);
    const current = second.body.data.requirements[1].currentDocument;
    expect(current).toMatchObject({ version: 2, contentType: 'image/png', displayFilename: 'memart-v2.png' });
    await upload(owner, app.corporateAccountId, 'MEMART', undefined, v1).expect(409);

    const old = await t.prisma.corporateKycDocument.findUniqueOrThrow({ where: { id: v1 } });
    expect(old).toMatchObject({ isCurrent: false });
    expect(old.supersededAt).toBeInstanceOf(Date);
    const replaced = await t.prisma.corporateKycDocumentEvent.findFirstOrThrow({ where: { documentId: current.documentId } });
    expect(replaced).toMatchObject({ eventKind: 'REPLACED', previousDocumentId: v1, documentVersion: 2 });
    expect(await t.prisma.corporateKycDocument.count({ where: { applicationId: app.applicationId, category: 'MEMART', isCurrent: true } })).toBe(1);
    // The superseded version is retained in storage for audit; only the current version is viewable by the applicant.
    expect(storage.readTestVersion(old.storageObjectKey, old.storageObjectVersionId)).not.toBeNull();
    await mutate(owner, `${base(app.corporateAccountId)}/kyc-documents/${v1}/view-authorization`).expect(404);
  });

  it('issues an audited, version-pinned, attachment-only view grant that expires within 60 seconds', async () => {
    const owner = await identity();
    const app = await corporateApplication(owner);
    const up = await upload(owner, app.corporateAccountId, 'TIN_CERTIFICATE').expect(201);
    const documentId = up.body.data.requirements[2].currentDocument.documentId;
    const before = Date.now();
    const res = await mutate(owner, `${base(app.corporateAccountId)}/kyc-documents/${documentId}/view-authorization`).expect(200);
    expect(res.body.data).toMatchObject({ documentId, category: 'TIN_CERTIFICATE', version: 1, disposition: 'attachment', viewUrl: expect.any(String) });
    const row = await t.prisma.corporateKycDocument.findUniqueOrThrow({ where: { id: documentId } });
    expect(res.body.data.viewUrl).toContain(encodeURIComponent(row.storageObjectVersionId));
    expect(Date.parse(res.body.data.expiresAt) - before).toBeLessThanOrEqual(61_000);
    const events = await t.prisma.corporateKycDocumentEvent.findMany({ where: { documentId, eventKind: 'VIEW_AUTHORIZED' } });
    expect(events).toHaveLength(1);
    expect(events[0].actorUserId).toBe(owner.userId);
    await mutate(owner, `${base(app.corporateAccountId)}/kyc-documents/${documentId}/view-authorization`, { csrf: false }).expect(403);
    await mutate(owner, `${base(app.corporateAccountId)}/kyc-documents/${randomUUID()}/view-authorization`).expect(404);
  });

  it('fails closed with 503 and no database row when private storage is unavailable', async () => {
    const owner = await identity();
    const app = await corporateApplication(owner);
    jest.spyOn(storage, 'putDocumentObject').mockRejectedValueOnce(new ServiceUnavailableException({ code: 'FEATURE_UNAVAILABLE', message: 'Secure document storage is unavailable.' }));
    const res = await upload(owner, app.corporateAccountId, 'MEMART').expect(503);
    expect(res.body.error.code).toBe('FEATURE_UNAVAILABLE');
    expect(await t.prisma.corporateKycDocument.count()).toBe(0);
    expect(await t.prisma.corporateKycDocumentEvent.count()).toBe(0);
  });

  it('blocks submission until all four sections are valid and all three documents are uploaded', async () => {
    const owner = await identity();
    const app = await corporateApplication(owner);
    await submit(owner, app.corporateAccountId, null).expect(400);
    let res = await submit(owner, app.corporateAccountId).expect(409);
    expect(res.body.error).toMatchObject({ code: 'CONFLICT', context: { reason: 'SUBMISSION_INCOMPLETE' } });
    expect(res.body.error.context.blockers).toHaveLength(7);

    // Stale Company Details (saved against an older canonical details version) is not valid.
    await completeProfile(app.applicationId, { companyDetailsDetailsVersion: 0 });
    await upload(owner, app.corporateAccountId, 'CERTIFICATE_OF_INCORPORATION').expect(201);
    await upload(owner, app.corporateAccountId, 'MEMART').expect(201);
    res = await submit(owner, app.corporateAccountId).expect(409);
    expect(res.body.error.context.blockers).toEqual([
      { kind: 'PROFILE_SECTION', key: 'companyDetails' }, { kind: 'PROFILE_SECTION', key: 'investmentProfile' },
      { kind: 'PROFILE_SECTION', key: 'sourceOfFunds' }, { kind: 'PROFILE_SECTION', key: 'bankDetails' },
      { kind: 'DOCUMENT', key: 'TIN_CERTIFICATE' },
    ]);
    const application = await t.prisma.onboardingApplication.findUniqueOrThrow({ where: { id: app.applicationId } });
    expect(application.status).toBe('DRAFT');
    expect(await t.prisma.corporateApplicationSubmission.count()).toBe(0);
  });

  it('submits once to SUBMITTED (never IN_REVIEW/APPROVED), audits it, replays idempotently and rejects conflicts', async () => {
    const owner = await identity();
    const app = await corporateApplication(owner, { completeProfile: true });
    await uploadAll(owner, app.corporateAccountId);
    const ready = await get(owner, app.corporateAccountId).expect(200);
    expect(ready.body.data.submission).toMatchObject({ canSubmit: true, blockers: [] });

    const first = await submit(owner, app.corporateAccountId, 'synthetic-submit-key-0001').expect(201);
    expect(first.body.data).toMatchObject({
      applicationId: app.applicationId, corporateAccountId: app.corporateAccountId, applicationStatus: 'SUBMITTED',
      profileVersion: 4, detailsVersion: 1, idempotentReplay: false, submissionId: expect.any(String),
    });
    expect(first.body.data.documents.map((d: { category: string }) => d.category)).toEqual([...CATEGORIES]);

    const application = await t.prisma.onboardingApplication.findUniqueOrThrow({ where: { id: app.applicationId } });
    expect(application).toMatchObject({ status: 'SUBMITTED', submittedByUserId: owner.userId });
    expect(application.submittedAt).toBeInstanceOf(Date);
    const history = await t.prisma.onboardingApplicationHistory.findMany({ where: { applicationId: app.applicationId }, orderBy: { createdAt: 'asc' } });
    expect(history.map((h) => h.event)).toEqual(['CREATED', 'SUBMITTED']);
    expect(history[1]).toMatchObject({ fromStatus: 'DRAFT', toStatus: 'SUBMITTED', actorUserId: owner.userId });
    const stored = await t.prisma.corporateApplicationSubmission.findUniqueOrThrow({ where: { applicationId: app.applicationId } });
    expect(stored.idempotencyKeyDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored)).not.toContain('synthetic-submit-key-0001');

    const replay = await submit(owner, app.corporateAccountId, 'synthetic-submit-key-0001').expect(201);
    expect(replay.body.data).toMatchObject({ submissionId: first.body.data.submissionId, idempotentReplay: true, applicationStatus: 'SUBMITTED' });
    const conflict = await submit(owner, app.corporateAccountId, 'synthetic-submit-key-0002').expect(409);
    expect(conflict.body.error.context).toMatchObject({ reason: 'ALREADY_SUBMITTED', submissionId: first.body.data.submissionId });
    expect(await t.prisma.corporateApplicationSubmission.count()).toBe(1);
    expect(await t.prisma.onboardingApplicationHistory.count({ where: { applicationId: app.applicationId, event: 'SUBMITTED' } })).toBe(1);

    // Documents are locked after submission; status is truthful.
    const locked = await upload(owner, app.corporateAccountId, 'MEMART', undefined, first.body.data.documents[1].documentId).expect(409);
    expect(locked.body.error.code).toBe('CONFLICT');
    const after = await get(owner, app.corporateAccountId).expect(200);
    expect(after.body.data.applicationStatus).toBe('SUBMITTED');
    expect(after.body.data.submission).toMatchObject({ canSubmit: false, submissionId: first.body.data.submissionId, blockers: [{ kind: 'APPLICATION_STATE', key: 'SUBMITTED' }] });
    for (const r of after.body.data.requirements) {
      expect(r).toMatchObject({ canUpload: false, canReplace: false, blockedReason: 'APPLICATION_NOT_EDITABLE' });
      expect(r.currentDocument).toMatchObject({ scanStatus: 'NOT_SCANNED', reviewStatus: 'AWAITING_REVIEW' });
    }
  });

  it('serializes concurrent submissions with different keys into one submission', async () => {
    const owner = await identity();
    const app = await corporateApplication(owner, { completeProfile: true });
    await uploadAll(owner, app.corporateAccountId);
    const results = await Promise.all([
      submit(owner, app.corporateAccountId, 'synthetic-concurrent-key-a'),
      submit(owner, app.corporateAccountId, 'synthetic-concurrent-key-b'),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await t.prisma.corporateApplicationSubmission.count()).toBe(1);
    expect(await t.prisma.onboardingApplicationHistory.count({ where: { event: 'SUBMITTED' } })).toBe(1);
  });

  it('enforces immutability, append-only audit and submission evidence at the database boundary', async () => {
    const owner = await identity();
    const app = await corporateApplication(owner, { completeProfile: true });
    await uploadAll(owner, app.corporateAccountId);
    const doc = await t.prisma.corporateKycDocument.findFirstOrThrow({ where: { applicationId: app.applicationId } });
    const event = await t.prisma.corporateKycDocumentEvent.findFirstOrThrow({ where: { applicationId: app.applicationId } });

    await expect(t.prisma.corporateKycDocument.update({ where: { id: doc.id }, data: { storageObjectVersionId: 'tampered' } })).rejects.toThrow();
    await expect(t.prisma.corporateKycDocument.delete({ where: { id: doc.id } })).rejects.toThrow();
    await expect(t.prisma.corporateKycDocumentEvent.update({ where: { id: event.id }, data: { actorUserId: randomUUID() } })).rejects.toThrow();
    await expect(t.prisma.corporateKycDocumentEvent.delete({ where: { id: event.id } })).rejects.toThrow();
    await expect(t.prisma.$executeRawUnsafe('TRUNCATE TABLE "corporate_kyc_document_events" CASCADE')).rejects.toThrow();
    // A non-approved storage key or content type cannot be recorded.
    await expect(t.prisma.corporateKycDocument.create({ data: {
      id: randomUUID(), applicationId: app.applicationId, category: 'MEMART', version: 1, storageObjectKey: 'public/leak.pdf',
      storageObjectVersionId: 'v', contentType: 'application/pdf', sizeBytes: 1, checksumSha256: 'a'.repeat(64), uploadedByUserId: owner.userId,
    } })).rejects.toThrow();
    // Lifecycle history cannot claim SUBMITTED without a recorded submission.
    await expect(t.prisma.$transaction(async (tx) => {
      await tx.onboardingApplication.update({ where: { id: app.applicationId }, data: { status: 'SUBMITTED', submittedAt: new Date(), submittedByUserId: owner.userId } });
      await tx.onboardingApplicationHistory.create({ data: { applicationId: app.applicationId, event: 'SUBMITTED', fromStatus: 'DRAFT', toStatus: 'SUBMITTED', actorUserId: owner.userId } });
    })).rejects.toThrow();

    await submit(owner, app.corporateAccountId).expect(201);
    const submission = await t.prisma.corporateApplicationSubmission.findFirstOrThrow();
    await expect(t.prisma.corporateApplicationSubmission.update({ where: { id: submission.id }, data: { profileVersion: 99 } })).rejects.toThrow();
    await expect(t.prisma.corporateApplicationSubmission.delete({ where: { id: submission.id } })).rejects.toThrow();
    // No document may be added or superseded after submission, even by a direct write.
    await expect(t.prisma.corporateKycDocument.update({ where: { id: doc.id }, data: { isCurrent: false, supersededAt: new Date() } })).rejects.toThrow();
  });
});
