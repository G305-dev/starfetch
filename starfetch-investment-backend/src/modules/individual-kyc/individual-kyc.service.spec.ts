import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { IndividualKycDocumentScanStatus, IndividualKycDocumentStatus, IndividualKycIdDocumentType, IndividualKycProfileStatus, IndividualKycSectionStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { TestIndividualKycEncryptionProvider } from './individual-kyc-encryption';
import { IsolatedMemoryIndividualKycDocumentStorage } from './individual-kyc-document-ports';
import { IndividualKycService } from './individual-kyc.service';
import { BankDetailsKycSectionDto, IdDocumentUploadIntentDto, InvestmentProfileKycSectionDto, PersonalKycSectionDto, SourceOfFundsKycSectionDto } from './dto/individual-kyc.dto';

function digest(bytes: Buffer): string { return createHash('sha256').update(bytes).digest('base64'); }
function uploadDto(version: number, bytes: Buffer, contentType = 'application/pdf') {
  return Object.assign(new IdDocumentUploadIntentDto(), {
    version,
    documentType: IndividualKycIdDocumentType.PASSPORT,
    originalFilename: 'passport.pdf',
    contentType,
    sizeBytes: bytes.length,
    checksumSha256: digest(bytes),
  });
}

function makeHarness() {
  let profile: any = null;
  const documents: any[] = [];
  const events: any[] = [];
  const includeDocuments = (row: any, include?: any) => include?.documents ? { ...row, documents: documents.filter((d) => d.kycProfileId === row.id) } : row;
  const db: any = {
    individualKycProfile: {
      findUnique: jest.fn(async (args: any) => profile && (profile.investorUserId === args.where.investorUserId || profile.id === args.where.id) ? includeDocuments(profile, args.include) : null),
      create: jest.fn(async ({ data, include }: any) => {
        profile = {
          id: data.id, investorUserId: data.investorUserId, status: IndividualKycProfileStatus.DRAFT,
          personalSectionStatus: IndividualKycSectionStatus.NOT_STARTED, investmentSectionStatus: IndividualKycSectionStatus.NOT_STARTED,
          sourceOfFundsSectionStatus: IndividualKycSectionStatus.NOT_STARTED, bankSectionStatus: IndividualKycSectionStatus.NOT_STARTED,
          version: data.version ?? 0, encryptedPayload: null, payloadIv: null, payloadAuthTag: null,
          encryptedDataKey: null, encryptionKeyProvider: null, encryptionKeyId: null,
          encryptionKeyVersion: null, encryptionContextVersion: null, submittedAt: null,
          approvedAt: null, approvedByUserId: null, createdAt: new Date(), updatedAt: new Date(),
        };
        return includeDocuments(profile, include);
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (!profile || profile.id !== where.id || profile.investorUserId !== where.investorUserId || profile.version !== where.version || (where.status && profile.status !== where.status)) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          if (key === 'version' && typeof value === 'object' && value !== null && 'increment' in (value as any)) profile.version += (value as any).increment;
          else profile[key] = value;
        }
        profile.updatedAt = new Date();
        return { count: 1 };
      }),
    },
    individualKycDocument: {
      create: jest.fn(async ({ data }: any) => {
        const doc = {
          ...data, status: IndividualKycDocumentStatus.PENDING_UPLOAD,
          scanStatus: IndividualKycDocumentScanStatus.PENDING, scannerVersion: null,
          scanCompletedAt: null, scanRequestedAt: null, uploadedAt: null, createdAt: new Date(), updatedAt: new Date(),
        };
        documents.push(doc);
        return doc;
      }),
      findFirst: jest.fn(async ({ where }: any) => documents.find((d) => d.id === where.id && d.investorUserId === where.investorUserId && d.kycProfileId === where.kycProfileId) ?? null),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const doc = documents.find((d) => d.id === where.id && d.investorUserId === where.investorUserId &&
          (!where.kycProfileId || d.kycProfileId === where.kycProfileId) && (!where.status || d.status === where.status) &&
          (!where.scanStatus || d.scanStatus === where.scanStatus));
        if (!doc) return { count: 0 };
        Object.assign(doc, data, { updatedAt: new Date() });
        return { count: 1 };
      }),
    },
    individualKycProfileEvent: { create: jest.fn(async ({ data }: any) => { events.push(data); return data; }) },
    $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(db)),
  };
  const storage = new IsolatedMemoryIndividualKycDocumentStorage('test');
  const service = new IndividualKycService(db, new TestIndividualKycEncryptionProvider('test', Buffer.alloc(32, 9)), storage);
  return { service, db, storage, get profile() { return profile; }, documents, events };
}

describe('IndividualKycService persistence and ownership', () => {
  it('saves/restores encrypted sections, masks bank numbers, and isolates investors', async () => {
    const h = makeHarness();
    expect((await h.service.getOwn('investor-a')).version).toBe(0);
    let version = 0;
    version = (await h.service.savePersonal('investor-a', Object.assign(new PersonalKycSectionDto(), { version, dateOfBirth: '1990-01-01', gender: 'FEMALE', nationality: 'NG', stateOfResidence: 'Lagos', residentialAddress: 'Synthetic address', idDocumentType: IndividualKycIdDocumentType.PASSPORT, occupation: 'Analyst', pepStatus: 'NO' }))).version;
    version = (await h.service.saveInvestment('investor-a', Object.assign(new InvestmentProfileKycSectionDto(), { version, primaryInvestmentObjective: 'synthetic objective', riskTolerance: 'synthetic tolerance', investmentHorizon: 'DAYS_180', financialCurrency: 'NGN', investmentKnowledgeExperience: 'synthetic experience', expectedWithdrawalsMinor: '10000', annualIncomeMinor: '100000', estimatedNetWorthMinor: '200000', withdrawalFrequency: 'monthly' }))).version;
    version = (await h.service.saveSourceOfFunds('investor-a', Object.assign(new SourceOfFundsKycSectionDto(), { version, sourceOfFunds: ['OTHER'], expectedAnnualInflowMinor: '30000', expectedTransactionFrequency: 'monthly' }))).version;
    version = (await h.service.saveBankDetails('investor-a', Object.assign(new BankDetailsKycSectionDto(), { version, bankName: 'Synthetic Bank', accountNumber: '0123456789', accountName: 'Synthetic Investor', accountType: 'CURRENT', bvnLinkedToAccount: true }))).version;
    expect(h.profile.encryptedPayload).not.toContain('0123456789');
    expect(h.profile.encryptionKeyProvider).toBe('TEST_AES_GCM');
    const restored = await h.service.getOwn('investor-a');
    const sections = restored.sections as Record<string, any>;
    expect(restored.version).toBe(version);
    expect(sections.personal).toMatchObject({ nationality: 'NG', pepStatus: 'NO' });
    expect(sections.investmentProfile).toMatchObject({ investmentHorizon: 'DAYS_180', annualIncomeMinor: '100000', estimatedNetWorthMinor: '200000' });
    expect(sections.sourceOfFunds).toMatchObject({ sourceOfFunds: ['OTHER'] });
    expect(sections.bankDetails).toMatchObject({ bankName: 'Synthetic Bank', accountNumberMasked: '******6789' });
    expect(JSON.stringify(restored)).not.toContain('0123456789');
    expect(restored.sectionStatuses).toMatchObject({ personal: IndividualKycSectionStatus.DRAFT, investment: IndividualKycSectionStatus.DRAFT, sourceOfFunds: IndividualKycSectionStatus.DRAFT, bank: IndividualKycSectionStatus.DRAFT });
    expect((await h.service.getOwn('different-investor')).version).toBe(0);
  });

  it('normalizes legacy income/net worth under Investment Profile and preserves on subsequent save', async () => {
    const h = makeHarness();
    await h.service.savePersonal('investor-a', Object.assign(new PersonalKycSectionDto(), { version: 0 }));
    const legacyEnvelope = await new TestIndividualKycEncryptionProvider('test', Buffer.alloc(32, 9)).encrypt(
      JSON.stringify({ investmentProfile: { investmentHorizon: 'DAYS_180' }, sourceOfFunds: { sourceOfFunds: ['OTHER'], annualIncomeMinor: '120000', estimatedNetWorthMinor: '450000' } }),
      h.profile.id, 'investor-a',
    );
    Object.assign(h.profile, {
      encryptedPayload: legacyEnvelope.encryptedPayload, payloadIv: legacyEnvelope.payloadIv,
      payloadAuthTag: legacyEnvelope.payloadAuthTag, encryptedDataKey: legacyEnvelope.encryptedDataKey,
      encryptionKeyProvider: legacyEnvelope.encryptionKeyProvider, encryptionKeyId: legacyEnvelope.encryptionKeyId,
      encryptionKeyVersion: legacyEnvelope.encryptionKeyVersion, encryptionContextVersion: legacyEnvelope.encryptionContextVersion,
    });
    const restored = await h.service.getOwn('investor-a');
    expect((restored.sections as any).investmentProfile).toMatchObject({ annualIncomeMinor: '120000', estimatedNetWorthMinor: '450000' });
    expect((restored.sections as any).sourceOfFunds).toEqual({ sourceOfFunds: ['OTHER'] });
    await h.service.saveSourceOfFunds('investor-a', Object.assign(new SourceOfFundsKycSectionDto(), { version: 1, expectedAnnualInflowMinor: '300', expectedTransactionFrequency: 'monthly' }));
    expect((await h.service.getOwn('investor-a') as any).sections.investmentProfile).toMatchObject({ annualIncomeMinor: '120000', estimatedNetWorthMinor: '450000' });
  });

  it('conditions PEP details on YES and rejects stale profile versions', async () => {
    const h = makeHarness();
    await h.service.savePersonal('investor-a', Object.assign(new PersonalKycSectionDto(), { version: 0, pepStatus: 'YES' }));
    await h.service.savePersonal('investor-a', Object.assign(new PersonalKycSectionDto(), { version: 1, pepStatus: 'NO', pepDetails: { fullName: 'Synthetic PEP' } }));
    await expect(h.service.savePersonal('investor-a', Object.assign(new PersonalKycSectionDto(), { version: 2, pepStatus: null, pepDetails: { fullName: 'Synthetic PEP' } }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(h.service.saveBankDetails('investor-a', Object.assign(new BankDetailsKycSectionDto(), { version: 0, bankName: 'Old tab' }))).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([
    ['application/pdf', Buffer.from('%PDF-1.7 synthetic')],
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x11])],
    ['image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01])],
  ] as const)('creates a one-time 5-minute signed intent and queues %s without reading bytes in the API', async (contentType, bytes) => {
    const h = makeHarness();
    const intent = await h.service.createUploadIntent('investor-a', uploadDto(0, bytes, contentType));
    expect(intent.expiresAt).toBeTruthy();
    expect(intent.signedContentLength).toBe(bytes.length);
    expect(intent.requiredHeaders).toMatchObject({ 'if-none-match': '*', 'x-amz-checksum-sha256': digest(bytes) });
    expect(intent.requiredHeaders).not.toHaveProperty('content-length');
    expect(h.storage.stageUpload(intent.uploadUrl, bytes, contentType, digest(bytes))).toBeTruthy();
    const completed = await h.service.completeDocument('investor-a', intent.documentId, intent.version);
    expect(completed).toMatchObject({ status: IndividualKycDocumentStatus.PENDING_SCAN, scanStatus: IndividualKycDocumentScanStatus.PENDING, version: 2 });
    const restored = await h.service.getOwn('investor-a');
    expect((restored.documents as any[])[0]).toMatchObject({ status: 'PENDING_SCAN', scanStatus: 'PENDING' });
  });

  it('rejects unsupported MIME, oversized input, and invalid/missing checksum before upload', async () => {
    const h = makeHarness();
    const bytes = Buffer.from('%PDF-1.7 synthetic');
    await expect(h.service.createUploadIntent('investor-a', Object.assign(uploadDto(0, bytes), { contentType: 'text/plain' } as any))).rejects.toBeInstanceOf(BadRequestException);
    await expect(h.service.createUploadIntent('investor-a', Object.assign(uploadDto(0, bytes), { sizeBytes: 10 * 1024 * 1024 + 1 }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(h.service.createUploadIntent('investor-a', Object.assign(uploadDto(0, bytes), { checksumSha256: 'bad' }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires the exact current version, reports a missing object, and denies cross-investor finalization', async () => {
    const h = makeHarness();
    const bytes = Buffer.from('%PDF-1.7 synthetic');
    const intent = await h.service.createUploadIntent('investor-a', uploadDto(0, bytes));
    await expect(h.service.completeDocument('investor-a', intent.documentId, 0)).rejects.toBeInstanceOf(ConflictException);
    await expect(h.service.completeDocument('investor-a', intent.documentId, intent.version)).rejects.toMatchObject({ response: { code: 'UPLOAD_NOT_FOUND' } });
    h.storage.stageUpload(intent.uploadUrl, bytes, 'application/pdf', digest(bytes));
    await expect(h.service.completeDocument('investor-b', intent.documentId, intent.version)).rejects.toBeInstanceOf(NotFoundException);
    await expect(h.service.completeDocument('investor-a', intent.documentId, intent.version)).resolves.toMatchObject({ status: IndividualKycDocumentStatus.PENDING_SCAN });
  });

  it('rejects object metadata size, checksum, MIME and SSE mismatches before scan queueing', async () => {
    const h = makeHarness();
    const bytes = Buffer.from('%PDF-1.7 synthetic');
    const intent = await h.service.createUploadIntent('investor-a', uploadDto(0, bytes));
    h.storage.stageUpload(intent.uploadUrl, bytes, 'application/pdf', digest(bytes));
    jest.spyOn(h.storage, 'headQuarantined').mockResolvedValue({
      versionId: 'test-version-1', sizeBytes: bytes.length + 1, contentType: 'image/png',
      checksumSha256: 'A'.repeat(43) + '=', documentIdMetadata: intent.documentId,
      serverSideEncryption: 'aws:kms', etag: 'synthetic',
    });
    await expect(h.service.completeDocument('investor-a', intent.documentId, intent.version)).rejects.toMatchObject({ response: { code: 'UPLOAD_VALIDATION_FAILED' } });
    expect(h.documents[0].status).toBe(IndividualKycDocumentStatus.PENDING_UPLOAD);
  });

  it('rejects duplicate/replayed browser PUT and does not mark an unvalidated object clean', async () => {
    const h = makeHarness();
    const bytes = Buffer.from('%PDF-1.7 synthetic');
    const intent = await h.service.createUploadIntent('investor-a', uploadDto(0, bytes));
    h.storage.stageUpload(intent.uploadUrl, bytes, 'application/pdf', digest(bytes));
    expect(() => h.storage.stageUpload(intent.uploadUrl, bytes, 'application/pdf', digest(bytes))).toThrow(ServiceUnavailableException);
    await h.service.completeDocument('investor-a', intent.documentId, intent.version);
    expect(h.documents[0].status).toBe(IndividualKycDocumentStatus.PENDING_SCAN);
    expect(h.documents[0].scanStatus).toBe(IndividualKycDocumentScanStatus.PENDING);
  });

  it('keeps an expired upload authorization unapproved', async () => {
    const h = makeHarness();
    const bytes = Buffer.from('%PDF-1.7 synthetic');
    const intent = await h.service.createUploadIntent('investor-a', uploadDto(0, bytes));
    h.documents[0].uploadExpiresAt = new Date(Date.now() - 1);
    await expect(h.service.completeDocument('investor-a', intent.documentId, intent.version)).rejects.toMatchObject({ response: { code: 'UPLOAD_EXPIRED' } });
    expect(h.documents[0].status).toBe(IndividualKycDocumentStatus.PENDING_UPLOAD);
  });

  it('keeps scanner clearance separate from upload completion and never submits before a clean matching ID', async () => {
    const h = makeHarness();
    const intent = await h.service.createUploadIntent('investor-a', uploadDto(0, Buffer.from('%PDF-1.7 synthetic')));
    await expect(h.service.submit('investor-a', intent.version)).rejects.toBeInstanceOf(ConflictException);
    expect(h.profile.status).toBe(IndividualKycProfileStatus.DRAFT);
    expect(h.documents[0].status).toBe(IndividualKycDocumentStatus.PENDING_UPLOAD);
  });
});
