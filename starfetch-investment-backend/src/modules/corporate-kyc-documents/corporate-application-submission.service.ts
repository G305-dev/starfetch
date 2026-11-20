import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  CorporateApplicationSubmission,
  CorporateKycDocumentCategory,
  OnboardingApplicationHistoryEvent,
  OnboardingApplicationStatus,
  Prisma,
} from '@prisma/client';
import { createHash } from 'crypto';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { AuthPrincipal } from '../../common/types/auth-principal';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CorporateKycDocumentsService, composeView, isRetryableTransactionError } from './corporate-kyc-documents.service';
import { evaluateCorporateProfileReadiness } from './corporate-profile-readiness';

const IDEMPOTENCY_KEY_MAX_LENGTH = 255;
const IDEMPOTENCY_DOMAIN = 'starfetch:corporate-application-submission:v1';
const CONFLICT = { code: ERROR_CODES.CONFLICT, message: 'The application changed while submitting. Reload and retry.' };
const NOT_FOUND = { code: ERROR_CODES.NOT_FOUND, message: 'Corporate account not found.' };

export interface CorporateSubmissionReceipt {
  submissionId: string;
  applicationId: string;
  corporateAccountId: string;
  /** Actual current lifecycle status (SUBMITTED until staff workflow accepts it). */
  applicationStatus: OnboardingApplicationStatus;
  submittedAt: string;
  profileVersion: number;
  detailsVersion: number;
  documents: Array<{ category: CorporateKycDocumentCategory; documentId: string }>;
  /** True when this response replays an earlier identical submission. */
  idempotentReplay: boolean;
}

export function validateSubmissionIdempotencyKey(key: string | undefined): asserts key is string {
  if (typeof key !== 'string' || key.trim().length < 8 || key.length > IDEMPOTENCY_KEY_MAX_LENGTH || /[\r\n\0]/.test(key)) {
    throw new HttpException(
      { code: ERROR_CODES.VALIDATION_FAILED, message: 'A valid Idempotency-Key header (8-255 characters) is required.' },
      HttpStatus.BAD_REQUEST,
    );
  }
}

/** Domain-separated and bound to the application; the raw key is never stored. */
export function submissionIdempotencyDigest(applicationId: string, userId: string, key: string): string {
  return createHash('sha256').update(`${IDEMPOTENCY_DOMAIN}\n${applicationId}\n${userId}\n${key}`).digest('hex');
}

@Injectable()
export class CorporateApplicationSubmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: CorporateKycDocumentsService,
  ) {}

  async submit(principal: AuthPrincipal | null | undefined, corporateAccountId: string, idempotencyKey: string | undefined): Promise<CorporateSubmissionReceipt> {
    validateSubmissionIdempotencyKey(idempotencyKey);
    const app = await this.documents.authorize(principal, corporateAccountId);
    const digest = submissionIdempotencyDigest(app.id, app.initiatingUserId, idempotencyKey);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string; status: OnboardingApplicationStatus }>>`
          SELECT "id", "status" FROM "onboarding_applications"
          WHERE "id" = ${app.id}::uuid
            AND "kind" = 'CORPORATE'::"OnboardingApplicationKind"
            AND "initiatingUserId" = ${app.initiatingUserId}::uuid
            AND "ownerCorporateAccountId" = ${corporateAccountId}::uuid
          FOR UPDATE
        `;
        const locked = rows[0];
        if (!locked) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);

        const existing = await tx.corporateApplicationSubmission.findUnique({ where: { applicationId: app.id } });
        if (existing) {
          if (existing.idempotencyKeyDigest === digest) return receipt(existing, corporateAccountId, locked.status, true);
          throw new HttpException({
            code: ERROR_CODES.CONFLICT,
            message: 'This application has already been submitted.',
            context: { reason: 'ALREADY_SUBMITTED', submissionId: existing.id, applicationStatus: locked.status },
          }, HttpStatus.CONFLICT);
        }

        const [application, details, profile, current] = await Promise.all([
          tx.onboardingApplication.findUniqueOrThrow({ where: { id: app.id } }),
          tx.corporateOnboardingDetails.findUnique({ where: { applicationId: app.id } }),
          tx.corporateProfile.findUnique({ where: { applicationId: app.id } }),
          tx.corporateKycDocument.findMany({ where: { applicationId: app.id, isCurrent: true } }),
        ]);
        if (!details) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
        const readiness = evaluateCorporateProfileReadiness(profile, details);
        const view = composeView(application, readiness.incompleteSections, current, null);
        if (!view.submission.canSubmit) {
          throw new HttpException({
            code: ERROR_CODES.CONFLICT,
            message: application.status === OnboardingApplicationStatus.DRAFT
              ? 'Complete all profile sections and upload all three required documents before submitting.'
              : 'This application cannot be submitted in its current state.',
            context: { reason: 'SUBMISSION_INCOMPLETE', blockers: view.submission.blockers },
          }, HttpStatus.CONFLICT);
        }
        const byCategory = (category: CorporateKycDocumentCategory) => current.find((d) => d.category === category)!.id;
        const now = new Date();
        const submission = await tx.corporateApplicationSubmission.create({
          data: {
            applicationId: app.id,
            submittedByUserId: app.initiatingUserId,
            idempotencyKeyDigest: digest,
            profileVersion: readiness.profileVersion,
            detailsVersion: readiness.detailsVersion,
            certificateOfIncorporationDocumentId: byCategory(CorporateKycDocumentCategory.CERTIFICATE_OF_INCORPORATION),
            memartDocumentId: byCategory(CorporateKycDocumentCategory.MEMART),
            tinCertificateDocumentId: byCategory(CorporateKycDocumentCategory.TIN_CERTIFICATE),
            submittedAt: now,
          },
        });
        // DRAFT -> SUBMITTED only. Never IN_REVIEW/APPROVED: those require the
        // (currently deny-all) staff-review workflow.
        const moved = await tx.onboardingApplication.updateMany({
          where: { id: app.id, status: OnboardingApplicationStatus.DRAFT },
          data: { status: OnboardingApplicationStatus.SUBMITTED, submittedAt: now, submittedByUserId: app.initiatingUserId },
        });
        if (moved.count !== 1) throw new HttpException(CONFLICT, HttpStatus.CONFLICT);
        await tx.onboardingApplicationHistory.create({
          data: {
            applicationId: app.id,
            event: OnboardingApplicationHistoryEvent.SUBMITTED,
            fromStatus: OnboardingApplicationStatus.DRAFT,
            toStatus: OnboardingApplicationStatus.SUBMITTED,
            actorUserId: app.initiatingUserId,
          },
        });
        return receipt(submission, corporateAccountId, OnboardingApplicationStatus.SUBMITTED, false);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (isRetryableTransactionError(error)) throw new HttpException(CONFLICT, HttpStatus.CONFLICT);
      throw error;
    }
  }
}

function receipt(
  submission: CorporateApplicationSubmission, corporateAccountId: string, status: OnboardingApplicationStatus, replay: boolean,
): CorporateSubmissionReceipt {
  return {
    submissionId: submission.id,
    applicationId: submission.applicationId,
    corporateAccountId,
    applicationStatus: status,
    submittedAt: submission.submittedAt.toISOString(),
    profileVersion: submission.profileVersion,
    detailsVersion: submission.detailsVersion,
    documents: [
      { category: CorporateKycDocumentCategory.CERTIFICATE_OF_INCORPORATION, documentId: submission.certificateOfIncorporationDocumentId },
      { category: CorporateKycDocumentCategory.MEMART, documentId: submission.memartDocumentId },
      { category: CorporateKycDocumentCategory.TIN_CERTIFICATE, documentId: submission.tinCertificateDocumentId },
    ],
    idempotentReplay: replay,
  };
}
