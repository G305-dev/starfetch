import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import { KeyedRateLimit } from '../../common/rate-limit/keyed-rate-limit.decorator';
import { KeyedRateLimitGuard } from '../../common/rate-limit/keyed-rate-limit.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CookieMutationGuard } from '../../common/security/cookie-mutation.guard';
import { AuthenticatedRequest } from '../../common/types/auth-principal';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { VerificationDocumentDecisionDto, VerificationDocumentUploadDto } from './verification-document.dto';
import { VerificationDocumentService } from './verification-document.service';

const MAX_BYTES = 25 * 1024 * 1024;

@Controller('verification-documents')
@Roles(UserRole.INVESTOR)
@UseGuards(AccessTokenGuard, RolesGuard)
export class VerificationDocumentController {
  constructor(private readonly documents: VerificationDocumentService) {}

  @Post('upload')
  @KeyedRateLimit({ bucket: 'verification-document-upload', limit: 10, windowSeconds: 3600, identity: 'user' })
  @UseGuards(CookieMutationGuard, KeyedRateLimitGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } }))
  async upload(@Req() req: AuthenticatedRequest, @UploadedFile() file: { buffer: Buffer; size: number; mimetype: string } | undefined, @Body() dto: VerificationDocumentUploadDto) {
    if (!file || !Buffer.isBuffer(file.buffer) || file.size < 1 || file.size > MAX_BYTES) throw new BadRequestException({ code: 'INVALID_DOCUMENT', message: 'Provide one supported document file up to 25 MiB.' });
    try {
      return await this.documents.upload(req.principal, { applicationId: dto.applicationId, requirementId: dto.requirementId, replacesDocumentId: dto.replacesDocumentId, bytes: file.buffer, mediaType: file.mimetype });
    } finally { file.buffer.fill(0); }
  }
}

@Controller('staff/verification-documents')
@Roles(UserRole.STAFF, UserRole.ADMIN)
@UseGuards(AccessTokenGuard, RolesGuard)
export class VerificationDocumentReviewController {
  constructor(private readonly documents: VerificationDocumentService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) { return this.documents.listReviewQueue(req.principal); }

  @Post(':documentId/view-authorization')
  @KeyedRateLimit({ bucket: 'verification-document-view-auth', limit: 30, windowSeconds: 3600, identity: 'user' })
  @UseGuards(CookieMutationGuard, KeyedRateLimitGuard)
  view(@Req() req: AuthenticatedRequest, @Param('documentId', new ParseUUIDPipe({ version: '4' })) id: string) { return this.documents.authorizeReviewView(req.principal, id); }

  @Post(':documentId/decision')
  @KeyedRateLimit({ bucket: 'verification-document-review-decision', limit: 30, windowSeconds: 3600, identity: 'user' })
  @UseGuards(CookieMutationGuard, KeyedRateLimitGuard)
  decide(@Req() req: AuthenticatedRequest, @Param('documentId', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: VerificationDocumentDecisionDto) {
    return this.documents.decideReview(req.principal, id, dto.decision, dto.reasonCode);
  }
}
