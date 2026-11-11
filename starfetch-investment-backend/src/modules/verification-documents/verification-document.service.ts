import { createHash, randomUUID } from 'crypto';
import { ConflictException, ForbiddenException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationVerificationRequirementKind, ApplicationVerificationRequirementState, OnboardingApplicationKind, OnboardingApplicationStatus, Prisma, UserRole, VerificationDocumentEventKind } from '@prisma/client';
import { AuthPrincipal } from '../../common/types/auth-principal';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { DOCUMENT_MALWARE_SCANNER, DocumentMalwareScanner, PRIVATE_DOCUMENT_STORAGE, PrivateDocumentStorage } from './document-infrastructure.ports';

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
  readonly state: 'QUARANTINED';
}

export interface DocumentDownloadReceipt {
  readonly documentId: string;
  readonly mediaType: string;
  readonly contentSha256: string;
  readonly bytes: Buffer;
}

/** Owner-scoped private document lifecycle; no upload/download route is registered. */
@Injectable()
export class VerificationDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(PRIVATE_DOCUMENT_STORAGE) private readonly storage: PrivateDocumentStorage,
    @Inject(DOCUMENT_MALWARE_SCANNER) private readonly scanner: DocumentMalwareScanner,
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
    this.requireCollectionGate();
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
    const objectKey = randomUUID();
    const hash = createHash('sha256').update(input.bytes).digest('hex');
    try {
      await this.storage.putQuarantined(objectKey, input.bytes, { sha256: hash, mediaType: input.mediaType });
    } catch {
      throw unavailable();
    }
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
          },
        });
        await tx.verificationDocumentEvent.create({
          data: { documentId: row.id, actorUserId: userId, eventKind: VerificationDocumentEventKind.QUARANTINED },
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
        state: 'QUARANTINED',
      };
    } catch (error) {
      try { await this.storage.delete(objectKey); } catch { /* private object remains unreachable without metadata */ }
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
    if (!document || effectiveDocumentState(document.events) !== 'QUARANTINED') throw new ConflictException('Document is not quarantined.');
    let bytes: Buffer | undefined;
    try {
      bytes = await this.storage.readQuarantined(document.objectKey);
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
    if (!document || effectiveDocumentState(document.events) !== 'SCAN_CLEAN') throw new ForbiddenException();
    let bytes: Buffer;
    try { bytes = await this.storage.readQuarantined(document.objectKey); } catch { throw unavailable(); }
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

  private requireCollectionGate(): void {
    if (!this.config.get<boolean>('verification.documentCollectionEnabled')) throw unavailable();
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
  return new ServiceUnavailableException({ code: 'FEATURE_UNAVAILABLE', message: 'Private document storage and scanning are not configured.' });
}
