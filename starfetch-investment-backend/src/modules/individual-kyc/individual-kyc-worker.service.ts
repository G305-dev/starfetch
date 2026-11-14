import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IndividualKycDocumentScanStatus, IndividualKycDocumentStatus, IndividualKycEventActorKind, IndividualKycProfileEventKind, IndividualKycProfileStatus } from '@prisma/client';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { IndividualKycDocumentStorage } from './individual-kyc-document-ports';
import { canonicalJson } from './individual-kyc-worker-auth';

export interface KycWorkerScanResult {
  outcome: 'CLEAN' | 'INFECTED' | 'FAILED';
  objectVersionId: string;
  sha256Base64: string;
  scannerEngine: 'clamd';
  scannerVersion: string | null;
  scannedAt: string;
  scanJobToken: string;
}

const MAX_SCAN_ATTEMPTS = 5;
const SCAN_LEASE_MS = 5 * 60 * 1000;

@Injectable()
export class IndividualKycWorkerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: IndividualKycDocumentStorage,
  ) {}

  async claimNext(workerId: string) {
    const now = new Date();
    const document = await this.prisma.individualKycDocument.findFirst({
      where: {
        status: IndividualKycDocumentStatus.PENDING_SCAN,
        scanStatus: IndividualKycDocumentScanStatus.PENDING,
        scanAttemptCount: { lt: MAX_SCAN_ATTEMPTS },
        OR: [{ scanLeaseExpiresAt: null }, { scanLeaseExpiresAt: { lte: now } }],
      },
      orderBy: [{ scanRequestedAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, kycProfileId: true, status: true, scanStatus: true,
        storageKey: true, storageObjectVersionId: true, contentType: true,
        sizeBytes: true, expectedChecksumSha256: true, scanRequestedAt: true,
        scanAttemptCount: true, scanLeaseExpiresAt: true,
      },
    });
    if (!document || !document.storageObjectVersionId || !document.expectedChecksumSha256 || !document.scanRequestedAt) return null;
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const leaseExpiresAt = new Date(now.getTime() + SCAN_LEASE_MS);
    const claimed = await this.prisma.individualKycDocument.updateMany({
      where: {
        id: document.id,
        status: IndividualKycDocumentStatus.PENDING_SCAN,
        scanStatus: IndividualKycDocumentScanStatus.PENDING,
        scanAttemptCount: document.scanAttemptCount,
        scanLeaseExpiresAt: document.scanLeaseExpiresAt,
      },
      data: {
        scanClaimedAt: now,
        scanLeaseExpiresAt: leaseExpiresAt,
        scanWorkerId: workerId,
        scanJobTokenHash: tokenHash,
        scanAttemptCount: { increment: 1 },
      },
    });
    if (claimed.count !== 1) return null;
    return {
      documentId: document.id,
      objectKey: document.storageKey,
      objectVersionId: document.storageObjectVersionId,
      contentType: document.contentType as 'application/pdf' | 'image/jpeg' | 'image/png',
      sizeBytes: Number(document.sizeBytes),
      checksumSha256: document.expectedChecksumSha256,
      scanRequestedAt: document.scanRequestedAt.toISOString(),
      scanJobToken: token,
    };
  }

  async recordResult(documentId: string, workerId: string, result: KycWorkerScanResult) {
    const now = new Date();
    if (!/^[0-9a-f-]{36}$/i.test(documentId) || !/^[A-Za-z0-9._-]{1,80}$/.test(workerId) ||
        !result || !['CLEAN', 'INFECTED', 'FAILED'].includes(result.outcome) ||
        result.scannerEngine !== 'clamd' || !/^[A-Za-z0-9_-]{40,128}$/.test(result.scanJobToken) ||
        !/^[A-Za-z0-9+/]{43}=$/.test(result.sha256Base64) ||
        typeof result.objectVersionId !== 'string' || result.objectVersionId.length > 256) throw new ConflictException('Scan attestation is invalid or stale.');
    const document = await this.prisma.individualKycDocument.findUnique({
      where: { id: documentId },
      include: { kycProfile: { select: { id: true, version: true, status: true, investorUserId: true } } },
    });
    if (!document || document.status !== IndividualKycDocumentStatus.PENDING_SCAN ||
        document.scanStatus !== IndividualKycDocumentScanStatus.PENDING ||
        document.scanWorkerId !== workerId || !document.scanJobTokenHash ||
        !document.scanLeaseExpiresAt || document.scanLeaseExpiresAt.getTime() <= now.getTime() ||
        result.objectVersionId !== document.storageObjectVersionId ||
        !safeDigestEqual(document.scanJobTokenHash, createHash('sha256').update(result.scanJobToken).digest('hex'))) {
      throw new ConflictException('Scan attestation is invalid or stale.');
    }
    if (document.kycProfile.status !== IndividualKycProfileStatus.DRAFT) throw new ConflictException('Scan job is no longer eligible.');
    const scannedAt = new Date(result.scannedAt);
    if (!Number.isFinite(scannedAt.getTime()) || scannedAt.getTime() > now.getTime() + 30_000 ||
        scannedAt.getTime() < (document.scanClaimedAt?.getTime() ?? now.getTime()) - 30_000 ||
        now.getTime() - scannedAt.getTime() > SCAN_LEASE_MS) throw new ConflictException('Scan attestation timestamp is invalid or stale.');
    if (result.outcome !== 'FAILED' && (!result.scannerVersion || !/^[A-Za-z0-9._-]{1,64}$/.test(result.scannerVersion))) throw new ConflictException('Scanner version is missing.');
    if (result.scannerVersion !== null && !/^[A-Za-z0-9._-]{1,64}$/.test(result.scannerVersion)) throw new ConflictException('Scanner version is invalid.');
    if (result.outcome !== 'FAILED' && result.sha256Base64 !== document.expectedChecksumSha256) throw new ConflictException('Scanned object digest did not match the signed upload.');

    const isClean = result.outcome === 'CLEAN';
    const status = isClean ? IndividualKycDocumentStatus.UPLOADED : IndividualKycDocumentStatus.REMOVED;
    const scanStatus = isClean ? IndividualKycDocumentScanStatus.CLEAN :
      result.outcome === 'INFECTED' ? IndividualKycDocumentScanStatus.REJECTED : IndividualKycDocumentScanStatus.FAILED;
    const digestBody = {
      documentId, outcome: result.outcome, objectVersionId: result.objectVersionId,
      sha256Base64: result.sha256Base64, scannerEngine: result.scannerEngine,
      scannerVersion: result.scannerVersion, scannedAt: scannedAt.toISOString(),
    };
    const attestationDigest = createHash('sha256').update(canonicalJson(digestBody)).digest('hex');
    const configuredRetentionDays = this.config.get<number>('individualKyc.s3.retentionDays') ?? 0;
    if (isClean && (!Number.isInteger(configuredRetentionDays) || configuredRetentionDays < 1 || configuredRetentionDays > 3650)) {
      throw new ConflictException('Approved document-retention configuration is unavailable.');
    }
    const retentionExpiresAt = isClean ? new Date(now.getTime() + configuredRetentionDays * 24 * 60 * 60 * 1000) : null;

    return this.prisma.$transaction(async (tx) => {
      const changedDocument = await tx.individualKycDocument.updateMany({
        where: {
          id: document.id,
          kycProfileId: document.kycProfileId,
          status: IndividualKycDocumentStatus.PENDING_SCAN,
          scanStatus: IndividualKycDocumentScanStatus.PENDING,
          scanJobTokenHash: document.scanJobTokenHash,
          scanWorkerId: workerId,
          scanLeaseExpiresAt: { gt: now },
        },
        data: {
          status,
          scanStatus,
          scannerVersion: result.scannerVersion,
          scanCompletedAt: scannedAt,
          scanSha256: result.sha256Base64,
          scanAttestationDigest: attestationDigest,
          scanJobTokenHash: null,
          scanWorkerId: null,
          scanLeaseExpiresAt: null,
          retentionExpiresAt,
        },
      });
      if (changedDocument.count !== 1) throw new ConflictException('Scan attestation is invalid or stale.');
      const nextVersion = document.kycProfile.version + 1;
      const changedProfile = await tx.individualKycProfile.updateMany({
        where: { id: document.kycProfile.id, investorUserId: document.kycProfile.investorUserId, version: document.kycProfile.version, status: IndividualKycProfileStatus.DRAFT },
        data: { version: { increment: 1 } },
      });
      if (changedProfile.count !== 1) throw new ConflictException('KYC profile changed while the scan result was being recorded.');
      await tx.individualKycProfileEvent.create({ data: {
        kycProfileId: document.kycProfile.id,
        actorUserId: null,
        actorKind: IndividualKycEventActorKind.SCANNER_WORKER,
        actorReference: `scanner:${workerId}`,
        eventKind: isClean ? IndividualKycProfileEventKind.ID_DOCUMENT_SCAN_CLEAN : IndividualKycProfileEventKind.ID_DOCUMENT_SCAN_REJECTED,
        profileVersion: nextVersion,
        relatedDocumentId: document.id,
      } });
      return { documentId: document.id, status, scanStatus, version: nextVersion, scannedAt: scannedAt.toISOString() };
    });
  }

  async cleanupExpired(workerId: string): Promise<{ deleted: number }> {
    const now = new Date();
    const uploadCutoff = new Date(now.getTime() - UPLOAD_EXPIRY_CLEANUP_GRACE_MS);
    const candidates = await this.prisma.individualKycDocument.findMany({
      where: {
        objectDeletedAt: null,
        OR: [
          { status: IndividualKycDocumentStatus.PENDING_UPLOAD, uploadExpiresAt: { lte: uploadCutoff } },
          { status: IndividualKycDocumentStatus.PENDING_SCAN, uploadExpiresAt: { lte: uploadCutoff }, OR: [{ scanLeaseExpiresAt: null }, { scanLeaseExpiresAt: { lte: now } }] },
          { status: IndividualKycDocumentStatus.REMOVED, uploadExpiresAt: { lte: uploadCutoff } },
          { status: IndividualKycDocumentStatus.UPLOADED, retentionExpiresAt: { lte: now } },
        ],
      },
      orderBy: { updatedAt: 'asc' },
      take: 25,
      select: {
        id: true, kycProfileId: true, investorUserId: true, storageKey: true,
        storageObjectVersionId: true, status: true, scanStatus: true,
        uploadExpiresAt: true, retentionExpiresAt: true, objectDeletedAt: true,
      },
    });
    let deleted = 0;
    for (const doc of candidates) {
      try {
        let versionId = doc.storageObjectVersionId;
        if (!versionId) {
          const metadata = await this.storage.headQuarantined(doc.storageKey);
          if (metadata) {
            if (metadata.documentIdMetadata !== doc.id || !metadata.versionId) continue;
            versionId = metadata.versionId;
          }
        }
        if (versionId) await this.storage.deleteObjectVersion(doc.storageKey, versionId);
        const updated = await this.markDeleted(doc, workerId, now);
        if (updated) deleted += 1;
      } catch {
        // Keep the row and private object for a later retry; never log keys or provider errors.
      }
    }
    return { deleted };
  }

  private async markDeleted(doc: {
    id: string; kycProfileId: string; investorUserId: string; status: IndividualKycDocumentStatus;
    scanStatus: IndividualKycDocumentScanStatus; objectDeletedAt: Date | null;
  }, workerId: string, now: Date): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.individualKycProfile.findUnique({ where: { id: doc.kycProfileId }, select: { id: true, investorUserId: true, version: true, status: true } });
      if (!profile) return false;
      const data: Record<string, unknown> = { objectDeletedAt: now };
      const where: Record<string, unknown> = { id: doc.id, objectDeletedAt: null };
      if (doc.status === IndividualKycDocumentStatus.PENDING_UPLOAD) {
        Object.assign(where, { status: IndividualKycDocumentStatus.PENDING_UPLOAD });
        Object.assign(data, { status: IndividualKycDocumentStatus.REMOVED, scanStatus: IndividualKycDocumentScanStatus.FAILED });
      } else if (doc.status === IndividualKycDocumentStatus.PENDING_SCAN) {
        Object.assign(where, { status: IndividualKycDocumentStatus.PENDING_SCAN, scanLeaseExpiresAt: { lte: now } });
        Object.assign(data, {
          status: IndividualKycDocumentStatus.REMOVED,
          scanStatus: IndividualKycDocumentScanStatus.FAILED,
          scanJobTokenHash: null, scanWorkerId: null, scanLeaseExpiresAt: null,
        });
      } else {
        Object.assign(where, { status: doc.status });
        if (doc.status === IndividualKycDocumentStatus.UPLOADED) Object.assign(data, { status: IndividualKycDocumentStatus.REMOVED });
      }
      const changedDoc = await tx.individualKycDocument.updateMany({ where: where as never, data: data as never });
      if (changedDoc.count !== 1) return false;
      const nextVersion = profile.version + 1;
      const changedProfile = await tx.individualKycProfile.updateMany({
        where: { id: profile.id, investorUserId: profile.investorUserId, version: profile.version },
        data: { version: { increment: 1 } },
      });
      if (changedProfile.count !== 1) throw new ConflictException('KYC profile changed during cleanup.');
      await tx.individualKycProfileEvent.create({ data: {
        kycProfileId: profile.id,
        actorUserId: null,
        actorKind: IndividualKycEventActorKind.RETENTION_WORKER,
        actorReference: `retention:${workerId}`,
        eventKind: IndividualKycProfileEventKind.ID_DOCUMENT_CLEANUP,
        profileVersion: nextVersion,
        relatedDocumentId: doc.id,
      } });
      return true;
    });
  }
}

function safeDigestEqual(expectedHex: string, actualHex: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(actualHex, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const UPLOAD_EXPIRY_CLEANUP_GRACE_MS = 60 * 1000;
