import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KMSClient } from '@aws-sdk/client-kms';
import { AuthModule } from '../auth/auth.module';
import { VerificationRulesetsModule } from '../verification-rulesets/verification-rulesets.module';
import { MonoVerificationModule } from '../verification-providers/mono/mono-verification.module';
import {
  ConfigCorporateDraftFingerprintKeyProvider,
  CORPORATE_DRAFT_FINGERPRINT_KEY_PROVIDER,
  CorporateDraftPayloadFingerprinter,
} from './crypto/corporate-draft-fingerprint';
import {
  AwsKmsCorporateTinEncryptionProvider,
  CORPORATE_TIN_ENCRYPTION_PROVIDER,
} from './crypto/corporate-tin-encryption';
import {
  ConfigCorporateO2HmacKeyring,
  CORPORATE_O2_HMAC_KEYRING,
} from './crypto/corporate-o2-hmac-keyring';
import { CorporateO2ApplicationsController } from './corporate-o2-applications.controller';
import { CorporateApplicationDiscoveryController, CorporateApplicationReadController } from './corporate-application-read.controller';
import { CorporateApplicantGuard } from './guards/corporate-applicant.guard';
import { CorporateApplicantContextService } from './services/corporate-applicant-context.service';
import { CorporateApplicationAccessService } from './services/corporate-application-access.service';
import { CorporateApplicationReadService } from './services/corporate-application-read.service';
import { CorporateDetailsEditService } from './services/corporate-details-edit.service';
import { CorporateDraftBootstrapService } from './services/corporate-draft-bootstrap.service';
import { CorporateO2DraftService } from './services/corporate-o2-draft.service';
import { CorporateO2ActivationGuard, CorporateO2AvailabilityService } from './services/corporate-o2-availability.service';
import { CorporateTinReadService } from './services/corporate-tin-read.service';
import { CorporateStaffReviewService } from './services/corporate-staff-review.service';
import { CorporateInvestmentEligibilityService } from './services/corporate-investment-eligibility.service';
import { CorporateMonoLookupVerificationService } from './services/corporate-mono-lookup-verification.service';
import { CORPORATE_STAFF_REVIEW_AUTHORIZER, DenyAllCorporateStaffReviewAuthorizer } from './services/corporate-staff-review-authorizer';

@Module({
  imports: [AuthModule, VerificationRulesetsModule, MonoVerificationModule],
  controllers: [CorporateO2ApplicationsController, CorporateApplicationReadController, CorporateApplicationDiscoveryController],
  providers: [
    CorporateApplicantContextService,
    CorporateApplicantGuard,
    CorporateApplicationAccessService,
    CorporateApplicationReadService,
    CorporateDetailsEditService,
    CorporateDraftBootstrapService,
    CorporateO2DraftService,
    CorporateO2AvailabilityService,
    CorporateO2ActivationGuard,
    CorporateTinReadService,
    CorporateStaffReviewService,
    CorporateInvestmentEligibilityService,
    CorporateMonoLookupVerificationService,
    DenyAllCorporateStaffReviewAuthorizer,
    { provide: CORPORATE_STAFF_REVIEW_AUTHORIZER, useExisting: DenyAllCorporateStaffReviewAuthorizer },
    CorporateDraftPayloadFingerprinter,
    { provide: CORPORATE_DRAFT_FINGERPRINT_KEY_PROVIDER, useClass: ConfigCorporateDraftFingerprintKeyProvider },
    { provide: CORPORATE_O2_HMAC_KEYRING, useClass: ConfigCorporateO2HmacKeyring },
    { provide: CORPORATE_TIN_ENCRYPTION_PROVIDER, useClass: AwsKmsCorporateTinEncryptionProvider },
    {
      provide: KMSClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new KMSClient({ region: config.get<string>('corporate.o2.awsRegion') }),
    },
  ],
  exports: [
    CorporateApplicantContextService,
    CorporateApplicantGuard,
    CorporateApplicationAccessService,
    CorporateApplicationReadService,
    CorporateDetailsEditService,
    CorporateDraftBootstrapService,
    CorporateO2DraftService,
    CorporateO2AvailabilityService,
    CorporateTinReadService,
    CorporateStaffReviewService,
    CorporateInvestmentEligibilityService,
    CorporateMonoLookupVerificationService,
  ],
})
export class CorporateOnboardingModule {}
