-- Additive migration dated 2026-11-16 as explicitly requested. Existing migration
-- directories are untouched and remain in their original order. Prepared only;
-- this migration has NOT been applied to any database.

CREATE TYPE "ManualDocumentReviewStatus" AS ENUM ('NOT_REVIEWED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED');
CREATE TYPE "ManualDocumentReviewDecision" AS ENUM ('ACCEPT', 'REJECT');
CREATE TYPE "IndividualKycDocumentReviewAction" AS ENUM ('METADATA_LISTED', 'VIEW_AUTHORIZATION_ISSUED', 'REVIEW_STARTED', 'DECISION_RECORDED');

ALTER TYPE "IndividualKycDocumentStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "IndividualKycProfileEventKind" ADD VALUE 'ID_DOCUMENT_UPLOADED';
ALTER TYPE "VerificationDocumentEventKind" ADD VALUE 'UPLOAD_INTENT_CREATED';
ALTER TYPE "VerificationDocumentEventKind" ADD VALUE 'UPLOADED';
ALTER TYPE "VerificationDocumentEventKind" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "VerificationDocumentEventKind" ADD VALUE 'REVIEW_ACCEPTED';
ALTER TYPE "VerificationDocumentEventKind" ADD VALUE 'REVIEW_REJECTED';
ALTER TYPE "VerificationDocumentEventKind" ADD VALUE 'VIEW_AUTHORIZATION_ISSUED';
ALTER TYPE "VerificationDocumentEventKind" ADD VALUE 'METADATA_LISTED';
ALTER TYPE "VerificationDocumentEventKind" ADD VALUE 'RETENTION_DELETED';

ALTER TABLE "individual_kyc_documents"
  ADD COLUMN "manualReviewStatus" "ManualDocumentReviewStatus" NOT NULL DEFAULT 'NOT_REVIEWED';

CREATE INDEX "individual_kyc_documents_manualReviewStatus_uploadedAt_idx"
  ON "individual_kyc_documents"("manualReviewStatus", "uploadedAt");
CREATE INDEX "individual_kyc_documents_investorUserId_status_manualReview_idx"
  ON "individual_kyc_documents"("investorUserId", "status", "manualReviewStatus");

CREATE TABLE "individual_kyc_document_review_events" (
  "id" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "action" "IndividualKycDocumentReviewAction" NOT NULL,
  "decision" "ManualDocumentReviewDecision",
  "reasonCode" VARCHAR(80),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "individual_kyc_document_review_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "individual_kyc_document_review_events_documentId_sequence_key"
  ON "individual_kyc_document_review_events"("documentId", "sequence");
CREATE INDEX "individual_kyc_document_review_events_documentId_occurredAt_idx"
  ON "individual_kyc_document_review_events"("documentId", "occurredAt");
CREATE INDEX "individual_kyc_document_review_events_actorUserId_occurredA_idx"
  ON "individual_kyc_document_review_events"("actorUserId", "occurredAt");
ALTER TABLE "individual_kyc_document_review_events"
  ADD CONSTRAINT "individual_kyc_document_review_events_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "individual_kyc_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "individual_kyc_document_review_events"
  ADD CONSTRAINT "individual_kyc_document_review_events_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "verification_documents"
  ADD COLUMN "storageObjectVersionId" VARCHAR(256),
  ADD COLUMN "uploadExpiresAt" TIMESTAMP(3),
  ADD COLUMN "uploadedAt" TIMESTAMP(3),
  ADD COLUMN "retentionExpiresAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "manualReviewStatus" "ManualDocumentReviewStatus" NOT NULL DEFAULT 'NOT_REVIEWED';
CREATE INDEX "verification_documents_manualReviewStatus_createdAt_idx"
  ON "verification_documents"("manualReviewStatus", "createdAt");
CREATE INDEX "verification_documents_deletedAt_retentionExpiresAt_idx"
  ON "verification_documents"("deletedAt", "retentionExpiresAt");

ALTER TABLE "verification_document_events"
  ADD COLUMN "decision" "ManualDocumentReviewDecision";
