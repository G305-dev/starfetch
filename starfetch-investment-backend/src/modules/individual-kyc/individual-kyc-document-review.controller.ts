import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { KeyedRateLimit } from '../../common/rate-limit/keyed-rate-limit.decorator';
import { KeyedRateLimitGuard } from '../../common/rate-limit/keyed-rate-limit.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CookieMutationGuard } from '../../common/security/cookie-mutation.guard';
import { AuthenticatedRequest } from '../../common/types/auth-principal';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { IndividualKycDocumentDecisionDto } from './dto/individual-kyc-document-review.dto';
import { IndividualKycDocumentReviewService } from './individual-kyc-document-review.service';

@Controller('staff/individual-kyc/documents')
@Roles(UserRole.STAFF, UserRole.ADMIN)
@UseGuards(AccessTokenGuard, RolesGuard)
export class IndividualKycDocumentReviewController {
  constructor(private readonly review: IndividualKycDocumentReviewService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) { return this.review.listQueue(req.principal); }

  @Post(':documentId/review')
  @KeyedRateLimit({ bucket: 'individual-kyc-document-review-start', limit: 60, windowSeconds: 3600, identity: 'user' })
  @UseGuards(CookieMutationGuard, KeyedRateLimitGuard)
  start(@Req() req: AuthenticatedRequest, @Param('documentId', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.review.startReview(req.principal, id);
  }

  @Post(':documentId/view-authorization')
  @KeyedRateLimit({ bucket: 'individual-kyc-document-view', limit: 30, windowSeconds: 3600, identity: 'user' })
  @UseGuards(CookieMutationGuard, KeyedRateLimitGuard)
  view(@Req() req: AuthenticatedRequest, @Param('documentId', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.review.authorizeView(req.principal, id);
  }

  @Post(':documentId/decision')
  @KeyedRateLimit({ bucket: 'individual-kyc-document-decision', limit: 30, windowSeconds: 3600, identity: 'user' })
  @UseGuards(CookieMutationGuard, KeyedRateLimitGuard)
  decide(@Req() req: AuthenticatedRequest, @Param('documentId', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: IndividualKycDocumentDecisionDto) {
    return this.review.decide(req.principal, id, dto.decision, dto.reasonCode);
  }
}
