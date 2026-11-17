import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IndividualKycModule } from '../individual-kyc/individual-kyc.module';
import { DisabledDocumentMalwareScanner, DOCUMENT_MALWARE_SCANNER, PRIVATE_DOCUMENT_STORAGE } from './document-infrastructure.ports';
import { VerificationDocumentController, VerificationDocumentReviewController } from './verification-document.controller';
import { VERIFICATION_DOCUMENT_REVIEW_AUTHORIZER, DenyAllVerificationDocumentReviewAuthorizer } from './verification-document-review-authorizer';
import { VersionedS3PrivateDocumentStorage } from './verification-document-s3-adapter';
import { VerificationDocumentService } from './verification-document.service';

/** Authenticated routes use the approved private versioned-S3 port; storage and staff grants fail closed until configured. */
@Module({
  imports: [AuthModule, IndividualKycModule],
  controllers: [VerificationDocumentController, VerificationDocumentReviewController],
  providers: [
    VerificationDocumentService,
    DisabledDocumentMalwareScanner,
    VersionedS3PrivateDocumentStorage,
    DenyAllVerificationDocumentReviewAuthorizer,
    { provide: PRIVATE_DOCUMENT_STORAGE, useExisting: VersionedS3PrivateDocumentStorage },
    { provide: DOCUMENT_MALWARE_SCANNER, useExisting: DisabledDocumentMalwareScanner },
    { provide: VERIFICATION_DOCUMENT_REVIEW_AUTHORIZER, useExisting: DenyAllVerificationDocumentReviewAuthorizer },
  ],
  exports: [VerificationDocumentService],
})
export class VerificationDocumentsModule {}
