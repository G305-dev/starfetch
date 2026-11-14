import { ConflictException } from '@nestjs/common';
import { IndividualKycDocumentScanStatus, IndividualKycDocumentStatus, IndividualKycEventActorKind, IndividualKycProfileEventKind, IndividualKycProfileStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { IndividualKycDocumentStorage } from './individual-kyc-document-ports';
import { IndividualKycWorkerService } from './individual-kyc-worker.service';
import { KycWorkerScanResult } from './individual-kyc-worker.service';

const DOC_ID = 'dc9b8a7a-9bbb-4b4c-8c24-8c43a260e7aa';
const PROFILE_ID = 'bb2aa767-b479-4cae-810c-4ec2cf24e9a1';
const OWNER_ID = 'fd4bd0eb-5fc1-4d4a-83f2-a2dbe78213b8';
const PDF = Buffer.from('%PDF-1.7 synthetic');
const CHECKSUM = createHash('sha256').update(PDF).digest('base64');
const VERSION_ID = 's3-version-synthetic-01';

function makeHarness(overrides: Record<string, unknown> = {}) {
  let profile: any = { id: PROFILE_ID, investorUserId: OWNER_ID, version: 7, status: IndividualKycProfileStatus.DRAFT };
  let doc: any = {
    id: DOC_ID, kycProfileId: PROFILE_ID, investorUserId: OWNER_ID,
    storageKey: 'individual-kyc/quarantine/2c09f95a-3377-4842-9a5e-c560496e3f9a',
    storageObjectVersionId: VERSION_ID, contentType: 'application/pdf', sizeBytes: BigInt(PDF.length),
    expectedChecksumSha256: CHECKSUM, status: IndividualKycDocumentStatus.PENDING_SCAN,
    scanStatus: IndividualKycDocumentScanStatus.PENDING, scanRequestedAt: new Date(Date.now() - 500),
    scanClaimedAt: null, scanLeaseExpiresAt: null, scanWorkerId: null, scanJobTokenHash: null,
    scanAttemptCount: 0, scanCompletedAt: null, scanSha256: null, scanAttestationDigest: null,
    uploadedAt: new Date(), uploadExpiresAt: new Date(Date.now() + 300_000), retentionExpiresAt: null,
    objectDeletedAt: null, scannerVersion: null, ...overrides,
  };
  const events: any[] = [];
  const storage = {
    headQuarantined: jest.fn(async () => ({ versionId: VERSION_ID, sizeBytes: PDF.length, contentType: 'application/pdf', checksumSha256: CHECKSUM, documentIdMetadata: DOC_ID, serverSideEncryption: 'AES256', etag: 'synthetic-etag' })),
    deleteObjectVersion: jest.fn(async () => undefined),
  } as unknown as IndividualKycDocumentStorage;
  const db: any = {
    individualKycDocument: {
      findFirst: jest.fn(async () => doc),
      findUnique: jest.fn(async () => ({ ...doc, kycProfile: { ...profile } })),
      findMany: jest.fn(async () => []),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (doc.id !== where.id || (where.status && doc.status !== where.status) ||
            (where.scanStatus && doc.scanStatus !== where.scanStatus) ||
            (where.scanJobTokenHash && doc.scanJobTokenHash !== where.scanJobTokenHash) ||
            (where.scanWorkerId && doc.scanWorkerId !== where.scanWorkerId)) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          if (key === 'scanAttemptCount' && typeof value === 'object' && value !== null && 'increment' in (value as any)) doc.scanAttemptCount += (value as any).increment;
          else doc[key] = value;
        }
        return { count: 1 };
      }),
    },
    individualKycProfile: {
      findUnique: jest.fn(async () => profile),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (profile.id !== where.id || profile.investorUserId !== where.investorUserId || profile.version !== where.version || (where.status && profile.status !== where.status)) return { count: 0 };
        if (typeof data.version === 'object') profile.version += data.version.increment;
        return { count: 1 };
      }),
    },
    individualKycProfileEvent: { create: jest.fn(async ({ data }: any) => { events.push(data); return data; }) },
    $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback(db)),
  };
  const config: any = { get: jest.fn((key: string) => key === 'individualKyc.s3.retentionDays' ? 30 : undefined) };
  const service = new IndividualKycWorkerService(db, config, storage);
  return { service, db, storage, events, get doc() { return doc; }, set doc(value) { doc = value; }, get profile() { return profile; }, set profile(value) { profile = value; } };
}

function cleanResult(token: string, overrides: Partial<KycWorkerScanResult> = {}): KycWorkerScanResult {
  return {
    outcome: 'CLEAN', objectVersionId: VERSION_ID, sha256Base64: CHECKSUM,
    scannerEngine: 'clamd', scannerVersion: 'ClamAV-1.4.3',
    scannedAt: new Date().toISOString(), scanJobToken: token, ...overrides,
  };
}

describe('Individual KYC worker workflow', () => {
  it('claims only a version-pinned pending scan without returning owner identity', async () => {
    const h = makeHarness();
    const job = await h.service.claimNext('scanner-nigeria-1');
    expect(job).toMatchObject({ documentId: DOC_ID, objectKey: expect.stringContaining('individual-kyc/quarantine/'), objectVersionId: VERSION_ID, checksumSha256: CHECKSUM });
    expect(job).not.toHaveProperty('investorUserId');
    expect(job?.scanJobToken).toHaveLength(43);
    expect(h.doc.status).toBe(IndividualKycDocumentStatus.PENDING_SCAN);
    expect(h.doc.scanJobTokenHash).not.toBe(job?.scanJobToken);
    expect(h.doc.scanAttemptCount).toBe(1);
  });

  it('marks CLEAN only after exact object/version/hash, valid ClamAV attestation, and consumes the token once', async () => {
    const h = makeHarness();
    const job = await h.service.claimNext('scanner-nigeria-1');
    const result = await h.service.recordResult(DOC_ID, 'scanner-nigeria-1', cleanResult(job!.scanJobToken));
    expect(result).toMatchObject({ status: IndividualKycDocumentStatus.UPLOADED, scanStatus: IndividualKycDocumentScanStatus.CLEAN, version: 8 });
    expect(h.doc).toMatchObject({ status: IndividualKycDocumentStatus.UPLOADED, scanStatus: IndividualKycDocumentScanStatus.CLEAN, storageObjectVersionId: VERSION_ID, expectedChecksumSha256: CHECKSUM, scannerVersion: 'ClamAV-1.4.3' });
    expect(h.doc.scanCompletedAt).toBeInstanceOf(Date);
    expect(h.doc.scanAttestationDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(h.doc.scanJobTokenHash).toBeNull();
    expect(h.events[0]).toMatchObject({ actorUserId: null, actorKind: IndividualKycEventActorKind.SCANNER_WORKER, actorReference: 'scanner:scanner-nigeria-1', eventKind: IndividualKycProfileEventKind.ID_DOCUMENT_SCAN_CLEAN, profileVersion: 8 });
    await expect(h.service.recordResult(DOC_ID, 'scanner-nigeria-1', cleanResult(job!.scanJobToken))).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([
    ['infected', 'INFECTED', IndividualKycDocumentScanStatus.REJECTED],
    ['scanner failure', 'FAILED', IndividualKycDocumentScanStatus.FAILED],
  ] as const)('keeps %s documents unapproved', async (_label, outcome, scanStatus) => {
    const h = makeHarness();
    const job = await h.service.claimNext('scanner-nigeria-1');
    const result = await h.service.recordResult(DOC_ID, 'scanner-nigeria-1', cleanResult(job!.scanJobToken, {
      outcome, scannerVersion: outcome === 'FAILED' ? null : 'ClamAV-1.4.3',
    }));
    expect(result).toMatchObject({ status: IndividualKycDocumentStatus.REMOVED, scanStatus });
    expect(h.doc.status).not.toBe(IndividualKycDocumentStatus.UPLOADED);
    expect(h.doc.scanCompletedAt).toBeInstanceOf(Date);
  });

  it('rejects forged, wrong-version, cross-worker, stale and replayed attestations', async () => {
    const h = makeHarness();
    const job = await h.service.claimNext('scanner-nigeria-1');
    await expect(h.service.recordResult(DOC_ID, 'scanner-nigeria-2', cleanResult(job!.scanJobToken))).rejects.toBeInstanceOf(ConflictException);
    await expect(h.service.recordResult(DOC_ID, 'scanner-nigeria-1', cleanResult('A'.repeat(43)))).rejects.toBeInstanceOf(ConflictException);
    await expect(h.service.recordResult(DOC_ID, 'scanner-nigeria-1', cleanResult(job!.scanJobToken, { objectVersionId: 'different-version' }))).rejects.toBeInstanceOf(ConflictException);
    await expect(h.service.recordResult(DOC_ID, 'scanner-nigeria-1', cleanResult(job!.scanJobToken, { sha256Base64: Buffer.alloc(32, 9).toString('base64') }))).rejects.toBeInstanceOf(ConflictException);
    h.doc.scanLeaseExpiresAt = new Date(Date.now() - 1);
    await expect(h.service.recordResult(DOC_ID, 'scanner-nigeria-1', cleanResult(job!.scanJobToken))).rejects.toBeInstanceOf(ConflictException);
    expect(h.doc.status).toBe(IndividualKycDocumentStatus.PENDING_SCAN);
  });

  it('retries stale profile-version writes rather than accepting a raced attestation', async () => {
    const h = makeHarness();
    const job = await h.service.claimNext('scanner-nigeria-1');
    h.db.$transaction.mockImplementationOnce(async (callback: (tx: any) => Promise<any>) => {
      h.profile.version += 1;
      return callback(h.db);
    });
    await expect(h.service.recordResult(DOC_ID, 'scanner-nigeria-1', cleanResult(job!.scanJobToken))).rejects.toBeInstanceOf(ConflictException);
    expect(h.events).toHaveLength(0);
  });

  it('deletes expired abandoned objects by exact version and records append-only cleanup', async () => {
    const h = makeHarness({
      status: IndividualKycDocumentStatus.PENDING_UPLOAD,
      scanStatus: IndividualKycDocumentScanStatus.PENDING,
      storageObjectVersionId: null,
      expectedChecksumSha256: CHECKSUM,
      uploadExpiresAt: new Date(Date.now() - 120_000),
      scanRequestedAt: null,
    });
    h.db.individualKycDocument.findMany.mockResolvedValue([h.doc]);
    const result = await h.service.cleanupExpired('worker-retention-1');
    expect(result.deleted).toBe(1);
    expect((h.storage.deleteObjectVersion as jest.Mock)).toHaveBeenCalledWith(h.doc.storageKey, VERSION_ID);
    expect(h.doc).toMatchObject({ status: IndividualKycDocumentStatus.REMOVED, objectDeletedAt: expect.any(Date) });
    expect(h.events[0]).toMatchObject({ actorKind: IndividualKycEventActorKind.RETENTION_WORKER, eventKind: IndividualKycProfileEventKind.ID_DOCUMENT_CLEANUP });
  });

  it('does not claim cleanup success or mutate state when provider deletion fails', async () => {
    const h = makeHarness({ status: IndividualKycDocumentStatus.REMOVED, objectDeletedAt: null, uploadExpiresAt: new Date(Date.now() - 120_000) });
    h.db.individualKycDocument.findMany.mockResolvedValue([h.doc]);
    (h.storage.deleteObjectVersion as jest.Mock).mockRejectedValue(new Error('provider failure'));
    expect(await h.service.cleanupExpired('worker-retention-1')).toEqual({ deleted: 0 });
    expect(h.doc.objectDeletedAt).toBeNull();
    expect(h.events).toHaveLength(0);
  });
});
