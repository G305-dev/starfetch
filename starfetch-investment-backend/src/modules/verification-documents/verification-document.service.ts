import { createHash, randomUUID } from 'crypto';
import { ConflictException, ForbiddenException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationVerificationRequirementKind, ApplicationVerificationRequirementState, ManualDocumentReviewDecision, ManualDocumentReviewStatus, OnboardingApplicationKind, OnboardingApplicationStatus, Prisma, UserRole, VerificationDocumentEventKind } from '@prisma/client';
import { AuthPrincipal } from '../../common/types/auth-principal';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { DOCUMENT_MALWARE_SCANNER, DocumentMalwareScanner, PRIVATE_DOCUMENT_STORAGE, PrivateDocumentStorage } from './document-infrastructure.ports';
import { VERIFICATION_DOCUMENT_REVIEW_AUTHORIZER, VerificationDocumentReviewAuthorizer } from './verification-document-review-authorizer';

const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DocumentUploadReceipt {
  readonly documentId: string;
  readonly applicationId: string;
  readonly requirementId: string;
  readonly documentKindKey: string;
  readonly version: number;
  readonly contentSha256: string;
  readonly contentLength: number;
  readonly state: 'UNDER_REVIEW';
  readonly manualReviewStatus: 'UNDER_REVIEW';
}

export interface DocumentDownloadReceipt {
  readonly documentId: string;
  readonly mediaType: string;
  readonly contentSha256: string;
  readonly bytes: Buffer;
}

/** Owner-scoped private document lifecycle and separately permission-gated staff review. */
@Injectable()
export class VerificationDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(PRIVATE_DOCUMENT_STORAGE) private readonly storage: PrivateDocumentStorage,
    @Inject(DOCUMENT_MALWARE_SCANNER) private readonly scanner: DocumentMalwareScanner,
    @Inject(VERIFICATION_DOCUMENT_REVIEW_AUTHORIZER) private readonly authorizer: VerificationDocumentReviewAuthorizer,
  ) {}

  async upload(
    principal: AuthPrincipal | null | undefined,
    input: {
      readonly applicationId: string;
      readonly requirementId: string;
      readonly bytes: Buffer;
      readonly mediaType: string;
      readonly replacesDocumentId?: string;
    },
  ): Promise<DocumentUploadReceipt> {
    const userId = await this.requireInvestor(principal);
    const retentionDays = this.requireCollectionGate();
    if (!UUID.test(input.applicationId) || !UUID.test(input.requirementId) ||
      (input.replacesDocumentId !== undefined && !UUID.test(input.replacesDocumentId)) ||
      !Buffer.isBuffer(input.bytes) || input.bytes.length === 0 || input.bytes.length > MAX_DOCUMENT_BYTES ||
      typeof input.mediaType !== 'string' || input.mediaType.length > 120 ||
      !/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(input.mediaType)) throw invalidUpload();

    const context = await this.requireCurrentRequiredDocument(userId, input.applicationId, input.requirementId);
    let replacement: { id: string; version: number } | null = null;
    if (input.replacesDocumentId) {
      replacement = await this.prisma.verificationDocument.findFirst({
        where: { id: input.replacesDocumentId, applicationId: context.applicationId, requirementId: context.requirementId },
        select: { id: true, version: true },
      });
      if (!replacement) throw new ForbiddenException();
      const superseding = await this.prisma.verificationDocument.findFirst({ where: { replacesDocumentId: replacement.id }, select: { id: true } });
      if (superseding) throw new ConflictException('Document replacement is already in progress.');
    }

    const documentId = randomUUID();
    const objectKey = `onboarding-documents/${randomUUID()}`;
    const hash = createHash('sha256').update(input.bytes).digest('hex');
    let uploadedVersionId: string | null = null;
    try {
      const versionId = await this.storage.putQuarantined(objectKey, input.bytes, { sha256: hash, mediaType: input.mediaType, documentId });
      if (!versionId || versionId.length > 256) throw unavailable();
      uploadedVersionId = versionId;
    } catch {
      throw unavailable();
    }
    const uploadedAt = new Date();
    const retentionExpiresAt = new Date(uploadedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
    try {
      const document = await this.prisma.$transaction(async (tx) => {
        const row = await tx.verificationDocument.create({
          data: {
            id: documentId,
            applicationId: context.applicationId,
            requirementId: context.requirementId,
            uploadedByUserId: userId,
            replacesDocumentId: replacement?.id ?? null,
            documentKindKey: context.documentKindKey,
            objectKey,
            contentSha256: hash,
            contentLength: BigInt(input.bytes.length),
            mediaType: input.mediaType,
            version: replacement ? replacement.version + 1 : 1,
            storageObjectVersionId: uploadedVersionId,
            uploadedAt,
            retentionExpiresAt,
            manualReviewStatus: ManualDocumentReviewStatus.UNDER_REVIEW,
          },
        });
        await tx.verificationDocumentEvent.create({
          data: { documentId: row.id, actorUserId: userId, eventKind: VerificationDocumentEventKind.UPLOADED },
        });
        return row;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 });
      return {
        documentId: document.id,
        applicationId: document.applicationId,
        requirementId: document.requirementId,
        documentKindKey: document.documentKindKey,
        version: document.version,
        contentSha256: document.contentSha256,
        contentLength: Number(document.contentLength),
        state: 'UNDER_REVIEW',
        manualReviewStatus: 'UNDER_REVIEW',
      };
    } catch (error) {
      try { if (uploadedVersionId) await this.storage.delete(objectKey, uploadedVersionId); } catch { /* private object remains unreachable without metadata */ }
      throw error;
    }
  }

  /** Internal scanner worker operation. No caller can mark a document clean. */
  async scanQuarantined(documentId: string): Promise<'SCAN_CLEAN' | 'SCAN_REJECTED'> {
    this.requireCollectionGate();
    if (!UUID.test(documentId)) throw invalidUpload();
    const document = await this.prisma.verificationDocument.findUnique({
      where: { id: documentId },
      include: { events: { orderBy: { sequence: 'desc' } } },
    });
    if (!document || !document.storageObjectVersionId || effectiveDocumentState(document.events) !== 'QUARANTINED') throw new ConflictException('Document is not eligible for optional scanning.');
    let bytes: Buffer | undefined;
    try {
bytes = await this.storage.readQuarantined(document.objectKey, document.storageObjectVersionId);
      const scan = await this.scanner.scan(bytes);
      if (!/^[A-Za-z0-9._-]{1,64}$/.test(scan.scannerVersion)) throw unavailable();
      await this.prisma.$transaction(async (tx) => {
        const latest = await tx.verificationDocumentEvent.findFirst({
          where: { documentId }, orderBy: { sequence: 'desc' },
        });
        if (!latest || latest.eventKind !== VerificationDocumentEventKind.QUARANTINED) throw new ConflictException('Document is not quarantined.');
        if (scan.clean && document.replacesDocumentId) {
          await tx.verificationDocumentEvent.create({
            data: {
              documentId: document.replacesDocumentId,
              actorUserId: document.uploadedByUserId,
              eventKind: VerificationDocumentEventKind.REPLACED,
              safeReason: 'REPLACED_AFTER_CLEAN_SCAN',
            },
          });
        }
        await tx.verificationDocumentEvent.create({
          data: {
            documentId,
            eventKind: scan.clean ? VerificationDocumentEventKind.SCAN_CLEAN : VerificationDocumentEventKind.SCAN_REJECTED,
            scannerVersion: scan.scannerVersion,
            safeReason: safeReason(scan.safeReason),
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 });
      return scan.clean ? 'SCAN_CLEAN' : 'SCAN_REJECTED';
    } catch {
      // Failure to read/scan/write leaves the document quarantined.
      throw unavailable();
    } finally {
      bytes?.fill(0);
    }
  }

  async downloadOwn(principal: AuthPrincipal | null | undefined, documentId: string): Promise<DocumentDownloadReceipt> {
    const userId = await this.requireInvestor(principal);
    this.requireCollectionGate();
    if (!UUID.test(documentId)) throw new ForbiddenException();
    const document = await this.prisma.verificationDocument.findFirst({
      where: {
        id: documentId,
        deletedAt: null,
        application: {
          OR: [
            { initiatingUserId: userId },
            { kind: OnboardingApplicationKind.INDIVIDUAL, ownerUserId: userId },
            { kind: OnboardingApplicationKind.JOINT, jointOwner: { members: { some: { userId } } } },
          ],
        },
      },
      include: { events: { orderBy: { sequence: 'desc' } } },
    });
    if (!document || document.manualReviewStatus !== ManualDocumentReviewStatus.ACCEPTED || !document.storageObjectVersionId) throw new ForbiddenException();
    let bytes: Buffer;
    try { bytes = await this.storage.readQuarantined(document.objectKey, document.storageObjectVersionId); } catch { throw unavailable(); }
    try {
      await this.prisma.verificationDocumentEvent.create({
        data: { documentId, actorUserId: userId, eventKind: VerificationDocumentEventKind.ACCESS_GRANTED },
      });
    } catch {
      bytes.fill(0);
      throw unavailable();
    }
    return { documentId, mediaType: document.mediaType, contentSha256: document.contentSha256, bytes };
  }

  async listReviewQueue(principal: AuthPrincipal | null | undefined) {
    const actor = await this.requireStaff(principal);
    const docs = await this.prisma.verificationDocument.findMany({
      where: { manualReviewStatus: ManualDocumentReviewStatus.UNDER_REVIEW, deletedAt: null },
      orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }], take: 100,
      select: { id: true, applicationId: true, requirementId: true, documentKindKey: true, mediaType: true, contentLength: true, version: true, uploadedAt: true, manualReviewStatus: true },
    });
    const permitted: typeof docs = [];
    for (const doc of docs) {
      if (await this.authorizer.authorizeReview(actor, doc.applicationId)) {
        permitted.push(doc);
        await this.appendDocumentEvent(doc.id, actor.userId, VerificationDocumentEventKind.METADATA_LISTED);
      }
    }
    return { documents: permitted.map(({ contentLength, uploadedAt, ...doc }) => ({ ...doc, contentLength: contentLength.toString(), uploadedAt: uploadedAt?.toISOString() ?? null })) };
  }

  async authorizeReviewView(principal: AuthPrincipal | null | undefined, documentId: string) {
    const actor = await this.requireStaff(principal);
    if (!UUID.test(documentId)) throw new ForbiddenException();
    const doc = await this.prisma.verificationDocument.findUnique({ where: { id: documentId, deletedAt: null }, select: { id: true, applicationId: true, objectKey: true, storageObjectVersionId: true, manualReviewStatus: true } });
    if (!doc || doc.manualReviewStatus !== ManualDocumentReviewStatus.UNDER_REVIEW || !doc.storageObjectVersionId || !await this.authorizer.authorizeReview(actor, doc.applicationId)) throw new ForbiddenException();
    const filename = `document-${doc.id}.bin`;
    const view = await this.storage.createViewAuthorization(doc.objectKey, doc.storageObjectVersionId, filename, 60);
    await this.appendDocumentEvent(doc.id, actor.userId, VerificationDocumentEventKind.VIEW_AUTHORIZATION_ISSUED);
    return { documentId, viewUrl: view.viewUrl, expiresAt: view.expiresAt.toISOString(), disposition: 'attachment' as const, sandboxRequired: true };
  }

  async decideReview(principal: AuthPrincipal | null | undefined, documentId: string, decision: import('@prisma/client').ManualDocumentReviewDecision, safeReason: string) {
    const actor = await this.requireStaff(principal);
    if (!UUID.test(documentId) || !Object.values(ManualDocumentReviewDecision).includes(decision) || !/^[A-Z][A-Z0-9_]{1,79}$/.test(safeReason)) throw new ForbiddenException();
    const doc = await this.prisma.verificationDocument.findUnique({ where: { id: documentId, deletedAt: null }, select: { id: true, applicationId: true, manualReviewStatus: true } });
    if (!doc || doc.manualReviewStatus !== ManualDocumentReviewStatus.UNDER_REVIEW || !await this.authorizer.authorizeReview(actor, doc.applicationId)) throw new ForbiddenException();
    const next = decision === ManualDocumentReviewDecision.ACCEPT ? ManualDocumentReviewStatus.ACCEPTED : ManualDocumentReviewStatus.REJECTED;
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.verificationDocument.updateMany({ where: { id: documentId, deletedAt: null, manualReviewStatus: ManualDocumentReviewStatus.UNDER_REVIEW }, data: { manualReviewStatus: next } });
      if (changed.count !== 1) throw new ConflictException('Document review has already been recorded.');
      const latest = await tx.verificationDocumentEvent.findFirst({ where: { documentId }, orderBy: { sequence: 'desc' }, select: { sequence: true } });
      await tx.verificationDocumentEvent.create({ data: { documentId, actorUserId: actor.userId, sequence: (latest?.sequence ?? 0) + 1, eventKind: decision === ManualDocumentReviewDecision.ACCEPT ? VerificationDocumentEventKind.REVIEW_ACCEPTED : VerificationDocumentEventKind.REVIEW_REJECTED, decision, safeReason } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
    return { documentId, manualReviewStatus: next, decision, customerIdentityApproved: false };
  }

  /** Internal retention-worker hook; callers must invoke this only after approved lifecycle scheduling is enabled. */
  async cleanupExpired(limit = 25): Promise<{ deleted: number }> {
    const now = new Date();
    const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(limit, 100)) : 25;
    const candidates = await this.prisma.verificationDocument.findMany({
      where: { deletedAt: null, retentionExpiresAt: { lte: now }, storageObjectVersionId: { not: null } },
      orderBy: [{ retentionExpiresAt: 'asc' }, { id: 'asc' }], take: safeLimit,
      select: { id: true, objectKey: true, storageObjectVersionId: true },
    });
    let deleted = 0;
    for (const document of candidates) {
      if (!document.storageObjectVersionId) continue;
      try {
        await this.storage.delete(document.objectKey, document.storageObjectVersionId);
        const recorded = await this.prisma.$transaction(async (tx) => {
          const changed = await tx.verificationDocument.updateMany({ where: { id: document.id, deletedAt: null, retentionExpiresAt: { lte: now } }, data: { deletedAt: now } });
          if (changed.count !== 1) return false;
          const latest = await tx.verificationDocumentEvent.findFirst({ where: { documentId: document.id }, orderBy: { sequence: 'desc' }, select: { sequence: true } });
          await tx.verificationDocumentEvent.create({ data: { documentId: document.id, actorUserId: null, sequence: (latest?.sequence ?? 0) + 1, eventKind: VerificationDocumentEventKind.RETENTION_DELETED, safeReason: 'RETENTION_EXPIRED' } });
          return true;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
        if (recorded) deleted += 1;
      } catch { /* keep metadata for retry; never log object keys or provider errors */ }
    }
    return { deleted };
  }

  private async requireStaff(principal: AuthPrincipal | null | undefined): Promise<AuthPrincipal> {
    if (!principal || !UUID.test(principal.userId) || !principal.sessionId || (principal.role !== UserRole.STAFF && principal.role !== UserRole.ADMIN)) throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({ where: { id: principal.userId }, select: { id: true, role: true, emailVerifiedAt: true } });
    if (!user || user.role !== principal.role || !user.emailVerifiedAt) throw new ForbiddenException();
    return principal;
  }

  private async appendDocumentEvent(documentId: string, actorUserId: string, eventKind: VerificationDocumentEventKind) {
    await this.prisma.$transaction(async (tx) => {
      const latest = await tx.verificationDocumentEvent.findFirst({ where: { documentId }, orderBy: { sequence: 'desc' }, select: { sequence: true } });
      await tx.verificationDocumentEvent.create({ data: { documentId, actorUserId, sequence: (latest?.sequence ?? 0) + 1, eventKind } });
    });
  }

  private async requireCurrentRequiredDocument(userId: string, applicationId: string, requirementId: string): Promise<{
    applicationId: string; requirementId: string; documentKindKey: string;
  }> {
    const application = await this.prisma.onboardingApplication.findFirst({
      where: {
        id: applicationId,
        status: { in: [OnboardingApplicationStatus.DRAFT, OnboardingApplicationStatus.INFO_REQUESTED] },
        OR: [
          { initiatingUserId: userId },
          { kind: OnboardingApplicationKind.INDIVIDUAL, ownerUserId: userId },
          { kind: OnboardingApplicationKind.JOINT, jointOwner: { members: { some: { userId } } } },
        ],
      },
      include: {
        verificationSnapshots: { orderBy: { generation: 'desc' }, take: 1, select: { id: true, corporateDetailsVersion: true, jointMembershipVersion: true } },
        corporateDetails: { select: { version: true } },
        jointOwner: { select: { membershipVersion: true } },
      },
    });
    if (!application) throw new ForbiddenException();
    const snapshot = application.verificationSnapshots[0];
    if (!snapshot || (application.kind === OnboardingApplicationKind.CORPORATE && snapshot.corporateDetailsVersion !== application.corporateDetails?.version) ||
      (application.kind === OnboardingApplicationKind.JOINT && snapshot.jointMembershipVersion !== application.jointOwner?.membershipVersion)) {
      throw new ConflictException('Verification requirements are stale or unavailable.');
    }
    const requirement = await this.prisma.applicationVerificationRequirement.findFirst({
      where: {
        id: requirementId,
        snapshotId: snapshot.id,
        requirementKind: ApplicationVerificationRequirementKind.CONDITIONAL_DOCUMENT,
        state: ApplicationVerificationRequirementState.PENDING,
        unresolvedIssue: null,
        documentKindKeySnapshot: { not: null },
      },
      select: { id: true, documentKindKeySnapshot: true },
    });
    if (!requirement?.documentKindKeySnapshot) throw new ForbiddenException();
    return { applicationId, requirementId: requirement.id, documentKindKey: requirement.documentKindKeySnapshot };
  }

  private async requireInvestor(principal: AuthPrincipal | null | undefined): Promise<string> {
    if (!principal || !UUID.test(principal.userId) || !principal.sessionId || principal.role !== UserRole.INVESTOR) throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({ where: { id: principal.userId }, select: { id: true, role: true, emailVerifiedAt: true } });
    if (!user || user.role !== UserRole.INVESTOR || !user.emailVerifiedAt) throw new ForbiddenException();
    return user.id;
  }

  private requireCollectionGate(): number {
    const retentionDays = this.config.get<number>('individualKyc.s3.retentionDays') ?? 0;
    if (!this.config.get<boolean>('verification.documentCollectionEnabled') || !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) throw unavailable();
    return retentionDays;
  }
}

function effectiveDocumentState(events: readonly { eventKind: VerificationDocumentEventKind }[]): Exclude<VerificationDocumentEventKind, 'ACCESS_GRANTED'> | null {
  const meaningful = events.find((event) => event.eventKind !== VerificationDocumentEventKind.ACCESS_GRANTED)?.eventKind;
  if (meaningful === VerificationDocumentEventKind.QUARANTINED || meaningful === VerificationDocumentEventKind.SCAN_CLEAN ||
    meaningful === VerificationDocumentEventKind.SCAN_REJECTED || meaningful === VerificationDocumentEventKind.REPLACED) return meaningful;
  return null;
}

function safeReason(reason: string | null): string | null {
  return reason && /^[A-Z0-9_]{1,80}$/.test(reason) ? reason : reason ? 'SCAN_RESULT_REDACTED' : null;
}

function invalidUpload(): ServiceUnavailableException {
  return new ServiceUnavailableException({ code: 'FEATURE_UNAVAILABLE', message: 'Document collection is unavailable.' });
}

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({ code: 'FEATURE_UNAVAILABLE', message: 'Private document storage is not configured.' });
}
