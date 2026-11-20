import { CORPORATE_KYC_DOCUMENT_STORAGE } from './corporate-kyc-document-storage';
import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  CorporateApplicationSubmission,
  CorporateKycDocument,
  CorporateKycDocumentCategory,
  CorporateKycDocumentEventKind,
  CorporateProfileSectionStatus,
  OnboardingApplication,
  OnboardingApplicationStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { AuthPrincipal } from '../../common/types/auth-principal';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CorporateApplicantContextService } from '../corporate-onboarding/services/corporate-applicant-context.service';
import { CorporateApplicationAccessService } from '../corporate-onboarding/services/corporate-application-access.service';
import { IndividualKycDocumentStorage } from '../individual-kyc/individual-kyc-document-ports';
import { verifyCorporateKycContent } from './corporate-kyc-document-content';
import {
  CORPORATE_KYC_ACCEPTED_CONTENT_TYPES,
  CORPORATE_KYC_ACCEPTED_EXTENSIONS,
  CORPORATE_KYC_DOCUMENT_EDITABLE_STATES,
  CORPORATE_KYC_DOCUMENT_REQUIREMENTS,
  CORPORATE_KYC_MAX_DOCUMENT_BYTES,
  CORPORATE_KYC_VIEW_TTL_SECONDS,
  displayFilename,
} from './corporate-kyc-document-requirements';
import { CorporateProfileSectionKey, evaluateCorporateProfileReadiness } from './corporate-profile-readiness';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = { code: ERROR_CODES.NOT_FOUND, message: 'Corporate account not found.' };
const DOCUMENT_NOT_FOUND = { code: ERROR_CODES.NOT_FOUND, message: 'Document not found.' };
const CONFLICT = { code: ERROR_CODES.CONFLICT, message: 'Corporate KYC documents changed. Reload and retry.' };

export type CorporateKycDocumentReviewStatus = 'NOT_SUBMITTED' | 'AWAITING_REVIEW' | 'UNDER_REVIEW' | 'INFORMATION_REQUESTED' | 'REVIEW_COMPLETED';

export interface CorporateKycDocumentView {
  documentId: string;
  version: number;
  contentType: string;
  sizeBytes: number;
  displayFilename: string;
  uploadedAt: string;
  /** No malware scanner is wired for Corporate documents; never reported as clean. */
  scanStatus: 'NOT_SCANNED';
  /** Derived from the application lifecycle; never claims review before staff accept it. */
  reviewStatus: CorporateKycDocumentReviewStatus;
}

export interface CorporateKycRequirementView {
  category: CorporateKycDocumentCategory;
  title: string;
  description: string;
  mandatory: true;
  acceptedContentTypes: readonly string[];
  acceptedExtensions: readonly string[];
  maxSizeBytes: number;
  uploadStatus: 'NOT_UPLOADED' | 'UPLOADED';
  canUpload: boolean;
  canReplace: boolean;
  /** Present when uploads/replacements are blocked. */
  blockedReason: 'APPLICATION_NOT_EDITABLE' | null;
  currentDocument: CorporateKycDocumentView | null;
}

export type CorporateSubmissionBlocker =
  | { kind: 'APPLICATION_STATE'; key: OnboardingApplicationStatus }
  | { kind: 'PROFILE_SECTION'; key: CorporateProfileSectionKey }
  | { kind: 'DOCUMENT'; key: CorporateKycDocumentCategory };

export interface CorporateKycDocumentsView {
  corporateAccountId: string;
  applicationId: string;
  applicationStatus: OnboardingApplicationStatus;
  section: { key: 'kycDocuments'; order: 5; status: CorporateProfileSectionStatus; uploadedCount: number; requiredCount: 3 };
  limits: { acceptedContentTypes: readonly string[]; acceptedExtensions: readonly string[]; maxSizeBytes: number };
  requirements: CorporateKycRequirementView[];
  submission: {
    canSubmit: boolean;
    blockers: CorporateSubmissionBlocker[];
    submissionId: string | null;
    submittedAt: string | null;
  };
}

export interface CorporateKycUploadFile {
  readonly bytes: Buffer;
  readonly declaredContentType: string | undefined;
  readonly originalFilename: string | undefined;
}

export interface CorporateKycViewAuthorizationView {
  documentId: string;
  category: CorporateKycDocumentCategory;
  version: number;
  viewUrl: string;
  expiresAt: string;
  disposition: 'attachment';
}

export function documentReviewStatus(status: OnboardingApplicationStatus): CorporateKycDocumentReviewStatus {
  switch (status) {
    case OnboardingApplicationStatus.DRAFT: return 'NOT_SUBMITTED';
    case OnboardingApplicationStatus.SUBMITTED: return 'AWAITING_REVIEW';
    case OnboardingApplicationStatus.IN_REVIEW: return 'UNDER_REVIEW';
    case OnboardingApplicationStatus.INFO_REQUESTED: return 'INFORMATION_REQUESTED';
    default: return 'REVIEW_COMPLETED';
  }
}

export function isRetryableTransactionError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const pgCode = typeof error.meta?.code === 'string' ? error.meta.code : undefined;
  return ['P2034', 'P2002'].includes(error.code) || ['40001', '40P01'].includes(pgCode ?? '');
}

@Injectable()
export class CorporateKycDocumentsService {
  private readonly logger = new Logger(CorporateKycDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly applicants: CorporateApplicantContextService,
    private readonly access: CorporateApplicationAccessService,
    @Inject(CORPORATE_KYC_DOCUMENT_STORAGE) private readonly storage: IndividualKycDocumentStorage,
  ) {}

  /** Session-derived initiator ownership; unowned or unknown accounts are a uniform 404. */
  async authorize(principal: AuthPrincipal | null | undefined, corporateAccountId: string): Promise<OnboardingApplication> {
    const applicant = await this.applicants.requireVerifiedInvestor(principal);
    if (!UUID_PATTERN.test(corporateAccountId)) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
    return this.access.requireInitiatorOwnedCorporateAccount(applicant, corporateAccountId);
  }

  async getRequirements(principal: AuthPrincipal | null | undefined, corporateAccountId: string): Promise<CorporateKycDocumentsView> {
    const app = await this.authorize(principal, corporateAccountId);
    return this.buildView(this.prisma, app.id);
  }

  async upload(
    principal: AuthPrincipal | null | undefined,
    corporateAccountId: string,
    category: CorporateKycDocumentCategory,
    replacesDocumentId: string | undefined,
    file: CorporateKycUploadFile,
  ): Promise<CorporateKycDocumentsView> {
    const app = await this.authorize(principal, corporateAccountId);
    if (replacesDocumentId !== undefined && !UUID_PATTERN.test(replacesDocumentId)) {
      throw new HttpException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'replacesDocumentId must be a document id.', fields: { replacesDocumentId: 'Invalid document id.' } }, HttpStatus.BAD_REQUEST);
    }
    // Ownership and state are proved before any byte inspection or storage call.
    this.requireEditable(app.status);
    const verified = verifyCorporateKycContent(file.bytes, file.declaredContentType, file.originalFilename);
    // Preflight the replacement expectation so obvious conflicts never reach storage.
    await this.expectReplacementTarget(this.prisma, app.id, category, replacesDocumentId);

    const documentId = randomUUID();
    const objectKey = `onboarding-documents/${documentId}`;
    const versionId = await this.storage.putDocumentObject({
      documentId, objectKey, bytes: file.bytes, contentType: verified.contentType, checksumSha256Hex: verified.checksumSha256Hex,
    });
    try {
      await this.prisma.$transaction(async (tx) => {
        const locked = await this.lockApplication(tx, app.id, corporateAccountId, app.initiatingUserId);
        this.requireEditable(locked.status);
        const previous = await this.expectReplacementTarget(tx, app.id, category, replacesDocumentId);
        const now = new Date();
        if (previous) {
          const superseded = await tx.corporateKycDocument.updateMany({
            where: { id: previous.id, isCurrent: true }, data: { isCurrent: false, supersededAt: now },
          });
          if (superseded.count !== 1) throw new HttpException(CONFLICT, HttpStatus.CONFLICT);
        }
        const version = previous ? previous.version + 1 : 1;
        await tx.corporateKycDocument.create({
          data: {
            id: documentId,
            applicationId: app.id,
            category,
            version,
            replacesDocumentId: previous?.id ?? null,
            storageObjectKey: objectKey,
            storageObjectVersionId: versionId,
            contentType: verified.contentType,
            sizeBytes: verified.sizeBytes,
            checksumSha256: verified.checksumSha256Hex,
            uploadedByUserId: app.initiatingUserId,
            uploadedAt: now,
          },
        });
        await tx.corporateKycDocumentEvent.create({
          data: {
            applicationId: app.id,
            documentId,
            category,
            documentVersion: version,
            eventKind: previous ? CorporateKycDocumentEventKind.REPLACED : CorporateKycDocumentEventKind.UPLOADED,
            actorUserId: app.initiatingUserId,
            previousDocumentId: previous?.id ?? null,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
    } catch (error) {
      // The object version is unreferenced; remove it so no orphan remains.
      await this.storage.deleteObjectVersion(objectKey, versionId).catch(() => {
        this.logger.warn(`Corporate KYC orphan cleanup failed for document ${documentId}; storage lifecycle cleanup required.`);
      });
      if (error instanceof HttpException) throw error;
      if (isRetryableTransactionError(error)) throw new HttpException(CONFLICT, HttpStatus.CONFLICT);
      throw error;
    }
    return this.buildView(this.prisma, app.id);
  }

  async authorizeView(principal: AuthPrincipal | null | undefined, corporateAccountId: string, documentId: string): Promise<CorporateKycViewAuthorizationView> {
    const app = await this.authorize(principal, corporateAccountId);
    if (!UUID_PATTERN.test(documentId)) throw new HttpException(DOCUMENT_NOT_FOUND, HttpStatus.NOT_FOUND);
    // Applicants may view only the current version of their own application's documents.
    const document = await this.prisma.corporateKycDocument.findFirst({ where: { id: documentId, applicationId: app.id, isCurrent: true } });
    if (!document) throw new HttpException(DOCUMENT_NOT_FOUND, HttpStatus.NOT_FOUND);
    const grant = await this.storage.createViewAuthorization({
      objectKey: document.storageObjectKey,
      versionId: document.storageObjectVersionId,
      filename: displayFilename(document.category, document.version, document.contentType),
      expiresInSeconds: CORPORATE_KYC_VIEW_TTL_SECONDS,
    });
    // The signed URL is returned only after the access audit row is durable.
    await this.prisma.corporateKycDocumentEvent.create({
      data: {
        applicationId: app.id, documentId: document.id, category: document.category, documentVersion: document.version,
        eventKind: CorporateKycDocumentEventKind.VIEW_AUTHORIZED, actorUserId: app.initiatingUserId,
      },
    });
    return {
      documentId: document.id,
      category: document.category,
      version: document.version,
      viewUrl: grant.viewUrl,
      expiresAt: grant.expiresAt.toISOString(),
      disposition: 'attachment',
    };
  }

  /** Shared read model; also used by the submission service. */
  async buildView(db: Prisma.TransactionClient | PrismaService, applicationId: string): Promise<CorporateKycDocumentsView> {
    const [application, details, profile, documents, submission] = await Promise.all([
      db.onboardingApplication.findUniqueOrThrow({ where: { id: applicationId } }),
      db.corporateOnboardingDetails.findUnique({ where: { applicationId } }),
      db.corporateProfile.findUnique({ where: { applicationId } }),
      db.corporateKycDocument.findMany({ where: { applicationId, isCurrent: true } }),
      db.corporateApplicationSubmission.findUnique({ where: { applicationId } }),
    ]);
    if (!details) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
    return composeView(application, evaluateCorporateProfileReadiness(profile, details).incompleteSections, documents, submission);
  }

  private requireEditable(status: OnboardingApplicationStatus): void {
    if (!CORPORATE_KYC_DOCUMENT_EDITABLE_STATES.includes(status)) {
      throw new HttpException({ code: ERROR_CODES.CONFLICT, message: 'Documents cannot be changed in the application\'s current state.' }, HttpStatus.CONFLICT);
    }
  }

  /**
   * Replacement is explicit: uploading over an existing current document
   * requires `replacesDocumentId` equal to it, and a first upload must omit it.
   */
  private async expectReplacementTarget(
    db: Prisma.TransactionClient | PrismaService, applicationId: string, category: CorporateKycDocumentCategory, replacesDocumentId: string | undefined,
  ): Promise<CorporateKycDocument | null> {
    const current = await db.corporateKycDocument.findFirst({ where: { applicationId, category, isCurrent: true } });
    if (!current && replacesDocumentId === undefined) return null;
    if (current && replacesDocumentId === current.id) return current;
    throw new HttpException({
      code: ERROR_CODES.CONFLICT,
      message: current
        ? 'A document is already uploaded for this category. Send replacesDocumentId with the current document id to replace it.'
        : 'There is no current document to replace for this category.',
    }, HttpStatus.CONFLICT);
  }

  private async lockApplication(tx: Prisma.TransactionClient, applicationId: string, corporateAccountId: string, initiatingUserId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string; status: OnboardingApplicationStatus }>>`
      SELECT "id", "status"
      FROM "onboarding_applications"
      WHERE "id" = ${applicationId}::uuid
        AND "kind" = 'CORPORATE'::"OnboardingApplicationKind"
        AND "initiatingUserId" = ${initiatingUserId}::uuid
        AND "ownerCorporateAccountId" = ${corporateAccountId}::uuid
      FOR UPDATE
    `;
    if (!rows[0]) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
    return rows[0];
  }
}

export function composeView(
  application: Pick<OnboardingApplication, 'id' | 'status' | 'ownerCorporateAccountId'>,
  incompleteSections: CorporateProfileSectionKey[],
  currentDocuments: CorporateKycDocument[],
  submission: Pick<CorporateApplicationSubmission, 'id' | 'submittedAt'> | null,
): CorporateKycDocumentsView {
  const editable = CORPORATE_KYC_DOCUMENT_EDITABLE_STATES.includes(application.status);
  const reviewStatus = documentReviewStatus(application.status);
  const requirements: CorporateKycRequirementView[] = CORPORATE_KYC_DOCUMENT_REQUIREMENTS.map((definition) => {
    const doc = currentDocuments.find((d) => d.category === definition.category) ?? null;
    return {
      category: definition.category,
      title: definition.title,
      description: definition.description,
      mandatory: true,
      acceptedContentTypes: CORPORATE_KYC_ACCEPTED_CONTENT_TYPES,
      acceptedExtensions: CORPORATE_KYC_ACCEPTED_EXTENSIONS,
      maxSizeBytes: CORPORATE_KYC_MAX_DOCUMENT_BYTES,
      uploadStatus: doc ? 'UPLOADED' : 'NOT_UPLOADED',
      canUpload: editable && !doc,
      canReplace: editable && Boolean(doc),
      blockedReason: editable ? null : 'APPLICATION_NOT_EDITABLE',
      currentDocument: doc ? {
        documentId: doc.id,
        version: doc.version,
        contentType: doc.contentType,
        sizeBytes: doc.sizeBytes,
        displayFilename: displayFilename(doc.category, doc.version, doc.contentType),
        uploadedAt: doc.uploadedAt.toISOString(),
        scanStatus: 'NOT_SCANNED',
        reviewStatus,
      } : null,
    };
  });
  const uploadedCount = requirements.filter((r) => r.uploadStatus === 'UPLOADED').length;
  const blockers: CorporateSubmissionBlocker[] = [];
  if (application.status !== OnboardingApplicationStatus.DRAFT) blockers.push({ kind: 'APPLICATION_STATE', key: application.status });
  for (const key of incompleteSections) blockers.push({ kind: 'PROFILE_SECTION', key });
  for (const r of requirements) if (r.uploadStatus !== 'UPLOADED') blockers.push({ kind: 'DOCUMENT', key: r.category });
  return {
    corporateAccountId: application.ownerCorporateAccountId!,
    applicationId: application.id,
    applicationStatus: application.status,
    section: {
      key: 'kycDocuments',
      order: 5,
      status: uploadedCount === 0 ? CorporateProfileSectionStatus.NOT_STARTED : uploadedCount === 3 ? CorporateProfileSectionStatus.COMPLETE : CorporateProfileSectionStatus.DRAFT,
      uploadedCount,
      requiredCount: 3,
    },
    limits: { acceptedContentTypes: CORPORATE_KYC_ACCEPTED_CONTENT_TYPES, acceptedExtensions: CORPORATE_KYC_ACCEPTED_EXTENSIONS, maxSizeBytes: CORPORATE_KYC_MAX_DOCUMENT_BYTES },
    requirements,
    submission: {
      canSubmit: blockers.length === 0,
      blockers,
      submissionId: submission?.id ?? null,
      submittedAt: submission?.submittedAt.toISOString() ?? null,
    },
  };
}
