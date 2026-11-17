import { IndividualKycDocumentStatus, ManualDocumentReviewStatus } from '@prisma/client';
import { customerDocumentStatus, customerReviewStatus } from './individual-kyc.customer-document-status';

describe('customer-facing document status projection', () => {
  it('never exposes the legacy PENDING_SCAN status and does not represent a scan as having occurred', () => {
    expect(customerDocumentStatus(IndividualKycDocumentStatus.PENDING_SCAN, ManualDocumentReviewStatus.NOT_REVIEWED, new Date())).toBe(IndividualKycDocumentStatus.UNDER_REVIEW);
    expect(customerReviewStatus(IndividualKycDocumentStatus.PENDING_SCAN, ManualDocumentReviewStatus.NOT_REVIEWED, new Date())).toBe(ManualDocumentReviewStatus.UNDER_REVIEW);
  });
  it('keeps a manually accepted/rejected document distinct from KYC approval', () => {
    expect(customerDocumentStatus(IndividualKycDocumentStatus.UNDER_REVIEW, ManualDocumentReviewStatus.ACCEPTED, new Date())).toBe(IndividualKycDocumentStatus.UPLOADED);
    expect(customerReviewStatus(IndividualKycDocumentStatus.UNDER_REVIEW, ManualDocumentReviewStatus.REJECTED, new Date())).toBe(ManualDocumentReviewStatus.REJECTED);
  });
});
