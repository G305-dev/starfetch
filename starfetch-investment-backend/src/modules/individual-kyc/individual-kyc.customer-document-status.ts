import { IndividualKycDocumentStatus, ManualDocumentReviewStatus } from '@prisma/client';

/** Public projection hides legacy scan-gated states without implying a scan occurred. */
export function customerDocumentStatus(status: IndividualKycDocumentStatus, review: ManualDocumentReviewStatus, uploadedAt: Date | null): IndividualKycDocumentStatus {
  if (status === IndividualKycDocumentStatus.PENDING_SCAN) return IndividualKycDocumentStatus.UNDER_REVIEW;
  if (status === IndividualKycDocumentStatus.UNDER_REVIEW && (review === ManualDocumentReviewStatus.ACCEPTED || review === ManualDocumentReviewStatus.REJECTED)) return IndividualKycDocumentStatus.UPLOADED;
  if (status === IndividualKycDocumentStatus.UPLOADED && review === ManualDocumentReviewStatus.NOT_REVIEWED && uploadedAt) return IndividualKycDocumentStatus.UNDER_REVIEW;
  return status;
}

export function customerReviewStatus(status: IndividualKycDocumentStatus, review: ManualDocumentReviewStatus, uploadedAt: Date | null): ManualDocumentReviewStatus {
  if (review === ManualDocumentReviewStatus.NOT_REVIEWED && uploadedAt &&
    (status === IndividualKycDocumentStatus.PENDING_SCAN || status === IndividualKycDocumentStatus.UPLOADED || status === IndividualKycDocumentStatus.UNDER_REVIEW)) {
    return ManualDocumentReviewStatus.UNDER_REVIEW;
  }
  return review;
}
