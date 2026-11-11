import { Module } from '@nestjs/common';
import { DisabledDocumentMalwareScanner, DisabledPrivateDocumentStorage, DOCUMENT_MALWARE_SCANNER, PRIVATE_DOCUMENT_STORAGE } from './document-infrastructure.ports';
import { VerificationDocumentService } from './verification-document.service';

/** No endpoints; storage and scanning default to deny until approved infrastructure is configured. */
@Module({
  providers: [
    VerificationDocumentService,
    DisabledPrivateDocumentStorage,
    DisabledDocumentMalwareScanner,
    { provide: PRIVATE_DOCUMENT_STORAGE, useExisting: DisabledPrivateDocumentStorage },
    { provide: DOCUMENT_MALWARE_SCANNER, useExisting: DisabledDocumentMalwareScanner },
  ],
  exports: [VerificationDocumentService],
})
export class VerificationDocumentsModule {}
