import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { KeyedRateLimit } from '../../common/rate-limit/keyed-rate-limit.decorator';
import { KeyedRateLimitGuard } from '../../common/rate-limit/keyed-rate-limit.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CookieMutationGuard } from '../../common/security/cookie-mutation.guard';
import { AuthenticatedRequest } from '../../common/types/auth-principal';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import {
  BankDetailsKycSectionDto,
  CompleteIdDocumentDto,
  IdDocumentUploadIntentDto,
  InvestmentProfileKycSectionDto,
  PersonalKycSectionDto,
  SourceOfFundsKycSectionDto,
  SubmitIndividualKycDto,
} from './dto/individual-kyc.dto';
import { IndividualKycGuard } from './individual-kyc.guard';
import { IndividualKycService } from './individual-kyc.service';

@Controller('me/kyc-profile')
@Roles(UserRole.INVESTOR)
@UseGuards(AccessTokenGuard, RolesGuard, IndividualKycGuard)
export class IndividualKycController {
  constructor(private readonly individualKyc: IndividualKycService) {}

  @Get()
  getOwn(@Req() req: AuthenticatedRequest) {
    return this.individualKyc.getOwn(req.principal!.userId);
  }

  @Put('personal')
  @KeyedRateLimit({ bucket: 'individual-kyc-personal-save', limit: 30, windowSeconds: 3600, identity: 'user' })
  @UseGuards(CookieMutationGuard, KeyedRateLimitGuard)
  savePersonal(@Req() req: AuthenticatedRequest, @Body() dto: PersonalKycSectionDto) {
    return this.individualKyc.savePersonal(req.principal!.userId, dto);
  }

  @Put('investment-profile')
  @KeyedRateLimit({ bucket: 'individual-kyc-investment-save', limit: 30, windowSeconds: 3600, identity: 'user' })
  @UseGuards(CookieMutationGuard, KeyedRateLimitGuard)
  saveInvestment(@Req() req: AuthenticatedRequest, @Body() dto: InvestmentProfileKycSectionDto) {
    return this.individualKyc.saveInvestment(req.principal!.userId, dto);
  }

  @Put('source-of-funds')
  @KeyedRateLimit({ bucket: 'individual-kyc-source-save', limit: 30, windowSeconds: 3600, identity: 'user' })
  @UseGuards(CookieMutationGuard, KeyedRateLimitGuard)
  saveSourceOfFunds(@Req() req: AuthenticatedRequest, @Body() dto: SourceOfFundsKycSectionDto) {
    return this.individualKyc.saveSourceOfFunds(req.principal!.userId, dto);
  }

  @Put('bank-details')
  @KeyedRateLimit({ bucket: 'individual-kyc-bank-save', limit: 30, windowSeconds: 3600, identity: 'user' })
  @UseGuards(CookieMutationGuard, KeyedRateLimitGuard)
  saveBankDetails(@Req() req: AuthenticatedRequest, @Body() dto: BankDetailsKycSectionDto) {
    return this.individualKyc.saveBankDetails(req.principal!.userId, dto);
  }

  @Post('id-document/upload-intent')
  @KeyedRateLimit({ bucket: 'individual-kyc-document-intent', limit: 5, windowSeconds: 3600, identity: 'user' })
  @UseGuards(CookieMutationGuard, KeyedRateLimitGuard)
  createUploadIntent(@Req() req: AuthenticatedRequest, @Body() dto: IdDocumentUploadIntentDto) {
    return this.individualKyc.createUploadIntent(req.principal!.userId, dto);
  }

  @Post('id-document/:documentId/complete')
  @KeyedRateLimit({ bucket: 'individual-kyc-document-complete', limit: 10, windowSeconds: 3600, identity: 'user' })
  @UseGuards(CookieMutationGuard, KeyedRateLimitGuard)
  completeDocument(
    @Req() req: AuthenticatedRequest,
    @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string,
    @Body() dto: CompleteIdDocumentDto,
  ) {
    return this.individualKyc.completeDocument(req.principal!.userId, documentId, dto.version);
  }

  @Post('submit')
  @KeyedRateLimit({ bucket: 'individual-kyc-submit', limit: 5, windowSeconds: 3600, identity: 'user' })
  @UseGuards(CookieMutationGuard, KeyedRateLimitGuard)
  submit(@Req() req: AuthenticatedRequest, @Body() dto: SubmitIndividualKycDto) {
    return this.individualKyc.submit(req.principal!.userId, dto.version);
  }
}
