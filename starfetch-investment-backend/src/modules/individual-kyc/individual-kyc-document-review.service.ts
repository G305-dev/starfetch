import { ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { IndividualKycDocumentReviewAction, IndividualKycDocumentStatus, ManualDocumentReviewDecision, ManualDocumentReviewStatus, Prisma, UserRole } from '@prisma/client';
import { AuthPrincipal } from '../../common/types/auth-principal';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { INDIVIDUAL_KYC_DOCUMENT_STORAGE, IndividualKycDocumentStorage } from './individual-kyc-document-ports';
import { INDIVIDUAL_KYC_DOCUMENT_REVIEW_AUTHORIZER, IndividualKycDocumentReviewAuthorizer } from './individual-kyc-document-review-authorizer';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REASON = /^[A-Z][A-Z0-9_]{1,79}$/;

@Injectable()
export class IndividualKycDocumentReviewService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(INDIVIDUAL_KYC_DOCUMENT_STORAGE) private readonly storage: IndividualKycDocumentStorage,
    @Inject(INDIVIDUAL_KYC_DOCUMENT_REVIEW_AUTHORIZER) private readonly authorizer: IndividualKycDocumentReviewAuthorizer,
  ) {}

  async listQueue(principal: AuthPrincipal | null | undefined) {
    const actor = await this.requireStaff(principal);
    if (!await this.authorizer.authorizeQueue(actor)) throw new ForbiddenException();
    const documents = await this.prisma.individualKycDocument.findMany({
      where: { status: IndividualKycDocumentStatus.UNDER_REVIEW, manualReviewStatus: ManualDocumentReviewStatus.UNDER_REVIEW },
      orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }], take: 100,
      select: { id: true, documentType: true, originalFilename: true, contentType: true, sizeBytes: true, uploadedAt: true, manualReviewStatus: true, kycProfileId: true },
    });
    for (const document of documents) await this.appendEvent(document.id, actor.userId, IndividualKycDocumentReviewAction.METADATA_LISTED);
    return { documents: documents.map(({ sizeBytes, uploadedAt, ...doc }) => ({ ...doc, sizeBytes: sizeBytes.toString(), uploadedAt: uploadedAt?.toISOString() ?? null })) };
  }

  async authorizeView(principal: AuthPrincipal | null | undefined, documentId: string) {
    const actor = await this.requireStaff(principal);
    this.requireDocumentId(documentId);
    if (!await this.authorizer.authorizeDocument(actor, documentId)) throw new ForbiddenException();
    const document = await this.prisma.individualKycDocument.findFirst({
      where: { id: documentId, status: IndividualKycDocumentStatus.UNDER_REVIEW, manualReviewStatus: ManualDocumentReviewStatus.UNDER_REVIEW },
      select: { id: true, storageKey: true, storageObjectVersionId: true, originalFilename: true },
    });
    if (!document || !document.storageObjectVersionId) throw new NotFoundException();
    const view = await this.storage.createViewAuthorization({ objectKey: document.storageKey, versionId: document.storageObjectVersionId, filename: document.originalFilename, expiresInSeconds: 60 });
    await this.appendEvent(document.id, actor.userId, IndividualKycDocumentReviewAction.VIEW_AUTHORIZATION_ISSUED);
    return { documentId, viewUrl: view.viewUrl, expiresAt: view.expiresAt.toISOString(), disposition: 'attachment' as const, sandboxRequired: true };
  }

  async decide(principal: AuthPrincipal | null | undefined, documentId: string, decision: ManualDocumentReviewDecision, reasonCode: string) {
    const actor = await this.requireStaff(principal);
    this.requireDocumentId(documentId);
    if (!Object.values(ManualDocumentReviewDecision).includes(decision) || !REASON.test(reasonCode) || !await this.authorizer.authorizeDecision(actor, documentId)) throw new ForbiddenException();
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.individualKycDocument.findFirst({ where: { id: documentId, status: IndividualKycDocumentStatus.UNDER_REVIEW, manualReviewStatus: ManualDocumentReviewStatus.UNDER_REVIEW }, select: { id: true } });
      if (!document) throw new NotFoundException();
      const sequence = await this.nextSequence(tx, document.id);
      const manualReviewStatus = decision === ManualDocumentReviewDecision.ACCEPT ? ManualDocumentReviewStatus.ACCEPTED : ManualDocumentReviewStatus.REJECTED;
      await tx.individualKycDocument.update({ where: { id: document.id }, data: { manualReviewStatus } });
      await tx.individualKycDocumentReviewEvent.create({ data: { documentId: document.id, actorUserId: actor.userId, sequence, action: IndividualKycDocumentReviewAction.DECISION_RECORDED, decision, reasonCode } });
      // A document decision is deliberately not an Individual KYC profile approval.
      return { documentId, manualReviewStatus, decision, recordedAt: new Date().toISOString(), customerIdentityApproved: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
  }

  async startReview(principal: AuthPrincipal | null | undefined, documentId: string) {
    const actor = await this.requireStaff(principal);
    this.requireDocumentId(documentId);
    if (!await this.authorizer.authorizeDocument(actor, documentId)) throw new ForbiddenException();
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.individualKycDocument.findFirst({ where: { id: documentId, status: IndividualKycDocumentStatus.UNDER_REVIEW, manualReviewStatus: ManualDocumentReviewStatus.UNDER_REVIEW }, select: { id: true } });
      if (!document) throw new NotFoundException();
      const sequence = await this.nextSequence(tx, document.id);
      await tx.individualKycDocumentReviewEvent.create({ data: { documentId: document.id, actorUserId: actor.userId, sequence, action: IndividualKycDocumentReviewAction.REVIEW_STARTED } });
      return { documentId, status: 'UNDER_REVIEW' as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
  }

  private async appendEvent(documentId: string, actorUserId: string, action: IndividualKycDocumentReviewAction) {
    return this.prisma.$transaction(async (tx) => {
      const sequence = await this.nextSequence(tx, documentId);
      await tx.individualKycDocumentReviewEvent.create({ data: { documentId, actorUserId, sequence, action } });
    });
  }

  private async nextSequence(tx: Prisma.TransactionClient, documentId: string): Promise<number> {
    const latest = await tx.individualKycDocumentReviewEvent.findFirst({ where: { documentId }, orderBy: { sequence: 'desc' }, select: { sequence: true } });
    return (latest?.sequence ?? 0) + 1;
  }

  private async requireStaff(principal: AuthPrincipal | null | undefined): Promise<AuthPrincipal> {
    if (!principal || !UUID.test(principal.userId) || !principal.sessionId || (principal.role !== UserRole.STAFF && principal.role !== UserRole.ADMIN)) throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({ where: { id: principal.userId }, select: { id: true, role: true, emailVerifiedAt: true } });
    if (!user || user.role !== principal.role || !user.emailVerifiedAt) throw new ForbiddenException();
    return principal;
  }

  private requireDocumentId(documentId: string): void { if (!UUID.test(documentId)) throw new NotFoundException(); }
}
