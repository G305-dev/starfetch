import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CookieMutationGuard } from '../../common/security/cookie-mutation.guard';
import { KeyedRateLimit } from '../../common/rate-limit/keyed-rate-limit.decorator';
import { KeyedRateLimitGuard } from '../../common/rate-limit/keyed-rate-limit.guard';
import { AuthenticatedRequest } from '../../common/types/auth-principal';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { ApplicationVerificationSnapshotFreshnessService } from '../verification-rulesets/services/application-verification-snapshot-freshness.service';
import { ApplicationVerificationSnapshotService } from '../verification-rulesets/services/application-verification-snapshot.service';
import { CorporateApplicantGuard } from './guards/corporate-applicant.guard';
import { CorporateDetailsUpdateDto } from './dto/corporate-details-update.input';
import { CorporateApplicationAccessService } from './services/corporate-application-access.service';
import { CorporateApplicationReadService } from './services/corporate-application-read.service';
import { CorporateApplicantContextService } from './services/corporate-applicant-context.service';
import { CorporateDetailsEditService } from './services/corporate-details-edit.service';

/** Owner-scoped Corporate read and draft mutation endpoints. */
@Controller('corporate-accounts/:corporateAccountId/onboarding')
@UseGuards(AccessTokenGuard, CorporateApplicantGuard)
export class CorporateApplicationReadController {
  constructor(
    private readonly reads: CorporateApplicationReadService,
    private readonly edits: CorporateDetailsEditService,
    private readonly applicants: CorporateApplicantContextService,
    private readonly access: CorporateApplicationAccessService,
    private readonly snapshots: ApplicationVerificationSnapshotService,
    private readonly snapshotFreshness: ApplicationVerificationSnapshotFreshnessService,
  ) {}

  @Get()
  getApplication(
    @Req() request: AuthenticatedRequest,
    @Param('corporateAccountId') corporateAccountId: string,
  ) {
    return this.reads.getApplicationByCorporateAccountId(request.principal, corporateAccountId);
  }

  @Get('history')
  getHistory(
    @Req() request: AuthenticatedRequest,
    @Param('corporateAccountId') corporateAccountId: string,
  ) {
    return this.reads.getHistoryByCorporateAccountId(request.principal, corporateAccountId);
  }

  @Patch('draft')
  @KeyedRateLimit({ bucket: 'corporate-o4-update', limit: 60, windowSeconds: 3600, identity: 'user' })
  @UseGuards(CookieMutationGuard, KeyedRateLimitGuard)
  updateDraft(
    @Req() request: AuthenticatedRequest,
    @Param('corporateAccountId') corporateAccountId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: CorporateDetailsUpdateDto,
  ) {
    return this.edits.updateByCorporateAccountId(
      request.principal,
      corporateAccountId,
      parseIfMatchVersion(ifMatch),
      body,
    );
  }

  @Get('verification-snapshot/freshness')
  async getSnapshotFreshness(
    @Req() request: AuthenticatedRequest,
    @Param('corporateAccountId') corporateAccountId: string,
  ) {
    const applicant = await this.applicants.requireVerifiedInvestor(request.principal);
    const application = await this.access.requireInitiatorOwnedCorporateAccount(applicant, corporateAccountId);
    return this.snapshotFreshness.assess(request.principal, application.id);
  }

  @Post('verification-snapshot')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CookieMutationGuard)
  async regenerateSnapshot(
    @Req() request: AuthenticatedRequest,
    @Param('corporateAccountId') corporateAccountId: string,
  ) {
    const applicant = await this.applicants.requireVerifiedInvestor(request.principal);
    const application = await this.access.requireInitiatorOwnedCorporateAccount(applicant, corporateAccountId);
    return this.snapshots.createOrGetSnapshot(request.principal, application.id);
  }
}

/** Initiator-only discovery. No principals are inferred or granted here. */
@Controller('me/corporate-accounts')
@UseGuards(AccessTokenGuard, CorporateApplicantGuard)
export class CorporateApplicationDiscoveryController {
  constructor(private readonly reads: CorporateApplicationReadService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.reads.listInitiatedApplications(request.principal);
  }
}

function parseIfMatchVersion(value: string | undefined): number {
  if (!value) {
    throw new BadRequestException({
      code: ERROR_CODES.VALIDATION_FAILED,
      message: 'If-Match with the current details version is required.',
    });
  }
  const match = /^"([1-9]\d*)"$/.exec(value.trim());
  if (!match) {
    throw new BadRequestException({
      code: ERROR_CODES.VALIDATION_FAILED,
      message: 'If-Match must contain a quoted positive details version.',
    });
  }
  const version = Number(match[1]);
  if (!Number.isSafeInteger(version)) {
    throw new BadRequestException({
      code: ERROR_CODES.VALIDATION_FAILED,
      message: 'If-Match must contain a valid details version.',
    });
  }
  return version;
}
