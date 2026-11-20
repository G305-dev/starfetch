import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CorporateOnboardingModule } from '../corporate-onboarding/corporate-onboarding.module';
import { IndividualKycModule } from '../individual-kyc/individual-kyc.module';
import { CorporateApplicationSubmissionService } from './corporate-application-submission.service';
import { CorporateKycDocumentsController } from './corporate-kyc-documents.controller';
import { CorporateKycDocumentsService } from './corporate-kyc-documents.service';

/**
 * Corporate KYC section 5 (three mandatory documents) and applicant submission.
 * A separate module because IndividualKycModule already imports
 * CorporateOnboardingModule; importing storage back into Corporate onboarding
 * would be circular. Only the private storage *transport* port is reused from
 * IndividualKycModule — all Corporate authorization is enforced here.
 */
@Module({
  imports: [AuthModule, CorporateOnboardingModule, IndividualKycModule],
  controllers: [CorporateKycDocumentsController],
  providers: [CorporateKycDocumentsService, CorporateApplicationSubmissionService],
  exports: [CorporateKycDocumentsService],
})
export class CorporateKycDocumentsModule {}
