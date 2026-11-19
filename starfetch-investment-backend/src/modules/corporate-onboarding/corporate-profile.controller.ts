import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { KeyedRateLimit } from '../../common/rate-limit/keyed-rate-limit.decorator';
import { KeyedRateLimitGuard } from '../../common/rate-limit/keyed-rate-limit.guard';
import { CookieMutationGuard } from '../../common/security/cookie-mutation.guard';
import { AuthenticatedRequest } from '../../common/types/auth-principal';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CorporateApplicantGuard } from './guards/corporate-applicant.guard';
import {
  CorporateProfileBankDetailsDto,
  CorporateProfileCompanyDetailsDto,
  CorporateProfileInvestmentDto,
  CorporateProfileSourceOfFundsDto,
  LegacyCorporateApplicantProfileDto,
  parseCorporateProfileIfMatch,
} from './dto/corporate-profile.dto';
import { CorporateProfileService } from './services/corporate-profile.service';

@Controller()
export class CorporateProfileController {
  constructor(private readonly profiles: CorporateProfileService) {}

  @Get('corporate-accounts/:corporateAccountId/profile')
  @Roles(UserRole.INVESTOR)
  @KeyedRateLimit({ bucket: 'corporate-profile-read', limit: 60, windowSeconds: 3600, identity: 'user' })
  @UseGuards(AccessTokenGuard, RolesGuard, CorporateApplicantGuard, KeyedRateLimitGuard)
  getProfile(@Req() req: AuthenticatedRequest, @Param('corporateAccountId') id: string) {
    return this.profiles.getByCorporateAccountId(req.principal, id);
  }

  @Patch('corporate-accounts/:corporateAccountId/profile/company-details')
  @Roles(UserRole.INVESTOR)
  @KeyedRateLimit({ bucket: 'corporate-profile-write', limit: 20, windowSeconds: 3600, identity: 'user' })
  @UseGuards(AccessTokenGuard, RolesGuard, CorporateApplicantGuard, CookieMutationGuard, KeyedRateLimitGuard)
  saveCompanyDetails(
    @Req() req: AuthenticatedRequest,
    @Param('corporateAccountId') id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: CorporateProfileCompanyDetailsDto,
  ) {
    const version = parseCorporateProfileIfMatch(ifMatch);
    if (version.detailsVersion === undefined) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Company Details requires both profile and canonical details versions in If-Match.' });
    return this.profiles.saveCompanyDetails(req.principal, id, version.profileVersion, version.detailsVersion, body);
  }

  @Patch('corporate-accounts/:corporateAccountId/profile/investment-profile')
  @Roles(UserRole.INVESTOR)
  @KeyedRateLimit({ bucket: 'corporate-profile-write', limit: 20, windowSeconds: 3600, identity: 'user' })
  @UseGuards(AccessTokenGuard, RolesGuard, CorporateApplicantGuard, CookieMutationGuard, KeyedRateLimitGuard)
  saveInvestmentProfile(
    @Req() req: AuthenticatedRequest,
    @Param('corporateAccountId') id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: CorporateProfileInvestmentDto,
  ) {
    return this.profiles.saveInvestmentProfile(req.principal, id, parseCorporateProfileIfMatch(ifMatch).profileVersion, body);
  }

  @Patch('corporate-accounts/:corporateAccountId/profile/source-of-funds')
  @Roles(UserRole.INVESTOR)
  @KeyedRateLimit({ bucket: 'corporate-profile-write', limit: 20, windowSeconds: 3600, identity: 'user' })
  @UseGuards(AccessTokenGuard, RolesGuard, CorporateApplicantGuard, CookieMutationGuard, KeyedRateLimitGuard)
  saveSourceOfFunds(
    @Req() req: AuthenticatedRequest,
    @Param('corporateAccountId') id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: CorporateProfileSourceOfFundsDto,
  ) {
    return this.profiles.saveSourceOfFunds(req.principal, id, parseCorporateProfileIfMatch(ifMatch).profileVersion, body);
  }

  @Patch('corporate-accounts/:corporateAccountId/profile/bank-details')
  @Roles(UserRole.INVESTOR)
  @KeyedRateLimit({ bucket: 'corporate-profile-write', limit: 20, windowSeconds: 3600, identity: 'user' })
  @UseGuards(AccessTokenGuard, RolesGuard, CorporateApplicantGuard, CookieMutationGuard, KeyedRateLimitGuard)
  saveBankDetails(
    @Req() req: AuthenticatedRequest,
    @Param('corporateAccountId') id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: CorporateProfileBankDetailsDto,
  ) {
    return this.profiles.saveBankDetails(req.principal, id, parseCorporateProfileIfMatch(ifMatch).profileVersion, body);
  }

  /** Owner-safe, one-time completion of absent legacy signup display fields. */
  @Patch('me/corporate-applicant-profile')
  @Roles(UserRole.INVESTOR)
  @KeyedRateLimit({ bucket: 'corporate-applicant-profile-write', limit: 5, windowSeconds: 3600, identity: 'user' })
  @UseGuards(AccessTokenGuard, RolesGuard, CorporateApplicantGuard, CookieMutationGuard, KeyedRateLimitGuard)
  completeLegacyIdentity(@Req() req: AuthenticatedRequest, @Body() body: LegacyCorporateApplicantProfileDto) {
    return this.profiles.completeLegacyApplicantProfile(req.principal, body);
  }
}
