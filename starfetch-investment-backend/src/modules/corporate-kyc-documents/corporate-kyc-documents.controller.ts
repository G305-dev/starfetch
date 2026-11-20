import {
  BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { KeyedRateLimit } from '../../common/rate-limit/keyed-rate-limit.decorator';
import { KeyedRateLimitGuard } from '../../common/rate-limit/keyed-rate-limit.guard';
import { CookieMutationGuard } from '../../common/security/cookie-mutation.guard';
import { AuthenticatedRequest } from '../../common/types/auth-principal';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CorporateApplicantGuard } from '../corporate-onboarding/guards/corporate-applicant.guard';
import { CorporateApplicationSubmissionService } from './corporate-application-submission.service';
import { CORPORATE_KYC_MAX_DOCUMENT_BYTES, isCorporateKycDocumentCategory } from './corporate-kyc-document-requirements';
import { CorporateKycDocumentsService } from './corporate-kyc-documents.service';

interface UploadedMultipartFile { buffer: Buffer; size: number; mimetype: string; originalname: string }

/**
 * Corporate KYC section 5 (documents) and applicant submission.
 * Guards, in order: bearer session -> INVESTOR role -> verified Corporate
 * applicant -> [Origin + signed double-submit CSRF for mutations] -> per-user
 * rate limit. Guards run before the multipart interceptor, so no file bytes
 * are parsed for unauthenticated, unverified or cross-site requests.
 */
@Controller('corporate-accounts/:corporateAccountId')
export class CorporateKycDocumentsController {
  constructor(
    private readonly documents: CorporateKycDocumentsService,
    private readonly submissions: CorporateApplicationSubmissionService,
  ) {}

  @Get('kyc-documents')
  @Roles(UserRole.INVESTOR)
  @KeyedRateLimit({ bucket: 'corporate-kyc-documents-read', limit: 60, windowSeconds: 3600, identity: 'user' })
  @UseGuards(AccessTokenGuard, RolesGuard, CorporateApplicantGuard, KeyedRateLimitGuard)
  getRequirements(@Req() req: AuthenticatedRequest, @Param('corporateAccountId') corporateAccountId: string) {
    return this.documents.getRequirements(req.principal, corporateAccountId);
  }

  @Post('kyc-documents/:category')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.INVESTOR)
  @KeyedRateLimit({ bucket: 'corporate-kyc-document-upload', limit: 20, windowSeconds: 3600, identity: 'user' })
  @UseGuards(AccessTokenGuard, RolesGuard, CorporateApplicantGuard, CookieMutationGuard, KeyedRateLimitGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: CORPORATE_KYC_MAX_DOCUMENT_BYTES, files: 1, fields: 1, parts: 3, fieldSize: 64, fieldNameSize: 32 },
  }))
  async upload(
    @Req() req: AuthenticatedRequest,
    @Param('corporateAccountId') corporateAccountId: string,
    @Param('category') category: string,
    @UploadedFile() file: UploadedMultipartFile | undefined,
    @Body('replacesDocumentId') replacesDocumentId: string | undefined,
  ) {
    try {
      if (!isCorporateKycDocumentCategory(category)) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_FAILED,
          message: 'Unknown document category. Accepted: CERTIFICATE_OF_INCORPORATION, MEMART, TIN_CERTIFICATE.',
        });
      }
      if (!file || !Buffer.isBuffer(file.buffer)) {
        throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: 'Attach exactly one document in the multipart field "file".' });
      }
      return await this.documents.upload(req.principal, corporateAccountId, category, replacesDocumentId || undefined, {
        bytes: file.buffer, declaredContentType: file.mimetype, originalFilename: file.originalname,
      });
    } finally {
      // Best-effort: do not keep document bytes in process memory longer than needed.
      file?.buffer?.fill(0);
    }
  }

  @Post('kyc-documents/:documentId/view-authorization')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.INVESTOR)
  @KeyedRateLimit({ bucket: 'corporate-kyc-document-view', limit: 30, windowSeconds: 3600, identity: 'user' })
  @UseGuards(AccessTokenGuard, RolesGuard, CorporateApplicantGuard, CookieMutationGuard, KeyedRateLimitGuard)
  authorizeView(
    @Req() req: AuthenticatedRequest,
    @Param('corporateAccountId') corporateAccountId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documents.authorizeView(req.principal, corporateAccountId, documentId);
  }

  @Post('submission')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.INVESTOR)
  @KeyedRateLimit({ bucket: 'corporate-application-submit', limit: 10, windowSeconds: 3600, identity: 'user' })
  @UseGuards(AccessTokenGuard, RolesGuard, CorporateApplicantGuard, CookieMutationGuard, KeyedRateLimitGuard)
  submit(
    @Req() req: AuthenticatedRequest,
    @Param('corporateAccountId') corporateAccountId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.submissions.submit(req.principal, corporateAccountId, idempotencyKey);
  }
}
