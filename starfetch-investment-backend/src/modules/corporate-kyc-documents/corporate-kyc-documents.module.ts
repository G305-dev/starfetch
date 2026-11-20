import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { CorporateOnboardingModule } from '../corporate-onboarding/corporate-onboarding.module';
import { CorporateApplicationSubmissionService } from './corporate-application-submission.service';
import { CORPORATE_KYC_DOCUMENT_STORAGE, createCorporateKycDocumentStorage } from './corporate-kyc-document-storage';
import { CorporateKycDocumentsController } from './corporate-kyc-documents.controller';
import { CorporateKycDocumentsService } from './corporate-kyc-documents.service';

/**
 * Corporate KYC section 5 (three mandatory documents) and applicant submission.
 * A separate module because IndividualKycModule already imports
 * CorporateOnboardingModule; importing storage back into Corporate onboarding
 * would be circular. Storage reuses the existing Individual KYC S3 adapter class,
 * bucket, OIDC role and INDIVIDUAL_KYC_* settings (see
 * corporate-kyc-document-storage.ts); all Corporate authorization is enforced here.
 */
@Module({
  imports: [AuthModule, CorporateOnboardingModule],
  controllers: [CorporateKycDocumentsController],
  providers: [
    CorporateKycDocumentsService,
    CorporateApplicationSubmissionService,
    { provide: CORPORATE_KYC_DOCUMENT_STORAGE, inject: [ConfigService], useFactory: createCorporateKycDocumentStorage },
  ],
  exports: [CorporateKycDocumentsService],
})
export class CorporateKycDocumentsModule {}
