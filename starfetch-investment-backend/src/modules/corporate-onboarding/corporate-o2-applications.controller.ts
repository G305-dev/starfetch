import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { KeyedRateLimit } from '../../common/rate-limit/keyed-rate-limit.decorator';
import { KeyedRateLimitGuard } from '../../common/rate-limit/keyed-rate-limit.guard';
import { CookieMutationGuard } from '../../common/security/cookie-mutation.guard';
import { AuthenticatedRequest } from '../../common/types/auth-principal';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CorporateApplicantGuard } from './guards/corporate-applicant.guard';
import { CorporateO2ActivationGuard } from './services/corporate-o2-availability.service';
import { CorporateO2CreateApplicationDto } from './dto/corporate-o2-create-application.input';
import { CorporateO2DraftService } from './services/corporate-o2-draft.service';

@Controller('corporate-accounts/applications')
export class CorporateO2ApplicationsController {
  constructor(private readonly drafts: CorporateO2DraftService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @KeyedRateLimit({
    bucket: 'corporate-o2-create',
    limit: 5,
    windowSeconds: 3600,
    identity: 'user',
  })
  @UseGuards(
    CorporateO2ActivationGuard,
    AccessTokenGuard,
    CorporateApplicantGuard,
    CookieMutationGuard,
    KeyedRateLimitGuard,
  )
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: CorporateO2CreateApplicationDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.drafts.createDraft(request.principal, body, idempotencyKey);
  }
}
